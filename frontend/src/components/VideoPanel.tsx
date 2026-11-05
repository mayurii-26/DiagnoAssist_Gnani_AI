"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
    getIceServers,
    verifyRoomAccess,
    markCallActive,
    markCallEnded,
    recordCallSignal,
    subscribeToRoomSignaling,
    broadcastRoomSignal,
    saveConsultationTranscript,
    generateClinicalReport,
    type RoomSignal,
    type ClinicalReport,
} from "@/lib/consultationService";
import ClinicalReportModal from "@/components/ClinicalReportModal";

export interface DialogueEntry {
    id: string;
    speaker: string;
    role: "doctor" | "patient" | "system";
    text: string;
    time: string;
}

type STTLanguage = "en-IN" | "hi-IN" | "mr-IN";

const STT_LANGUAGES: { code: STTLanguage; label: string }[] = [
    { code: "en-IN", label: "English (IN)" },
    { code: "hi-IN", label: "Hindi (IN)" },
    { code: "mr-IN", label: "Marathi (IN)" },
];

interface VideoPanelProps {
    roomId?: string;
    currentUserRole?: "doctor" | "patient";
    currentUserName?: string;
    peerName?: string;
    onCallEnd?: () => void;
    onTranscriptUpdate?: (transcript: string) => void;
}

/**
 * Creates a synthetic clinical canvas stream ONLY when the developer explicitly enables dev testing fallback.
 * Strictly labeled as DEV SIMULATION.
 */
function createDevSimulationStream(displayName: string, role: string): MediaStream {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    let frame = 0;

    const draw = () => {
        frame++;
        const grad = ctx.createLinearGradient(0, 0, 640, 480);
        grad.addColorStop(0, role === "doctor" ? "#1E293B" : "#0F172A");
        grad.addColorStop(1, role === "doctor" ? "#0F172A" : "#134E4A");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 640, 480);

        // Warning banner
        ctx.fillStyle = "#F59E0B";
        ctx.fillRect(0, 0, 640, 28);
        ctx.fillStyle = "#000";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("DEV TESTING SIMULATION — PHYSICAL CAMERA DISABLED", 320, 18);

        // Avatar
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.beginPath();
        ctx.arc(320, 200, 60, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(role === "doctor" ? "DR" : "PT", 320, 200);

        ctx.font = "600 18px sans-serif";
        ctx.fillText(displayName, 320, 290);

        // Timestamp
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "12px monospace";
        ctx.textAlign = "right";
        ctx.fillText(new Date().toLocaleTimeString(), 620, 460);
    };

    const intervalId = setInterval(draw, 1000 / 25);
    const stream = canvas.captureStream(25);
    const videoTrack = stream.getVideoTracks()[0];
    const originalStop = videoTrack.stop.bind(videoTrack);
    videoTrack.stop = () => {
        clearInterval(intervalId);
        originalStop();
    };
    return stream;
}

