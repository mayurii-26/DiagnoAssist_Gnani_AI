"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import VideoPanel from "@/components/VideoPanel";
import VoicePanel from "@/components/VoicePanel";
import {
    getRegisteredDoctors,
    getPatientActiveRequest,
    createConsultationRequest,
    cancelConsultationRequest,
    subscribeToPatientUpdates,
    subscribeToPresenceUpdates,
    type DoctorProfile,
    type ConsultationRequest,
    type RequestStatus,
} from "@/lib/consultationService";

function PatientConsultationContent() {
    const searchParams = useSearchParams();
    const queryRoomId = searchParams.get("room_id");

    const { user } = useAuth();
    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [loadingDoctors, setLoadingDoctors] = useState(true);
    const [activeRequest, setActiveRequest] = useState<ConsultationRequest | null>(null);
    const [inCallRoomId, setInCallRoomId] = useState<string | null>(queryRoomId || null);
    const [statusMessage, setStatusMessage] = useState<{ type: "success" | "info" | "error"; text: string } | null>(null);

    // Modal state for creating a new request
    const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
    const [reason, setReason] = useState("");
    const [urgency, setUrgency] = useState<"routine" | "urgent">("routine");
    const [submitting, setSubmitting] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    const patientName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Patient";

    // 1. Fetch online & registered doctors
    const refreshDoctors = useCallback(async () => {
        try {
            const list = await getRegisteredDoctors();
            setDoctors(list);
        } catch (err) {
            console.error("Failed to fetch doctors:", err);
        } finally {
            setLoadingDoctors(false);
        }
    }, []);

    // 2. Fetch any existing active request on mount
    const checkActiveRequest = useCallback(async () => {
        if (!user?.id) return;
        try {
            const req = await getPatientActiveRequest(user.id);
            setActiveRequest(req);
        } catch (err) {
            console.error("Failed to check active request:", err);
        }
    }, [user?.id]);

    useEffect(() => {
        refreshDoctors();
        checkActiveRequest();
    }, [refreshDoctors, checkActiveRequest]);

    // 3. Realtime: Subscribe to doctor responses (Accepted / Rejected)
    useEffect(() => {
        if (!user?.id) return;

        const unsubscribeUpdates = subscribeToPatientUpdates(user.id, (response) => {
            console.log("Realtime response received by patient:", response);

            setActiveRequest((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    status: response.status,
                    doctor_name: response.doctor_name,
                    room_id: response.room_id || prev.room_id,
                };
            });

            if (response.status === "accepted") {
                setStatusMessage({
                    type: "success",
                    text: `${response.doctor_name} has accepted your consultation request! Entering video consultation...`,
                });
                setInCallRoomId(response.room_id);
            } else if (response.status === "rejected") {
                setStatusMessage({
                    type: "info",
                    text: `${response.doctor_name} is currently unavailable. Please request another physician.`,
                });
            }
        });

        // 4. Realtime: Subscribe to doctor presence updates (online / offline)
        const unsubscribePresence = subscribeToPresenceUpdates((presence) => {
            console.log("Realtime doctor presence update:", presence);
            setDoctors((prev) =>
                prev.map((d) =>
                    d.id === presence.doctor_id
                        ? { ...d, is_online: presence.is_online, last_seen: presence.last_seen }
                        : d
                )
            );
        });

        return () => {
            unsubscribeUpdates();
            unsubscribePresence();
        };
    }, [user?.id]);

    // Handle sending a consultation request
    const handleSendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDoctor || !user?.id) return;
        if (!reason.trim()) {
            setStatusMessage({ type: "error", text: "Please enter your symptoms or reason for consultation." });
            return;
        }

        setSubmitting(true);
        setStatusMessage(null);

        try {
            const formattedReason = urgency === "urgent" ? `[URGENT] ${reason.trim()}` : reason.trim();
            const created = await createConsultationRequest(
                user.id,
                selectedDoctor.id,
                formattedReason,
                patientName
            );

            setActiveRequest({
                ...created,
                doctor_name: selectedDoctor.name,
            });

            setSelectedDoctor(null);
            setReason("");
            setStatusMessage({
                type: "info",
                text: `Consultation request sent to ${selectedDoctor.name}. Waiting for doctor response...`,
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to send consultation request.";
            setStatusMessage({ type: "error", text: msg });
        } finally {
            setSubmitting(false);
        }
    };

    // Handle cancelling a pending request
    const handleCancelRequest = async () => {
        if (!activeRequest || !user?.id) return;
        setCancelling(true);
        try {
            await cancelConsultationRequest(activeRequest.id, user.id, activeRequest.doctor_id);
            setActiveRequest(null);
            setStatusMessage({ type: "info", text: "Consultation request cancelled." });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to cancel request.";
            setStatusMessage({ type: "error", text: msg });
        } finally {
            setCancelling(false);
        }
    };

    const onlineDoctorsCount = doctors.filter((d) => d.is_online).length;

    return (
        <div style={{ paddingBottom: "40px" }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: "24px" }}>
                <div>
                    <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Doctor Directory &amp; Live Consultation</h1>
                    <p style={{ color: "var(--d-text-muted)", marginTop: "4px" }}>
                        Browse verified physicians and request real-time clinical consultations
                    </p>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <span
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 12px",
                            borderRadius: "20px",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            background: onlineDoctorsCount > 0 ? "#ECFDF5" : "#F3F4F6",
                            color: onlineDoctorsCount > 0 ? "#059669" : "#6B7280",
                            border: `1px solid ${onlineDoctorsCount > 0 ? "#A7F3D0" : "#E5E7EB"}`,
                        }}
                    >
                        <span
                            style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: onlineDoctorsCount > 0 ? "#10B981" : "#9CA3AF",
                            }}
                        />
                        {onlineDoctorsCount} {onlineDoctorsCount === 1 ? "Doctor" : "Doctors"} Available Now
                    </span>
                    <button
                        onClick={refreshDoctors}
                        style={{
                            padding: "6px 14px",
                            borderRadius: "var(--d-radius-sm)",
                            border: "1px solid var(--d-border)",
                            background: "var(--d-surface)",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            fontWeight: 500,
                        }}
                    >
                        Refresh Directory
                    </button>
                </div>
            </div>

            {/* Notification alert banner */}
            {statusMessage && (
                <div
                    style={{
                        padding: "14px 18px",
                        borderRadius: "var(--d-radius)",
                        marginBottom: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background:
                            statusMessage.type === "success"
                                ? "#ECFDF5"
                                : statusMessage.type === "error"
                                ? "#FEF2F2"
                                : "#EFF6FF",
                        border: `1px solid ${
                            statusMessage.type === "success"
                                ? "#A7F3D0"
                                : statusMessage.type === "error"
                                ? "#FCA5A5"
                                : "#BFDBFE"
                        }`,
                        color:
                            statusMessage.type === "success"
                                ? "#065F46"
                                : statusMessage.type === "error"
                                ? "#991B1B"
                                : "#1E40AF",
                    }}
                >
                    <span>{statusMessage.text}</span>
                    <button
                        onClick={() => setStatusMessage(null)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Live Video Consultation Viewport when in call */}
            {inCallRoomId && (
                <div style={{ marginBottom: "28px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--d-text)" }}>
                            Active Video Consultation
                        </h2>
                        <button
                            onClick={() => setInCallRoomId(null)}
                            style={{
                                padding: "6px 14px",
                                borderRadius: "var(--d-radius-sm)",
                                border: "1px solid var(--d-border)",
                                background: "var(--d-surface)",
                                cursor: "pointer",
                                fontSize: "0.82rem",
                                fontWeight: 600,
                            }}
                        >
                            Minimize Video
                        </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
                        <VideoPanel
                            roomId={inCallRoomId}
                            currentUserRole="patient"
                            currentUserName={patientName}
                            peerName={activeRequest?.doctor_name}
                            onCallEnd={() => {
                                setInCallRoomId(null);
                                setActiveRequest(null);
                            }}
                        />
                        <VoicePanel
                            roomId={inCallRoomId}
                            currentUserRole="patient"
                            currentUserName={patientName}
                        />
                    </div>
                </div>
            )}

            {/* Active Request Status Section */}
            {activeRequest && !inCallRoomId && (
                <div
                    className="card"
                    style={{
                        marginBottom: "28px",
                        borderLeft: `5px solid ${
                            activeRequest.status === "accepted"
                                ? "#10B981"
                                : activeRequest.status === "rejected"
                                ? "#EF4444"
                                : "#F59E0B"
                        }`,
                        background:
                            activeRequest.status === "accepted"
                                ? "linear-gradient(to right, #F0FDF4, #FFFFFF)"
                                : activeRequest.status === "rejected"
                                ? "linear-gradient(to right, #FEF2F2, #FFFFFF)"
                                : "linear-gradient(to right, #FFFBEB, #FFFFFF)",
                    }}
                >
                    <div style={{ padding: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                                    <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                                        {activeRequest.status === "pending" && "Waiting for Doctor Acceptance..."}
                                        {activeRequest.status === "accepted" && "Consultation Request Accepted!"}
                                        {activeRequest.status === "rejected" && "Consultation Request Declined"}
                                    </h3>
                                    <span
                                        className={`status-badge ${
                                            activeRequest.status === "accepted"
                                                ? "completed"
                                                : activeRequest.status === "rejected"
                                                ? "reviewed"
                                                : "processing"
                                        }`}
                                    >
                                        {activeRequest.status.toUpperCase()}
                                    </span>
                                </div>
                                <p style={{ margin: "4px 0", color: "var(--d-text)", fontSize: "0.92rem" }}>
                                    <strong>Physician:</strong> {activeRequest.doctor_name || "Assigned Doctor"}
                                </p>
                                <p style={{ margin: "4px 0", color: "var(--d-text)", fontSize: "0.92rem" }}>
                                    <strong>Reason:</strong> {activeRequest.reason}
                                </p>
                                <p style={{ margin: "4px 0", color: "var(--d-text-muted)", fontSize: "0.82rem" }}>
                                    Session Reference ID: <code>{activeRequest.room_id}</code>
                                </p>
                            </div>

                            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                {activeRequest.status === "pending" && (
                                    <button
                                        onClick={handleCancelRequest}
                                        disabled={cancelling}
                                        style={{
                                            padding: "8px 16px",
                                            borderRadius: "var(--d-radius-sm)",
                                            border: "1px solid #DC2626",
                                            background: "#FFF",
                                            color: "#DC2626",
                                            fontWeight: 600,
                                            fontSize: "0.85rem",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {cancelling ? "Cancelling..." : "Cancel Request"}
                                    </button>
                                )}

                                {activeRequest.status === "accepted" && (
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            onClick={() => setInCallRoomId(activeRequest.room_id)}
                                            style={{
                                                padding: "8px 18px",
                                                borderRadius: "var(--d-radius-sm)",
                                                background: "#10B981",
                                                color: "#FFF",
                                                fontWeight: 600,
                                                fontSize: "0.88rem",
                                                cursor: "pointer",
                                                border: "none",
                                            }}
                                        >
                                            Join Video Consultation
                                        </button>
                                        <button
                                            onClick={() => setActiveRequest(null)}
                                            style={{
                                                padding: "8px 12px",
                                                borderRadius: "var(--d-radius-sm)",
                                                border: "1px solid var(--d-border)",
                                                background: "#FFF",
                                                cursor: "pointer",
                                                fontSize: "0.85rem",
                                            }}
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                )}

                                {activeRequest.status === "rejected" && (
                                    <button
                                        onClick={() => setActiveRequest(null)}
                                        style={{
                                            padding: "8px 16px",
                                            borderRadius: "var(--d-radius-sm)",
                                            border: "1px solid var(--d-border)",
                                            background: "var(--d-surface)",
                                            cursor: "pointer",
                                            fontSize: "0.85rem",
                                            fontWeight: 600,
                                        }}
                                    >
                                        Select Another Doctor
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Doctors Grid */}
            <div style={{ marginBottom: "16px" }}>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 16px 0", color: "var(--d-text)" }}>
                    Available Registered Physicians
                </h2>

                {loadingDoctors ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "var(--d-text-muted)" }}>
                        Loading doctor availability...
                    </div>
                ) : doctors.length === 0 ? (
                    <div className="card" style={{ padding: "32px", textAlign: "center", color: "var(--d-text-muted)" }}>
                        No registered doctors found in the directory.
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: "20px" }}>
                        {doctors.map((doc) => {
                            const isPendingWithThisDoc = activeRequest?.doctor_id === doc.id && activeRequest.status === "pending";

                            return (
                                <div
                                    key={doc.id}
                                    className="card"
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "space-between",
                                        transition: "transform 0.2s, box-shadow 0.2s",
                                        border: doc.is_online ? "1px solid #A7F3D0" : "1px solid var(--d-border)",
                                    }}
                                >
                                    <div style={{ padding: "20px" }}>
                                        {/* Top card row: Avatar & Online Badge */}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                                            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                                <div
                                                    style={{
                                                        width: "48px",
                                                        height: "48px",
                                                        borderRadius: "50%",
                                                        background: doc.is_online ? "var(--d-primary-light)" : "#E2E8F0",
                                                        color: doc.is_online ? "var(--d-primary)" : "var(--d-text-muted)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontWeight: 700,
                                                        fontSize: "1.1rem",
                                                    }}
                                                >
                                                    {doc.name.replace(/^Dr\.\s*/i, "").substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--d-text)" }}>
                                                        {doc.name.startsWith("Dr") ? doc.name : `Dr. ${doc.name}`}
                                                    </h3>
                                                    <div style={{ fontSize: "0.82rem", color: "var(--d-primary)", fontWeight: 500, marginTop: "2px" }}>
                                                        {doc.specialization}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Presence indicator */}
                                            <span
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "5px",
                                                    fontSize: "0.75rem",
                                                    fontWeight: 600,
                                                    padding: "4px 8px",
                                                    borderRadius: "12px",
                                                    background: doc.is_online ? "#ECFDF5" : "#F3F4F6",
                                                    color: doc.is_online ? "#059669" : "#6B7280",
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        width: "6px",
                                                        height: "6px",
                                                        borderRadius: "50%",
                                                        background: doc.is_online ? "#10B981" : "#9CA3AF",
                                                    }}
                                                />
                                                {doc.is_online ? "Available" : "Offline"}
                                            </span>
                                        </div>

                                        {/* Doctor details */}
                                        <div style={{ fontSize: "0.84rem", color: "var(--d-text-muted)", lineHeight: 1.5, marginBottom: "16px" }}>
                                            <div><strong>Experience:</strong> {doc.experience}</div>
                                            <div>
                                                <strong>Status:</strong>{" "}
                                                {doc.is_online ? (
                                                    <span style={{ color: "#059669" }}>Active &amp; ready for calls</span>
                                                ) : (
                                                    <span>Currently offline</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action button */}
                                    <div style={{ padding: "14px 20px", borderTop: "1px solid var(--d-border)", background: "var(--d-surface-hover)" }}>
                                        <button
                                            onClick={() => setSelectedDoctor(doc)}
                                            disabled={!doc.is_online || (activeRequest?.status === "pending")}
                                            style={{
                                                width: "100%",
                                                padding: "10px",
                                                borderRadius: "var(--d-radius-sm)",
                                                border: "none",
                                                background: isPendingWithThisDoc
                                                    ? "#F59E0B"
                                                    : doc.is_online
                                                    ? "var(--d-primary)"
                                                    : "#94A3B8",
                                                color: "#FFF",
                                                fontWeight: 600,
                                                fontSize: "0.88rem",
                                                cursor: doc.is_online && activeRequest?.status !== "pending" ? "pointer" : "not-allowed",
                                                transition: "all 0.2s",
                                            }}
                                        >
                                            {isPendingWithThisDoc
                                                ? "Request Pending..."
                                                : doc.is_online
                                                ? "Request Live Consultation"
                                                : "Physician Offline"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Request Consultation Modal */}
            {selectedDoctor && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(15, 23, 42, 0.6)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: "20px",
                    }}
                >
                    <div
                        className="card"
                        style={{
                            maxWidth: "520px",
                            width: "100%",
                            background: "var(--d-surface)",
                            borderRadius: "var(--d-radius-lg)",
                            boxShadow: "var(--d-shadow-lg)",
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                padding: "20px 24px",
                                borderBottom: "1px solid var(--d-border)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Request Consultation</h2>
                            <button
                                onClick={() => setSelectedDoctor(null)}
                                style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "var(--d-text-muted)" }}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSendRequest} style={{ padding: "24px" }}>
                            {/* Doctor Summary Header */}
                            <div
                                style={{
                                    padding: "12px 16px",
                                    background: "var(--d-primary-light)",
                                    borderRadius: "var(--d-radius-sm)",
                                    marginBottom: "18px",
                                }}
                            >
                                <div style={{ fontWeight: 700, color: "var(--d-primary)", fontSize: "0.95rem" }}>
                                    {selectedDoctor.name.startsWith("Dr") ? selectedDoctor.name : `Dr. ${selectedDoctor.name}`}
                                </div>
                                <div style={{ fontSize: "0.82rem", color: "var(--d-text)" }}>
                                    {selectedDoctor.specialization} • {selectedDoctor.experience}
                                </div>
                            </div>

                            {/* Reason for Consultation */}
                            <div style={{ marginBottom: "18px" }}>
                                <label
                                    htmlFor="consultation-reason"
                                    style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "6px" }}
                                >
                                    Chief Complaint / Symptoms *
                                </label>
                                <textarea
                                    id="consultation-reason"
                                    rows={4}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Describe your symptoms (e.g. throbbing headache for 3 days, mild fever, nausea)..."
                                    required
                                    style={{
                                        width: "100%",
                                        padding: "10px 14px",
                                        borderRadius: "var(--d-radius-sm)",
                                        border: "1px solid var(--d-border)",
                                        background: "var(--d-surface)",
                                        color: "var(--d-text)",
                                        fontFamily: "var(--font)",
                                        fontSize: "0.9rem",
                                        resize: "vertical",
                                    }}
                                />
                            </div>

                            {/* Urgency Level */}
                            <div style={{ marginBottom: "24px" }}>
                                <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "8px" }}>
                                    Consultation Priority
                                </label>
                                <div style={{ display: "flex", gap: "12px" }}>
                                    <label
                                        style={{
                                            flex: 1,
                                            padding: "10px 14px",
                                            borderRadius: "var(--d-radius-sm)",
                                            border: `1px solid ${urgency === "routine" ? "var(--d-primary)" : "var(--d-border)"}`,
                                            background: urgency === "routine" ? "var(--d-primary-light)" : "transparent",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            fontSize: "0.88rem",
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="urgency"
                                            value="routine"
                                            checked={urgency === "routine"}
                                            onChange={() => setUrgency("routine")}
                                        />
                                        <span>Standard Routine</span>
                                    </label>
                                    <label
                                        style={{
                                            flex: 1,
                                            padding: "10px 14px",
                                            borderRadius: "var(--d-radius-sm)",
                                            border: `1px solid ${urgency === "urgent" ? "#EF4444" : "var(--d-border)"}`,
                                            background: urgency === "urgent" ? "#FEF2F2" : "transparent",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            fontSize: "0.88rem",
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="urgency"
                                            value="urgent"
                                            checked={urgency === "urgent"}
                                            onChange={() => setUrgency("urgent")}
                                        />
                                        <span style={{ color: urgency === "urgent" ? "#DC2626" : "inherit", fontWeight: 600 }}>
                                            High Priority
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedDoctor(null)}
                                    disabled={submitting}
                                    style={{
                                        padding: "10px 18px",
                                        borderRadius: "var(--d-radius-sm)",
                                        border: "1px solid var(--d-border)",
                                        background: "transparent",
                                        cursor: "pointer",
                                        fontSize: "0.88rem",
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        padding: "10px 22px",
                                        borderRadius: "var(--d-radius-sm)",
                                        border: "none",
                                        background: "var(--d-primary)",
                                        color: "#FFF",
                                        fontWeight: 600,
                                        fontSize: "0.88rem",
                                        cursor: submitting ? "not-allowed" : "pointer",
                                    }}
                                >
                                    {submitting ? "Sending Request..." : "Send Request Now"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PatientConsultationPage() {
    return (
        <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "var(--d-text-muted)" }}>Loading consultation directory...</div>}>
            <PatientConsultationContent />
        </Suspense>
    );
}
