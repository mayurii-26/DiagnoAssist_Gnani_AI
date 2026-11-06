"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
    askMedicalChatbot,
    fetchSpeechAudio,
    SUPPORTED_MULTILINGUAL_LANGUAGES,
} from "@/lib/consultationService";
import { useGnaniVoice } from "@/hooks/useGnaniVoice";

interface ChatMessage {
    id: string;
    sender: "user" | "assistant";
    text: string;
    time: string;
    language?: string;
    isEmergency?: boolean;
    matchedTopics?: string[];
    hasPatientContext?: boolean;
    audioUrl?: string;
}

export default function MultilingualChatbot() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "welcome-msg",
            sender: "assistant",
            text: "Hello! I am your DiagnoAssist Clinical AI Assistant. You can describe your symptoms or ask health questions in Hindi, Marathi, English, Tamil, Telugu, or any supported Indian language.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            language: "en",
        },
    ]);
    const [inputValue, setInputValue] = useState("");
    const [selectedLanguage, setSelectedLanguage] = useState("en");
    const [isLoading, setIsLoading] = useState(false);
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Multilingual Voice Input via Gnani Prisma STT
    const activeBcp47 =
        SUPPORTED_MULTILINGUAL_LANGUAGES.find((l) => l.code === selectedLanguage)?.bcp47 || "en-IN";

    const {
        isListening,
        interimText,
        error: voiceError,
        startListening,
        stopListening,
    } = useGnaniVoice({
        defaultLanguage: activeBcp47,
        onTranscript: (spoken) => {
            setInputValue((prev) => (prev ? `${prev} ${spoken}` : spoken));
        },
    });

    useEffect(() => {
        if (isOpen && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const text = inputValue.trim();
        if (!text || isLoading) return;

        if (isListening) {
            stopListening();
        }

        const userMsg: ChatMessage = {
            id: `usr_${Date.now()}`,
            sender: "user",
            text,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            language: selectedLanguage,
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputValue("");
        setIsLoading(true);

        try {
            const historyPayload = messages.slice(-6).map((m) => ({
                role: m.sender === "user" ? "user" : "assistant",
                content: m.text,
            }));

            const response = await askMedicalChatbot(text, selectedLanguage, historyPayload, user?.id);

            const assistantMsg: ChatMessage = {
                id: `ast_${Date.now()}`,
                sender: "assistant",
                text: response.reply,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                language: response.language || selectedLanguage,
                isEmergency: response.is_emergency,
                matchedTopics: response.matched_topics,
                hasPatientContext: response.has_patient_context,
            };

            setMessages((prev) => [...prev, assistantMsg]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: `err_${Date.now()}`,
                    sender: "assistant",
                    text: "Sorry, our clinical AI assistant is currently unable to reach the medical database. Please consult a doctor directly.",
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePlayTTS = async (msg: ChatMessage) => {
        if (playingAudioId === msg.id) {
            if (audioRef.current) {
                audioRef.current.pause();
                setPlayingAudioId(null);
            }
            return;
        }

        try {
            setPlayingAudioId(msg.id);
            let url = msg.audioUrl;
            if (!url) {
                const bcp47 =
                    SUPPORTED_MULTILINGUAL_LANGUAGES.find((l) => l.code === (msg.language || selectedLanguage))
                        ?.bcp47 || "hi-IN";
                url = await fetchSpeechAudio(msg.text, bcp47);
                msg.audioUrl = url;
            }

            if (audioRef.current) {
                audioRef.current.pause();
            }

            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => setPlayingAudioId(null);
            audio.onerror = () => setPlayingAudioId(null);
            audio.play();
        } catch {
            setPlayingAudioId(null);
        }
    };

    return (
        <>
            {/* Floating Trigger Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    style={{
                        position: "fixed",
                        bottom: "24px",
                        right: "24px",
                        padding: "12px 20px",
                        borderRadius: "30px",
                        background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                        color: "#FFF",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        border: "none",
                        boxShadow: "0 10px 25px rgba(37, 99, 235, 0.4)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        zIndex: 999,
                        transition: "transform 0.2s ease",
                    }}
                >
                    <span style={{ fontSize: "1.2rem" }}>🩺</span>
                    <span>AI Health Assistant</span>
                    <span
                        style={{
                            background: "rgba(255,255,255,0.25)",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "0.72rem",
                        }}
                    >
                        Multilingual
                    </span>
                </button>
            )}

            {/* Chatbot Window */}
            {isOpen && (
                <div
                    style={{
                        position: "fixed",
                        bottom: "20px",
                        right: "20px",
                        width: "420px",
                        maxWidth: "calc(100vw - 40px)",
                        height: "600px",
                        maxHeight: "calc(100vh - 40px)",
                        background: "#FFF",
                        borderRadius: "16px",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
                        border: "1px solid var(--d-border)",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        zIndex: 1000,
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: "14px 18px",
                            background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
                            color: "#FFF",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                                style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "50%",
                                    background: "rgba(255,255,255,0.2)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "1.2rem",
                                }}
                            >
                                🩺
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>DiagnoAssist AI</div>
                                <div style={{ fontSize: "0.75rem", opacity: 0.9 }}>Clinical Medical Assistant</div>
                            </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {/* Language selector */}
                            <select
                                value={selectedLanguage}
                                onChange={(e) => setSelectedLanguage(e.target.value)}
                                style={{
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    border: "none",
                                    background: "rgba(255,255,255,0.2)",
                                    color: "#FFF",
                                    fontSize: "0.76rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    outline: "none",
                                }}
                            >
                                {SUPPORTED_MULTILINGUAL_LANGUAGES.map((l) => (
                                    <option key={l.code} value={l.code} style={{ color: "#000" }}>
                                        {l.native}
                                    </option>
                                ))}
                            </select>

                            <button
                                onClick={() => setIsOpen(false)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "#FFF",
                                    fontSize: "1.3rem",
                                    cursor: "pointer",
                                    lineHeight: 1,
                                    padding: "4px",
                                }}
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    {/* Messages Body */}
                    <div
                        style={{
                            flex: 1,
                            padding: "16px",
                            overflowY: "auto",
                            background: "#F8FAFC",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                        }}
                    >
                        {messages.map((m) => (
                            <div
                                key={m.id}
                                style={{
                                    alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                                    maxWidth: "85%",
                                }}
                            >
                                <div
                                    style={{
                                        padding: "10px 14px",
                                        borderRadius: "12px",
                                        background:
                                            m.sender === "user"
                                                ? "#2563EB"
                                                : m.isEmergency
                                                ? "#FEF2F2"
                                                : "#FFFFFF",
                                        color:
                                            m.sender === "user"
                                                ? "#FFFFFF"
                                                : m.isEmergency
                                                ? "#991B1B"
                                                : "#1E293B",
                                        border:
                                            m.sender === "user"
                                                ? "none"
                                                : m.isEmergency
                                                ? "1.5px solid #F87171"
                                                : "1px solid #E2E8F0",
                                        fontSize: "0.88rem",
                                        lineHeight: 1.5,
                                        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                                    }}
                                >
                                    {m.text}

                                    {/* Matched clinical concepts / consultation history pills */}
                                    {((m.matchedTopics && m.matchedTopics.length > 0) || m.hasPatientContext) && (
                                        <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                            {m.hasPatientContext && (
                                                <span
                                                    style={{
                                                        padding: "2px 8px",
                                                        borderRadius: "10px",
                                                        background: "#F5F3FF",
                                                        color: "#6D28D9",
                                                        fontSize: "0.72rem",
                                                        fontWeight: 700,
                                                        border: "1px solid #DDD6FE",
                                                    }}
                                                >
                                                    📋 Clinical EMR Context Linked
                                                </span>
                                            )}
                                            {m.matchedTopics?.map((topic, i) => {
                                                const isHistory = topic.startsWith("Consultation:") || topic.startsWith("History:") || topic.startsWith("Previous");
                                                return (
                                                    <span
                                                        key={i}
                                                        style={{
                                                            padding: "2px 8px",
                                                            borderRadius: "10px",
                                                            background: isHistory ? "#ECFDF5" : "#EFF6FF",
                                                            color: isHistory ? "#047857" : "#1E40AF",
                                                            fontSize: "0.72rem",
                                                            fontWeight: 600,
                                                            border: `1px solid ${isHistory ? "#A7F3D0" : "#BFDBFE"}`,
                                                        }}
                                                    >
                                                        {isHistory ? `🩺 ${topic}` : `ICD-10: ${topic}`}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* TTS Voice play button for assistant messages */}
                                    {m.sender === "assistant" && (
                                        <div
                                            style={{
                                                marginTop: "6px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                fontSize: "0.72rem",
                                                color: "#64748B",
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => handlePlayTTS(m)}
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    color: "#2563EB",
                                                    fontSize: "0.74rem",
                                                    fontWeight: 600,
                                                    cursor: "pointer",
                                                    padding: "2px 0",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                }}
                                            >
                                                <span>{playingAudioId === m.id ? "⏸️ Pause Voice" : "🔊 Listen (TTS)"}</span>
                                            </button>
                                            <span>{m.time}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div style={{ alignSelf: "flex-start", padding: "10px 14px", background: "#FFF", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "0.84rem", color: "#64748B" }}>
                                <span style={{ animation: "pulse 1.2s infinite" }}>Analyzing symptoms &amp; translating response...</span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Voice interim display */}
                    {isListening && (
                        <div
                            style={{
                                padding: "8px 14px",
                                background: "#FEF3C7",
                                borderTop: "1px solid #FCD34D",
                                fontSize: "0.78rem",
                                color: "#92400E",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                            }}
                        >
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#EF4444", animation: "pulse 1.2s infinite" }} />
                            <span>{interimText || "Listening to speech..."}</span>
                        </div>
                    )}

                    {voiceError && (
                        <div style={{ padding: "6px 14px", background: "#FEE2E2", fontSize: "0.75rem", color: "#DC2626" }}>
                            ⚠️ {voiceError}
                        </div>
                    )}

                    {/* Input form */}
                    <form
                        onSubmit={handleSendMessage}
                        style={{
                            padding: "12px 14px",
                            background: "#FFF",
                            borderTop: "1px solid var(--d-border)",
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => {
                                if (isListening) stopListening();
                                else startListening(activeBcp47);
                            }}
                            title="Speak with Gnani AI Speech-to-Text"
                            style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "50%",
                                border: "none",
                                background: isListening ? "#EF4444" : "#F1F5F9",
                                color: isListening ? "#FFF" : "#475569",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                flexShrink: 0,
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        </button>

                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Type symptoms or click mic to speak..."
                            disabled={isLoading}
                            style={{
                                flex: 1,
                                padding: "8px 12px",
                                borderRadius: "20px",
                                border: "1px solid var(--d-border)",
                                outline: "none",
                                fontSize: "0.88rem",
                            }}
                        />

                        <button
                            type="submit"
                            disabled={isLoading || !inputValue.trim()}
                            style={{
                                padding: "8px 16px",
                                borderRadius: "20px",
                                background: "var(--d-primary)",
                                color: "#FFF",
                                border: "none",
                                fontWeight: 600,
                                fontSize: "0.84rem",
                                cursor: isLoading || !inputValue.trim() ? "not-allowed" : "pointer",
                                opacity: isLoading || !inputValue.trim() ? 0.6 : 1,
                            }}
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}

