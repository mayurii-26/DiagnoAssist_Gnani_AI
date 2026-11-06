"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase";
import {
    getConsultationHistory,
    getClinicalReports,
    generateClinicalReport,
    translateTranscript,
    SUPPORTED_MULTILINGUAL_LANGUAGES,
    type CompletedConsultation,
    type ClinicalReport,
} from "@/lib/consultationService";
import ClinicalReportModal from "@/components/ClinicalReportModal";

export default function DoctorHistoryPage() {
    const { user } = useAuth();
    const [history, setHistory] = useState<CompletedConsultation[]>([]);
    const [reports, setReports] = useState<ClinicalReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedConsultation, setSelectedConsultation] = useState<CompletedConsultation | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);

    // Multilingual Transcript State
    const [transcriptLang, setTranscriptLang] = useState<string>("en");
    const [isTranslatingTranscript, setIsTranslatingTranscript] = useState(false);
    const [transcriptTranslations, setTranscriptTranslations] = useState<Record<string, Record<string, string>>>({});
    const [transcriptTransError, setTranscriptTransError] = useState<string | null>(null);

    const handleTranscriptLangChange = async (targetLang: string) => {
        if (!selectedConsultation || !selectedConsultation.transcript) return;
        setTranscriptLang(targetLang);
        setTranscriptTransError(null);
        if (targetLang === "en") return;

        const consultId = selectedConsultation.id || selectedConsultation.roomId;
        if (transcriptTranslations[consultId]?.[targetLang]) {
            return;
        }

        setIsTranslatingTranscript(true);
        try {
            const translated = await translateTranscript(
                selectedConsultation.transcript,
                targetLang,
                consultId,
                "en"
            );
            setTranscriptTranslations((prev) => ({
                ...prev,
                [consultId]: {
                    ...(prev[consultId] || {}),
                    [targetLang]: translated,
                },
            }));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Translation failed";
            setTranscriptTransError(msg);
        } finally {
            setIsTranslatingTranscript(false);
        }
    };

    // Phase 4: Clinical Report Modal state
    const [activeReport, setActiveReport] = useState<ClinicalReport | null>(null);
    const [reportPatientName, setReportPatientName] = useState<string>("Patient");
    const [doctorProfileName, setDoctorProfileName] = useState<string>("Dr. Physician");
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [genError, setGenError] = useState<string | null>(null);

    const loadHistoryAndReports = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const supabase = createClient();
            const { data: prof } = await supabase
                .from("user_profiles")
                .select("name, specialization")
                .eq("id", user.id)
                .maybeSingle();

            const resolvedDocName =
                prof?.name ||
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                "Dr. Physician";
            setDoctorProfileName(resolvedDocName);

            const [historyData, reportsData] = await Promise.all([
                getConsultationHistory(user.id, "doctor"),
                getClinicalReports(user.id, "doctor"),
            ]);
            setHistory(historyData);
            setReports(reportsData);
        } catch (err) {
            console.error("Failed to load doctor history and clinical reports:", err);
        } finally {
            setLoading(false);
        }
    }, [user?.id, user?.user_metadata]);

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

    // Find existing clinical report for a consultation item
    const getReportForItem = (item: CompletedConsultation): ClinicalReport | undefined => {
        return reports.find(
            (r) =>
                (r.room_id && r.room_id === item.roomId) ||
                (r.patient_id === item.patientId && r.doctor_id === item.doctorId)
        );
    };

    // Handle Generate AI Report
    const handleGenerateReport = async (item: CompletedConsultation) => {
        if (!user?.id) return;
        setGeneratingId(item.id);
        setGenError(null);

        try {
            const docName = doctorProfileName || user.user_metadata?.full_name || "Doctor";
            const res = await generateClinicalReport({
                transcriptId: item.transcriptId,
                roomId: item.roomId,
                doctorId: user.id,
                patientId: item.patientId,
                transcript: item.transcript,
                patientName: item.patientName,
                doctorName: docName,
            });

            if (res.success && res.report) {
                // Add or update report in state
                const enriched: ClinicalReport = {
                    ...res.report,
                    doctor_name: docName,
                    patient_name: item.patientName,
                };
                setReports((prev) => [enriched, ...prev.filter((r) => r.id !== enriched.id)]);
                setReportPatientName(item.patientName);
                setActiveReport(enriched);
            } else {
                setGenError(res.error || "Failed to generate report from transcript");
            }
        } catch (e: any) {
            setGenError(e.message || "Error generating report");
        } finally {
            setGeneratingId(null);
        }
    };

    const handleOpenExistingReport = (report: ClinicalReport, patientName: string) => {
        setReportPatientName(patientName || report.patient_name || "Patient");
        setActiveReport(report);
    };

    return (
        <div style={{ paddingBottom: "40px" }}>
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Patient Consultation Records</h1>
                    <p style={{ color: "var(--d-text-muted)", marginTop: "4px" }}>
                        Archived clinical encounters, dialogue transcripts, and AI-powered structured EMR documentation
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
                    Refresh Records
                </button>
            </div>

            {genError && (
                <div
                    style={{
                        padding: "10px 16px",
                        background: "#FEE2E2",
                        color: "#991B1B",
                        borderRadius: "8px",
                        marginBottom: "16px",
                        fontSize: "0.85rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <span>⚠️ {genError}</span>
                    <button
                        onClick={() => setGenError(null)}
                        style={{ background: "none", border: "none", color: "#991B1B", cursor: "pointer", fontWeight: 700 }}
                    >
                        ✕
                    </button>
                </div>
            )}

            <div className="dashboard-grid">
                <div className="card full-width">
                    <div className="card-header">
                        <div className="card-header-left">
                            <div className="card-header-icon blue">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                            </div>
                            <div>
                                <div className="card-title">Completed Consultations &amp; Clinical EMR</div>
                                <div className="card-subtitle">
                                    {history.length} {history.length === 1 ? "consultation" : "consultations"} documented
                                </div>
                            </div>
                        </div>
                        <span className="status-badge completed">Verified EMR</span>
                    </div>

                    {/* Multilingual Notice Banner */}
                    <div
                        style={{
                            padding: "10px 22px",
                            background: "linear-gradient(90deg, #EFF6FF 0%, #F0FDF4 100%)",
                            borderBottom: "1px solid #DBEAFE",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "0.82rem",
                            color: "#1E40AF",
                            flexWrap: "wrap",
                            gap: "8px",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>🌐</span>
                            <span>
                                <strong>Multilingual Clinical Intelligence Active:</strong> Click <strong>&quot;🌐 Transcript&quot;</strong> to translate dialogue into 9 Indian languages, or <strong>&quot;Review Draft&quot;</strong> to translate clinical EMRs and use voice dictation.
                            </span>
                        </div>
                        <span style={{ fontSize: "0.75rem", background: "#DBEAFE", color: "#1D4ED8", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>
                            Gnani AI Vachana
                        </span>
                    </div>

                    <div className="card-body" style={{ padding: 0 }}>
                        {loading ? (
                            <div style={{ padding: "40px", textAlign: "center", color: "var(--d-text-muted)" }}>
                                Loading patient consultation history &amp; EMR records...
                            </div>
                        ) : history.length === 0 ? (
                            <div style={{ padding: "50px 20px", textAlign: "center", color: "var(--d-text-muted)" }}>
                                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }}>
                                    <rect x="2" y="4" width="20" height="16" rx="2" />
                                    <path d="M7 15h0M2 9.5h20" />
                                </svg>
                                <h3 style={{ margin: "0 0 6px 0", fontSize: "1.1rem" }}>No Completed Consultations Yet</h3>
                                <p style={{ margin: 0, fontSize: "0.85rem" }}>
                                    When you accept and finish consultations with patients, their session logs, transcripts, and AI reports will be stored here.
                                </p>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "1px solid var(--d-border)", background: "var(--d-surface-alt, #F8FAFC)" }}>
                                            <th style={{ padding: "12px 18px", fontWeight: 600, color: "var(--d-text-muted)" }}>Date &amp; Time</th>
                                            <th style={{ padding: "12px 18px", fontWeight: 600, color: "var(--d-text-muted)" }}>Patient Name</th>
                                            <th style={{ padding: "12px 18px", fontWeight: 600, color: "var(--d-text-muted)" }}>Reason</th>
                                            <th style={{ padding: "12px 18px", fontWeight: 600, color: "var(--d-text-muted)" }}>Duration</th>
                                            <th style={{ padding: "12px 18px", fontWeight: 600, color: "var(--d-text-muted)" }}>EMR Report Status</th>
                                            <th style={{ padding: "12px 18px", fontWeight: 600, color: "var(--d-text-muted)", textAlign: "right" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((item) => {
                                            const matchedReport = getReportForItem(item);
                                            const isGenerating = generatingId === item.id;

                                            return (
                                                <tr key={item.id} style={{ borderBottom: "1px solid var(--d-border)" }}>
                                                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                                                        <strong>{formatDate(item.createdAt)}</strong>
                                                    </td>
                                                    <td style={{ padding: "14px 18px" }}>
                                                        <span style={{ fontWeight: 600, color: "var(--d-text)" }}>{item.patientName}</span>
                                                    </td>
                                                    <td style={{ padding: "14px 18px", maxWidth: "220px" }}>
                                                        <span style={{ display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
                                                            {item.reason || "Clinical Consultation"}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                                                        {formatDuration(item.duration)}
                                                    </td>
                                                    <td style={{ padding: "14px 18px" }}>
                                                        {matchedReport?.status === "approved" ? (
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
                                                        ) : matchedReport?.status === "draft" ? (
                                                            <span
                                                                style={{
                                                                    fontSize: "0.75rem",
                                                                    fontWeight: 700,
                                                                    padding: "3px 8px",
                                                                    borderRadius: "10px",
                                                                    background: "#FEF3C7",
                                                                    color: "#B45309",
                                                                    border: "1px solid #FDE68A",
                                                                }}
                                                            >
                                                                ⚠ Draft Review
                                                            </span>
                                                        ) : item.transcript ? (
                                                            <span
                                                                style={{
                                                                    fontSize: "0.75rem",
                                                                    fontWeight: 600,
                                                                    padding: "3px 8px",
                                                                    borderRadius: "10px",
                                                                    background: "#EFF6FF",
                                                                    color: "#1E40AF",
                                                                    border: "1px solid #BFDBFE",
                                                                }}
                                                            >
                                                                Transcript Saved
                                                            </span>
                                                        ) : (
                                                            <span
                                                                style={{
                                                                    fontSize: "0.75rem",
                                                                    color: "var(--d-text-muted)",
                                                                }}
                                                            >
                                                                No Speech Log
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                                                        <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                                                            {/* AI Clinical Report Action */}
                                                            {matchedReport ? (
                                                                <button
                                                                    onClick={() => handleOpenExistingReport(matchedReport, item.patientName)}
                                                                    style={{
                                                                        padding: "6px 12px",
                                                                        borderRadius: "var(--d-radius-sm)",
                                                                        border: `1px solid ${matchedReport.status === "approved" ? "#16A34A" : "#D97706"}`,
                                                                        background: matchedReport.status === "approved" ? "#F0FDF4" : "#FFFBEB",
                                                                        color: matchedReport.status === "approved" ? "#166534" : "#B45309",
                                                                        fontWeight: 700,
                                                                        cursor: "pointer",
                                                                        fontSize: "0.82rem",
                                                                    }}
                                                                >
                                                                    {matchedReport.status === "approved" ? "View EMR Report" : "Review Draft"}
                                                                </button>
                                                            ) : item.transcript ? (
                                                                <button
                                                                    onClick={() => handleGenerateReport(item)}
                                                                    disabled={isGenerating}
                                                                    style={{
                                                                        padding: "6px 12px",
                                                                        borderRadius: "var(--d-radius-sm)",
                                                                        border: "none",
                                                                        background: isGenerating ? "#9CA3AF" : "#2563EB",
                                                                        color: "#FFF",
                                                                        fontWeight: 600,
                                                                        cursor: isGenerating ? "not-allowed" : "pointer",
                                                                        fontSize: "0.82rem",
                                                                        boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                                                                    }}
                                                                >
                                                                    {isGenerating ? "Analyzing..." : "⚡ Generate AI Report"}
                                                                </button>
                                                            ) : null}

                                                            {/* Transcript button */}
                                                            <button
                                                                onClick={() => setSelectedConsultation(item)}
                                                                style={{
                                                                    padding: "6px 12px",
                                                                    borderRadius: "var(--d-radius-sm)",
                                                                    border: "1px solid var(--d-border)",
                                                                    background: "#FFFFFF",
                                                                    color: "var(--d-text)",
                                                                    fontWeight: 600,
                                                                    cursor: "pointer",
                                                                    fontSize: "0.82rem",
                                                                }}
                                                            >
                                                                🌐 Transcript
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

            {/* Phase 4: Interactive Clinical Report Review & Sign-Off Modal */}
            {activeReport && user?.id && (
                <ClinicalReportModal
                    report={activeReport}
                    patientName={reportPatientName || activeReport.patient_name || "Patient"}
                    doctorName={activeReport.doctor_name || doctorProfileName || user?.user_metadata?.full_name || "Dr. Physician"}
                    currentUserRole="doctor"
                    currentUserId={user.id}
                    onClose={() => setActiveReport(null)}
                    onReportApproved={(approved) => {
                        // Update in state
                        setReports((prev) => [approved, ...prev.filter((r) => r.id !== approved.id)]);
                    }}
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
                        {/* Modal Header with Language Selector */}
                        <div
                            style={{
                                padding: "18px 24px",
                                borderBottom: "1px solid var(--d-border)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: "10px",
                            }}
                        >
                            <div>
                                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                                    EMR Clinical Transcript Review
                                </h3>
                                <p style={{ margin: "3px 0 0", color: "var(--d-text-muted)", fontSize: "0.82rem" }}>
                                    Patient: <strong>{selectedConsultation.patientName}</strong> • {formatDate(selectedConsultation.createdAt)}
                                </p>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                {/* Language dropdown */}
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <label htmlFor="doctor-transcript-lang" style={{ fontSize: "0.8rem", color: "var(--d-text-muted)", fontWeight: 500 }}>
                                        Language:
                                    </label>
                                    <select
                                        id="doctor-transcript-lang"
                                        value={transcriptLang}
                                        onChange={(e) => handleTranscriptLangChange(e.target.value)}
                                        style={{
                                            padding: "5px 10px",
                                            borderRadius: "var(--d-radius-sm)",
                                            border: "1px solid var(--d-border)",
                                            background: "var(--d-surface)",
                                            color: "var(--d-text)",
                                            fontSize: "0.82rem",
                                            fontWeight: 600,
                                            cursor: "pointer",
                                        }}
                                    >
                                        <option value="en">English (Original)</option>
                                        {SUPPORTED_MULTILINGUAL_LANGUAGES.filter((l) => l.code !== "en").map((l) => (
                                            <option key={l.code} value={l.code}>
                                                {l.native} ({l.label})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    onClick={() => {
                                        setSelectedConsultation(null);
                                        setTranscriptLang("en");
                                    }}
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
                        </div>

                        {/* Modal Metadata Summary */}
                        <div
                            style={{
                                padding: "12px 24px",
                                background: "var(--d-surface-alt, #F8FAFC)",
                                borderBottom: "1px solid var(--d-border)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "20px",
                                fontSize: "0.82rem",
                                color: "var(--d-text)",
                                flexWrap: "wrap",
                            }}
                        >
                            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                                <div>
                                    <span style={{ color: "var(--d-text-muted)" }}>Duration:</span>{" "}
                                    <strong>{formatDuration(selectedConsultation.duration)}</strong>
                                </div>
                                <div>
                                    <span style={{ color: "var(--d-text-muted)" }}>Room ID:</span>{" "}
                                    <code>{selectedConsultation.roomId}</code>
                                </div>
                                <div>
                                    <span style={{ color: "var(--d-text-muted)" }}>Chief Complaint:</span>{" "}
                                    <strong>{selectedConsultation.reason || "Clinical Encounter"}</strong>
                                </div>
                            </div>

                            {/* Status badge */}
                            <div>
                                {transcriptLang !== "en" ? (
                                    <span
                                        style={{
                                            padding: "3px 8px",
                                            borderRadius: "12px",
                                            fontSize: "0.74rem",
                                            fontWeight: 600,
                                            background: "#EFF6FF",
                                            color: "#1D4ED8",
                                            border: "1px solid #BFDBFE",
                                        }}
                                    >
                                        Gnani Translation ({SUPPORTED_MULTILINGUAL_LANGUAGES.find((l) => l.code === transcriptLang)?.label || transcriptLang})
                                    </span>
                                ) : (
                                    <span
                                        style={{
                                            padding: "3px 8px",
                                            borderRadius: "12px",
                                            fontSize: "0.74rem",
                                            fontWeight: 600,
                                            background: "#F3F4F6",
                                            color: "#4B5563",
                                        }}
                                    >
                                        Original Speech
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Translation progress feedback */}
                        {isTranslatingTranscript && (
                            <div
                                style={{
                                    padding: "8px 24px",
                                    background: "#FEF3C7",
                                    borderBottom: "1px solid #FCD34D",
                                    fontSize: "0.8rem",
                                    color: "#92400E",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}
                            >
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#F59E0B", animation: "pulse 1.2s infinite" }} />
                                Translating dialogue log into {SUPPORTED_MULTILINGUAL_LANGUAGES.find((l) => l.code === transcriptLang)?.label}...
                            </div>
                        )}

                        {transcriptTransError && (
                            <div
                                style={{
                                    padding: "8px 24px",
                                    background: "#FEE2E2",
                                    borderBottom: "1px solid #FCA5A5",
                                    fontSize: "0.8rem",
                                    color: "#B91C1C",
                                }}
                            >
                                ⚠️ Translation failed: {transcriptTransError} (Showing original English transcript)
                            </div>
                        )}

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
                                    {((transcriptLang !== "en" && transcriptTranslations[selectedConsultation.id || selectedConsultation.roomId]?.[transcriptLang]) || selectedConsultation.transcript)
                                        .split("\n")
                                        .map((line, idx) => {
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
                                    {copySuccess ? "✓ Copied to Clipboard" : "Copy EMR Transcript"}
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
