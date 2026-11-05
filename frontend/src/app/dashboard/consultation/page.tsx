"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function ConsultationPage() {
    const router = useRouter();
    const { user } = useAuth();
    const isDoctor = user?.user_metadata?.role === "doctor";
    const targetRoute = isDoctor ? "/doctor/consultation" : "/patient/consultation";

    return (
        <>
            <div className="page-header">
                <h1>Consultation</h1>
                <p>Start a new consultation session</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {/* Video Call Option */}
                <div className="card" style={{
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    overflow: 'hidden'
                }}
                onClick={() => router.push(targetRoute)}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = 'var(--d-shadow-lg)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--d-shadow)';
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, var(--d-primary), #14B8A6)',
                        padding: '24px',
                        color: 'white'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                background: 'rgba(255,255,255,0.2)',
                                borderRadius: 'var(--d-radius-sm)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="23 7 16 12 23 17 23 7"/>
                                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                                </svg>
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700' }}>Video Call</h2>
                        </div>
                        <p style={{ opacity: 0.95, fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                            Start a video consultation with real-time interaction and AI documentation
                        </p>
                    </div>
                    <div style={{ padding: '20px' }}>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                router.push(targetRoute);
                            }}
                            style={{
                                width: '100%',
                                padding: '12px 20px',
                                border: 'none',
                                borderRadius: 'var(--d-radius-sm)',
                                background: 'linear-gradient(135deg, var(--d-primary), #14B8A6)',
                                color: 'white',
                                fontFamily: 'var(--font)',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 4px 16px rgba(15, 123, 138, 0.35)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}>
                            {isDoctor ? "Open Consultation Hub" : "Select Doctor & Request Call"}
                        </button>
                    </div>
                </div>

                {/* Live Interaction Option */}
                <div className="card" style={{
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    overflow: 'hidden'
                }}
                onClick={() => router.push(targetRoute)}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = 'var(--d-shadow-lg)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--d-shadow)';
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, var(--d-accent), #3B82F6)',
                        padding: '24px',
                        color: 'white'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                background: 'rgba(255,255,255,0.2)',
                                borderRadius: 'var(--d-radius-sm)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                                </svg>
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700' }}>Live Interaction</h2>
                        </div>
                        <p style={{ opacity: 0.95, fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                            Engage in live chat consultation with voice recording and instant messaging
                        </p>
                    </div>
                    <div style={{ padding: '20px' }}>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                router.push(targetRoute);
                            }}
                            style={{
                                width: '100%',
                                padding: '12px 20px',
                                border: 'none',
                                borderRadius: 'var(--d-radius-sm)',
                                background: 'linear-gradient(135deg, var(--d-accent), #3B82F6)',
                                color: 'white',
                                fontFamily: 'var(--font)',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 4px 16px rgba(14, 165, 233, 0.35)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}>
                            {isDoctor ? "Enter Consultation Workspace" : "Start Live Consultation"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
