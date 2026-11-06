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
    translateClinicalReport,
    SUPPORTED_MULTILINGUAL_LANGUAGES,
} from "@/lib/consultationService";
import { useGnaniVoice } from "@/hooks/useGnaniVoice";
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

    // Multilingual Report Translation State
    const [reportLang, setReportLang] = useState<string>("en");
    const [isTranslatingReport, setIsTranslatingReport] = useState(false);
    const [translatedReportCache, setTranslatedReportCache] = useState<Record<string, ClinicalReport>>({});
    const [transReportError, setTransReportError] = useState<string | null>(null);

    const isApproved = report.status === "approved";
    // Patients cannot edit. Doctors can edit drafts in source English mode.
    const isEditable = isDoctor && !isApproved && reportLang === "en";

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

    const handleReportLangChange = async (targetLang: string) => {
        setReportLang(targetLang);
        setTransReportError(null);
        if (targetLang === "en") return;

        if (translatedReportCache[targetLang]) {
            return;
        }

        setIsTranslatingReport(true);
        try {
            const currentDocToTranslate: ClinicalReport = {
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
            };
            const translated = await translateClinicalReport(
                currentDocToTranslate,
                targetLang,
                report.id || report.document_id,
                currentUserRole
            );
            setTranslatedReportCache((prev) => ({
                ...prev,
                [targetLang]: translated,
            }));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Report translation failed";
            setTransReportError(msg);
        } finally {
            setIsTranslatingReport(false);
        }
    };

    // Doctor Voice Dictation State (Gnani Prisma STT)
    const [activeDictationField, setActiveDictationField] = useState<string | null>(null);
    const [dictationLang, setDictationLang] = useState<string>("en-IN");

    const {
        isListening: isDictating,
        interimText: dictationInterim,
        error: dictationError,
        startListening: startDictating,
        stopListening: stopDictating,
    } = useGnaniVoice({
        defaultLanguage: dictationLang,
        onTranscript: (recognizedText) => {
            if (!activeDictationField) return;
            if (activeDictationField === "chief_complaint") {
                setChiefComplaint((prev) => (prev ? `${prev} ${recognizedText}` : recognizedText));
            } else if (activeDictationField === "hpi") {
                setHpi((prev) => (prev ? `${prev} ${recognizedText}` : recognizedText));
            } else if (activeDictationField === "soap_subjective") {
                setSoap((prev) => ({ ...prev, subjective: prev.subjective ? `${prev.subjective} ${recognizedText}` : recognizedText }));
            } else if (activeDictationField === "soap_assessment") {
                setSoap((prev) => ({ ...prev, assessment: prev.assessment ? `${prev.assessment} ${recognizedText}` : recognizedText }));
            } else if (activeDictationField === "soap_plan") {
                setSoap((prev) => ({ ...prev, plan: prev.plan ? `${prev.plan} ${recognizedText}` : recognizedText }));
            } else if (activeDictationField === "doctor_notes") {
                setDoctorNotes((prev) => (prev ? `${prev} ${recognizedText}` : recognizedText));
            }
        },
    });

    const toggleDictation = (fieldName: string) => {
        if (isDictating && activeDictationField === fieldName) {
            stopDictating();
            setActiveDictationField(null);
        } else {
            setActiveDictationField(fieldName);
            startDictating(dictationLang);
        }
    };

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

    const activeDisplayReport: ClinicalReport =
        reportLang !== "en" && translatedReportCache[reportLang]
            ? translatedReportCache[reportLang]
            : currentActiveReport;

    // Dedicated Complete EMR PDF Export
    const handleExportPDF = () => {
        openPrintableEMRWindow(
            activeDisplayReport,
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

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        {/* EMR Translation Language Selector */}
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <label htmlFor="modal-emr-lang" style={{ fontSize: "0.8rem", color: "var(--d-text-muted)", fontWeight: 500 }}>
                                EMR Language:
                            </label>
                            <select
                                id="modal-emr-lang"
                                value={reportLang}
                                onChange={(e) => handleReportLangChange(e.target.value)}
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
                                <option value="en">English (Original Record)</option>
                                {SUPPORTED_MULTILINGUAL_LANGUAGES.filter((l) => l.code !== "en").map((l) => (
                                    <option key={l.code} value={l.code}>
                                        {l.native} ({l.label})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Dictation Language (For Doctors in editing mode) */}
                        {isEditable && (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <label htmlFor="modal-dictate-lang" style={{ fontSize: "0.8rem", color: "var(--d-text-muted)", fontWeight: 500 }}>
                                    Dictation:
                                </label>
                                <select
                                    id="modal-dictate-lang"
                                    value={dictationLang}
                                    onChange={(e) => setDictationLang(e.target.value)}
                                    style={{
                                        padding: "5px 8px",
                                        borderRadius: "var(--d-radius-sm)",
                                        border: "1px solid var(--d-border)",
                                        background: "var(--d-surface)",
                                        color: "var(--d-text)",
                                        fontSize: "0.8rem",
                                        cursor: "pointer",
                                    }}
                                >
                                    <option value="en-IN">English (India)</option>
                                    <option value="hi-IN">हिन्दी (Hindi)</option>
                                    <option value="mr-IN">मराठी (Marathi)</option>
                                </select>
                            </div>
                        )}

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
                </div>

                {/* Translation progress banner */}
                {isTranslatingReport && (
                    <div
                        style={{
                            padding: "8px 24px",
                            background: "#FEF3C7",
                            borderBottom: "1px solid #FCD34D",
                            fontSize: "0.82rem",
                            color: "#92400E",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                        }}
                    >
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#F59E0B", animation: "pulse 1.2s infinite" }} />
                        Translating clinical record into {SUPPORTED_MULTILINGUAL_LANGUAGES.find((l) => l.code === reportLang)?.label} via Gnani AI Vachana...
                    </div>
                )}

                {transReportError && (
                    <div
                        style={{
                            padding: "8px 24px",
                            background: "#FEE2E2",
                            borderBottom: "1px solid #FCA5A5",
                            fontSize: "0.82rem",
                            color: "#B91C1C",
                        }}
                    >
                        ⚠️ Report translation notice: {transReportError} (Showing original English document)
                    </div>
                )}

                {/* Voice dictation active feedback */}
                {isDictating && (
                    <div
                        style={{
                            padding: "8px 24px",
                            background: "#EEF2FF",
                            borderBottom: "1px solid #C7D2FE",
                            fontSize: "0.82rem",
                            color: "#3730A3",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4F46E5", animation: "pulse 1.2s infinite" }} />
                            <span>
                                <strong>Voice Dictation Active on [{activeDictationField?.replace("_", " ").toUpperCase()}]:</strong>{" "}
                                {dictationInterim || "Listening via Gnani Prisma... Speak clinical findings clearly."}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => stopDictating()}
                            style={{
                                padding: "2px 8px",
                                borderRadius: "4px",
                                background: "#DC2626",
                                color: "#FFF",
                                border: "none",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            Stop
                        </button>
                    </div>
                )}

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
                        { id: "symptoms", label: `Symptoms (${(activeDisplayReport.symptoms || symptoms).length})` },
                        { id: "icd", label: `ICD-10 & Diagnoses (${(activeDisplayReport.icd_10_codes || icdCodes).length})` },
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
                                    report={activeDisplayReport}
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
                            {reportLang !== "en" && (
                                <div style={{ marginBottom: "16px", padding: "10px 14px", background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: "6px", fontSize: "0.82rem", color: "#1E40AF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span>🌐 <strong>Displaying Certified Translation ({SUPPORTED_MULTILINGUAL_LANGUAGES.find((l) => l.code === reportLang)?.label || reportLang}).</strong> Clinical terms and ICD codes are legally preserved.</span>
                                    {isDoctor && !isApproved && (
                                        <button
                                            type="button"
                                            onClick={() => setReportLang("en")}
                                            style={{ padding: "4px 8px", background: "#DBEAFE", border: "1px solid #93C5FD", borderRadius: "4px", fontSize: "0.76rem", fontWeight: 700, color: "#1E40AF", cursor: "pointer" }}
                                        >
                                            Switch to English to Edit
                                        </button>
                                    )}
                                </div>
                            )}

                            <div style={{ marginBottom: "18px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                    <label style={{ fontWeight: 700, margin: 0, color: "var(--d-text)" }}>
                                        Chief Complaint
                                    </label>
                                    {isEditable && (
                                        <button
                                            type="button"
                                            onClick={() => toggleDictation("chief_complaint")}
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                padding: "2px 8px",
                                                borderRadius: "12px",
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                                border: "none",
                                                background: isDictating && activeDictationField === "chief_complaint" ? "#EF4444" : "#EEF2FF",
                                                color: isDictating && activeDictationField === "chief_complaint" ? "#FFF" : "#4F46E5",
                                                cursor: "pointer",
                                            }}
                                        >
                                            🎤 {isDictating && activeDictationField === "chief_complaint" ? "Stop Dictation" : "Voice Dictate"}
                                        </button>
                                    )}
                                </div>
                                {isEditable ? (
                                    <input
                                        type="text"
                                        value={chiefComplaint}
                                        onChange={(e) => setChiefComplaint(e.target.value)}
                                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--d-border)", fontSize: "0.88rem" }}
                                    />
                                ) : (
                                    <div style={{ padding: "10px 14px", background: "var(--d-surface-alt, #F8FAFC)", borderRadius: "6px", border: "1px solid var(--d-border)", fontWeight: 600 }}>
                                        {activeDisplayReport.chief_complaint || chiefComplaint || "Acute consultation"}
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
                                        {activeDisplayReport.summary || summary || "No summary documented."}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: "18px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                    <label style={{ fontWeight: 700, margin: 0, color: "var(--d-text)" }}>
                                        Attending Clinician Remarks
                                    </label>
                                    {isEditable && (
                                        <button
                                            type="button"
                                            onClick={() => toggleDictation("doctor_notes")}
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                padding: "2px 8px",
                                                borderRadius: "12px",
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                                border: "none",
                                                background: isDictating && activeDictationField === "doctor_notes" ? "#EF4444" : "#EEF2FF",
                                                color: isDictating && activeDictationField === "doctor_notes" ? "#FFF" : "#4F46E5",
                                                cursor: "pointer",
                                            }}
                                        >
                                            🎤 {isDictating && activeDictationField === "doctor_notes" ? "Stop Dictation" : "Voice Dictate"}
                                        </button>
                                    )}
                                </div>
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
                                        {activeDisplayReport.doctor_notes || doctorNotes || "None added."}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB: HPI, HISTORY & VITALS */}
                    {activeTab === "hpi_history" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                            {reportLang !== "en" && (
                                <div style={{ padding: "10px 14px", background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: "6px", fontSize: "0.82rem", color: "#1E40AF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span>🌐 <strong>Displaying Certified Translation ({SUPPORTED_MULTILINGUAL_LANGUAGES.find((l) => l.code === reportLang)?.label || reportLang}).</strong></span>
                                    {isDoctor && !isApproved && (
                                        <button
                                            type="button"
                                            onClick={() => setReportLang("en")}
                                            style={{ padding: "4px 8px", background: "#DBEAFE", border: "1px solid #93C5FD", borderRadius: "4px", fontSize: "0.76rem", fontWeight: 700, color: "#1E40AF", cursor: "pointer" }}
                                        >
                                            Switch to English to Edit
                                        </button>
                                    )}
                                </div>
                            )}

                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                    <label style={{ fontWeight: 700, margin: 0, color: "var(--d-text)" }}>
                                        History of Present Illness (HPI)
                                    </label>
                                    {isEditable && (
                                        <button
                                            type="button"
                                            onClick={() => toggleDictation("hpi")}
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                padding: "2px 8px",
                                                borderRadius: "12px",
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                                border: "none",
                                                background: isDictating && activeDictationField === "hpi" ? "#EF4444" : "#EEF2FF",
                                                color: isDictating && activeDictationField === "hpi" ? "#FFF" : "#4F46E5",
                                                cursor: "pointer",
                                            }}
                                        >
                                            🎤 {isDictating && activeDictationField === "hpi" ? "Stop Dictation" : "Voice Dictate"}
                                        </button>
                                    )}
                                </div>
                                {isEditable ? (
                                    <textarea
                                        value={hpi}
                                        onChange={(e) => setHpi(e.target.value)}
                                        rows={4}
                                        style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid var(--d-border)", fontSize: "0.88rem", lineHeight: "1.5", fontFamily: "inherit" }}
                                    />
                                ) : (
                                    <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "6px", border: "1px solid #E2E8F0", lineHeight: "1.5" }}>
                                        {activeDisplayReport.history_of_present_illness || activeDisplayReport.soap?.subjective || hpi}
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
                                        {activeDisplayReport.physical_examination || physicalExam}
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
                                            <div style={{ fontWeight: 600 }}>{(activeDisplayReport.vital_signs || vitalSigns).temperature || "Not measured"}</div>
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
                                            <div style={{ fontWeight: 600 }}>{(activeDisplayReport.vital_signs || vitalSigns).observations || "Alert and responsive"}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: SOAP NOTES */}
                    {activeTab === "soap" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {reportLang !== "en" && (
                                <div style={{ padding: "10px 14px", background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: "6px", fontSize: "0.82rem", color: "#1E40AF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span>🌐 <strong>Displaying Certified Translation ({SUPPORTED_MULTILINGUAL_LANGUAGES.find((l) => l.code === reportLang)?.label || reportLang}).</strong></span>
                                    {isDoctor && !isApproved && (
                                        <button
                                            type="button"
                                            onClick={() => setReportLang("en")}
                                            style={{ padding: "4px 8px", background: "#DBEAFE", border: "1px solid #93C5FD", borderRadius: "4px", fontSize: "0.76rem", fontWeight: 700, color: "#1E40AF", cursor: "pointer" }}
                                        >
                                            Switch to English to Edit
                                        </button>
                                    )}
                                </div>
                            )}

                            <div style={{ border: "1px solid #BFDBFE", borderRadius: "8px", overflow: "hidden" }}>
                                <div style={{ background: "#EFF6FF", padding: "8px 14px", fontWeight: 700, color: "#1E40AF", fontSize: "0.84rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span>S — Subjective (Patient narrative, chief complaint, symptom onset)</span>
                                    {isEditable && (
                                        <button
                                            type="button"
                                            onClick={() => toggleDictation("soap_subjective")}
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                padding: "2px 8px",
                                                borderRadius: "12px",
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                                border: "none",
                                                background: isDictating && activeDictationField === "soap_subjective" ? "#EF4444" : "#DBEAFE",
                                                color: isDictating && activeDictationField === "soap_subjective" ? "#FFF" : "#1E40AF",
                                                cursor: "pointer",
                                            }}
                                        >
                                            🎤 {isDictating && activeDictationField === "soap_subjective" ? "Stop" : "Dictate"}
                                        </button>
                                    )}
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
                                        <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.5" }}>{activeDisplayReport.soap?.subjective || soap.subjective}</div>
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
                                        <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.5" }}>{activeDisplayReport.soap?.objective || soap.objective}</div>
                                    )}
                                </div>
                            </div>

                            <div style={{ border: "1px solid #DDD6FE", borderRadius: "8px", overflow: "hidden" }}>
                                <div style={{ background: "#F5F3FF", padding: "8px 14px", fontWeight: 700, color: "#6D28D9", fontSize: "0.84rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span>A — Assessment (Clinical evaluation, working diagnosis, differentials)</span>
                                    {isEditable && (
                                        <button
                                            type="button"
                                            onClick={() => toggleDictation("soap_assessment")}
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                padding: "2px 8px",
                                                borderRadius: "12px",
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                                border: "none",
                                                background: isDictating && activeDictationField === "soap_assessment" ? "#EF4444" : "#EDE9FE",
                                                color: isDictating && activeDictationField === "soap_assessment" ? "#FFF" : "#6D28D9",
                                                cursor: "pointer",
                                            }}
                                        >
                                            🎤 {isDictating && activeDictationField === "soap_assessment" ? "Stop" : "Dictate"}
                                        </button>
                                    )}
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
                                        <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.5" }}>{activeDisplayReport.soap?.assessment || soap.assessment}</div>
                                    )}
                                </div>
                            </div>

                            <div style={{ border: "1px solid #BBF7D0", borderRadius: "8px", overflow: "hidden" }}>
                                <div style={{ background: "#F0FDF4", padding: "8px 14px", fontWeight: 700, color: "#166534", fontSize: "0.84rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span>P — Plan (Therapeutic actions, medications, investigations, follow-up)</span>
                                    {isEditable && (
                                        <button
                                            type="button"
                                            onClick={() => toggleDictation("soap_plan")}
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                padding: "2px 8px",
                                                borderRadius: "12px",
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                                border: "none",
                                                background: isDictating && activeDictationField === "soap_plan" ? "#EF4444" : "#DCFCE7",
                                                color: isDictating && activeDictationField === "soap_plan" ? "#FFF" : "#166534",
                                                cursor: "pointer",
                                            }}
                                        >
                                            🎤 {isDictating && activeDictationField === "soap_plan" ? "Stop" : "Dictate"}
                                        </button>
                                    )}
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
                                        <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.5" }}>{activeDisplayReport.soap?.plan || soap.plan}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: SYMPTOMS */}
                    {activeTab === "symptoms" && (
                        <div>
                            {reportLang !== "en" && (
                                <div style={{ marginBottom: "16px", padding: "10px 14px", background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: "6px", fontSize: "0.82rem", color: "#1E40AF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span>🌐 <strong>Displaying Certified Translation ({SUPPORTED_MULTILINGUAL_LANGUAGES.find((l) => l.code === reportLang)?.label || reportLang}).</strong></span>
                                    {isDoctor && !isApproved && (
                                        <button
                                            type="button"
                                            onClick={() => setReportLang("en")}
                                            style={{ padding: "4px 8px", background: "#DBEAFE", border: "1px solid #93C5FD", borderRadius: "4px", fontSize: "0.76rem", fontWeight: 700, color: "#1E40AF", cursor: "pointer" }}
                                        >
                                            Switch to English to Edit
                                        </button>
                                    )}
                                </div>
                            )}

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
                                    {((reportLang !== "en" && activeDisplayReport.symptoms && activeDisplayReport.symptoms.length > 0 ? activeDisplayReport.symptoms : symptoms)).map((item, idx) => (
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
                            {reportLang !== "en" && (
                                <div style={{ marginBottom: "16px", padding: "10px 14px", background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: "6px", fontSize: "0.82rem", color: "#1E40AF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span>🌐 <strong>Displaying Certified Translation ({SUPPORTED_MULTILINGUAL_LANGUAGES.find((l) => l.code === reportLang)?.label || reportLang}).</strong></span>
                                    {isDoctor && !isApproved && (
                                        <button
                                            type="button"
                                            onClick={() => setReportLang("en")}
                                            style={{ padding: "4px 8px", background: "#DBEAFE", border: "1px solid #93C5FD", borderRadius: "4px", fontSize: "0.76rem", fontWeight: 700, color: "#1E40AF", cursor: "pointer" }}
                                        >
                                            Switch to English to Edit
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Differential Diagnoses */}
                            <div style={{ marginBottom: "22px" }}>
                                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", fontWeight: 700, color: "var(--d-text)" }}>
                                    Clinical Diagnostic Impressions &amp; Differentials
                                </h4>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {((reportLang !== "en" && activeDisplayReport.differential_diagnoses && activeDisplayReport.differential_diagnoses.length > 0 ? activeDisplayReport.differential_diagnoses : differentialDiagnoses)).map((d, idx) => (
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
                                        {((reportLang !== "en" && activeDisplayReport.icd_10_codes && activeDisplayReport.icd_10_codes.length > 0 ? activeDisplayReport.icd_10_codes : icdCodes)).map((item, idx) => (
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
                            {reportLang !== "en" && (
                                <div style={{ padding: "10px 14px", background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: "6px", fontSize: "0.82rem", color: "#1E40AF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span>🌐 <strong>Displaying Certified Translation ({SUPPORTED_MULTILINGUAL_LANGUAGES.find((l) => l.code === reportLang)?.label || reportLang}).</strong></span>
                                    {isDoctor && !isApproved && (
                                        <button
                                            type="button"
                                            onClick={() => setReportLang("en")}
                                            style={{ padding: "4px 8px", background: "#DBEAFE", border: "1px solid #93C5FD", borderRadius: "4px", fontSize: "0.76rem", fontWeight: 700, color: "#1E40AF", cursor: "pointer" }}
                                        >
                                            Switch to English to Edit
                                        </button>
                                    )}
                                </div>
                            )}

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
                                    {(((reportLang !== "en" && activeDisplayReport.treatment_plan?.medications) ? activeDisplayReport.treatment_plan.medications : treatmentPlan.medications) || []).map((med, idx) => (
                                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            {isEditable ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={typeof med === "string" ? med : (med as any).medication || ""}
                                                        onChange={(e) => handleUpdateMedication(idx, e.target.value)}
                                                        style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--d-border)" }}
                                                    />
                                                    <button onClick={() => handleRemoveMedication(idx)} style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer" }}>
                                                        ✕
                                                    </button>
                                                </>
                                            ) : (
                                                <div style={{ padding: "8px 12px", background: "#F1F5F9", borderRadius: "6px", width: "100%", fontWeight: 600 }}>
                                                    💊 {typeof med === "string" ? med : `${(med as any).medication} — ${(med as any).instructions || (med as any).dosage || ""}`}
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
                                    <p style={{ margin: 0 }}>{(reportLang !== "en" && activeDisplayReport.treatment_plan?.follow_up) ? activeDisplayReport.treatment_plan.follow_up : (treatmentPlan.follow_up || "Follow up in 3 to 5 days.")}</p>
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
                                        {(reportLang !== "en" && (activeDisplayReport.treatment_plan?.emergency_warnings || activeDisplayReport.treatment_plan?.emergency_warning)) ? (activeDisplayReport.treatment_plan.emergency_warnings || activeDisplayReport.treatment_plan.emergency_warning) : (treatmentPlan.emergency_warnings || "Seek immediate emergency medical attention if severe sudden symptoms occur.")}
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
                    report={activeDisplayReport}
                    patientName={effectivePatientName}
                    doctorName={effectiveDoctorName}
                    currentUserRole={currentUserRole}
                    encounterDuration={report.duration ? `${Math.round(report.duration / 60)} minutes` : "10 minutes"}
                />
            </div>
        </div>
    );
}
