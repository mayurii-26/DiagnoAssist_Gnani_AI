"use client";

import { Suspense } from "react";
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

    return (
        <>
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>
                        {roomId ? "Active Clinical Video Consultation" : "Consultation Workspace"}
                    </h1>
                    <p style={{ margin: "4px 0 0", color: "var(--d-text-muted)" }}>
                        {roomId
                            ? `Live WebRTC Video Session • Room: ${roomId}`
                            : "Live Patient Consultations & Clinical Voice Documentation"}
                    </p>
                </div>

                {roomId && (
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
                        Back to Triage Queue
                    </button>
                )}
            </div>

            {/* If not in an active call, show incoming requests triage */}
            {!roomId && <DoctorIncomingRequests />}

            {/* Video Consultation and Gnani Voice Documentation panels */}
            <div className="dashboard-grid">
                <VideoPanel
                    roomId={roomId || undefined}
                    currentUserRole="doctor"
                    currentUserName={doctorName}
                    onCallEnd={() => {
                        router.push("/doctor/consultation");
                    }}
                />
                <VoicePanel
                    roomId={roomId || undefined}
                    currentUserRole="doctor"
                    currentUserName={doctorName}
                />
            </div>
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
