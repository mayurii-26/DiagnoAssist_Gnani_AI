"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import VideoPanel from "@/components/VideoPanel";
import VoicePanel from "@/components/VoicePanel";
import DoctorIncomingRequests from "@/components/DoctorIncomingRequests";

function DoctorConsultationContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const roomId = searchParams.get("room_id");
    const doctorName = user?.user_metadata?.full_name || "Dr. Physician";

    // Mode when not in an active video room
    const [consultMode, setConsultMode] = useState<"voice" | "video">("voice");

    return (
        <>
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>
                        {roomId ? "Active Clinical Video Consultation" : "Doctor Consultation Workspace"}
                    </h1>
                    <p style={{ margin: "4px 0 0", color: "var(--d-text-muted)" }}>
                        {roomId
                            ? `Live WebRTC Video Session • Room: ${roomId}`
                            : "Direct Voice Clinical Encounters & Patient Triage"}
                    </p>
                </div>

                {roomId ? (
                    <button
                        onClick={() => router.push("/doctor/consultation")}
                        style={{
                            padding: "8px 16px",
                            borderRadius: "var(--d-radius-sm)",
                            border: "1px solid var(--d-border)",
                            background: "var(--d-surface)",
                            color: "var(--d-text)",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            cursor: "pointer",
                        }}
                    >
                        Back to Consultation Workspace
                    </button>
                ) : (
                    /* Consultation Mode Tabs */
                    <div style={{ display: "flex", background: "var(--d-surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--d-border)" }}>
                        <button
                            type="button"
                            onClick={() => setConsultMode("voice")}
                            style={{
                                padding: "8px 16px",
                                borderRadius: "8px",
                                border: "none",
                                background: consultMode === "voice" ? "var(--d-primary)" : "transparent",
                                color: consultMode === "voice" ? "#FFF" : "var(--d-text)",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            🎙️ Direct Voice Consultation
                        </button>
                        <button
                            type="button"
                            onClick={() => setConsultMode("video")}
                            style={{
                                padding: "8px 16px",
                                borderRadius: "8px",
                                border: "none",
                                background: consultMode === "video" ? "var(--d-primary)" : "transparent",
                                color: consultMode === "video" ? "#FFF" : "var(--d-text)",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            📹 Video Requests &amp; Queue
                        </button>
                    </div>
                )}
            </div>

            {/* Active Video Room Session: Split Video + Voice Panel */}
            {roomId && (
                <div className="dashboard-grid">
                    <VideoPanel
                        roomId={roomId}
                        currentUserRole="doctor"
                        currentUserName={doctorName}
                        onCallEnd={() => {
                            router.push("/doctor/consultation");
                        }}
                    />
                    <VoicePanel
                        roomId={roomId}
                        currentUserRole="doctor"
                        currentUserName={doctorName}
                    />
                </div>
            )}

            {/* Inactive Video Room: Voice Mode */}
            {!roomId && consultMode === "voice" && (
                <div style={{ maxWidth: "860px", margin: "0 auto" }}>
                    <VoicePanel
                        currentUserRole="doctor"
                        currentUserName={doctorName}
                        doctorId={user?.id}
                    />
                </div>
            )}

            {/* Inactive Video Room: Video Queue Mode */}
            {!roomId && consultMode === "video" && (
                <>
                    <DoctorIncomingRequests />
                    <div className="dashboard-grid">
                        <VideoPanel
                            currentUserRole="doctor"
                            currentUserName={doctorName}
                        />
                        <VoicePanel
                            currentUserRole="doctor"
                            currentUserName={doctorName}
                            doctorId={user?.id}
                        />
                    </div>
                </>
            )}
        </>
    );
}

export default function DoctorConsultationPage() {
    return (
        <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "var(--d-text-muted)" }}>Loading consultation workspace...</div>}>
            <DoctorConsultationContent />
        </Suspense>
    );
}