"use client";

import { useState, useRef, useEffect } from "react";

type Language = "en-IN" | "hi-IN" | "mr-IN";

const LANGUAGES: { code: Language; label: string; native: string }[] = [
    { code: "en-IN", label: "English", native: "English (IN)" },
    { code: "hi-IN", label: "Hindi", native: "हिन्दी (IN)" },
    { code: "mr-IN", label: "Marathi", native: "मराठी (IN)" },
];

export default function VoicePanel() {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [language, setLanguage] = useState<Language>("en-IN");
    const [recordingTime, setRecordingTime] = useState(0);
    const [transcript, setTranscript] = useState("");
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
    const bars = Array.from({ length: 40 }, (_, i) => i);

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

    const startRecording = async () => {
        setErrorMessage(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Connect to FastAPI WebSocket proxy with selected language
            const wsUrl = `ws://localhost:8000/ws/transcribe?lang=${language}`;
            const ws = new WebSocket(wsUrl);
            websocketRef.current = ws;

            ws.onopen = () => {
                console.log(`WebSocket connected to ${wsUrl}`);
            };

            ws.onclose = () => {
                console.log("WebSocket closed");
                setIsProcessing(false);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log("Received STT event:", data);

                    if (data.type === "connected") {
                        setInterimTranscript(`Connected to Gnani STT (${getLangLabel(language)})`);
                    } else if (data.type === "speech_start") {
                        setInterimTranscript("Speech detected...");
                    } else if (data.type === "processing") {
                        setInterimTranscript("Processing utterance...");
                    } else if (data.type === "transcript") {
                        setTranscript((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript));
                        setInterimTranscript("");
                    } else if (data.type === "complete" || data.complete) {
                        if (data.transcript) {
                            setTranscript(data.transcript);
                        }
                        setInterimTranscript("");
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
                console.error("WebSocket error:", error);
                setErrorMessage("Failed to connect to transcription service. Make sure backend is running.");
            };

            // Setup Web Audio API for 16kHz PCM conversion (matches Gnani requirement)
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
            setTranscript("");
            setInterimTranscript("Connecting to Gnani STT...");
        } catch (error) {
            console.error("Microphone access error:", error);
            setErrorMessage("Microphone access is required. Please check browser microphone permissions.");
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

            // Safety timeout to close connection if backend doesn't close within 3s
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
                        <div className="card-title">Live Interaction</div>
                        <div className="card-subtitle">Gnani AI Voice recording</div>
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
                <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <label htmlFor="voice-language-select" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--d-text)" }}>
                        Spoken Language:
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
                                : `Tap to record in ${getLangLabel(language)}`}
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

                <div className="transcription-area" style={{ minHeight: "70px", padding: "12px", border: "1px solid var(--d-border)", borderRadius: "var(--d-radius-sm)", marginTop: "14px" }}>
                    <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: "1.5" }}>
                        {transcript || <span style={{ color: "var(--d-text-muted)" }}>Transcription will appear here...</span>}
                        {interimTranscript && (
                            <span style={{ color: "var(--d-primary)", fontStyle: "italic", marginLeft: "6px" }}>
                                ({interimTranscript})
                            </span>
                        )}
                    </p>
                    <button
                        onClick={() => setTranscript("Test transcript from button")}
                        style={{
                            marginTop: "10px",
                            padding: "4px 10px",
                            fontSize: "0.75rem",
                            border: "1px solid var(--d-border)",
                            borderRadius: "var(--d-radius-sm)",
                            background: "transparent",
                            cursor: "pointer",
                        }}
                    >
                        Test Display
                    </button>
                </div>
            </div>
        </div>
    );
}
