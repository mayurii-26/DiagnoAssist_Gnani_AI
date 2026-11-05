"use client";

import React, { useState } from "react";
import {
    type ClinicalReport,
    type SOAPNotes,
    type SymptomItem,
    type DiagnosisItem,
    type ICD10CodeItem,
    type TreatmentPlan,
    type PastMedicalHistory,
    type VitalSigns,
    approveClinicalReport,
} from "@/lib/consultationService";
import PrintableEMRDocument, { openPrintableEMRWindow } from "./PrintableEMRDocument";

interface ClinicalReportModalProps {
    report: ClinicalReport;
    patientName?: string;
    doctorName?: string;
    currentUserRole: "doctor" | "patient";
    currentUserId: string;
    onClose: () => void;
    onReportApproved?: (approvedReport: ClinicalReport) => void;
}

export default function ClinicalReportModal({
    report: initialReport,
    patientName = "Patient",
    doctorName = "Doctor",
    currentUserRole,
    currentUserId,
    onClose,
    onReportApproved,
}: ClinicalReportModalProps) {
    const isDoctor = currentUserRole === "doctor";
    const effectivePatientName =
        (patientName && patientName !== "You" && patientName !== "Patient" ? patientName : "") ||
        initialReport.patient_name ||
        patientName ||
        "Patient";

    const effectiveDoctorName =
        (doctorName && doctorName !== "Attending Physician" && doctorName !== "Doctor" ? doctorName : "") ||
        initialReport.doctor_name ||
        doctorName ||
        "Dr. Physician";

    const [report, setReport] = useState<ClinicalReport>({
        ...initialReport,
        soap: initialReport.soap || { subjective: "", objective: "", assessment: "", plan: "" },
        symptoms: initialReport.symptoms || [],
        diagnosis_suggestions: initialReport.diagnosis_suggestions || [],
        differential_diagnoses: initialReport.differential_diagnoses || initialReport.diagnosis_suggestions || [],
        icd_10_codes: initialReport.icd_10_codes || [],
        treatment_plan: initialReport.treatment_plan || {
            medications: [],
            investigations: [],
            recommendations: [],
            follow_up: "",
            emergency_warnings: "",
        },
    });

    const isApproved = report.status === "approved";
    // Patients cannot edit. Doctors can edit drafts.
    const isEditable = isDoctor && !isApproved;

    const [activeTab, setActiveTab] = useState<"preview" | "summary" | "hpi_history" | "soap" | "symptoms" | "icd" | "treatment">("preview");
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Form states
    const [summary, setSummary] = useState(report.summary || "");
    const [chiefComplaint, setChiefComplaint] = useState(report.chief_complaint || "");
    const [hpi, setHpi] = useState(report.history_of_present_illness || report.soap?.subjective || "");
    const [soap, setSoap] = useState<SOAPNotes>({
        subjective: report.soap?.subjective || "",
        objective: report.soap?.objective || "",
        assessment: report.soap?.assessment || "",
        plan: report.soap?.plan || "",
    });
    const [symptoms, setSymptoms] = useState<SymptomItem[]>(report.symptoms || []);
    const [diagnoses, setDiagnoses] = useState<DiagnosisItem[]>(report.diagnosis_suggestions || []);
    const [differentialDiagnoses, setDifferentialDiagnoses] = useState<DiagnosisItem[]>(
        report.differential_diagnoses || report.diagnosis_suggestions || []
    );
    const [icdCodes, setIcdCodes] = useState<ICD10CodeItem[]>(report.icd_10_codes || []);
    const [treatmentPlan, setTreatmentPlan] = useState<TreatmentPlan>({
        medications: report.treatment_plan?.medications || [],
        medications_structured: report.treatment_plan?.medications_structured || [],
        investigations: report.treatment_plan?.investigations || [],
        recommendations: report.treatment_plan?.recommendations || [],
        follow_up: report.treatment_plan?.follow_up || "",
        emergency_warnings: report.treatment_plan?.emergency_warnings || report.treatment_plan?.emergency_warning || "",
    });
    const [doctorNotes, setDoctorNotes] = useState(report.doctor_notes || "");
    const [vitalSigns, setVitalSigns] = useState<VitalSigns>(
        report.vital_signs || {
            blood_pressure: "Not measured directly (Telehealth encounter)",
            heart_rate: "Not measured directly (Telehealth encounter)",
            temperature: "100.0 °F (Patient-reported mild fever)",
            respiratory_rate: "Non-labored on visual inspection",
            spo2: "Not measured directly (Telehealth encounter)",
            observations: "Patient alert, responsive, and communicating clearly.",
        }
    );
    const [pastMedicalHistory, setPastMedicalHistory] = useState<PastMedicalHistory>(
        report.past_medical_history || {
            past_conditions: ["No significant chronic illnesses reported"],
            surgical_history: ["No prior surgeries documented"],
            current_medications: ["Paracetamol 500mg taken previously"],
            allergies: ["No known drug allergies (NKDA) reported"],
            family_history: ["Non-contributory / Not documented"],
        }
    );
    const [physicalExam, setPhysicalExam] = useState(
        report.physical_examination ||
            "Visual Telehealth Examination: Patient is alert and oriented x3. Communicating fluently without respiratory distress or facial asymmetry. Hands-on physical examination not performed due to telemedicine format."
    );

    // Helpers for symptoms
    const handleAddSymptom = () => {
        setSymptoms([...symptoms, { symptom: "New Symptom", name: "New Symptom", duration: "Acute", severity: "Moderate" }]);
    };
    const handleRemoveSymptom = (index: number) => {
        setSymptoms(symptoms.filter((_, i) => i !== index));
    };
    const handleUpdateSymptom = (index: number, field: keyof SymptomItem, value: string) => {
        const copy = [...symptoms];
        copy[index] = { ...copy[index], [field]: value };
        if (field === "symptom") copy[index].name = value;
        setSymptoms(copy);
    };

    // Helpers for ICD-10
    const handleAddIcd = () => {
        setIcdCodes([
            ...icdCodes,
            {
                code: "R69",
                description: "Illness, unspecified",
                evidence: "Patient clinical presentation",
                coding_status: "Provisional (Awaiting Physician Confirmation)",
            },
        ]);
    };
    const handleRemoveIcd = (index: number) => {
        setIcdCodes(icdCodes.filter((_, i) => i !== index));
    };
    const handleUpdateIcdStatus = (index: number, newStatus: string) => {
        const copy = [...icdCodes];
        copy[index] = { ...copy[index], coding_status: newStatus };
        setIcdCodes(copy);
    };

    // Helpers for medications
    const handleAddMedication = () => {
        setTreatmentPlan({
            ...treatmentPlan,
            medications: [...(treatmentPlan.medications || []), "New medication instructions"],
        });
    };
    const handleRemoveMedication = (index: number) => {
        setTreatmentPlan({
            ...treatmentPlan,
            medications: (treatmentPlan.medications || []).filter((_, i) => i !== index),
        });
    };
    const handleUpdateMedication = (index: number, val: string) => {
        const list = [...(treatmentPlan.medications || [])];
        list[index] = val;
        setTreatmentPlan({ ...treatmentPlan, medications: list });
    };

    // Assemble current live report object reflecting all edits
    const currentActiveReport: ClinicalReport = {
        ...report,
        summary,
        chief_complaint: chiefComplaint,
        history_of_present_illness: hpi,
        soap,
        symptoms,
        diagnosis_suggestions: diagnoses,
        differential_diagnoses: differentialDiagnoses,
        icd_10_codes: icdCodes,
        treatment_plan: treatmentPlan,
        doctor_notes: doctorNotes,
        vital_signs: vitalSigns,
        past_medical_history: pastMedicalHistory,
        physical_examination: physicalExam,
    };

    // Sign off & approve handler
    const handleApproveAndSave = async () => {
        setIsSaving(true);
        setSaveMessage(null);

        const payload = {
            report_id: report.id,
            transcription_id: report.transcription_id,
            room_id: report.room_id,
            doctor_id: report.doctor_id || currentUserId,
            patient_id: report.patient_id,
            doctor_name: effectiveDoctorName,
            patient_name: effectivePatientName,
            summary,
            soap,
            symptoms,
            diagnosis_suggestions: diagnoses,
            differential_diagnoses: differentialDiagnoses,
            icd_10_codes: icdCodes,
            treatment_plan: treatmentPlan,
            doctor_notes: doctorNotes,
            chief_complaint: chiefComplaint,
            history_of_present_illness: hpi,
            past_medical_history: pastMedicalHistory,
            review_of_systems: report.review_of_systems,
            vital_signs: vitalSigns,
            physical_examination: physicalExam,
            assessment_and_impression: soap.assessment,
            consultation_outcome: report.consultation_outcome,
            source_disclosure: report.source_disclosure,
            clinic_name: report.clinic_name,
            document_title: report.document_title,
            document_id: report.document_id,
            encounter_type: report.encounter_type,
        };

        const result = await approveClinicalReport(payload);
        setIsSaving(false);

        if (result.success) {
            setSaveMessage({ type: "success", text: "Clinical documentation authenticated, approved, and committed to EMR!" });
            const updated: ClinicalReport = {
                ...currentActiveReport,
                id: result.reportId || report.id,
                status: "approved",
                approved_at: new Date().toISOString(),
            };
            setReport(updated);
            if (onReportApproved) {
                onReportApproved(updated);
            }
        } else {
            setSaveMessage({ type: "error", text: result.error || "Failed to approve report" });
        }
    };

    // Dedicated Complete EMR PDF Export
    const handleExportPDF = () => {
        openPrintableEMRWindow(
            currentActiveReport,
            effectivePatientName,
            effectiveDoctorName,
            report.duration ? `${Math.round(report.duration / 60)} minutes` : "10 minutes"
        );
    };

    return (
        <div
            id="clinical-report-modal-overlay"
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(15, 23, 42, 0.7)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: "20px",
            }}
        >
            <style jsx global>{`
                @media print {
                    /* Hide modal chrome and all screen elements */
                    #clinical-report-modal-overlay > div:not(.print-container) {
                        display: none !important;
                    }
                    body > *:not(#clinical-report-modal-overlay) {
                        display: none !important;
                    }
                    #clinical-report-modal-overlay {
                        position: static !important;
                        background: none !important;
                        padding: 0 !important;
                        display: block !important;
                    }
                    .modal-screen-only {
                        display: none !important;
                    }
                    .print-container {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                }
            `}</style>

            <div
                className="modal-screen-only"
                style={{
                    background: "var(--d-surface, #FFFFFF)",
                    borderRadius: "14px",
                    maxWidth: "960px",
                    width: "100%",
                    maxHeight: "92vh",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 24px 48px rgba(0,0,0,0.25)",
                    border: "1px solid var(--d-border)",
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "16px 24px",
                        borderBottom: "1px solid var(--d-border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "var(--d-surface-alt, #F8FAFC)",
                    }}
                >
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--d-text)" }}>
                                Hospital Clinical EMR Documentation
                            </h2>
                            <span
                                style={{
                                    fontSize: "0.74rem",
                                    fontWeight: 700,
                                    padding: "3px 10px",
                                    borderRadius: "12px",
                                    background: isApproved ? "#DCFCE7" : "#FEF3C7",
                                    color: isApproved ? "#15803D" : "#B45309",
                                    border: `1px solid ${isApproved ? "#86EFAC" : "#FDE68A"}`,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                }}
                            >
                                {isApproved ? "✓ Authenticated EMR Record" : "⚠ Draft — Physician Review Required"}
                            </span>
                        </div>
                        <p style={{ margin: "4px 0 0", color: "var(--d-text-muted)", fontSize: "0.82rem" }}>
                            Patient: <strong>{patientName}</strong> • Attending: <strong>{doctorName}</strong>
                            {report.room_id && (
                                <> • Session: <code style={{ fontSize: "0.78rem" }}>{report.room_id}</code></>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            fontSize: "1.5rem",
                            color: "var(--d-text-muted)",
                            cursor: "pointer",
                            padding: "4px 8px",
                            lineHeight: 1,
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Banner alert */}
                <div
                    style={{
                        padding: "10px 24px",
                        fontSize: "0.82rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        background: isApproved ? "#F0FDF4" : "#FFFBEB",
                        borderBottom: `1px solid ${isApproved ? "#BBF7D0" : "#FDE68A"}`,
                        color: isApproved ? "#166534" : "#92400E",
                    }}
                >
                    <span style={{ fontSize: "1rem" }}>{isApproved ? "🛡️" : "📋"}</span>
                    <span>
                        {isApproved
                            ? "Finalized & digitally authenticated clinical encounter documentation. Stored in patient longitudinal EMR."
                            : "Synthesized from Gnani AI consultation transcript. Review each clinical section, adjust diagnoses/orders, preview complete document, and sign off."}
                    </span>
                </div>

                {/* Navigation Tabs */}
                <div
                    style={{
                        display: "flex",
                        borderBottom: "1px solid var(--d-border)",
                        padding: "0 24px",
                        background: "var(--d-surface)",
                        gap: "4px",
                        overflowX: "auto",
                    }}
                >
                    {[
                        { id: "preview", label: "📄 Complete EMR Preview" },
                        { id: "summary", label: "Encounter & Summary" },
                        { id: "hpi_history", label: "HPI, History & Vitals" },
                        { id: "soap", label: "SOAP Notes" },
                        { id: "symptoms", label: `Symptoms (${symptoms.length})` },
                        { id: "icd", label: `ICD-10 & Diagnoses (${icdCodes.length})` },
                        { id: "treatment", label: "Treatment & Plan" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            style={{
                                padding: "12px 14px",
                                border: "none",
                                background: "none",
                                borderBottom: activeTab === tab.id ? "2px solid var(--d-primary)" : "2px solid transparent",
                                color: activeTab === tab.id ? "var(--d-primary)" : "var(--d-text-muted)",
                                fontWeight: activeTab === tab.id ? 700 : 500,
                                fontSize: "0.84rem",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Modal Body / Tab Content */}
                <div
                    style={{
                        padding: activeTab === "preview" ? "12px 16px" : "24px",
                        overflowY: "auto",
                        flex: 1,
                        fontSize: "0.88rem",
                    }}
                >
                    {/* TAB: COMPLETE EMR PREVIEW */}
                    {activeTab === "preview" && (
                        <div style={{ background: "#F1F5F9", padding: "16px", borderRadius: "8px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", background: "#FFF", padding: "8px 14px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                                <span style={{ fontSize: "0.84rem", color: "#475569" }}>
                                    Showing live preview of the complete 16-section clinical encounter document.
                                </span>
                                <button
                                    onClick={handleExportPDF}
                                    style={{
                                        padding: "6px 14px",
                                        borderRadius: "6px",
                                        background: "var(--d-primary, #2563EB)",
                                        color: "#FFF",
                                        border: "none",
                                        fontSize: "0.82rem",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                    }}
                                >
                                    🖨️ Export / Print Full PDF
                                </button>
                            </div>
                            <div style={{ background: "#FFF", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                                <PrintableEMRDocument
                                    report={currentActiveReport}
                                    patientName={effectivePatientName}
                                    doctorName={effectiveDoctorName}
                                    currentUserRole={currentUserRole}
                                    encounterDuration={report.duration ? `${Math.round(report.duration / 60)} minutes` : "10 minutes"}
                                />
                            </div>
                        </div>
                    )}

                    {/* TAB: SUMMARY & ENCOUNTER */}
                    {activeTab === "summary" && (
                        <div>
                            <div style={{ marginBottom: "18px" }}>
                                <label style={{ display: "block", fontWeight: 700, marginBottom: "6px", color: "var(--d-text)" }}>
                                    Chief Complaint
                                </label>
                                {isEditable ? (
                                    <input
                                        type="text"
                                        value={chiefComplaint}
                                        onChange={(e) => setChiefComplaint(e.target.value)}
                                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--d-border)", fontSize: "0.88rem" }}
                                    />
                                ) : (
                                    <div style={{ padding: "10px 14px", background: "var(--d-surface-alt, #F8FAFC)", borderRadius: "6px", border: "1px solid var(--d-border)", fontWeight: 600 }}>
                                        {chiefComplaint || "Acute consultation"}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: "18px" }}>
                                <label style={{ display: "block", fontWeight: 700, marginBottom: "6px", color: "var(--d-text)" }}>
                                    Clinical Summary
                                </label>
                                {isEditable ? (
                                    <textarea
                                        value={summary}
                                        onChange={(e) => setSummary(e.target.value)}
                                        rows={4}
                                        style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid var(--d-border)", fontSize: "0.88rem", lineHeight: "1.5", fontFamily: "inherit" }}
                                    />
                                ) : (
                                    <div style={{ padding: "12px 14px", background: "var(--d-surface-alt, #F8FAFC)", borderRadius: "6px", border: "1px solid var(--d-border)", lineHeight: "1.5" }}>
                                        {summary || "No summary documented."}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: "18px" }}>
                                <label style={{ display: "block", fontWeight: 700, marginBottom: "6px", color: "var(--d-text)" }}>
                                    Attending Clinician Remarks
                                </label>
                                {isEditable ? (
                                    <textarea
                                        value={doctorNotes}
                                        onChange={(e) => setDoctorNotes(e.target.value)}
                                        rows={3}
                                        style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid var(--d-border)", fontSize: "0.88rem", lineHeight: "1.5", fontFamily: "inherit" }}
                                        placeholder="Add attending clinician observations or instructions..."
                                    />
                                ) : (
                                    <div style={{ padding: "10px 14px", background: "var(--d-surface-alt, #F8FAFC)", borderRadius: "6px", border: "1px solid var(--d-border)" }}>
                                        {doctorNotes || "None added."}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB: HPI, HISTORY & VITALS */}
                    {activeTab === "hpi_history" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                            <div>
                                <label style={{ display: "block", fontWeight: 700, marginBottom: "6px", color: "var(--d-text)" }}>
                                    History of Present Illness (HPI)
                                </label>
                                {isEditable ? (
                                    <textarea
                                        value={hpi}
                                        onChange={(e) => setHpi(e.target.value)}
                                        rows={4}
                                        style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid var(--d-border)", fontSize: "0.88rem", lineHeight: "1.5", fontFamily: "inherit" }}
                                    />
                                ) : (
                                    <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "6px", border: "1px solid #E2E8F0", lineHeight: "1.5" }}>
                                        {hpi}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label style={{ display: "block", fontWeight: 700, marginBottom: "6px", color: "var(--d-text)" }}>
                                    Visual Telehealth Examination
                                </label>
                                {isEditable ? (
                                    <textarea
                                        value={physicalExam}
                                        onChange={(e) => setPhysicalExam(e.target.value)}
                                        rows={3}
                                        style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid var(--d-border)", fontSize: "0.88rem", lineHeight: "1.5", fontFamily: "inherit" }}
                                    />
                                ) : (
                                    <div style={{ padding: "10px 14px", background: "#F8FAFC", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                                        {physicalExam}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label style={{ display: "block", fontWeight: 700, marginBottom: "6px", color: "var(--d-text)" }}>
                                    Vital Signs (Telehealth Observation)
                                </label>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                    <div>
                                        <span style={{ fontSize: "0.8rem", color: "#64748B" }}>Temperature:</span>
                                        {isEditable ? (
                                            <input
                                                type="text"
                                                value={vitalSigns.temperature || ""}
                                                onChange={(e) => setVitalSigns({ ...vitalSigns, temperature: e.target.value })}
                                                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
                                            />
                                        ) : (
                                            <div style={{ fontWeight: 600 }}>{vitalSigns.temperature || "Not measured"}</div>
                                        )}
                                    </div>
                                    <div>
                                        <span style={{ fontSize: "0.8rem", color: "#64748B" }}>Clinical Observations:</span>
                                        {isEditable ? (
                                            <input
                                                type="text"
                                                value={vitalSigns.observations || ""}
                                                onChange={(e) => setVitalSigns({ ...vitalSigns, observations: e.target.value })}
                                                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.85rem" }}
                                            />
                                        ) : (
                                            <div style={{ fontWeight: 600 }}>{vitalSigns.observations || "Alert and responsive"}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: SOAP NOTES */}
                    {activeTab === "soap" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div style={{ border: "1px solid #BFDBFE", borderRadius: "8px", overflow: "hidden" }}>
                                <div style={{ background: "#EFF6FF", padding: "8px 14px", fontWeight: 700, color: "#1E40AF", fontSize: "0.84rem" }}>
                                    S — Subjective (Patient narrative, chief complaint, symptom onset)
                                </div>
                                <div style={{ padding: "10px 14px" }}>
                                    {isEditable ? (
                                        <textarea
                                            value={soap.subjective}
                                            onChange={(e) => setSoap({ ...soap, subjective: e.target.value })}
                                            rows={3}
                                            style={{ width: "100%", border: "none", outline: "none", fontSize: "0.88rem", fontFamily: "inherit" }}
                                        />
                                    ) : (
                                        <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.5" }}>{soap.subjective}</div>
                                    )}
                                </div>
                            </div>

                            <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden" }}>
                                <div style={{ background: "#F8FAFC", padding: "8px 14px", fontWeight: 700, color: "#475569", fontSize: "0.84rem" }}>
                                    O — Objective (Observable tele-findings, vitals, examination notes)
                                </div>
                                <div style={{ padding: "10px 14px" }}>
                                    {isEditable ? (
                                        <textarea
                                            value={soap.objective}
                                            onChange={(e) => setSoap({ ...soap, objective: e.target.value })}
                                            rows={2}
                                            style={{ width: "100%", border: "none", outline: "none", fontSize: "0.88rem", fontFamily: "inherit" }}
                                        />
                                    ) : (
                                        <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.5" }}>{soap.objective}</div>
                                    )}
                                </div>
                            </div>

                            <div style={{ border: "1px solid #DDD6FE", borderRadius: "8px", overflow: "hidden" }}>
                                <div style={{ background: "#F5F3FF", padding: "8px 14px", fontWeight: 700, color: "#6D28D9", fontSize: "0.84rem" }}>
                                    A — Assessment (Clinical evaluation, working diagnosis, differentials)
                                </div>
                                <div style={{ padding: "10px 14px" }}>
                                    {isEditable ? (
                                        <textarea
                                            value={soap.assessment}
                                            onChange={(e) => setSoap({ ...soap, assessment: e.target.value })}
                                            rows={3}
                                            style={{ width: "100%", border: "none", outline: "none", fontSize: "0.88rem", fontFamily: "inherit" }}
                                        />
                                    ) : (
                                        <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.5" }}>{soap.assessment}</div>
                                    )}
                                </div>
                            </div>

                            <div style={{ border: "1px solid #BBF7D0", borderRadius: "8px", overflow: "hidden" }}>
                                <div style={{ background: "#F0FDF4", padding: "8px 14px", fontWeight: 700, color: "#166534", fontSize: "0.84rem" }}>
                                    P — Plan (Therapeutic actions, medications, investigations, follow-up)
                                </div>
                                <div style={{ padding: "10px 14px" }}>
                                    {isEditable ? (
                                        <textarea
                                            value={soap.plan}
                                            onChange={(e) => setSoap({ ...soap, plan: e.target.value })}
                                            rows={3}
                                            style={{ width: "100%", border: "none", outline: "none", fontSize: "0.88rem", fontFamily: "inherit" }}
                                        />
                                    ) : (
                                        <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.5" }}>{soap.plan}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: SYMPTOMS */}
                    {activeTab === "symptoms" && (
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                <div style={{ fontSize: "0.88rem", color: "var(--d-text-muted)" }}>
                                    Extracted patient symptoms with severity and duration
                                </div>
                                {isEditable && (
                                    <button
                                        onClick={handleAddSymptom}
                                        style={{ padding: "5px 12px", borderRadius: "6px", border: "1px solid var(--d-primary)", background: "transparent", color: "var(--d-primary)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
                                    >
                                        + Add Symptom
                                    </button>
                                )}
                            </div>

                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
                                <thead>
                                    <tr style={{ background: "var(--d-surface-alt, #F8FAFC)", borderBottom: "1px solid var(--d-border)" }}>
                                        <th style={{ padding: "8px 12px", textAlign: "left" }}>Symptom</th>
                                        <th style={{ padding: "8px 12px", textAlign: "left" }}>Duration</th>
                                        <th style={{ padding: "8px 12px", textAlign: "left" }}>Severity</th>
                                        <th style={{ padding: "8px 12px", textAlign: "left" }}>Notes</th>
                                        {isEditable && <th style={{ padding: "8px 12px", textAlign: "right" }}>Action</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {symptoms.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: "1px solid var(--d-border)" }}>
                                            <td style={{ padding: "8px 12px" }}>
                                                {isEditable ? (
                                                    <input
                                                        type="text"
                                                        value={item.symptom || item.name}
                                                        onChange={(e) => handleUpdateSymptom(idx, "symptom", e.target.value)}
                                                        style={{ width: "100%", padding: "4px 8px", border: "1px solid var(--d-border)", borderRadius: "4px" }}
                                                    />
                                                ) : (
                                                    <strong>{item.symptom || item.name}</strong>
                                                )}
                                            </td>
                                            <td style={{ padding: "8px 12px" }}>
                                                {isEditable ? (
                                                    <input
                                                        type="text"
                                                        value={item.duration || ""}
                                                        onChange={(e) => handleUpdateSymptom(idx, "duration", e.target.value)}
                                                        style={{ width: "100%", padding: "4px 8px", border: "1px solid var(--d-border)", borderRadius: "4px" }}
                                                    />
                                                ) : (
                                                    item.duration || "—"
                                                )}
                                            </td>
                                            <td style={{ padding: "8px 12px" }}>
                                                <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "0.78rem", fontWeight: 600, background: item.severity?.toLowerCase().includes("severe") ? "#FEE2E2" : "#FEF3C7", color: item.severity?.toLowerCase().includes("severe") ? "#B91C1C" : "#B45309" }}>
                                                    {item.severity || "Reported"}
                                                </span>
                                            </td>
                                            <td style={{ padding: "8px 12px" }}>{item.notes || "Reported"}</td>
                                            {isEditable && (
                                                <td style={{ padding: "8px 12px", textAlign: "right" }}>
                                                    <button onClick={() => handleRemoveSymptom(idx)} style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer" }}>
                                                        Remove
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* TAB: ICD-10 & DIAGNOSES */}
                    {activeTab === "icd" && (
                        <div>
                            {/* Differential Diagnoses */}
                            <div style={{ marginBottom: "22px" }}>
                                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", fontWeight: 700, color: "var(--d-text)" }}>
                                    Clinical Diagnostic Impressions &amp; Differentials
                                </h4>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {differentialDiagnoses.map((d, idx) => (
                                        <div key={idx} style={{ padding: "10px 14px", borderRadius: "6px", background: "#F8FAFC", border: "1px solid var(--d-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <strong style={{ fontSize: "0.92rem", color: "#1E3A8A" }}>{d.diagnosis}</strong>
                                                <div style={{ fontSize: "0.8rem", color: "#64748B", marginTop: "2px" }}>{d.supporting_evidence || d.reasoning}</div>
                                            </div>
                                            <span style={{ fontSize: "0.75rem", padding: "3px 8px", borderRadius: "10px", background: "#EFF6FF", color: "#1D4ED8", fontWeight: 600 }}>
                                                {d.status || (idx === 0 ? "Working Impression" : "Differential")} ({d.confidence || "Moderate"})
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ICD-10 Codes Table */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                    <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--d-text)" }}>
                                        Assigned ICD-10 Clinical Coding (WHO / MoHFW Standards)
                                    </h4>
                                    {isEditable && (
                                        <button
                                            onClick={handleAddIcd}
                                            style={{ padding: "5px 12px", borderRadius: "6px", border: "1px solid var(--d-primary)", background: "transparent", color: "var(--d-primary)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
                                        >
                                            + Add ICD Code
                                        </button>
                                    )}
                                </div>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
                                    <thead>
                                        <tr style={{ background: "var(--d-surface-alt, #F8FAFC)", borderBottom: "1px solid var(--d-border)" }}>
                                            <th style={{ padding: "8px 12px", textAlign: "left", width: "16%" }}>Code</th>
                                            <th style={{ padding: "8px 12px", textAlign: "left", width: "32%" }}>Official Description</th>
                                            <th style={{ padding: "8px 12px", textAlign: "left", width: "26%" }}>Evidence</th>
                                            <th style={{ padding: "8px 12px", textAlign: "left", width: "26%" }}>Coding Status</th>
                                            {isEditable && <th style={{ padding: "8px 12px", textAlign: "right" }}>Action</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {icdCodes.map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: "1px solid var(--d-border)" }}>
                                                <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: "#1E40AF" }}>{item.code}</td>
                                                <td style={{ padding: "8px 12px", fontWeight: 600 }}>{item.description}</td>
                                                <td style={{ padding: "8px 12px", color: "var(--d-text-muted)", fontSize: "0.82rem" }}>{item.supporting_evidence || item.evidence}</td>
                                                <td style={{ padding: "8px 12px" }}>
                                                    {isEditable ? (
                                                        <select
                                                            value={item.coding_status || "Provisional (Awaiting Physician Confirmation)"}
                                                            onChange={(e) => handleUpdateIcdStatus(idx, e.target.value)}
                                                            style={{ fontSize: "0.78rem", padding: "3px 6px", borderRadius: "4px", border: "1px solid #CBD5E1" }}
                                                        >
                                                            <option value="Provisional (Awaiting Physician Confirmation)">Provisional</option>
                                                            <option value="Confirmed by Physician">Confirmed by Physician</option>
                                                            <option value="Differential Diagnosis">Differential</option>
                                                        </select>
                                                    ) : (
                                                        <span style={{ fontSize: "0.78rem", color: "#047857", fontWeight: 600 }}>
                                                            {item.coding_status || "Provisional"}
                                                        </span>
                                                    )}
                                                </td>
                                                {isEditable && (
                                                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                                                        <button onClick={() => handleRemoveIcd(idx)} style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer" }}>
                                                            ✕
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB: TREATMENT PLAN */}
                    {activeTab === "treatment" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                    <label style={{ fontWeight: 700, color: "var(--d-text)" }}>
                                        Prescribed / Recommended Medications
                                    </label>
                                    {isEditable && (
                                        <button onClick={handleAddMedication} style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--d-primary)", background: "transparent", color: "var(--d-primary)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                                            + Add Medication
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {(treatmentPlan.medications || []).map((med, idx) => (
                                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            {isEditable ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={med}
                                                        onChange={(e) => handleUpdateMedication(idx, e.target.value)}
                                                        style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--d-border)" }}
                                                    />
                                                    <button onClick={() => handleRemoveMedication(idx)} style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer" }}>
                                                        ✕
                                                    </button>
                                                </>
                                            ) : (
                                                <div style={{ padding: "8px 12px", background: "#F1F5F9", borderRadius: "6px", width: "100%", fontWeight: 600 }}>
                                                    💊 {med}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label style={{ fontWeight: 700, color: "var(--d-text)", display: "block", marginBottom: "4px" }}>
                                    Follow-Up Guidance
                                </label>
                                {isEditable ? (
                                    <input
                                        type="text"
                                        value={treatmentPlan.follow_up || ""}
                                        onChange={(e) => setTreatmentPlan({ ...treatmentPlan, follow_up: e.target.value })}
                                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--d-border)" }}
                                    />
                                ) : (
                                    <p style={{ margin: 0 }}>{treatmentPlan.follow_up || "Follow up in 3 to 5 days."}</p>
                                )}
                            </div>

                            <div style={{ padding: "12px 16px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "8px", color: "#991B1B" }}>
                                <strong style={{ display: "block", marginBottom: "4px" }}>⚠️ Emergency Red-Flag Warning</strong>
                                {isEditable ? (
                                    <input
                                        type="text"
                                        value={treatmentPlan.emergency_warnings || ""}
                                        onChange={(e) => setTreatmentPlan({ ...treatmentPlan, emergency_warnings: e.target.value })}
                                        style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #FCA5A5", background: "#FFF" }}
                                    />
                                ) : (
                                    <p style={{ margin: 0, fontSize: "0.85rem" }}>
                                        {treatmentPlan.emergency_warnings || "Seek immediate emergency medical attention if severe sudden symptoms occur."}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Save Feedback Banner */}
                {saveMessage && (
                    <div
                        style={{
                            padding: "8px 24px",
                            background: saveMessage.type === "success" ? "#DCFCE7" : "#FEE2E2",
                            color: saveMessage.type === "success" ? "#166534" : "#991B1B",
                            fontSize: "0.84rem",
                            fontWeight: 600,
                            borderTop: "1px solid var(--d-border)",
                        }}
                    >
                        {saveMessage.text}
                    </div>
                )}

                {/* Modal Footer Actions */}
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
                    <div style={{ display: "flex", gap: "10px" }}>
                        <button
                            onClick={handleExportPDF}
                            style={{
                                padding: "8px 18px",
                                borderRadius: "6px",
                                border: "1px solid #2563EB",
                                background: "#EFF6FF",
                                color: "#1E40AF",
                                cursor: "pointer",
                                fontSize: "0.84rem",
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            🖨️ Print / Export Complete EMR (PDF)
                        </button>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: "8px 18px",
                                borderRadius: "6px",
                                border: "1px solid var(--d-border)",
                                background: "var(--d-surface-alt, #F8FAFC)",
                                color: "var(--d-text)",
                                cursor: "pointer",
                                fontSize: "0.84rem",
                                fontWeight: 600,
                            }}
                        >
                            Close
                        </button>

                        {isEditable && (
                            <button
                                onClick={handleApproveAndSave}
                                disabled={isSaving}
                                style={{
                                    padding: "8px 22px",
                                    borderRadius: "6px",
                                    border: "none",
                                    background: isSaving ? "#9CA3AF" : "#16A34A",
                                    color: "#FFF",
                                    cursor: isSaving ? "not-allowed" : "pointer",
                                    fontSize: "0.84rem",
                                    fontWeight: 700,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    boxShadow: "0 2px 4px rgba(22, 163, 74, 0.2)",
                                }}
                            >
                                {isSaving ? "Authenticating & Saving..." : "✓ Approve & Authenticate EMR"}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Standalone background container for native browser print (Ctrl+P) */}
            <div className="print-container" style={{ display: "none" }}>
                <PrintableEMRDocument
                    report={currentActiveReport}
                    patientName={patientName}
                    doctorName={doctorName}
                    currentUserRole={currentUserRole}
                    encounterDuration={report.duration ? `${Math.round(report.duration / 60)} minutes` : "10 minutes"}
                />
            </div>
        </div>
    );
}
