"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
    broadcastRoomSignal,
    subscribeToRoomSignaling,
    saveConsultationTranscript,
    generateClinicalReport,
    getRegisteredPatients,
    type RoomSignal,
    type ClinicalReport,
    type RegisteredPatient,
} from "@/lib/consultationService";
import ClinicalReportModal from "@/components/ClinicalReportModal";

type Language = "en-IN" | "hi-IN" | "mr-IN";
type DiarizationMode = "auto" | "doctor" | "patient";

const LANGUAGES: { code: Language; label: string; native: string }[] = [
    { code: "en-IN", label: "English", native: "English (IN)" },
    { code: "hi-IN", label: "Hindi", native: "हिन्दी (IN)" },
    { code: "mr-IN", label: "Marathi", native: "मराठी (IN)" },
];

export interface VoiceDialogueLine {
    id: string;
    speaker: string;
    role: "doctor" | "patient" | "system";
    text: string;
    time: string;
    detectedMethod?: string;
}

interface VoicePanelProps {
    roomId?: string;
    currentUserRole?: "doctor" | "patient";
    currentUserName?: string;
    doctorId?: string;
    patientId?: string;
    patientName?: string;
    onTranscriptUpdate?: (fullTranscript: string) => void;
    onFinishConsultation?: (report: ClinicalReport) => void;
}

/**
 * Fast Time-Domain Autocorrelation Pitch Detector (F0 Extraction)
 * Analyzes speech frames to measure vocal pitch in the human fundamental frequency range (75Hz - 380Hz).
 */
function detectAcousticPitch(buffer: Float32Array, sampleRate: number): number {
    const size = buffer.length;
    let sum = 0;
    for (let i = 0; i < size; i++) {
        sum += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sum / size);
    if (rms < 0.015) return -1; // Ignore silence or low background noise

    const minLag = Math.floor(sampleRate / 380);
    const maxLag = Math.floor(sampleRate / 75);

    let bestCorr = -1;
    let bestLag = -1;

    for (let lag = minLag; lag < maxLag; lag++) {
        let c = 0;
        for (let i = 0; i < size - lag; i += 2) {
            c += buffer[i] * buffer[i + lag];
        }
        if (c > bestCorr) {
            bestCorr = c;
            bestLag = lag;
        }
    }

    if (bestLag > 0 && bestCorr > sum * 0.35) {
        return Math.round(sampleRate / bestLag);
    }
    return -1;
}

/**
 * Clinical Dialogue Linguistic & Acoustic Classifier (Auto-Diarization Engine)
 * Automatically determines whether an utterance is Doctor or Patient based on:
 * 1. Clinical vocabulary & symptom reporting (English, Hindi, Marathi)
 * 2. Acoustic vocal pitch variance (F0 differences between speakers)
 * 3. Conversational dialogue turn dynamics
 */
function classifyClinicalSpeech(
    text: string,
    medianPitch: number,
    doctorPitch: number | null,
    lastRole: "doctor" | "patient" | null
): { role: "doctor" | "patient"; reason: string } {
    const lower = text.toLowerCase();

    // 1. Doctor Inquiry & Directive Patterns (Questions about symptoms are Doctor speech)
    const doctorInquiries = [
        "did you", "do you", "have you", "how long", "how can i", "how are you", "is there",
        "are you feeling", "any allergy", "any other", "what brings you", "let me examine",
        "open your mouth", "breathe deeply", "paracetamol", "prescribing", "twice a day",
        "three times", "tablet", "tablets", "capsule", "after food", "before food", "blood test",
        // Hindi & Marathi
        "किती दिवस", "औषध", "गोळी", "घ्या", "तपासणी", "काळजी करू नका", "रक्त तपासणी",
        "कितने दिन", "दवाई", "गोली", "खाओ", "चेक करते", "चिंता मत करो"
    ];

    // 2. Patient Self-Reference & Symptom Reporting Patterns
    const patientReporting = [
        "doctor,", "doc,", "i have", "i am having", "i feel", "i'm feeling", "yes, i", "no, i",
        "my head", "my chest", "it hurts", "pain", "fever", "cough", "cold", "nausea", "vomiting",
        "dizzy", "headache", "since yesterday", "since 2 days", "since two days", "severe", "weakness",
        // Hindi & Marathi
        "डॉक्टर", "मला", "त्रास", "दुखत", "ताप", "खोकला", "उलटी", "चक्कर", "वेदना",
        "कालपासून", "दोन दिवसांपासून", "मुझे", "दर्द", "बुखार", "खांसी", "तबीयत", "कमजोरी"
    ];

    let patientScore = 0;
    let doctorScore = 0;

    for (const kw of doctorInquiries) {
        if (lower.includes(kw)) doctorScore += 3.5;
    }
    for (const kw of patientReporting) {
        if (lower.includes(kw)) patientScore += 3.5;
    }

    // 3. Acoustic Pitch Deviation
    let acousticNote = "";
    if (medianPitch > 70 && medianPitch < 400 && doctorPitch && doctorPitch > 70) {
        const pitchDiff = Math.abs(medianPitch - doctorPitch);
        if (pitchDiff > 35) {
            patientScore += 1.8;
            acousticNote = ` (Pitch: ${Math.round(medianPitch)}Hz)`;
        } else if (pitchDiff < 20) {
            doctorScore += 1.8;
            acousticNote = ` (Pitch: ${Math.round(medianPitch)}Hz)`;
        }
    }

    // 4. Conversational Turn Alternation Heuristic
    if (lastRole === "doctor" && (patientScore > 0 || doctorScore === 0)) {
        patientScore += 1.2;
    } else if (lastRole === "patient" && (doctorScore > 0 || patientScore === 0)) {
        doctorScore += 1.2;
    }

    if (patientScore > doctorScore) {
        return { role: "patient", reason: `Auto-AI Detected: Patient${acousticNote}` };
    } else if (doctorScore > patientScore) {
        return { role: "doctor", reason: `Auto-AI Detected: Doctor${acousticNote}` };
    }

    const fallback = lastRole === "doctor" ? "patient" : "doctor";
    return { role: fallback, reason: `Auto-AI Detected: Alternate Turn${acousticNote}` };
}

