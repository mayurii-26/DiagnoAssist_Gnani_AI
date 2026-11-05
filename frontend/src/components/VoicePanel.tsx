"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
    broadcastRoomSignal,
    subscribeToRoomSignaling,
    saveConsultationTranscript,
    type RoomSignal,
} from "@/lib/consultationService";

type Language = "en-IN" | "hi-IN" | "mr-IN";

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
}

interface VoicePanelProps {
    roomId?: string;
    currentUserRole?: "doctor" | "patient";
    currentUserName?: string;
    doctorId?: string;
    patientId?: string;
    onTranscriptUpdate?: (fullTranscript: string) => void;
}

export default function VoicePanel({
    roomId,
    currentUserRole,
    currentUserName,
    doctorId,
    patientId,
    onTranscriptUpdate,
}: VoicePanelProps) {
    const { user } = useAuth();
    const effectiveRole = currentUserRole || (user?.user_metadata?.role as "doctor" | "patient") || "doctor";
    const effectiveName =
        currentUserName || user?.user_metadata?.full_name || (effectiveRole === "doctor" ? "Doctor" : "Patient");

    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [language, setLanguage] = useState<Language>("en-IN");
    const [recordingTime, setRecordingTime] = useState(0);
    const [dialogue, setDialogue] = useState<VoiceDialogueLine[]>([]);
    const [interimTranscript, setInterimTranscript] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const mediaRecorderRef = useRef<{
        audioContext: AudioContext;
        source: MediaStreamAudioSourceNode;
        processor: ScriptProcessorNode;
        stream: MediaStream;
    } | null>(null);
    const websocketRef = useRef<WebSocket | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const dialogueRef = useRef<VoiceDialogueLine[]>([]);
    const signalingSubRef = useRef<{ unsubscribe: () => void; channel: any } | null>(null);

    const bars = Array.from({ length: 40 }, (_, i) => i);

    // Keep dialogueRef synchronized
    useEffect(() => {
        dialogueRef.current = dialogue;
        if (onTranscriptUpdate && dialogue.length > 0) {
            const compiled = dialogue.map((d) => `[${d.speaker}]: ${d.text}`).join("\n");
            onTranscriptUpdate(compiled);
        }
    }, [dialogue, onTranscriptUpdate]);

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

    // Format seconds to MM:SS
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
    // REALTIME ROOM SYNCHRONIZATION (Listen to other party's transcripts)
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!roomId) return;

        const sub = subscribeToRoomSignaling(roomId, (signal: RoomSignal) => {
            if (signal.type === "live_transcript" && signal.transcript && signal.sender_id !== user?.id) {
                const incomingSpeaker = signal.speaker_name || (signal.sender_role === "doctor" ? "Doctor" : "Patient");
                const line: VoiceDialogueLine = {
                    id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    speaker: incomingSpeaker,
                    role: signal.sender_role || "patient",
                    text: signal.transcript,
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                };
                setDialogue((prev) => [...prev, line]);
            }
        });

        signalingSubRef.current = sub;
        return () => {
            sub.unsubscribe();
        };
    }, [roomId, user?.id]);

    // Append our own spoken utterance and broadcast to room
    const appendSpokenUtterance = useCallback(
        async (rawText: string) => {
            if (!rawText || !rawText.trim()) return;
            const cleanText = rawText.trim();

            const entry: VoiceDialogueLine = {
                id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                speaker: effectiveName,
                role: effectiveRole,
                text: cleanText,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };

            setDialogue((prev) => [...prev, entry]);

            // Broadcast to consultation room so remote peer and VideoPanel see it
            if (roomId) {
                try {
                    await broadcastRoomSignal(roomId, {
                        type: "live_transcript",
                        sender_id: user?.id || "anonymous",
                        sender_role: effectiveRole,
                        speaker_name: effectiveName,
                        transcript: cleanText,
                        is_final: true,
                        timestamp: new Date().toISOString(),
                    });
                } catch (broadcastErr) {
                    console.warn("Failed to broadcast live transcript:", broadcastErr);
                }
            }
        },
        [effectiveName, effectiveRole, roomId, user?.id]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // GNANI AI STT STREAMING WEBSOCKET
    // ─────────────────────────────────────────────────────────────────────────
    const startRecording = async () => {
        setErrorMessage(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Connect to FastAPI Gnani AI WebSocket proxy with selected language
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
                    console.log("Received Gnani STT event:", data);

                    if (data.type === "connected") {
                        setInterimTranscript(`Connected to Gnani STT (${getLangLabel(language)})`);
                    } else if (data.type === "speech_start") {
                        setInterimTranscript("Speech detected...");
                    } else if (data.type === "processing") {
                        setInterimTranscript("Processing audio stream...");
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

            // Setup Web Audio API for 16kHz PCM streaming (Gnani AI required format)
            const audioContext = new AudioContext({ sampleRate: 16000 });
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
                if (ws.readyState === WebSocket.OPEN) {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcmData = floatTo16BitPCM(inputData);
                    ws.send(pcmData);
                }
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            mediaRecorderRef.current = { audioContext, source, processor, stream };

            setIsRecording(true);
            setIsProcessing(false);
            setRecordingTime(0);
            setInterimTranscript("Listening for speech...");
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

        // Graceful stop: Tell backend to flush and receive final transcript
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
                        <div className="card-title">Live Voice Documentation</div>
                        <div className="card-subtitle">
                            Gnani AI Multi-lingual STT {roomId ? `• Room: ${roomId}` : ""}
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
                        Speaker: <strong>{effectiveName}</strong> ({effectiveRole})
                    </div>
                </div>

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
                                ? `Recording in ${getLangLabel(language)}...`
                                : isProcessing
                                ? "Transcribing speech..."
                                : `Tap to record clinical speech in ${getLangLabel(language)}`}
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

                {/* Transcription Dialogue Area */}
                <div
                    className="transcription-area"
                    style={{
                        minHeight: "110px",
                        maxHeight: "220px",
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
                            Voice transcription will appear here tagged with speaker identity...
                        </p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {dialogue.map((entry) => (
                                <div key={entry.id} style={{ fontSize: "0.88rem", lineHeight: "1.4" }}>
                                    <strong style={{ color: entry.role === "doctor" ? "#2563EB" : "#0D9488" }}>
                                        {entry.speaker}:
                                    </strong>{" "}
                                    <span>{entry.text}</span>
                                    <span style={{ fontSize: "0.74rem", color: "var(--d-text-muted)", marginLeft: "6px" }}>
                                        {entry.time}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {interimTranscript && (
                        <p style={{ margin: "8px 0 0", color: "var(--d-primary)", fontStyle: "italic", fontSize: "0.85rem" }}>
                            ({interimTranscript})
                        </p>
                    )}
                </div>

                <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--d-text-muted)" }}>
                        {isRecording ? "🔴 Capturing microphone audio..." : isProcessing ? "Transcribing speech..." : "Gnani STT Ready"}
                    </span>

                    {dialogue.length > 0 && (
                        <span style={{ fontSize: "0.78rem", color: "var(--d-text-muted)" }}>
                            {dialogue.length} dialogue {dialogue.length === 1 ? "entry" : "entries"} recorded
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
