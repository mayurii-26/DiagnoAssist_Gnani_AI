"use client";

import { useState, useRef, useCallback, useEffect } from "react";

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output.buffer;
}

export interface UseGnaniVoiceOptions {
    defaultLanguage?: string;
    onTranscript?: (text: string, isFinal: boolean) => void;
    onError?: (err: string) => void;
}

export function useGnaniVoice(options: UseGnaniVoiceOptions = {}) {
    const [isListening, setIsListening] = useState(false);
    const [interimText, setInterimText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [language, setLanguage] = useState<string>(options.defaultLanguage || "en-IN");

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const onTranscriptRef = useRef(options.onTranscript);

    useEffect(() => {
        onTranscriptRef.current = options.onTranscript;
    }, [options.onTranscript]);

    const stopListening = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            try {
                wsRef.current.send(JSON.stringify({ action: "stop" }));
            } catch {
                // Ignore
            }
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }

        setIsListening(false);
        setInterimText("");
    }, []);

    const startListening = useCallback(async (customLang?: string) => {
        stopListening();
        setError(null);
        setInterimText("Connecting to Gnani STT...");

        const activeLang = customLang || language;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const wsUrl = `ws://localhost:8000/ws/transcribe?lang=${activeLang}`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setIsListening(true);
                setInterimText("Listening... Speak clearly.");
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "speech_start") {
                        setInterimText("Speech detected...");
                    } else if (data.type === "transcript") {
                        const recognized = data.transcript?.trim() || "";
                        if (recognized) {
                            setInterimText("");
                            if (onTranscriptRef.current) {
                                onTranscriptRef.current(recognized, true);
                            }
                        }
                    } else if (data.type === "complete") {
                        const finalTxt = data.transcript?.trim() || "";
                        if (finalTxt && onTranscriptRef.current) {
                            onTranscriptRef.current(finalTxt, true);
                        }
                        stopListening();
                    } else if (data.type === "error") {
                        const msg = data.message || "Speech transcription failed";
                        setError(msg);
                        if (options.onError) options.onError(msg);
                        stopListening();
                    }
                } catch {
                    // Ignore JSON parsing errors
                }
            };

            ws.onerror = () => {
                const msg = "Speech backend connection error. Ensure FastAPI server is running.";
                setError(msg);
                if (options.onError) options.onError(msg);
                stopListening();
            };

            ws.onclose = () => {
                setIsListening(false);
            };

            // Setup 16kHz PCM audio processor
            const audioContext = new AudioContext({ sampleRate: 16000 });
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
                if (ws.readyState === WebSocket.OPEN) {
                    const input = e.inputBuffer.getChannelData(0);
                    const pcm = floatTo16BitPCM(input);
                    ws.send(pcm);
                }
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Microphone access denied.";
            setError(msg);
            if (options.onError) options.onError(msg);
            stopListening();
        }
    }, [language, options, stopListening]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopListening();
        };
    }, [stopListening]);

    return {
        isListening,
        interimText,
        error,
        language,
        setLanguage,
        startListening,
        stopListening,
    };
}

