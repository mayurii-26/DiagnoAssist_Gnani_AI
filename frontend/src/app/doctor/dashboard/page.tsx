"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
    getConsultationHistory,
    type CompletedConsultation,
} from "@/lib/consultationService";
import PatientSummary from "@/components/PatientSummary";
import PatientTimeline from "@/components/PatientTimeline";
import DoctorIncomingRequests from "@/components/DoctorIncomingRequests";

export default function DoctorDashboardPage() {
    const { user } = useAuth();
    const [recentConsultations, setRecentConsultations] = useState<CompletedConsultation[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const data = await getConsultationHistory(user.id, "doctor");
            setRecentConsultations(data);
        } catch (err) {
            console.error("Failed to load doctor dashboard stats:", err);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const totalConsultations = recentConsultations.length;
    const transcriptsCount = recentConsultations.filter((c) => Boolean(c.transcript)).length;
    const totalDurationSecs = recentConsultations.reduce((acc, c) => acc + (c.duration || 0), 0);
    const avgDurationMins = totalConsultations > 0 ? Math.round(totalDurationSecs / totalConsultations / 60) : 0;

    return (
        <>
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Doctor Dashboard</h1>
                    <p style={{ margin: "4px 0 0", color: "var(--d-text-muted)" }}>
                        Clinical Analytics &amp; Real-time Patient Triage Queue
                    </p>
                </div>
                <Link
                    href="/doctor/consultation"
                    style={{
                        padding: "8px 18px",
                        borderRadius: "var(--d-radius-sm)",
                        background: "var(--d-primary)",
                        color: "#FFF",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        textDecoration: "none",
                    }}
                >
                    Open Live Workspace
                </Link>
            </div>

            {/* Real-time incoming consultation requests queue */}
            <DoctorIncomingRequests />

            <div className="dashboard-grid">
                {/* Analytics Overview Card */}
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
                                <div className="card-title">Clinical Performance Analytics</div>
                                <div className="card-subtitle">Encounter metrics and logs</div>
                            </div>
                        </div>
                        <Link
                            href="/doctor/history"
                            style={{
                                fontSize: "0.82rem",
                                color: "var(--d-primary)",
                                textDecoration: "none",
                                fontWeight: 600,
                            }}
                        >
                            View History →
                        </Link>
                    </div>

                    <div className="card-body">
                        {loading ? (
                            <p style={{ color: "var(--d-text-muted)", fontSize: "0.85rem" }}>Loading analytics...</p>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                                <div style={{ padding: "12px", background: "var(--d-surface-alt, #F8FAFC)", borderRadius: "var(--d-radius-sm)", border: "1px solid var(--d-border)" }}>
                                    <div style={{ fontSize: "0.74rem", color: "var(--d-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                                        Total Visits
                                    </div>
                                    <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--d-primary)", marginTop: "2px" }}>
                                        {totalConsultations}
                                    </div>
                                </div>
                                <div style={{ padding: "12px", background: "var(--d-surface-alt, #F8FAFC)", borderRadius: "var(--d-radius-sm)", border: "1px solid var(--d-border)" }}>
                                    <div style={{ fontSize: "0.74rem", color: "var(--d-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                                        Transcripts
                                    </div>
                                    <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#059669", marginTop: "2px" }}>
                                        {transcriptsCount}
                                    </div>
                                </div>
                                <div style={{ padding: "12px", background: "var(--d-surface-alt, #F8FAFC)", borderRadius: "var(--d-radius-sm)", border: "1px solid var(--d-border)" }}>
                                    <div style={{ fontSize: "0.74rem", color: "var(--d-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                                        Avg Duration
                                    </div>
                                    <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#D97706", marginTop: "2px" }}>
                                        {avgDurationMins}m
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <PatientSummary />
                <PatientTimeline />
            </div>
        </>
    );
}