export default function VoicePanel({
    roomId,
    currentUserRole,
    currentUserName,
    doctorId,
    patientId,
    patientName,
    onTranscriptUpdate,
    onFinishConsultation,
}: VoicePanelProps) {
    const { user } = useAuth();
    const effectiveRole = currentUserRole || (user?.user_metadata?.role as "doctor" | "patient") || "doctor";
    const effectiveName =
        currentUserName || user?.user_metadata?.full_name || (effectiveRole === "doctor" ? "Doctor" : "Patient");

    // ─────────────────────────────────────────────────────────────────────────
    // REGISTERED PATIENT SELECTION
    // ─────────────────────────────────────────────────────────────────────────
    const [registeredPatients, setRegisteredPatients] = useState<RegisteredPatient[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<RegisteredPatient | null>(null);
    const [loadingPatients, setLoadingPatients] = useState(false);
    const [patientSearch, setPatientSearch] = useState("");
    const [showPatientSelector, setShowPatientSelector] = useState(false);

    // Recording and Transcription State
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [language, setLanguage] = useState<Language>("en-IN");
    const [recordingTime, setRecordingTime] = useState(0);
    const [dialogue, setDialogue] = useState<VoiceDialogueLine[]>([]);
    const [interimTranscript, setInterimTranscript] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // ─────────────────────────────────────────────────────────────────────────
    // AUTOMATIC SPEAKER DIARIZATION (Acoustic + AI Semantic)
    // ─────────────────────────────────────────────────────────────────────────
    const [diarizationMode, setDiarizationMode] = useState<DiarizationMode>("auto");
    const [lastAutoTag, setLastAutoTag] = useState<{ role: "doctor" | "patient"; label: string; reason: string } | null>(null);

    // Finish Consultation & Report Generation
    const [isFinishing, setIsFinishing] = useState(false);
    const [generatedReport, setGeneratedReport] = useState<ClinicalReport | null>(null);

    const mediaRecorderRef = useRef<{
        audioContext: AudioContext;
        source: MediaStreamAudioSourceNode;
        processor: ScriptProcessorNode;
        stream: MediaStream;
    } | null>(null);
    const websocketRef = useRef<WebSocket | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const dialogueRef = useRef<VoiceDialogueLine[]>([]);
    const diarizationModeRef = useRef<DiarizationMode>("auto");
    const selectedPatientRef = useRef<RegisteredPatient | null>(null);
    const signalingSubRef = useRef<{ unsubscribe: () => void; channel: any } | null>(null);

    // Acoustic Pitch Buffers
    const recentPitchSamplesRef = useRef<number[]>([]);
    const doctorBaselinePitchRef = useRef<number | null>(null);

    const bars = Array.from({ length: 40 }, (_, i) => i);

    useEffect(() => {
        dialogueRef.current = dialogue;
        if (onTranscriptUpdate && dialogue.length > 0) {
            const compiled = dialogue.map((d) => `[${d.speaker}]: ${d.text}`).join("\n");
            onTranscriptUpdate(compiled);
        }
    }, [dialogue, onTranscriptUpdate]);

    useEffect(() => {
        diarizationModeRef.current = diarizationMode;
    }, [diarizationMode]);

    useEffect(() => {
        selectedPatientRef.current = selectedPatient;
    }, [selectedPatient]);

    // Load registered patients on mount
    useEffect(() => {
        if (effectiveRole === "doctor") {
            setLoadingPatients(true);
            getRegisteredPatients()
                .then((list) => {
                    setRegisteredPatients(list);
                    if (patientId) {
                        const matched = list.find((p) => p.id === patientId);
                        if (matched) {
                            setSelectedPatient(matched);
                        } else if (patientName) {
                            setSelectedPatient({ id: patientId, name: patientName, role: "patient" });
                        }
                    } else if (patientName) {
                        const matchedByName = list.find((p) => p.name.toLowerCase() === patientName.toLowerCase());
                        if (matchedByName) setSelectedPatient(matchedByName);
                    }
                })
                .catch((err) => console.error("Failed to load registered patients:", err))
                .finally(() => setLoadingPatients(false));
        }
    }, [effectiveRole, patientId, patientName]);

    // Timer for recording duration
    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isRecording]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const getLangLabel = (code: Language) => {
        const found = LANGUAGES.find((l) => l.code === code);
        return found ? found.label : code;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // REALTIME ROOM SYNCHRONIZATION
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!roomId) return;

        const sub = subscribeToRoomSignaling(roomId, (signal: RoomSignal) => {
            if (signal.type === "live_transcript" && signal.transcript && signal.sender_id !== user?.id) {
                const incomingSpeaker = signal.speaker_name || (signal.sender_role === "doctor" ? "Doctor" : (selectedPatient?.name || "Patient"));
                const line: VoiceDialogueLine = {
                    id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    speaker: incomingSpeaker,
                    role: signal.sender_role || "patient",
                    text: signal.transcript,
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    detectedMethod: "Remote Peer WebRTC Stream",
                };
                setDialogue((prev) => [...prev, line]);
            }
        });

        signalingSubRef.current = sub;
        return () => {
            sub.unsubscribe();
        };
    }, [roomId, user?.id, selectedPatient?.name]);

    // ─────────────────────────────────────────────────────────────────────────
    // AUTOMATIC SPEAKER RESOLVER
    // ─────────────────────────────────────────────────────────────────────────
    const appendSpokenUtterance = useCallback(
        async (rawText: string) => {
            if (!rawText || !rawText.trim()) return;
            const cleanText = rawText.trim();

            const mode = diarizationModeRef.current;
            const patient = selectedPatientRef.current;
            const patientDisplayName = patient ? patient.name : "Patient";

            let resolvedRole: "doctor" | "patient" = "doctor";
            let resolvedSpeaker = effectiveName;
            let methodLabel = "Manual Tag";

            if (mode === "doctor") {
                resolvedRole = "doctor";
                resolvedSpeaker = effectiveName;
                methodLabel = "Force Doctor";
            } else if (mode === "patient") {
                resolvedRole = "patient";
                resolvedSpeaker = patientDisplayName;
                methodLabel = "Force Patient";
            } else {
                // AUTO-DIARIZATION MODE
                // Compute median pitch of recent utterance
                const pitches = recentPitchSamplesRef.current;
                let medianPitch = -1;
                if (pitches.length > 0) {
                    const sorted = [...pitches].sort((a, b) => a - b);
                    medianPitch = sorted[Math.floor(sorted.length / 2)];
                }

                // If doctor baseline pitch is uncalibrated, calibrate on first turn
                if (!doctorBaselinePitchRef.current && medianPitch > 80 && medianPitch < 350) {
                    doctorBaselinePitchRef.current = medianPitch;
                }

                // Determine previous dialogue turn role
                const prevEntries = dialogueRef.current;
                const lastEntry = prevEntries.length > 0 ? prevEntries[prevEntries.length - 1] : null;
                const lastRole = lastEntry ? (lastEntry.role as "doctor" | "patient") : null;

                const classification = classifyClinicalSpeech(
                    cleanText,
                    medianPitch,
                    doctorBaselinePitchRef.current,
                    lastRole
                );

                resolvedRole = classification.role;
                resolvedSpeaker = resolvedRole === "doctor" ? effectiveName : patientDisplayName;
                methodLabel = classification.reason;
            }

            // Update live auto-tag pill indicator
            setLastAutoTag({
                role: resolvedRole,
                label: resolvedSpeaker,
                reason: methodLabel,
            });

            // Reset pitch buffer for next utterance
            recentPitchSamplesRef.current = [];

            const entry: VoiceDialogueLine = {
                id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                speaker: resolvedSpeaker,
                role: resolvedRole,
                text: cleanText,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                detectedMethod: methodLabel,
            };

            setDialogue((prev) => [...prev, entry]);

            // Broadcast to consultation room if connected
            if (roomId) {
                try {
                    await broadcastRoomSignal(roomId, {
                        type: "live_transcript",
                        sender_id: user?.id || "anonymous",
                        sender_role: resolvedRole,
                        speaker_name: resolvedSpeaker,
                        transcript: cleanText,
                        is_final: true,
                        timestamp: new Date().toISOString(),
                    });
                } catch (broadcastErr) {
                    console.warn("Failed to broadcast live transcript:", broadcastErr);
                }
            }
        },
        [effectiveName, roomId, user?.id]
    );

    // Switch individual line speaker between doctor and patient with 1 click
    const toggleLineSpeaker = (lineId: string) => {
        setDialogue((prev) =>
            prev.map((line) => {
                if (line.id !== lineId) return line;
                const nextRole: "doctor" | "patient" = line.role === "doctor" ? "patient" : "doctor";
                const nextSpeaker = nextRole === "doctor" ? effectiveName : (selectedPatient?.name || "Patient");
                return {
                    ...line,
                    role: nextRole,
                    speaker: nextSpeaker,
                    detectedMethod: "Manual Correction",
                };
            })
        );
    };

    const deleteLine = (lineId: string) => {
        setDialogue((prev) => prev.filter((l) => l.id !== lineId));
    };

    // ─────────────────────────────────────────────────────────────────────────
    // GNANI AI STT STREAMING WEBSOCKET + REAL-TIME PITCH TRACKING
    // ─────────────────────────────────────────────────────────────────────────
    const startRecording = async () => {
        setErrorMessage(null);
        setSuccessMessage(null);

        if (effectiveRole === "doctor" && !selectedPatient && !patientId) {
            setErrorMessage("Please select an existing patient from the database before starting the consultation.");
            setShowPatientSelector(true);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const wsUrl = `ws://localhost:8000/ws/transcribe?lang=${language}`;
            const ws = new WebSocket(wsUrl);
            websocketRef.current = ws;

            ws.onopen = () => {
                console.log(`Gnani STT WebSocket connected (${wsUrl})`);
            };

            ws.onclose = () => {
                console.log("Gnani STT WebSocket closed");
                setIsProcessing(false);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "connected") {
                        setInterimTranscript(`Connected to Gnani STT (${getLangLabel(language)})`);
                    } else if (data.type === "speech_start") {
                        setInterimTranscript("Speech detected · Analyzing vocal acoustic profile...");
                    } else if (data.type === "processing") {
                        setInterimTranscript("Transcribing speech...");
                    } else if (data.type === "transcript") {
                        setInterimTranscript("");
                        appendSpokenUtterance(data.transcript);
                    } else if (data.type === "complete" || data.complete) {
                        setInterimTranscript("");
                        if (data.transcript) {
                            appendSpokenUtterance(data.transcript);
                        }
                        setIsProcessing(false);
                    } else if (data.type === "error") {
                        setErrorMessage(data.message || "Transcription error occurred");
                        setIsProcessing(false);
                    }
                } catch (err) {
                    console.error("Error parsing WebSocket event:", err);
                }
            };

            ws.onerror = (error) => {
                console.error("Gnani STT WebSocket error:", error);
                setErrorMessage("Transcription backend unavailable. Verify FastAPI server is running on port 8000.");
            };

            const audioContext = new AudioContext({ sampleRate: 16000 });
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
                if (ws.readyState === WebSocket.OPEN) {
                    const inputData = e.inputBuffer.getChannelData(0);

                    // Real-time acoustic fundamental frequency analysis
                    const pitch = detectAcousticPitch(inputData, 16000);
                    if (pitch > 70 && pitch < 400) {
                        recentPitchSamplesRef.current.push(pitch);
                        if (recentPitchSamplesRef.current.length > 25) {
                            recentPitchSamplesRef.current.shift();
                        }
                    }

                    const pcmData = floatTo16BitPCM(inputData);
                    ws.send(pcmData);
                }
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            mediaRecorderRef.current = { audioContext, source, processor, stream };

            setIsRecording(true);
            setIsProcessing(false);
            setInterimTranscript("Listening · Auto voice identification active...");
        } catch (error) {
            console.error("Microphone access error:", error);
            setErrorMessage("Microphone access is required. Please check browser permissions.");
        }
    };

    const floatTo16BitPCM = (float32Array: Float32Array) => {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        let offset = 0;

        for (let i = 0; i < float32Array.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        }

        return buffer;
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            const { audioContext, source, processor, stream } = mediaRecorderRef.current;
            processor.disconnect();
            source.disconnect();
            audioContext.close();
            stream.getTracks().forEach((track) => track.stop());
            mediaRecorderRef.current = null;
        }

        setIsRecording(false);

        if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
            setIsProcessing(true);
            setInterimTranscript("Finalizing transcription...");
            websocketRef.current.send(JSON.stringify({ action: "stop" }));

            setTimeout(() => {
                if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
                    websocketRef.current.close();
                }
                setIsProcessing(false);
            }, 3000);
        }
    };

    const handleClick = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // FINISH CONSULTATION & PERSIST FOR REPORT GENERATION
    // ─────────────────────────────────────────────────────────────────────────
    const handleFinishConsultation = async () => {
        if (dialogue.length === 0) {
            setErrorMessage("Cannot finish consultation without any recorded speech dialogue.");
            return;
        }

        const patientObj = selectedPatient || (patientId ? { id: patientId, name: patientName || "Patient", role: "patient" as const } : null);
        if (!patientObj) {
            setErrorMessage("Please select a registered patient before finishing the consultation.");
            setShowPatientSelector(true);
            return;
        }

        if (isRecording) {
            stopRecording();
        }

        setIsFinishing(true);
        setErrorMessage(null);

        try {
            const sessionRoomId = roomId || `voice_consult_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const docId = user?.id || doctorId || "doctor";
            const patId = patientObj.id;

            const compiledTranscript = dialogue
                .map((d) => `[${d.speaker}] (${d.time}): ${d.text}`)
                .join("\n");

            // Persist transcript & video_calls session
            await saveConsultationTranscript(
                sessionRoomId,
                docId,
                patId,
                compiledTranscript,
                recordingTime
            );

            // Generate AI Clinical Report (SOAP notes, ICD-10, Treatment Plan)
            const res = await generateClinicalReport({
                roomId: sessionRoomId,
                doctorId: docId,
                patientId: patId,
                transcript: compiledTranscript,
                patientName: patientObj.name,
                doctorName: effectiveName,
            });

            if (res.success && res.report) {
                setGeneratedReport(res.report);
                setSuccessMessage(`Consultation finished! Clinical EMR report created for ${patientObj.name}. It is now saved in their history and linked to the AI Chatbot.`);
                if (onFinishConsultation) {
                    onFinishConsultation(res.report);
                }
            } else {
                setErrorMessage(res.error || "Transcript saved, but report generation encountered an issue.");
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error finishing consultation";
            setErrorMessage(msg);
        } finally {
            setIsFinishing(false);
        }
    };

    const filteredPatients = registeredPatients.filter((p) =>
        p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
        p.id.toLowerCase().includes(patientSearch.toLowerCase())
    );

    return (
        <div className="card">
            <div className="card-header">
                <div className="card-header-left">
                    <div className="card-header-icon red">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                            <path d="M19 10v2a7 7 0 01-14 0v-2" />
                        </svg>
                    </div>
                    <div>
                        <div className="card-title">Live Voice Consultation</div>
                        <div className="card-subtitle">
                            Auto Voice Diarization &amp; Gnani AI STT {roomId ? `• Room: ${roomId}` : "• Direct Encounter"}
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className={`status-badge ${isRecording ? "processing" : isProcessing ? "processing" : "completed"}`}>
                        {isRecording ? "Recording" : isProcessing ? "Transcribing" : "Ready"}
                    </span>
                </div>
            </div>

            <div className="card-body">
                {/* ─────────────────────────────────────────────────────────────
                    1. PATIENT SELECTION (From registered database)
                   ───────────────────────────────────────────────────────────── */}
                {effectiveRole === "doctor" && (
                    <div style={{ marginBottom: "16px" }}>
                        {!selectedPatient || showPatientSelector ? (
                            <div
                                style={{
                                    padding: "14px 16px",
                                    borderRadius: "var(--d-radius)",
                                    border: "1.5px dashed var(--d-primary)",
                                    background: "#F0FDFA",
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                    <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0F766E" }}>
                                        Select Patient from Registered Database *
                                    </label>
                                    {selectedPatient && (
                                        <button
                                            type="button"
                                            onClick={() => setShowPatientSelector(false)}
                                            style={{
                                                background: "transparent",
                                                border: "none",
                                                color: "var(--d-text-muted)",
                                                cursor: "pointer",
                                                fontSize: "0.78rem",
                                            }}
                                        >
                                            ✕ Close
                                        </button>
                                    )}
                                </div>

                                <input
                                    type="text"
                                    placeholder="Search registered patient by name (e.g. chintu, mayuri)..."
                                    value={patientSearch}
                                    onChange={(e) => setPatientSearch(e.target.value)}
                                    style={{
                                        width: "100%",
                                        padding: "8px 12px",
                                        borderRadius: "var(--d-radius-sm)",
                                        border: "1px solid var(--d-border)",
                                        fontSize: "0.88rem",
                                        marginBottom: "8px",
                                        background: "white",
                                    }}
                                />

                                {loadingPatients ? (
                                    <p style={{ margin: "4px 0", fontSize: "0.8rem", color: "var(--d-text-muted)" }}>
                                        Loading registered patients...
                                    </p>
                                ) : filteredPatients.length === 0 ? (
                                    <p style={{ margin: "4px 0", fontSize: "0.8rem", color: "#DC2626" }}>
                                        No registered patients found matching &quot;{patientSearch}&quot;.
                                    </p>
                                ) : (
                                    <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                                        {filteredPatients.map((pat) => (
                                            <div
                                                key={pat.id}
                                                onClick={() => {
                                                    setSelectedPatient(pat);
                                                    setShowPatientSelector(false);
                                                    setErrorMessage(null);
                                                }}
                                                style={{
                                                    padding: "8px 12px",
                                                    borderRadius: "6px",
                                                    background: selectedPatient?.id === pat.id ? "#CCFBF1" : "white",
                                                    border: "1px solid #E2E8F0",
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    transition: "background 0.15s",
                                                }}
                                                onMouseEnter={(e) => (e.currentTarget.style.background = "#E6FFFA")}
                                                onMouseLeave={(e) => (e.currentTarget.style.background = selectedPatient?.id === pat.id ? "#CCFBF1" : "white")}
                                            >
                                                <div>
                                                    <strong style={{ fontSize: "0.88rem", color: "#0F766E" }}>
                                                        👤 {pat.name}
                                                    </strong>
                                                    <span style={{ fontSize: "0.74rem", color: "#64748B", marginLeft: "8px" }}>
                                                        MRN: {pat.id.substring(0, 8)}...
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: "0.75rem", color: "#0D9488", fontWeight: 600 }}>
                                                    Select →
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: "var(--d-radius)",
                                    border: "1px solid #99F6E4",
                                    background: "#F0FDFA",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: "0.72rem", color: "#0F766E", fontWeight: 700, textTransform: "uppercase" }}>
                                        Active Clinical Patient
                                    </div>
                                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "#134E4A", margin: "2px 0" }}>
                                        👤 {selectedPatient.name}
                                    </div>
                                    <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                                        MRN: {selectedPatient.id} • Verified EMR Account
                                    </div>
                                </div>
                                {!isRecording && (
                                    <button
                                        type="button"
                                        onClick={() => setShowPatientSelector(true)}
                                        style={{
                                            padding: "5px 10px",
                                            borderRadius: "6px",
                                            border: "1px solid #0D9488",
                                            background: "white",
                                            color: "#0F766E",
                                            fontSize: "0.78rem",
                                            fontWeight: 600,
                                            cursor: "pointer",
                                        }}
                                    >
                                        Change Patient
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    2. AUTOMATIC VOICE IDENTIFICATION CONTROLS (HANDS-FREE)
                   ───────────────────────────────────────────────────────────── */}
                <div
                    style={{
                        marginBottom: "14px",
                        padding: "12px 14px",
                        borderRadius: "var(--d-radius)",
                        background: "var(--d-surface-alt)",
                        border: "1px solid var(--d-border)",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "8px" }}>
                        <div>
                            <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--d-text-muted)", textTransform: "uppercase" }}>
                                Voice Identification Mode
                            </div>
                            <div style={{ fontSize: "0.82rem", color: "var(--d-text)" }}>
                                {diarizationMode === "auto" ? (
                                    <span style={{ color: "#059669", fontWeight: 600 }}>
                                        🤖 Automatic Diarization Active · Differentiates voices via acoustic pitch &amp; clinical semantics
                                    </span>
                                ) : (
                                    <span style={{ color: "var(--d-text)", fontWeight: 500 }}>
                                        Manual Lock: Transcribing all speech as <strong>{diarizationMode === "doctor" ? "Doctor" : "Patient"}</strong>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Mode Switcher Buttons */}
                        <div style={{ display: "flex", gap: "6px" }}>
                            <button
                                type="button"
                                onClick={() => setDiarizationMode("auto")}
                                style={{
                                    padding: "6px 14px",
                                    borderRadius: "20px",
                                    border: diarizationMode === "auto" ? "2px solid #059669" : "1px solid var(--d-border)",
                                    background: diarizationMode === "auto" ? "#ECFDF5" : "var(--d-surface)",
                                    color: diarizationMode === "auto" ? "#065F46" : "var(--d-text)",
                                    fontWeight: 700,
                                    fontSize: "0.82rem",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "5px",
                                }}
                            >
                                🤖 Auto Detect (Hands-Free)
                            </button>
                            <button
                                type="button"
                                onClick={() => setDiarizationMode("doctor")}
                                style={{
                                    padding: "6px 12px",
                                    borderRadius: "20px",
                                    border: diarizationMode === "doctor" ? "2px solid #2563EB" : "1px solid var(--d-border)",
                                    background: diarizationMode === "doctor" ? "#EFF6FF" : "var(--d-surface)",
                                    color: diarizationMode === "doctor" ? "#1E40AF" : "var(--d-text-muted)",
                                    fontWeight: 600,
                                    fontSize: "0.78rem",
                                    cursor: "pointer",
                                }}
                            >
                                👨‍⚕️ Lock Doctor
                            </button>
                            <button
                                type="button"
                                onClick={() => setDiarizationMode("patient")}
                                style={{
                                    padding: "6px 12px",
                                    borderRadius: "20px",
                                    border: diarizationMode === "patient" ? "2px solid #0D9488" : "1px solid var(--d-border)",
                                    background: diarizationMode === "patient" ? "#F0FDFA" : "var(--d-surface)",
                                    color: diarizationMode === "patient" ? "#0F766E" : "var(--d-text-muted)",
                                    fontWeight: 600,
                                    fontSize: "0.78rem",
                                    cursor: "pointer",
                                }}
                            >
                                👤 Lock Patient
                            </button>
                        </div>
                    </div>

                    {/* Live Auto-Detection Pill Banner */}
                    {lastAutoTag && (
                        <div
                            style={{
                                marginTop: "6px",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                background: lastAutoTag.role === "doctor" ? "#EFF6FF" : "#F0FDFA",
                                border: `1px solid ${lastAutoTag.role === "doctor" ? "#BFDBFE" : "#99F6E4"}`,
                                fontSize: "0.76rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            <span>✨ Latest Detected:</span>
                            <strong style={{ color: lastAutoTag.role === "doctor" ? "#1E40AF" : "#0F766E" }}>
                                {lastAutoTag.role === "doctor" ? "👨‍⚕️" : "👤"} {lastAutoTag.label}
                            </strong>
                            <span style={{ color: "#64748B" }}>({lastAutoTag.reason})</span>
                        </div>
                    )}
                </div>

                {/* Language Selection Mechanism */}
                <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <label htmlFor="voice-language-select" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--d-text)" }}>
                            Language:
                        </label>
                        <select
                            id="voice-language-select"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value as Language)}
                            disabled={isRecording || isProcessing}
                            style={{
                                padding: "6px 12px",
                                borderRadius: "var(--d-radius-sm)",
                                border: "1px solid var(--d-border)",
                                background: "var(--d-surface)",
                                color: "var(--d-text)",
                                fontSize: "0.85rem",
                                cursor: isRecording ? "not-allowed" : "pointer",
                            }}
                        >
                            {LANGUAGES.map((lang) => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.label} — {lang.native}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ fontSize: "0.82rem", color: "var(--d-text-muted)" }}>
                        Duration: <strong>{formatTime(recordingTime)}</strong>
                    </div>
                </div>

                {/* Status Banners */}
                {errorMessage && (
                    <div
                        style={{
                            padding: "10px 14px",
                            marginBottom: "14px",
                            borderRadius: "var(--d-radius-sm)",
                            background: "#FEF2F2",
                            border: "1px solid #FCA5A5",
                            color: "#DC2626",
                            fontSize: "0.85rem",
                        }}
                    >
                        {errorMessage}
                    </div>
                )}

                {successMessage && (
                    <div
                        style={{
                            padding: "10px 14px",
                            marginBottom: "14px",
                            borderRadius: "var(--d-radius-sm)",
                            background: "#F0FDF4",
                            border: "1px solid #86EFAC",
                            color: "#166534",
                            fontSize: "0.85rem",
                        }}
                    >
                        {successMessage}
                    </div>
                )}

                {/* Microphone Record Control */}
                <div className="voice-controls">
                    <button
                        className={`voice-record-btn ${isRecording ? "recording" : ""}`}
                        onClick={handleClick}
                        disabled={isProcessing}
                        aria-label={isRecording ? "Stop recording" : "Start recording"}
                    >
                        {isRecording ? (
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        )}
                    </button>
                    <div className="voice-info">
                        <div className="voice-status">
                            {isRecording
                                ? `Capturing speech · Auto-identifying voice in ${getLangLabel(language)}...`
                                : isProcessing
                                ? "Transcribing speech with Gnani AI..."
                                : `Tap mic to begin clinical dialogue in ${getLangLabel(language)}`}
                        </div>
                        <div className="voice-duration">
                            {formatTime(recordingTime)}
                        </div>
                    </div>
                </div>

                <div className="waveform">
                    {bars.map((i) => (
                        <div
                            key={i}
                            className={`waveform-bar ${isRecording ? "active" : ""}`}
                            style={{
                                height: isRecording ? undefined : `${8 + Math.random() * 16}px`,
                                animationDelay: `${i * 0.05}s`,
                            }}
                        />
                    ))}
                </div>

                {/* ─────────────────────────────────────────────────────────────
                    3. TRANSCRIPTION DIALOGUE AREA
                   ───────────────────────────────────────────────────────────── */}
                <div
                    className="transcription-area"
                    style={{
                        minHeight: "130px",
                        maxHeight: "260px",
                        overflowY: "auto",
                        padding: "14px",
                        border: "1px solid var(--d-border)",
                        borderRadius: "var(--d-radius-sm)",
                        marginTop: "14px",
                        background: "var(--d-surface)",
                    }}
                >
                    {dialogue.length === 0 && !interimTranscript ? (
                        <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--d-text-muted)" }}>
                            Voice consultation dialogue will appear here automatically tagged by speaker. Speak naturally into the microphone—the system differentiates voices automatically.
                        </p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {dialogue.map((entry) => {
                                const isDoc = entry.role === "doctor";
                                return (
                                    <div
                                        key={entry.id}
                                        style={{
                                            fontSize: "0.88rem",
                                            lineHeight: "1.4",
                                            padding: "8px 12px",
                                            borderRadius: "6px",
                                            background: isDoc ? "#EFF6FF" : "#F0FDFA",
                                            borderLeft: `4px solid ${isDoc ? "#2563EB" : "#0D9488"}`,
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "flex-start",
                                            gap: "8px",
                                        }}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px", flexWrap: "wrap" }}>
                                                <strong style={{ color: isDoc ? "#1E40AF" : "#0F766E", fontSize: "0.84rem" }}>
                                                    {isDoc ? "👨‍⚕️" : "👤"} {entry.speaker}
                                                </strong>
                                                <span style={{ fontSize: "0.72rem", color: "var(--d-text-muted)" }}>
                                                    {entry.time}
                                                </span>
                                                {entry.detectedMethod && (
                                                    <span style={{ fontSize: "0.68rem", background: "rgba(0,0,0,0.05)", padding: "1px 6px", borderRadius: "4px", color: "#64748B" }}>
                                                        {entry.detectedMethod}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ color: "var(--d-text)" }}>{entry.text}</div>
                                        </div>

                                        {/* Optional Manual Overrides */}
                                        <div style={{ display: "flex", gap: "4px" }}>
                                            <button
                                                type="button"
                                                onClick={() => toggleLineSpeaker(entry.id)}
                                                title={`Switch this line to ${isDoc ? "Patient" : "Doctor"}`}
                                                style={{
                                                    fontSize: "0.72rem",
                                                    padding: "2px 6px",
                                                    borderRadius: "4px",
                                                    border: "1px solid var(--d-border)",
                                                    background: "white",
                                                    color: "var(--d-text)",
                                                    cursor: "pointer",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                ⇄ Switch
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => deleteLine(entry.id)}
                                                title="Delete line"
                                                style={{
                                                    fontSize: "0.72rem",
                                                    padding: "2px 6px",
                                                    borderRadius: "4px",
                                                    border: "1px solid #FCA5A5",
                                                    background: "white",
                                                    color: "#DC2626",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {interimTranscript && (
                        <p style={{ margin: "8px 0 0", color: "var(--d-primary)", fontStyle: "italic", fontSize: "0.85rem" }}>
                            ({interimTranscript})
                        </p>
                    )}
                </div>

                {/* ─────────────────────────────────────────────────────────────
                    4. FINISH CONSULTATION & GENERATE REPORT BUTTON
                   ───────────────────────────────────────────────────────────── */}
                <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ fontSize: "0.78rem", color: "var(--d-text-muted)" }}>
                        {dialogue.length} dialogue {dialogue.length === 1 ? "line" : "lines"} recorded
                    </div>

                    {effectiveRole === "doctor" && (
                        <button
                            type="button"
                            onClick={handleFinishConsultation}
                            disabled={isFinishing || dialogue.length === 0 || !selectedPatient}
                            style={{
                                padding: "10px 20px",
                                borderRadius: "var(--d-radius-sm)",
                                background:
                                    dialogue.length > 0 && selectedPatient
                                        ? "linear-gradient(135deg, #059669, #10B981)"
                                        : "#94A3B8",
                                color: "white",
                                fontWeight: 700,
                                fontSize: "0.88rem",
                                border: "none",
                                cursor: dialogue.length > 0 && selectedPatient && !isFinishing ? "pointer" : "not-allowed",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                boxShadow: dialogue.length > 0 && selectedPatient ? "0 4px 12px rgba(16, 185, 129, 0.3)" : "none",
                                transition: "all 0.2s ease",
                            }}
                        >
                            {isFinishing ? (
                                <>
                                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span>
                                    Saving &amp; Generating EMR Report...
                                </>
                            ) : (
                                <>
                                    🏁 Finish Consultation &amp; Generate EMR
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Generated Clinical EMR Review Modal */}
            {generatedReport && (
                <ClinicalReportModal
                    report={generatedReport}
                    currentUserRole={effectiveRole}
                    currentUserId={user?.id || doctorId || ""}
                    patientName={selectedPatient?.name || patientName || "Patient"}
                    doctorName={effectiveName}
                    onClose={() => setGeneratedReport(null)}
                    onReportApproved={(approvedReport: ClinicalReport) => setGeneratedReport(approvedReport)}
                />
            )}
        </div>
    );
}