export default function VideoPanel({
    roomId: propRoomId,
    currentUserRole: propRole,
    currentUserName: propUserName,
    peerName: propPeerName,
    onCallEnd,
    onTranscriptUpdate,
}: VideoPanelProps) {
    const { user } = useAuth();
    const effectiveRole = propRole || (user?.user_metadata?.role as "doctor" | "patient") || "patient";
    const effectiveUserName =
        propUserName || user?.user_metadata?.full_name || (effectiveRole === "doctor" ? "Dr. Physician" : "Patient");

    // Offerer Determination: Doctor is impolite (initiator), Patient is polite (yields on glare)
    const isPolite = effectiveRole !== "doctor";

    // Effective Room ID
    const [roomId, setRoomId] = useState<string | null>(propRoomId || null);

    // Call state
    const [connectionStatus, setConnectionStatus] = useState<
        "idle" | "authorizing" | "requesting_media" | "connecting" | "connected" | "disconnected" | "failed" | "ended"
    >("idle");
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);

    // Media states
    const [cameraStatus, setCameraStatus] = useState<"idle" | "active" | "unavailable" | "denied">("idle");
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isSimulatedStream, setIsSimulatedStream] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    // Peer metadata
    const [peerInfo, setPeerInfo] = useState<{ name: string; role: string; reason?: string } | null>(
        propPeerName ? { name: propPeerName, role: effectiveRole === "doctor" ? "patient" : "doctor" } : null
    );
    const [assignedDoctorId, setAssignedDoctorId] = useState<string | null>(null);
    const [assignedPatientId, setAssignedPatientId] = useState<string | null>(null);

    // Live Transcription (Gnani AI) state
    const [sttLanguage, setSttLanguage] = useState<STTLanguage>("en-IN");
    const [isSttActive, setIsSttActive] = useState(false);
    const [sttStatusText, setSttStatusText] = useState("Gnani STT Ready");
    const [dialogueTranscripts, setDialogueTranscripts] = useState<DialogueEntry[]>([]);
    const [showTranscriptDrawer, setShowTranscriptDrawer] = useState(false);
    const [showClosedCaptions, setShowClosedCaptions] = useState(true);
    const [currentSubtitle, setCurrentSubtitle] = useState<{ speaker: string; text: string } | null>(null);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

    // Phase 4: Post-call AI Clinical Report Generation & Review
    const [activeClinicalReport, setActiveClinicalReport] = useState<ClinicalReport | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportGenError, setReportGenError] = useState<string | null>(null);

    const handleGeneratePostCallReport = async () => {
        if (!roomId || !user?.id) return;
        setIsGeneratingReport(true);
        setReportGenError(null);
        try {
            const fullTranscript = dialogueTranscripts
                .map((d) => `[${d.speaker}]: ${d.text}`)
                .join("\n");
            const docId = assignedDoctorId || (effectiveRole === "doctor" ? user.id : "");
            const patId = assignedPatientId || (effectiveRole === "patient" ? user.id : "");

            const res = await generateClinicalReport({
                roomId: roomId,
                doctorId: docId,
                patientId: patId,
                transcript: fullTranscript,
                patientName: peerInfo?.name || "Patient",
                doctorName: effectiveRole === "doctor" ? effectiveUserName : "Doctor",
            });

            if (res.success && res.report) {
                setActiveClinicalReport(res.report);
            } else {
                setReportGenError(res.error || "Failed to generate report");
            }
        } catch (e: any) {
            setReportGenError(e.message || "Error generating report");
        } finally {
            setIsGeneratingReport(false);
        }
    };

    // WebRTC Perfect Negotiation & DOM Refs
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
    const signalingSubRef = useRef<{ channel: any; unsubscribe: () => void } | null>(null);

    // Perfect Negotiation Flags
    const makingOfferRef = useRef<boolean>(false);
    const ignoreOfferRef = useRef<boolean>(false);
    const isSettingRemoteAnswerPendingRef = useRef<boolean>(false);

    // Gnani AI STT AudioContext & WebSocket Refs
    const gnaniWsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    // Timers & Lifecycle Refs
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const subtitleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const activeSessionRoomRef = useRef<string | null>(null);
    const dialogueTranscriptsRef = useRef<DialogueEntry[]>([]);

    useEffect(() => {
        dialogueTranscriptsRef.current = dialogueTranscripts;
        if (onTranscriptUpdate && dialogueTranscripts.length > 0) {
            const formatted = dialogueTranscripts.map((d) => `[${d.speaker}]: ${d.text}`).join("\n");
            onTranscriptUpdate(formatted);
        }
    }, [dialogueTranscripts, onTranscriptUpdate]);

    useEffect(() => {
        if (propRoomId) {
            setRoomId(propRoomId);
        }
    }, [propRoomId]);

    const formatDuration = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // GNANI AI STT STREAMING INTEGRATION (Real Microphone -> FastAPI -> Gnani AI)
    // ─────────────────────────────────────────────────────────────────────────
    const startGnaniTranscription = useCallback((stream: MediaStream, lang: STTLanguage) => {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
            console.warn("[Gnani STT] No audio track available for transcription");
            setSttStatusText("No microphone track");
            return;
        }

        // Close any prior transcription session
        stopGnaniTranscription();

        try {
            const wsUrl = `ws://localhost:8000/ws/transcribe?lang=${lang}`;
            const ws = new WebSocket(wsUrl);
            gnaniWsRef.current = ws;

            ws.onopen = () => {
                console.log(`[Gnani STT] Connected to backend proxy (${wsUrl})`);
                setIsSttActive(true);
                setSttStatusText(`Listening (${lang})`);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "connected") {
                        setSttStatusText(`Listening (${lang})`);
                    } else if (data.type === "speech_start") {
                        setSttStatusText("Speech detected...");
                    } else if (data.type === "processing") {
                        setSttStatusText("Transcribing...");
                    } else if (data.type === "transcript" && data.transcript) {
                        const recognizedText = data.transcript.trim();
                        if (!recognizedText) return;

                        const newEntry: DialogueEntry = {
                            id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                            speaker: effectiveUserName,
                            role: effectiveRole,
                            text: recognizedText,
                            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        };

                        setDialogueTranscripts((prev) => [...prev, newEntry]);
                        setCurrentSubtitle({ speaker: effectiveUserName, text: recognizedText });

                        if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
                        subtitleTimerRef.current = setTimeout(() => setCurrentSubtitle(null), 6000);

                        // Broadcast to remote peer via Supabase Realtime
                        if (roomId) {
                            broadcastRoomSignal(roomId, {
                                type: "live_transcript",
                                sender_id: user?.id || "anon",
                                sender_role: effectiveRole,
                                speaker_name: effectiveUserName,
                                transcript: recognizedText,
                                is_final: true,
                                timestamp: new Date().toISOString(),
                            });
                        }
                    } else if (data.type === "error") {
                        console.warn("[Gnani STT] Server error:", data.message);
                        setSttStatusText("STT Error");
                    }
                } catch (parseErr) {
                    console.error("[Gnani STT] Error parsing WS event:", parseErr);
                }
            };

            ws.onerror = () => {
                setSttStatusText("Backend offline (FastAPI port 8000)");
                setIsSttActive(false);
            };

            ws.onclose = () => {
                setIsSttActive(false);
                setSttStatusText("STT Disconnected");
            };

            // Setup Web Audio API for 16 kHz Mono PCM
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = audioCtx;

            const source = audioCtx.createMediaStreamSource(stream);
            audioSourceRef.current = source;

            // ScriptProcessorNode for 16-bit PCM chunking (512 samples = 32ms)
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            audioProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (ws.readyState === WebSocket.OPEN) {
                    const input = e.inputBuffer.getChannelData(0);
                    // Convert Float32Array to 16-bit PCM signed LE
                    const buffer = new ArrayBuffer(input.length * 2);
                    const view = new DataView(buffer);
                    let offset = 0;
                    for (let i = 0; i < input.length; i++, offset += 2) {
                        const s = Math.max(-1, Math.min(1, input[i]));
                        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
                    }
                    ws.send(buffer);
                }
            };

            source.connect(processor);
            processor.connect(audioCtx.destination);
        } catch (sttErr) {
            console.error("[Gnani STT] Initialization error:", sttErr);
            setSttStatusText("AudioContext error");
        }
    }, [effectiveRole, effectiveUserName, roomId, user?.id]);

    const stopGnaniTranscription = () => {
        if (gnaniWsRef.current && gnaniWsRef.current.readyState === WebSocket.OPEN) {
            try {
                gnaniWsRef.current.send(JSON.stringify({ action: "stop" }));
                gnaniWsRef.current.close();
            } catch {}
            gnaniWsRef.current = null;
        }

        if (audioProcessorRef.current) {
            try { audioProcessorRef.current.disconnect(); } catch {}
            audioProcessorRef.current = null;
        }
        if (audioSourceRef.current) {
            try { audioSourceRef.current.disconnect(); } catch {}
            audioSourceRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
            try { audioContextRef.current.close(); } catch {}
            audioContextRef.current = null;
        }
        setIsSttActive(false);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // CLEANUP & TEARDOWN
    // ─────────────────────────────────────────────────────────────────────────
    const cleanupMediaAndPeer = useCallback(() => {
        activeSessionRoomRef.current = null;

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (subtitleTimerRef.current) {
            clearTimeout(subtitleTimerRef.current);
            subtitleTimerRef.current = null;
        }

        stopGnaniTranscription();

        if (signalingSubRef.current) {
            signalingSubRef.current.unsubscribe();
            signalingSubRef.current = null;
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }

        if (pcRef.current) {
            pcRef.current.onnegotiationneeded = null;
            pcRef.current.onicecandidate = null;
            pcRef.current.ontrack = null;
            pcRef.current.onconnectionstatechange = null;
            pcRef.current.close();
            pcRef.current = null;
        }

        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // END CALL HANDLER
    // ─────────────────────────────────────────────────────────────────────────
    const handleEndCall = useCallback(async () => {
        const currentEntries = dialogueTranscriptsRef.current;
        const formattedTranscript = currentEntries.length > 0
            ? currentEntries.map((d) => `[${d.speaker}] (${d.time}): ${d.text}`).join("\n")
            : "No speech dialogue was recorded during this consultation session.";

        if (roomId && user?.id) {
            try {
                await broadcastRoomSignal(roomId, {
                    type: "call_ended",
                    sender_id: user.id,
                    sender_role: effectiveRole,
                    timestamp: new Date().toISOString(),
                });

                await markCallEnded(roomId);
                await recordCallSignal(roomId, user.id, "call_ended", { timestamp: new Date().toISOString() });

                const docId = assignedDoctorId || (effectiveRole === "doctor" ? user.id : undefined);
                const patId = assignedPatientId || (effectiveRole === "patient" ? user.id : undefined);

                if (docId && patId) {
                    setSaveStatus("saving");
                    const res = await saveConsultationTranscript(
                        roomId,
                        docId,
                        patId,
                        formattedTranscript,
                        callDuration
                    );
                    setSaveStatus(res.success ? "saved" : "error");
                }
            } catch (err) {
                console.warn("[Call] Error persisting call termination:", err);
            }
        }

        cleanupMediaAndPeer();
        setConnectionStatus("ended");
        if (onCallEnd) onCallEnd();
    }, [
        roomId,
        user?.id,
        effectiveRole,
        assignedDoctorId,
        assignedPatientId,
        callDuration,
        cleanupMediaAndPeer,
        onCallEnd,
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // TOGGLE MEDIA
    // ─────────────────────────────────────────────────────────────────────────
    const toggleMute = () => {
        if (localStreamRef.current) {
            const nextMuted = !isMuted;
            localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
            setIsMuted(nextMuted);
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const nextOff = !isVideoOff;
            localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !nextOff));
            setIsVideoOff(nextOff);
        }
    };

    // Explicit developer toggle for testing split screen on a single camera machine
    const toggleDevSimulation = () => {
        if (!isSimulatedStream) {
            const sim = createDevSimulationStream(effectiveUserName, effectiveRole);
            const simVideo = sim.getVideoTracks()[0];
            if (localStreamRef.current) {
                // Replace video track
                const currentVideo = localStreamRef.current.getVideoTracks()[0];
                if (currentVideo) {
                    localStreamRef.current.removeTrack(currentVideo);
                    currentVideo.stop();
                }
                localStreamRef.current.addTrack(simVideo);
                if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;

                if (pcRef.current) {
                    const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
                    if (sender) sender.replaceTrack(simVideo);
                }
            }
            setIsSimulatedStream(true);
            setCameraStatus("active");
            setIsVideoOff(false);
            setInfoMessage("DEVELOPMENT SIMULATION ENABLED: Transmitting synthetic feed for split-screen testing.");
        } else {
            // Revert back
            setIsSimulatedStream(false);
            setInfoMessage(null);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // WEBRTC SESSION & PERFECT NEGOTIATION
    // ─────────────────────────────────────────────────────────────────────────
    const startWebRTCSession = useCallback(
        async (targetRoomId: string, userId: string) => {
            if (activeSessionRoomRef.current === targetRoomId && pcRef.current) {
                return; // Prevent duplicate execution
            }
            activeSessionRoomRef.current = targetRoomId;

            setErrorMessage(null);
            setInfoMessage(null);
            setAuthError(null);
            setConnectionStatus("authorizing");

            // 1. Authorization
            const access = await verifyRoomAccess(targetRoomId, userId);
            if (!access.authorized) {
                setIsAuthorized(false);
                setAuthError(access.error || "You are not authorized to join this room.");
                setConnectionStatus("failed");
                return;
            }

            setIsAuthorized(true);
            const peerDisplayName = effectiveRole === "doctor" ? access.patientName : access.doctorName;
            setPeerInfo({
                name: peerDisplayName || (effectiveRole === "doctor" ? "Patient" : "Doctor"),
                role: effectiveRole === "doctor" ? "patient" : "doctor",
                reason: access.reason,
            });
            if (access.doctorId) setAssignedDoctorId(access.doctorId);
            if (access.patientId) setAssignedPatientId(access.patientId);

            // 2. Physical Camera Acquisition
            setConnectionStatus("requesting_media");
            let stream: MediaStream;

            try {
                // Request physical camera and microphone with high-quality constraints
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 },
                        frameRate: { ideal: 30 },
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });
                setCameraStatus("active");
                setIsSimulatedStream(false);
            } catch (mediaErr: any) {
                console.warn("[Media] Full video+audio request failed, checking audio fallback:", mediaErr.name, mediaErr.message);

                let audioTrack: MediaStreamTrack | null = null;
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    audioTrack = audioStream.getAudioTracks()[0] || null;
                } catch (audioErr) {
                    console.warn("[Media] Microphone also inaccessible:", audioErr);
                }

                if (audioTrack) {
                    stream = new MediaStream([audioTrack]);
                } else {
                    stream = new MediaStream();
                }

                if (mediaErr.name === "NotAllowedError" || mediaErr.name === "PermissionDeniedError") {
                    setCameraStatus("denied");
                    setErrorMessage("Camera permission blocked. Click the lock/camera icon in your address bar to allow camera access.");
                } else if (mediaErr.name === "NotFoundError" || mediaErr.name === "DevicesNotFoundError") {
                    setCameraStatus("unavailable");
                    setErrorMessage("No physical camera device detected on this system. Audio-only call active.");
                } else if (mediaErr.name === "NotReadableError" || mediaErr.name === "TrackStartError") {
                    setCameraStatus("unavailable");
                    setErrorMessage("Physical camera is locked by another window or application. Operating in audio-only mode.");
                } else {
                    setCameraStatus("unavailable");
                    setErrorMessage(`Camera unavailable (${mediaErr.name || "Error"}). Audio-only active.`);
                }
                setIsVideoOff(true);
            }

            localStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // Start Gnani STT on the acquired microphone track
            startGnaniTranscription(stream, sttLanguage);

            // 3. Initialize RTCPeerConnection with STUN
            setConnectionStatus("connecting");
            const pc = new RTCPeerConnection({
                iceServers: getIceServers(),
            });
            pcRef.current = pc;

            // Reset Perfect Negotiation flags
            makingOfferRef.current = false;
            ignoreOfferRef.current = false;
            isSettingRemoteAnswerPendingRef.current = false;

            // Add local tracks to peer connection
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            // On remote track arrival: render in remoteVideoRef
            pc.ontrack = (event) => {
                console.log("[WebRTC] Received remote track:", event.track.kind);
                if (remoteVideoRef.current && event.streams[0]) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                    remoteVideoRef.current.play().catch(() => {});
                }
            };

            // Connection state transitions
            pc.onconnectionstatechange = () => {
                const state = pc.connectionState;
                console.log("[WebRTC] Connection state:", state);
                if (state === "connected") {
                    setConnectionStatus("connected");
                    markCallActive(targetRoomId);

                    if (!timerRef.current) {
                        timerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
                    }
                } else if (state === "disconnected") {
                    setConnectionStatus("disconnected");
                } else if (state === "failed") {
                    setConnectionStatus("failed");
                    setErrorMessage("Connection dropped. Attempting ICE restart...");
                    pc.restartIce();
                } else if (state === "closed") {
                    setConnectionStatus("ended");
                }
            };

            // 4. Setup Signaling Channel & Handlers
            const signaling = subscribeToRoomSignaling(targetRoomId, async (signal: RoomSignal) => {
                if (signal.sender_id === userId) return; // Ignore own broadcasts

                try {
                    // LIVE TRANSCRIPT: Received from remote peer
                    if (signal.type === "live_transcript" && signal.transcript) {
                        const speakerName = signal.speaker_name || (signal.sender_role === "doctor" ? "Doctor" : "Patient");
                        const newEntry: DialogueEntry = {
                            id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                            speaker: speakerName,
                            role: signal.sender_role || ("patient" as any),
                            text: signal.transcript,
                            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        };

                        setDialogueTranscripts((prev) => [...prev, newEntry]);
                        setCurrentSubtitle({ speaker: speakerName, text: signal.transcript });

                        if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
                        subtitleTimerRef.current = setTimeout(() => setCurrentSubtitle(null), 6000);
                        return;
                    }

                    // JOIN: Announce peer presence
                    if (signal.type === "join") {
                        console.log("[Signaling] Remote peer joined.");
                        // Doctor (initiator) creates offer if stable
                        if (effectiveRole === "doctor" && pc.signalingState === "stable") {
                            makingOfferRef.current = true;
                            try {
                                const offer = await pc.createOffer();
                                if (pc.signalingState !== "stable") return;
                                await pc.setLocalDescription(offer);
                                await broadcastRoomSignal(signaling.channel, {
                                    type: "offer",
                                    sdp: pc.localDescription ?? undefined,
                                    sender_id: userId,
                                    sender_role: effectiveRole,
                                    timestamp: new Date().toISOString(),
                                });
                                recordCallSignal(targetRoomId, userId, "offer", pc.localDescription);
                            } finally {
                                makingOfferRef.current = false;
                            }
                        }
                        return;
                    }

                    // OFFER: Process incoming offer with Perfect Negotiation glare handling
                    if (signal.type === "offer" && signal.sdp) {
                        const readyForOffer =
                            !makingOfferRef.current &&
                            (pc.signalingState === "stable" || isSettingRemoteAnswerPendingRef.current);
                        const offerCollision = !readyForOffer;
                        ignoreOfferRef.current = !isPolite && offerCollision;

                        if (ignoreOfferRef.current) {
                            console.log("[Signaling] Offer collision: impolite initiator ignoring colliding offer");
                            return;
                        }

                        if (offerCollision) {
                            console.log("[Signaling] Offer collision: polite peer rolling back local offer");
                            await pc.setLocalDescription({ type: "rollback" });
                        }

                        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

                        while (iceCandidatesQueue.current.length > 0) {
                            const cand = iceCandidatesQueue.current.shift();
                            if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
                        }

                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);

                        await broadcastRoomSignal(signaling.channel, {
                            type: "answer",
                            sdp: pc.localDescription ?? undefined,
                            sender_id: userId,
                            sender_role: effectiveRole,
                            timestamp: new Date().toISOString(),
                        });
                        recordCallSignal(targetRoomId, userId, "answer", pc.localDescription);
                        return;
                    }

                    // ANSWER: Process SDP answer only if expecting one (have-local-offer)
                    if (signal.type === "answer" && signal.sdp) {
                        if (pc.signalingState !== "have-local-offer") {
                            console.warn(`[Signaling] Ignoring answer SDP: signalingState is '${pc.signalingState}', expected 'have-local-offer'`);
                            return;
                        }

                        isSettingRemoteAnswerPendingRef.current = true;
                        try {
                            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                            while (iceCandidatesQueue.current.length > 0) {
                                const cand = iceCandidatesQueue.current.shift();
                                if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
                            }
                        } finally {
                            isSettingRemoteAnswerPendingRef.current = false;
                        }
                        return;
                    }

                    // ICE CANDIDATE
                    if (signal.type === "ice_candidate" && signal.candidate) {
                        try {
                            if (pc.remoteDescription && pc.remoteDescription.type) {
                                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                            } else {
                                iceCandidatesQueue.current.push(signal.candidate);
                            }
                        } catch (err) {
                            if (!ignoreOfferRef.current) {
                                console.warn("[Signaling] Error adding remote candidate:", err);
                            }
                        }
                        return;
                    }

                    // CALL ENDED
                    if (signal.type === "call_ended" || signal.type === "peer_left") {
                        console.log("[Signaling] Remote peer ended consultation.");
                        cleanupMediaAndPeer();
                        setConnectionStatus("ended");
                        if (onCallEnd) onCallEnd();
                    }
                } catch (signalErr) {
                    console.error("[Signaling] Error handling message:", signalErr);
                }
            });

            signalingSubRef.current = signaling;

            // Emit local ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    broadcastRoomSignal(signaling.channel, {
                        type: "ice_candidate",
                        candidate: event.candidate.toJSON(),
                        sender_id: userId,
                        sender_role: effectiveRole,
                        timestamp: new Date().toISOString(),
                    });
                }
            };

            // Broadcast join presence
            setTimeout(() => {
                broadcastRoomSignal(signaling.channel, {
                    type: "join",
                    sender_id: userId,
                    sender_role: effectiveRole,
                    timestamp: new Date().toISOString(),
                });
            }, 400);
        },
        [effectiveRole, effectiveUserName, isPolite, sttLanguage, startGnaniTranscription, cleanupMediaAndPeer, onCallEnd]
    );

    // Mount / Room change trigger
    useEffect(() => {
        if (roomId && user?.id) {
            startWebRTCSession(roomId, user.id);
        }

        return () => {
            cleanupMediaAndPeer();
        };
    }, [roomId, user?.id, startWebRTCSession, cleanupMediaAndPeer]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER SCREENS
    // ─────────────────────────────────────────────────────────────────────────

    if (!roomId) {
        return (
            <div className="card" style={{ minHeight: "360px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center", padding: "40px", color: "var(--d-text-muted)" }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 16px", display: "block", opacity: 0.4 }}>
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem", fontWeight: 600 }}>Virtual Video Consultation</h3>
                    <p style={{ margin: 0, fontSize: "0.85rem", maxWidth: "340px" }}>
                        {effectiveRole === "doctor"
                            ? "Accept an incoming consultation request from the queue to start."
                            : "Select a physician from the directory above to initiate your live consultation."}
                    </p>
                </div>
            </div>
        );
    }

    if (isAuthorized === false) {
        return (
            <div className="card" style={{ borderLeft: "5px solid #EF4444", padding: "30px", background: "#FEF2F2" }}>
                <h3 style={{ margin: "0 0 10px 0", color: "#DC2626", fontWeight: 700 }}>Access Denied</h3>
                <p style={{ margin: "0 0 16px 0", color: "#991B1B", fontSize: "0.9rem" }}>{authError}</p>
                <button
                    onClick={() => {
                        setRoomId(null);
                        if (onCallEnd) onCallEnd();
                    }}
                    style={{
                        padding: "8px 16px",
                        borderRadius: "var(--d-radius-sm)",
                        border: "1px solid #DC2626",
                        background: "#FFF",
                        color: "#DC2626",
                        cursor: "pointer",
                        fontWeight: 600,
                    }}
                >
                    Return to Directory
                </button>
            </div>
        );
    }

    if (connectionStatus === "ended") {
        return (
            <div className="card" style={{ padding: "36px 24px", textAlign: "center" }}>
                <div
                    style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "50%",
                        background: "#ECFDF5",
                        color: "#059669",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 16px",
                    }}
                >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                </div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "1.3rem", fontWeight: 700 }}>Consultation Completed</h3>
                <p style={{ margin: "0 0 6px 0", color: "var(--d-text)", fontSize: "0.92rem" }}>
                    Total Session Duration: <strong>{formatDuration(callDuration)}</strong>
                </p>
                <p style={{ margin: "0 0 16px 0", color: "var(--d-text-muted)", fontSize: "0.82rem" }}>
                    Room ID: <code>{roomId}</code>
                </p>

                <div
                    style={{
                        maxWidth: "480px",
                        margin: "0 auto 20px",
                        padding: "10px 14px",
                        borderRadius: "var(--d-radius-sm)",
                        background: saveStatus === "saved" ? "#F0FDF4" : "#F8FAFC",
                        border: `1px solid ${saveStatus === "saved" ? "#BBF7D0" : "var(--d-border)"}`,
                        fontSize: "0.85rem",
                        color: saveStatus === "saved" ? "#166534" : "var(--d-text-muted)",
                    }}
                >
                    {saveStatus === "saved"
                        ? "✓ Verified dialogue transcript saved to EMR records."
                        : saveStatus === "saving"
                        ? "Saving transcript to database..."
                        : "Transcript archived and available in Consultation History."}
                </div>

                {dialogueTranscripts.length > 0 && (
                    <div
                        style={{
                            maxWidth: "600px",
                            margin: "0 auto 24px",
                            textAlign: "left",
                            background: "var(--d-surface)",
                            border: "1px solid var(--d-border)",
                            borderRadius: "var(--d-radius)",
                            padding: "16px",
                            maxHeight: "180px",
                            overflowY: "auto",
                        }}
                    >
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--d-text-muted)", marginBottom: "8px" }}>
                            Conversation Transcript ({dialogueTranscripts.length} dialogue turns)
                        </div>
                        {dialogueTranscripts.map((entry) => (
                            <div key={entry.id} style={{ marginBottom: "6px", fontSize: "0.86rem", lineHeight: "1.4" }}>
                                <strong style={{ color: entry.role === "doctor" ? "#2563EB" : "#0D9488" }}>
                                    {entry.speaker}:
                                </strong>{" "}
                                <span>{entry.text}</span>
                            </div>
                        ))}
                    </div>
                )}

                {reportGenError && (
                    <div style={{ color: "#DC2626", fontSize: "0.85rem", marginBottom: "12px" }}>
                        ⚠️ {reportGenError}
                    </div>
                )}

                <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "12px", flexWrap: "wrap" }}>
                    {effectiveRole === "doctor" && (
                        <button
                            onClick={handleGeneratePostCallReport}
                            disabled={isGeneratingReport}
                            style={{
                                padding: "10px 24px",
                                borderRadius: "var(--d-radius-sm)",
                                border: "none",
                                background: isGeneratingReport ? "#9CA3AF" : "#2563EB",
                                color: "#FFF",
                                fontWeight: 700,
                                cursor: isGeneratingReport ? "not-allowed" : "pointer",
                                fontSize: "0.9rem",
                                boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
                            }}
                        >
                            {isGeneratingReport ? "Analyzing Consultation..." : "⚡ Generate AI Clinical Report"}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setRoomId(null);
                            setConnectionStatus("idle");
                            if (onCallEnd) onCallEnd();
                        }}
                        style={{
                            padding: "10px 24px",
                            borderRadius: "var(--d-radius-sm)",
                            border: "1px solid var(--d-border)",
                            background: "var(--d-surface-alt, #F8FAFC)",
                            color: "var(--d-text)",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: "0.9rem",
                        }}
                    >
                        Return to Directory
                    </button>
                </div>

                {activeClinicalReport && user?.id && (
                    <ClinicalReportModal
                        report={activeClinicalReport}
                        patientName={effectiveRole === "doctor" ? (peerInfo?.name || "Patient") : effectiveUserName}
                        doctorName={effectiveRole === "doctor" ? effectiveUserName : (peerInfo?.name || "Dr. Physician")}
                        currentUserRole={effectiveRole}
                        currentUserId={user.id}
                        onClose={() => setActiveClinicalReport(null)}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div className="card-header" style={{ padding: "14px 20px" }}>
                <div className="card-header-left">
                    <div className="card-header-icon purple">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="23 7 16 12 23 17 23 7" />
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                    </div>
                    <div>
                        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>Live Video Consultation</span>
                            {callDuration > 0 && (
                                <span style={{ fontSize: "0.82rem", color: "var(--d-primary)", fontWeight: 700 }}>
                                    • {formatDuration(callDuration)}
                                </span>
                            )}
                        </div>
                        <div className="card-subtitle">
                            {peerInfo?.name
                                ? `Connected with ${peerInfo.name} (${peerInfo.role})`
                                : "Connecting to clinical room..."}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {/* Camera Status Badge */}
                    <span
                        style={{
                            fontSize: "0.75rem",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            background: cameraStatus === "active" ? (isSimulatedStream ? "#FEF3C7" : "#ECFDF5") : "#FEF2F2",
                            color: cameraStatus === "active" ? (isSimulatedStream ? "#B45309" : "#059669") : "#DC2626",
                            border: `1px solid ${cameraStatus === "active" ? (isSimulatedStream ? "#FDE68A" : "#A7F3D0") : "#FCA5A5"}`,
                            fontWeight: 600,
                        }}
                    >
                        {cameraStatus === "active"
                            ? (isSimulatedStream ? "Dev Simulation" : "HD Camera")
                            : "Camera Unavailable"}
                    </span>

                    {/* Gnani STT Status Badge */}
                    <span
                        style={{
                            fontSize: "0.75rem",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            background: isSttActive ? "#EFF6FF" : "#F3F4F6",
                            color: isSttActive ? "#1D4ED8" : "#6B7280",
                            border: `1px solid ${isSttActive ? "#BFDBFE" : "#E5E7EB"}`,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                        }}
                    >
                        <span
                            style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: isSttActive ? "#2563EB" : "#9CA3AF",
                            }}
                        />
                        {sttStatusText}
                    </span>

                    {/* Connection Status Badge */}
                    <span
                        className={`status-badge ${
                            connectionStatus === "connected"
                                ? "completed"
                                : connectionStatus === "failed"
                                ? "reviewed"
                                : "processing"
                        }`}
                    >
                        {connectionStatus === "connected"
                            ? "Connected (P2P)"
                            : connectionStatus === "connecting"
                            ? "Signaling..."
                            : connectionStatus === "disconnected"
                            ? "Reconnecting..."
                            : connectionStatus.toUpperCase()}
                    </span>
                </div>
            </div>

            {/* Error or Info Banners */}
            {errorMessage && (
                <div
                    style={{
                        background: "#FEF2F2",
                        borderBottom: "1px solid #FCA5A5",
                        color: "#DC2626",
                        padding: "10px 16px",
                        fontSize: "0.85rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <span>{errorMessage}</span>
                    <button
                        onClick={() => setErrorMessage(null)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", fontSize: "1rem" }}
                    >
                        ×
                    </button>
                </div>
            )}

            {infoMessage && (
                <div
                    style={{
                        background: "#FFFBEB",
                        borderBottom: "1px solid #FDE68A",
                        color: "#B45309",
                        padding: "8px 16px",
                        fontSize: "0.82rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <span>{infoMessage}</span>
                    <button
                        onClick={() => setInfoMessage(null)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#B45309", fontSize: "1rem" }}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Video Viewport Container */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    minHeight: "380px",
                    height: "440px",
                    background: "#0F172A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                }}
            >
                {/* Remote Video Stream (Main Viewport) */}
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: connectionStatus === "connected" ? "block" : "none",
                    }}
                />

                {/* Remote Stream Placeholder / Waiting Indicator */}
                {connectionStatus !== "connected" && (
                    <div style={{ textAlign: "center", color: "#94A3B8", padding: "20px" }}>
                        <div
                            style={{
                                width: "64px",
                                height: "64px",
                                borderRadius: "50%",
                                background: "rgba(255, 255, 255, 0.1)",
                                color: "#FFF",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "1.4rem",
                                fontWeight: 700,
                                margin: "0 auto 14px",
                                animation: "pulse 2s infinite",
                            }}
                        >
                            {peerInfo?.name ? peerInfo.name.replace(/^Dr\.\s*/i, "").substring(0, 2).toUpperCase() : "MD"}
                        </div>
                        <h4 style={{ margin: "0 0 6px 0", color: "#FFF", fontSize: "1.05rem" }}>
                            {connectionStatus === "connecting" || connectionStatus === "requesting_media"
                                ? `Connecting with ${peerInfo?.name || "Participant"}...`
                                : connectionStatus === "disconnected"
                                ? "Peer disconnected. Waiting to reconnect..."
                                : "Waiting for participant to connect..."}
                        </h4>
                        <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748B" }}>
                            P2P Encrypted Session • Room: {roomId}
                        </p>
                    </div>
                )}

                {/* Local Camera Picture-in-Picture (PiP) Inset */}
                <div
                    style={{
                        position: "absolute",
                        bottom: "16px",
                        right: "16px",
                        width: "150px",
                        height: "105px",
                        borderRadius: "10px",
                        overflow: "hidden",
                        border: "2px solid rgba(255, 255, 255, 0.3)",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
                        background: "#1E293B",
                        zIndex: 10,
                    }}
                >
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            transform: isSimulatedStream ? "none" : "scaleX(-1)",
                            display: isVideoOff || cameraStatus !== "active" ? "none" : "block",
                        }}
                    />

                    {/* Camera Off or Unavailable Overlay */}
                    {(isVideoOff || cameraStatus !== "active") && (
                        <div
                            style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#94A3B8",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                textAlign: "center",
                                padding: "4px",
                            }}
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: "4px", opacity: 0.7 }}>
                                <line x1="1" y1="1" x2="23" y2="23" />
                                <path d="M21 21l-3.6-3.6" />
                                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6a2 2 0 0 1 2 2v3l4-2.5v7" />
                            </svg>
                            <span>{cameraStatus === "denied" ? "Permission Denied" : isVideoOff ? "Camera Off" : "No Camera"}</span>
                        </div>
                    )}

                    <span
                        style={{
                            position: "absolute",
                            bottom: "4px",
                            left: "6px",
                            fontSize: "0.68rem",
                            color: "#FFF",
                            background: "rgba(0,0,0,0.6)",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            fontWeight: 600,
                        }}
                    >
                        You ({effectiveRole})
                    </span>
                </div>

                {/* Closed Captions Subtitle Overlay */}
                {showClosedCaptions && currentSubtitle && (
                    <div
                        style={{
                            position: "absolute",
                            bottom: "76px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            background: "rgba(15, 23, 42, 0.88)",
                            backdropFilter: "blur(6px)",
                            color: "#FFF",
                            padding: "8px 18px",
                            borderRadius: "20px",
                            maxWidth: "85%",
                            textAlign: "center",
                            fontSize: "0.92rem",
                            lineHeight: "1.4",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                            zIndex: 9,
                            pointerEvents: "none",
                        }}
                    >
                        <strong style={{ color: "#38BDF8", marginRight: "6px" }}>{currentSubtitle.speaker}:</strong>
                        <span>{currentSubtitle.text}</span>
                    </div>
                )}

                {/* Slide-out Live Transcript Drawer */}
                {showTranscriptDrawer && (
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            width: "320px",
                            height: "100%",
                            background: "rgba(15, 23, 42, 0.95)",
                            backdropFilter: "blur(10px)",
                            borderLeft: "1px solid rgba(255, 255, 255, 0.15)",
                            zIndex: 12,
                            display: "flex",
                            flexDirection: "column",
                            color: "#FFF",
                        }}
                    >
                        <div
                            style={{
                                padding: "12px 16px",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Live Gnani AI Transcript ({dialogueTranscripts.length})</span>
                            <button
                                onClick={() => setShowTranscriptDrawer(false)}
                                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: "1.2rem" }}
                            >
                                ×
                            </button>
                        </div>
                        <div style={{ flex: 1, padding: "14px", overflowY: "auto", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "10px" }}>
                            {dialogueTranscripts.length === 0 ? (
                                <p style={{ color: "#94A3B8", textAlign: "center", marginTop: "40px", fontSize: "0.82rem" }}>
                                    Speech spoken into your microphone is transcribed in real-time by Gnani AI.
                                </p>
                            ) : (
                                dialogueTranscripts.map((entry) => (
                                    <div
                                        key={entry.id}
                                        style={{
                                            background: "rgba(255, 255, 255, 0.06)",
                                            padding: "8px 10px",
                                            borderRadius: "6px",
                                            borderLeft: `3px solid ${entry.role === "doctor" ? "#3B82F6" : "#14B8A6"}`,
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "3px" }}>
                                            <strong style={{ color: entry.role === "doctor" ? "#60A5FA" : "#2DD4BF" }}>
                                                {entry.speaker}
                                            </strong>
                                            <span style={{ color: "#64748B" }}>{entry.time}</span>
                                        </div>
                                        <div style={{ color: "#F1F5F9", lineHeight: "1.3" }}>{entry.text}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Floating Media Controls Overlay */}
                <div
                    style={{
                        position: "absolute",
                        bottom: "16px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        background: "rgba(15, 23, 42, 0.82)",
                        backdropFilter: "blur(8px)",
                        padding: "8px 16px",
                        borderRadius: "30px",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                        zIndex: 11,
                    }}
                >
                    {/* Microphone Toggle */}
                    <button
                        onClick={toggleMute}
                        title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                        style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            border: "none",
                            background: isMuted ? "#EF4444" : "rgba(255,255,255,0.15)",
                            color: "#FFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                        }}
                    >
                        {isMuted ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="1" y1="1" x2="23" y2="23" />
                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        )}
                    </button>

                    {/* Camera Toggle */}
                    <button
                        onClick={toggleVideo}
                        title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                        style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            border: "none",
                            background: isVideoOff ? "#EF4444" : "rgba(255,255,255,0.15)",
                            color: "#FFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                        }}
                    >
                        {isVideoOff ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="1" y1="1" x2="23" y2="23" />
                                <path d="M21 21l-3.6-3.6" />
                                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6a2 2 0 0 1 2 2v3l4-2.5v7" />
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="23 7 16 12 23 17 23 7" />
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                        )}
                    </button>

                    {/* Subtitle / Closed Caption Toggle */}
                    <button
                        onClick={() => setShowClosedCaptions(!showClosedCaptions)}
                        title={showClosedCaptions ? "Hide Subtitles" : "Show Subtitles"}
                        style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            border: "none",
                            background: showClosedCaptions ? "#2563EB" : "rgba(255,255,255,0.15)",
                            color: "#FFF",
                            fontWeight: 700,
                            fontSize: "0.78rem",
                            cursor: "pointer",
                        }}
                    >
                        CC
                    </button>

                    {/* Live Transcript Drawer Toggle */}
                    <button
                        onClick={() => setShowTranscriptDrawer(!showTranscriptDrawer)}
                        title="Open Live Dialogue Log"
                        style={{
                            position: "relative",
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            border: "none",
                            background: showTranscriptDrawer ? "#0D9488" : "rgba(255,255,255,0.15)",
                            color: "#FFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        {dialogueTranscripts.length > 0 && (
                            <span
                                style={{
                                    position: "absolute",
                                    top: "-2px",
                                    right: "-2px",
                                    background: "#38BDF8",
                                    color: "#0F172A",
                                    borderRadius: "10px",
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    padding: "1px 5px",
                                }}
                            >
                                {dialogueTranscripts.length}
                            </span>
                        )}
                    </button>

                    {/* Language Selector */}
                    <select
                        value={sttLanguage}
                        onChange={(e) => {
                            const newLang = e.target.value as STTLanguage;
                            setSttLanguage(newLang);
                            if (localStreamRef.current) {
                                startGnaniTranscription(localStreamRef.current, newLang);
                            }
                        }}
                        style={{
                            height: "36px",
                            padding: "0 8px",
                            borderRadius: "18px",
                            background: "rgba(255,255,255,0.15)",
                            color: "#FFF",
                            border: "none",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            outline: "none",
                        }}
                    >
                        {STT_LANGUAGES.map((l) => (
                            <option key={l.code} value={l.code} style={{ background: "#0F172A", color: "#FFF" }}>
                                {l.label}
                            </option>
                        ))}
                    </select>

                    {/* Dev Mode Simulation Toggle (explicit testing only) */}
                    <button
                        onClick={toggleDevSimulation}
                        title="Toggle Synthetic Video (Only for single laptop split-screen testing without second camera)"
                        style={{
                            padding: "0 10px",
                            height: "36px",
                            borderRadius: "18px",
                            border: "1px dashed rgba(255,255,255,0.3)",
                            background: isSimulatedStream ? "#D97706" : "transparent",
                            color: isSimulatedStream ? "#FFF" : "rgba(255,255,255,0.7)",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        {isSimulatedStream ? "Dev Sim Active" : "Dev Sim"}
                    </button>

                    {/* End Call Button */}
                    <button
                        onClick={handleEndCall}
                        title="End Consultation"
                        style={{
                            padding: "0 16px",
                            height: "40px",
                            borderRadius: "20px",
                            border: "none",
                            background: "#DC2626",
                            color: "#FFF",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            cursor: "pointer",
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.28 8.78 7.39 7 12 7c4.61 0 8.72 1.78 11.71 4.67.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                        </svg>
                        End Call
                    </button>
                </div>
            </div>
        </div>
    );
}
