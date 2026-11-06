"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import MultilingualChatbot from "@/components/MultilingualChatbot";
import {
    getConsultationHistory,
    type CompletedConsultation,
} from "@/lib/consultationService";

export default function PatientDashboardPage() {
    const { user } = useAuth();
    const [recentConsultations, setRecentConsultations] = useState<CompletedConsultation[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const data = await getConsultationHistory(user.id, "patient");
            setRecentConsultations(data.slice(0, 5));
        } catch (err) {
            console.error("Failed to load patient dashboard visits:", err);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const formatDate = (isoString?: string) => {
        if (!isoString) return "Recent";
        try {
            return new Date(isoString).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            });
        } catch {
            return isoString;
        }
    };

    const formatDuration = (secs: number) => {
        if (!secs || secs <= 0) return "< 1 min";
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}m ${s.toString().padStart(2, "0")}s`;
    };

    return (
        <div style={{ paddingBottom: "40px" }}>
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Patient Health Dashboard</h1>
                    <p style={{ color: "var(--d-text-muted)", marginTop: "4px" }}>
                        Overview of your clinical consultations and health journey
                    </p>
                </div>
                <Link
                    href="/patient/consultation"
                    style={{
                        padding: "10px 20px",
                        borderRadius: "var(--d-radius-sm)",
                        background: "var(--d-primary)",
                        color: "#FFF",
                        fontWeight: 600,
                        fontSize: "0.88rem",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                    Consult a Doctor Now
                </Link>
            </div>

            <div className="dashboard-grid">
                {/* Health Analytics Card */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-header-left">
                            <div className="card-header-icon blue">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="20" x2="18" y2="10" />
                                    <line x1="12" y1="20" x2="12" y2="4" />
                                    <line x1="6" y1="20" x2="6" y2="14" />
                                </svg>
                            </div>
                            <div>
                                <div className="card-title">Encounter Summary</div>
                                <div className="card-subtitle">Lifetime clinical activity</div>
                            </div>
                        </div>
                        <span className="status-badge completed">Live</span>
                    </div>
                    <div className="card-body">
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                            <div style={{ padding: "16px", background: "var(--d-surface-alt, #F8FAFC)", borderRadius: "var(--d-radius-sm)", border: "1px solid var(--d-border)" }}>
                                <div style={{ fontSize: "0.8rem", color: "var(--d-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                                    Total Consultations
                                </div>
                                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--d-primary)", marginTop: "4px" }}>
                                    {recentConsultations.length}
                                </div>
                            </div>
                            <div style={{ padding: "16px", background: "var(--d-surface-alt, #F8FAFC)", borderRadius: "var(--d-radius-sm)", border: "1px solid var(--d-border)" }}>
                                <div style={{ fontSize: "0.8rem", color: "var(--d-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                                    Transcripts Archived
                                </div>
                                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#059669", marginTop: "4px" }}>
                                    {recentConsultations.filter((c) => Boolean(c.transcript)).length}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: "16px", fontSize: "0.85rem", color: "var(--d-text-muted)" }}>
                            All consultations are encrypted end-to-end and stored with strict RLS medical access policies.
                        </div>
                    </div>
                </div>

                {/* Recent Consultations Card */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-header-left">
                            <div className="card-header-icon teal">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                            </div>
                            <div>
                                <div className="card-title">Recent Consultations</div>
                                <div className="card-subtitle">Last 5 completed sessions</div>
                            </div>
                        </div>
                        <Link
                            href="/patient/history"
                            style={{
                                fontSize: "0.82rem",
                                color: "var(--d-primary)",
                                textDecoration: "none",
                                fontWeight: 600,
                            }}
                        >
                            View All →
                        </Link>
                    </div>

                    <div className="card-body" style={{ padding: 0 }}>
                        {loading ? (
                            <div style={{ padding: "30px", textAlign: "center", color: "var(--d-text-muted)" }}>
                                Loading visits...
                            </div>
                        ) : recentConsultations.length === 0 ? (
                            <div style={{ padding: "36px 20px", textAlign: "center", color: "var(--d-text-muted)" }}>
                                <p style={{ margin: 0, fontSize: "0.88rem" }}>No past consultations found.</p>
                                <Link
                                    href="/patient/consultation"
                                    style={{
                                        display: "inline-block",
                                        marginTop: "10px",
                                        fontSize: "0.84rem",
                                        color: "var(--d-primary)",
                                        textDecoration: "underline",
                                    }}
                                >
                                    Browse available physicians
                                </Link>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                {recentConsultations.map((c) => (
                                    <div
                                        key={c.id}
                                        style={{
                                            padding: "14px 18px",
                                            borderBottom: "1px solid var(--d-border)",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--d-text)" }}>
                                                {c.doctorName}
                                            </div>
                                            <div style={{ fontSize: "0.8rem", color: "var(--d-text-muted)", marginTop: "2px" }}>
                                                {formatDate(c.createdAt)} • {formatDuration(c.duration)}
                                            </div>
                                        </div>
                                        <Link
                                            href="/patient/history"
                                            style={{
                                                fontSize: "0.8rem",
                                                padding: "4px 10px",
                                                borderRadius: "4px",
                                                background: "var(--d-surface-alt, #F1F5F9)",
                                                border: "1px solid var(--d-border)",
                                                color: "var(--d-text)",
                                                textDecoration: "none",
                                                fontWeight: 600,
                                            }}
                                        >
                                            Transcript
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Multilingual AI Clinical Assistant */}
            <MultilingualChatbot />
        </div>
    );
}
