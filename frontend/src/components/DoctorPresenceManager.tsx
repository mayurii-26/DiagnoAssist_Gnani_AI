"use client";

import { useDoctorPresence } from "@/hooks/useDoctorPresence";

export default function DoctorPresenceManager() {
    // Activates the 30-second heartbeat and sets online presence
    const { isOnline } = useDoctorPresence();

    if (!isOnline) return null;

    // Subtle floating online indicator for the doctor
    return (
        <div
            style={{
                position: "fixed",
                bottom: "16px",
                right: "16px",
                zIndex: 999,
                background: "var(--d-surface)",
                border: "1px solid var(--d-border)",
                boxShadow: "var(--d-shadow)",
                borderRadius: "20px",
                padding: "6px 14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "var(--d-text)",
            }}
        >
            <span
                style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#10B981",
                    boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.2)",
                    animation: "pulse 2s infinite",
                }}
            />
            Available for Consultations
        </div>
    );
}

