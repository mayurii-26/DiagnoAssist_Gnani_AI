"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
    getDoctorPendingRequests,
    respondToConsultationRequest,
    subscribeToDoctorRequests,
    type ConsultationRequest,
} from "@/lib/consultationService";

export default function DoctorIncomingRequests() {
    const { user } = useAuth();
    const [pendingRequests, setPendingRequests] = useState<ConsultationRequest[]>([]);
    const [recentActions, setRecentActions] = useState<{ id: string; name: string; action: "accepted" | "rejected"; room_id: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const router = useRouter();
    const doctorId = user?.id;
    const doctorName = user?.user_metadata?.full_name || "Doctor";
    const audioContextRef = useRef<AudioContext | null>(null);

    // Play a gentle alert tone using Web Audio API synthesis
    const playNotificationChime = useCallback(() => {
        try {
            const ctx = audioContextRef.current || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            audioContextRef.current = ctx;

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880, now + 0.15); // A5

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.5);
        } catch {
            // Audio synthesis not allowed before user interaction
        }
    }, []);

    // Load initial pending requests
    const loadRequests = useCallback(async () => {
        if (!doctorId) return;
        try {
            const list = await getDoctorPendingRequests(doctorId);
            setPendingRequests(list);
        } catch (err) {
            console.error("Failed to load doctor requests:", err);
        } finally {
            setLoading(false);
        }
    }, [doctorId]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    // Realtime: Listen for incoming consultation requests & cancellations
    useEffect(() => {
        if (!doctorId) return;

        const unsubscribe = subscribeToDoctorRequests(
            doctorId,
            (newReq) => {
                console.log("Realtime incoming request received by doctor:", newReq);
                playNotificationChime();

                setPendingRequests((prev) => {
                    // Prevent duplicate entries
                    if (prev.some((r) => r.id === newReq.id)) return prev;
                    return [newReq, ...prev];
                });
            },
            (cancelledId) => {
                console.log("Realtime cancellation received:", cancelledId);
                setPendingRequests((prev) => prev.filter((r) => r.id !== cancelledId));
            }
        );

        return () => {
            unsubscribe();
        };
    }, [doctorId, playNotificationChime]);

    // Handle Doctor Accept
    const handleAccept = async (req: ConsultationRequest) => {
        if (!doctorId) return;
        setActionLoading(req.id);
        setErrorMsg(null);

        try {
            const success = await respondToConsultationRequest(
                req.id,
                doctorId,
                req.patient_id,
                true,
                doctorName
            );

            if (success) {
                setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
                setRecentActions((prev) => [
                    { id: req.id, name: req.patient_name, action: "accepted", room_id: req.room_id },
                    ...prev.slice(0, 4),
                ]);
                // Automatically redirect doctor to the live consultation room
                router.push(`/doctor/consultation?room_id=${req.room_id}`);
            } else {
                setErrorMsg(`Could not accept request from ${req.patient_name}. It may have been cancelled or expired.`);
                loadRequests();
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error accepting request";
            setErrorMsg(msg);
        } finally {
            setActionLoading(null);
        }
    };

    // Handle Doctor Reject
    const handleReject = async (req: ConsultationRequest) => {
        if (!doctorId) return;
        setActionLoading(req.id);
        setErrorMsg(null);

        try {
            const success = await respondToConsultationRequest(
                req.id,
                doctorId,
                req.patient_id,
                false,
                doctorName
            );

            if (success) {
                setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
                setRecentActions((prev) => [
                    { id: req.id, name: req.patient_name, action: "rejected", room_id: req.room_id },
                    ...prev.slice(0, 4),
                ]);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error declining request";
            setErrorMsg(msg);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="card" style={{ marginBottom: "24px" }}>
            <div className="card-header">
                <div className="card-header-left">
                    <div className="card-header-icon blue">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="23 7 16 12 23 17 23 7" />
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                    </div>
                    <div>
                        <div className="card-title">Live Consultation Requests</div>
                        <div className="card-subtitle">Real-time patient triage &amp; queue</div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                        className={`status-badge ${pendingRequests.length > 0 ? "processing" : "completed"}`}
                    >
                        {pendingRequests.length} {pendingRequests.length === 1 ? "Pending Request" : "Pending Requests"}
                    </span>
                    <button
                        onClick={loadRequests}
                        style={{
                            background: "transparent",
                            border: "1px solid var(--d-border)",
                            borderRadius: "var(--d-radius-sm)",
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                        }}
                    >
                        Refresh
                    </button>
                </div>
            </div>

            <div className="card-body">
                {errorMsg && (
                    <div
                        style={{
                            padding: "10px 14px",
                            borderRadius: "var(--d-radius-sm)",
                            background: "#FEF2F2",
                            border: "1px solid #FCA5A5",
                            color: "#DC2626",
                            fontSize: "0.85rem",
                            marginBottom: "14px",
                        }}
                    >
                        {errorMsg}
                    </div>
                )}

                {loading ? (
                    <p style={{ color: "var(--d-text-muted)", fontSize: "0.9rem", margin: 0 }}>
                        Checking for incoming consultation requests...
                    </p>
                ) : pendingRequests.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "var(--d-text-muted)" }}>
                        <svg
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            style={{ margin: "0 auto 10px", display: "block", opacity: 0.5 }}
                        >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 14 14" />
                        </svg>
                        <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 500 }}>No pending consultation requests</p>
                        <p style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>
                            You are marked as <strong>Available</strong>. New patient requests will chime here instantly.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        {pendingRequests.map((req) => {
                            const isUrgent = req.reason.startsWith("[URGENT]");
                            const cleanReason = isUrgent ? req.reason.replace("[URGENT]", "").trim() : req.reason;

                            return (
                                <div
                                    key={req.id}
                                    style={{
                                        padding: "16px 20px",
                                        borderRadius: "var(--d-radius)",
                                        border: `1px solid ${isUrgent ? "#FCA5A5" : "var(--d-border)"}`,
                                        background: isUrgent ? "#FFF5F5" : "var(--d-surface-hover)",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        gap: "14px",
                                    }}
                                >
                                    <div style={{ flex: 1, minWidth: "240px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                            <span style={{ fontWeight: 700, fontSize: "0.98rem", color: "var(--d-text)" }}>
                                                {req.patient_name}
                                            </span>
                                            {isUrgent && (
                                                <span
                                                    style={{
                                                        background: "#EF4444",
                                                        color: "#FFF",
                                                        fontSize: "0.7rem",
                                                        fontWeight: 700,
                                                        padding: "2px 6px",
                                                        borderRadius: "4px",
                                                    }}
                                                >
                                                    HIGH PRIORITY
                                                </span>
                                            )}
                                            <span style={{ fontSize: "0.78rem", color: "var(--d-text-muted)" }}>
                                                {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        </div>

                                        <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--d-text)" }}>
                                            <strong>Chief Complaint:</strong> {cleanReason}
                                        </p>
                                    </div>

                                    {/* Action buttons */}
                                    <div style={{ display: "flex", gap: "10px" }}>
                                        <button
                                            onClick={() => handleReject(req)}
                                            disabled={actionLoading === req.id}
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
                                            Decline
                                        </button>
                                        <button
                                            onClick={() => handleAccept(req)}
                                            disabled={actionLoading === req.id}
                                            style={{
                                                padding: "8px 20px",
                                                borderRadius: "var(--d-radius-sm)",
                                                border: "none",
                                                background: "var(--d-primary)",
                                                color: "#FFF",
                                                fontWeight: 600,
                                                fontSize: "0.85rem",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {actionLoading === req.id ? "Connecting..." : "Accept Request"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Handled / Accepted list for today */}
                {recentActions.length > 0 && (
                    <div style={{ marginTop: "20px", paddingTop: "14px", borderTop: "1px solid var(--d-border)" }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--d-text-muted)", marginBottom: "8px" }}>
                            Recently Handled Requests:
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {recentActions.map((item, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        fontSize: "0.82rem",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        color: item.action === "accepted" ? "#059669" : "#6B7280",
                                    }}
                                >
                                    <span>
                                        • {item.action === "accepted" ? "Accepted call from " : "Declined call from "}
                                        <strong>{item.name}</strong>
                                    </span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span>Room: <code>{item.room_id}</code></span>
                                        {item.action === "accepted" && (
                                            <button
                                                onClick={() => router.push(`/doctor/consultation?room_id=${item.room_id}`)}
                                                style={{
                                                    padding: "3px 8px",
                                                    borderRadius: "4px",
                                                    border: "none",
                                                    background: "var(--d-primary)",
                                                    color: "#FFF",
                                                    fontSize: "0.75rem",
                                                    fontWeight: 600,
                                                    cursor: "pointer",
                                                }}
                                            >
                                                Enter Room
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

