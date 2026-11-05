"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase";
import {
    getConsultationHistory,
    getClinicalReports,
    type CompletedConsultation,
    type ClinicalReport,
} from "@/lib/consultationService";
import ClinicalReportModal from "@/components/ClinicalReportModal";

export default function PatientHistoryPage() {
    const { user } = useAuth();
    const [history, setHistory] = useState<CompletedConsultation[]>([]);
    const [reports, setReports] = useState<ClinicalReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedConsultation, setSelectedConsultation] = useState<CompletedConsultation | null>(null);
    const [activeReport, setActiveReport] = useState<ClinicalReport | null>(null);
    const [activeDoctorName, setActiveDoctorName] = useState<string>("Doctor");
    const [activePatientName, setActivePatientName] = useState<string>("Patient");
    const [patientProfileName, setPatientProfileName] = useState<string>("Patient");
    const [copySuccess, setCopySuccess] = useState(false);

    const loadHistoryAndReports = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const supabase = createClient();
            const { data: prof } = await supabase
                .from("user_profiles")
                .select("name")
                .eq("id", user.id)
                .maybeSingle();

            const resolvedPatientName =
                prof?.name ||
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                user.email?.split("@")[0] ||
                "Patient";
            setPatientProfileName(resolvedPatientName);

            const [historyData, reportsData] = await Promise.all([
                getConsultationHistory(user.id, "patient"),
                getClinicalReports(user.id, "patient"),
            ]);
            setHistory(historyData);
            // Patients only receive approved reports (filtered by backend or client)
            setReports(reportsData.filter((r) => r.status === "approved"));
        } catch (err) {
            console.error("Failed to load patient history and reports:", err);
        } finally {
            setLoading(false);
        }
    }, [user?.id, user?.user_metadata, user?.email]);

    useEffect(() => {
        loadHistoryAndReports();
    }, [loadHistoryAndReports]);

    const formatDuration = (secs: number) => {
        if (!secs || secs <= 0) return "< 1 min";
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}m ${s.toString().padStart(2, "0")}s`;
    };

    const formatDate = (isoString?: string) => {
        if (!isoString) return "Recent";
        try {
            const d = new Date(isoString);
            return d.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return isoString;
        }
    };

    const handleCopyTranscript = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
    };

    const getReportForItem = (item: CompletedConsultation): ClinicalReport | undefined => {
        return reports.find(
            (r) =>
                (r.room_id && r.room_id === item.roomId) ||
                (r.doctor_id === item.doctorId && r.patient_id === item.patientId)
        );
    };

    return (
        <div style={{ paddingBottom: "40px" }}>
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Consultation History</h1>
                    <p style={{ color: "var(--d-text-muted)", marginTop: "4px" }}>
                        Review past clinical encounters, approved medical summaries, diagnoses, and saved transcripts
                    </p>
                </div>
                <button
                    onClick={loadHistoryAndReports}
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
                    Refresh
                </button>
            </div>

            <div className="dashboard-grid">
                <div className="card full-width">
                    <div className="card-header">
                        <div className="card-header-left">
                            <div className="card-header-icon green">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                            </div>
                            <div>
                                <div className="card-title">Past Medical Encounters</div>
                                <div className="card-subtitle">
                                    {history.length} {history.length === 1 ? "record" : "records"} found in EMR database
                                </div>
                            </div>
                        </div>
                        <span className="status-badge completed">Verified EMR</span>
                    </div>

                    <div className="card-body" style={{ padding: 0 }}>
                        {loading ? (
                            <div style={{ padding: "40px", textAlign: "center", color: "var(--d-text-muted)" }}>
                                Loading your consultation history...
                            </div>
                        ) : history.length === 0 ? (
                            <div style={{ padding: "50px 20px", textAlign: "center", color: "var(--d-text-muted)" }}>
                                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }}>
                                    <rect x="2" y="4" width="20" height="16" rx="2" />
                                    <path d="M7 15h0M2 9.5h20" />
                                </svg>
                                <h3 style={{ margin: "0 0 6px 0", fontSize: "1.1rem" }}>No Past Consultations Yet</h3>
                                <p style={{ margin: 0, fontSize: "0.85rem" }}>
                                    When you finish a live video consultation with a doctor, your session records and doctor-approved clinical summaries will be listed here.
                                </p>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "1px solid var(--d-border)", background: "var(--d-surface-alt, #F8FAFC)" }}>
                                            <th style={{ padding: "12px 18px", fontWeight: 600, color: "var(--d-text-muted)" }}>Date &amp; Time</th>
                                            <th style={{ padding: "12px 18px", fontWeight: 600, color: "var(--d-text-muted)" }}>Physician</th>
                                            <th style={{ padding: "12px 18px", fontWeight: 600, color: "var(--d-text-muted)" }}>Consultation Reason</th>
                                            <th style={{ padding: "12px 18px", fontWeight: 600, color: "var(--d-text-muted)" }}>Duration</th>
                                            <th style={{ padding: "12px 18px", fontWeight: 600, color: "var(--d-text-muted)" }}>Doctor Report</th>
                                            <th style={{ padding: "12px 18px", fontWeight: 600, color: "var(--d-text-muted)", textAlign: "right" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((item) => {
                                            const matchedReport = getReportForItem(item);

                                            return (
                                                <tr key={item.id} style={{ borderBottom: "1px solid var(--d-border)" }}>
                                                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                                                        <strong>{formatDate(item.createdAt)}</strong>
                                                    </td>
                                                    <td style={{ padding: "14px 18px" }}>
                                                        <span style={{ fontWeight: 600, color: "var(--d-primary)" }}>{item.doctorName}</span>
                                                    </td>
                                                    <td style={{ padding: "14px 18px", maxWidth: "240px" }}>
                                                        <span style={{ display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "230px" }}>
                                                            {item.reason || "General Medical Consultation"}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                                                        {formatDuration(item.duration)}
                                                    </td>
                                                    <td style={{ padding: "14px 18px" }}>
                                                        {matchedReport ? (
                                                            <span
                                                                style={{
                                                                    fontSize: "0.75rem",
                                                                    fontWeight: 700,
                                                                    padding: "3px 8px",
                                                                    borderRadius: "10px",
                                                                    background: "#DCFCE7",
                                                                    color: "#15803D",
                                                                    border: "1px solid #86EFAC",
                                                                }}
                                                            >
                                                                ✓ Approved EMR
                                                            </span>
                                                        ) : (
                                                            <span
                                                                style={{
                                                                    fontSize: "0.75rem",
                                                                    color: "var(--d-text-muted)",
                                                                }}
                                                            >
                                                                In Review
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                                                        <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                                                            {matchedReport && (
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveDoctorName(item.doctorName || matchedReport.doctor_name || "Doctor");
                                                                        setActivePatientName(item.patientName || matchedReport.patient_name || patientProfileName || "Patient");
                                                                        setActiveReport(matchedReport);
                                                                    }}
                                                                    style={{
                                                                        padding: "6px 12px",
                                                                        borderRadius: "var(--d-radius-sm)",
                                                                        border: "1px solid #16A34A",
                                                                        background: "#F0FDF4",
                                                                        color: "#166534",
                                                                        fontWeight: 700,
                                                                        cursor: "pointer",
                                                                        fontSize: "0.82rem",
                                                                    }}
                                                                >
                                                                    View Clinical Report
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setSelectedConsultation(item)}
                                                                style={{
                                                                    padding: "6px 12px",
                                                                    borderRadius: "var(--d-radius-sm)",
                                                                    border: "1px solid var(--d-primary)",
                                                                    background: "transparent",
                                                                    color: "var(--d-primary)",
                                                                    fontWeight: 600,
                                                                    cursor: "pointer",
                                                                    fontSize: "0.82rem",
                                                                }}
                                                            >
                                                                Transcript
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Approved Clinical Report Modal for Patient (Read-Only) */}
            {activeReport && user?.id && (
                <ClinicalReportModal
                    report={activeReport}
                    patientName={activePatientName || patientProfileName || "Patient"}
                    doctorName={activeDoctorName || activeReport.doctor_name || "Doctor"}
                    currentUserRole="patient"
                    currentUserId={user.id}
                    onClose={() => setActiveReport(null)}
                />
            )}

            {/* Transcript Modal Dialog */}
            {selectedConsultation && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(15, 23, 42, 0.6)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 100,
                        padding: "20px",
                    }}
                >
                    <div
                        style={{
                            background: "var(--d-surface, #FFFFFF)",
                            borderRadius: "var(--d-radius, 12px)",
                            maxWidth: "700px",
                            width: "100%",
                            maxHeight: "85vh",
                            display: "flex",
                            flexDirection: "column",
                            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                            border: "1px solid var(--d-border)",
                            overflow: "hidden",
                        }}
                    >
                        {/* Modal Header */}
                        <div
                            style={{
                                padding: "18px 24px",
                                borderBottom: "1px solid var(--d-border)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <div>
                                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                                    Consultation Speech Transcript
                                </h3>
                                <p style={{ margin: "3px 0 0", color: "var(--d-text-muted)", fontSize: "0.82rem" }}>
                                    Physician: <strong>{selectedConsultation.doctorName}</strong> • {formatDate(selectedConsultation.createdAt)}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedConsultation(null)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    fontSize: "1.4rem",
                                    color: "var(--d-text-muted)",
                                    cursor: "pointer",
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Metadata Summary */}
                        <div
                            style={{
                                padding: "12px 24px",
                                background: "var(--d-surface-alt, #F8FAFC)",
                                borderBottom: "1px solid var(--d-border)",
                                display: "flex",
                                gap: "20px",
                                fontSize: "0.82rem",
                                color: "var(--d-text)",
                                flexWrap: "wrap",
                            }}
                        >
                            <div>
                                <span style={{ color: "var(--d-text-muted)" }}>Session Duration:</span>{" "}
                                <strong>{formatDuration(selectedConsultation.duration)}</strong>
                            </div>
                            <div>
                                <span style={{ color: "var(--d-text-muted)" }}>Physician:</span>{" "}
                                <strong>{selectedConsultation.doctorName}</strong>
                            </div>
                            <div>
                                <span style={{ color: "var(--d-text-muted)" }}>Reason:</span>{" "}
                                <strong>{selectedConsultation.reason || "General Medical Consultation"}</strong>
                            </div>
                        </div>

                        {/* Transcript Dialogue Content */}
                        <div
                            style={{
                                padding: "20px 24px",
                                overflowY: "auto",
                                flex: 1,
                                fontSize: "0.9rem",
                                lineHeight: "1.6",
                            }}
                        >
                            {selectedConsultation.transcript ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {selectedConsultation.transcript.split("\n").map((line, idx) => {
                                        const isDoctor = line.startsWith("[Dr") || line.startsWith("[Doctor");
                                        return (
                                            <div
                                                key={idx}
                                                style={{
                                                    padding: "10px 14px",
                                                    borderRadius: "8px",
                                                    background: isDoctor ? "#EFF6FF" : "#F0FDF4",
                                                    border: `1px solid ${isDoctor ? "#BFDBFE" : "#BBF7D0"}`,
                                                    color: isDoctor ? "#1E40AF" : "#166534",
                                                }}
                                            >
                                                {line}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p style={{ color: "var(--d-text-muted)", fontStyle: "italic", textAlign: "center", margin: "40px 0" }}>
                                    No speech dialogue was recorded for this session.
                                </p>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div
                            style={{
                                padding: "14px 24px",
                                borderTop: "1px solid var(--d-border)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                background: "var(--d-surface, #FFFFFF)",
                            }}
                        >
                            {selectedConsultation.transcript ? (
                                <button
                                    onClick={() => handleCopyTranscript(selectedConsultation.transcript)}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: "var(--d-radius-sm)",
                                        border: "1px solid var(--d-border)",
                                        background: "transparent",
                                        cursor: "pointer",
                                        fontSize: "0.85rem",
                                        fontWeight: 600,
                                        color: copySuccess ? "#16A34A" : "var(--d-text)",
                                    }}
                                >
                                    {copySuccess ? "✓ Copied to Clipboard" : "Copy Dialogue Log"}
                                </button>
                            ) : (
                                <div />
                            )}

                            <button
                                onClick={() => setSelectedConsultation(null)}
                                style={{
                                    padding: "8px 20px",
                                    borderRadius: "var(--d-radius-sm)",
                                    border: "none",
                                    background: "var(--d-primary)",
                                    color: "#FFF",
                                    cursor: "pointer",
                                    fontSize: "0.85rem",
                                    fontWeight: 600,
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
