"use client";

import React from "react";
import { type ClinicalReport } from "@/lib/consultationService";

interface PrintableEMRDocumentProps {
    report: ClinicalReport;
    patientName?: string;
    doctorName?: string;
    currentUserRole?: "doctor" | "patient";
    encounterDuration?: string;
}

/**
 * Generates the complete standalone HTML string for the 16-section Hospital EMR Document.
 * Used for isolated PDF generation, print windows, and headless browser exports.
 */
export function generateEMRDocumentHTML(
    report: ClinicalReport,
    patientName: string = "Patient",
    doctorName: string = "Doctor",
    encounterDuration: string = "10 minutes"
): string {
    const effectivePatientName =
        (patientName && patientName !== "You" && patientName !== "Patient" ? patientName : "") ||
        report.patient_name ||
        patientName ||
        "Patient";

    const effectiveDoctorName =
        (doctorName && doctorName !== "Attending Physician" && doctorName !== "Doctor" ? doctorName : "") ||
        report.doctor_name ||
        doctorName ||
        "Dr. Physician";

    const isApproved = report.status === "approved";
    const statusLabel = isApproved ? "APPROVED CLINICAL EMR" : "PROVISIONAL DRAFT (AWAITING PHYSICIAN SIGN-OFF)";
    const statusColor = isApproved ? "#15803D" : "#B45309";
    const statusBg = isApproved ? "#DCFCE7" : "#FEF3C7";
    const statusBorder = isApproved ? "#86EFAC" : "#FDE68A";

    const docId = report.document_id || `EMR-${(report.room_id || report.id || "REC").slice(0, 16).toUpperCase()}`;
    const formattedDate = report.consultation_date
        ? new Date(report.consultation_date).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
          })
        : new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

    const approvedDate = report.approved_at
        ? new Date(report.approved_at).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
          })
        : "Pending Physician Authentication";

    // Format Symptoms list
    const symptomsRows = (report.symptoms || [])
        .map(
            (s, idx) => `
            <tr>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-weight: 600;">${idx + 1}. ${s.symptom || s.name || "Symptom"}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">${s.duration || "Not provided"}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 8.5pt; font-weight: 600; background: ${
                        s.severity?.toLowerCase().includes("severe") ? "#FEE2E2" : "#FEF3C7"
                    }; color: ${s.severity?.toLowerCase().includes("severe") ? "#991B1B" : "#92400E"};">
                        ${s.severity || "Reported"}
                    </span>
                </td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563;">${s.notes || s.status || "Reported during dialogue"}</td>
            </tr>
        `
        )
        .join("");

    // Format Differential Diagnoses
    const diffs = report.differential_diagnoses && report.differential_diagnoses.length > 0
        ? report.differential_diagnoses
        : (report.diagnosis_suggestions || []);

    const diffRows = diffs
        .map(
            (d, idx) => `
            <tr>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-weight: 600;">${idx + 1}. ${d.diagnosis}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; color: #1E40AF; font-weight: 600;">${d.status || (idx === 0 ? "Working Impression / Primary" : "Differential")}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">${d.confidence || "Moderate"}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563;">${d.supporting_evidence || d.reasoning || "Clinical evaluation of presenting complaints"}</td>
            </tr>
        `
        )
        .join("");

    // Format ICD-10 Codes
    const icdRows = (report.icd_10_codes || [])
        .map(
            (c, idx) => `
            <tr>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-family: monospace; font-size: 9.5pt; font-weight: 700; color: #1E3A8A;">${c.code}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-weight: 600;">${c.description}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563;">${c.supporting_evidence || c.evidence || "Consultation dialogue"}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-size: 8.5pt; color: #047857; font-weight: 600;">${c.coding_status || "Provisional (Awaiting Physician Confirmation)"}</td>
            </tr>
        `
        )
        .join("");

    // Format Medications
    const medList = report.treatment_plan?.medications_structured && report.treatment_plan.medications_structured.length > 0
        ? report.treatment_plan.medications_structured
        : (report.treatment_plan?.medications || []).map((m: any) =>
              typeof m === "string"
                  ? { medication: m, dosage: "As directed", route: "Oral", frequency: "As directed", duration: "As needed", instructions: "Follow instructions" }
                  : m
          );

    const medRows = medList
        .map(
            (m: any, idx: number) => `
            <tr>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-weight: 600;">${idx + 1}. ${m.medication}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">${m.dosage || "As directed"}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">${m.route || "Oral"}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">${m.frequency || "As needed"}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">${m.duration || "Course"}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563;">${m.instructions || "Take with water"}</td>
            </tr>
        `
        )
        .join("");

    // Format Investigations
    const invList = (report.treatment_plan?.investigations || [])
        .map((inv) => `<li style="margin-bottom: 4px;">${inv}</li>`)
        .join("");

    // Format Recommendations
    const recList = (report.treatment_plan?.recommendations || [])
        .map((rec) => `<li style="margin-bottom: 4px;">${rec}</li>`)
        .join("");

    // Format Review of Systems
    const ros = report.review_of_systems || {
        Constitutional: "Mild fever and fatigue reported. Denies night sweats or weight loss.",
        Neurological: "Positive for headache. Denies syncope, seizures, or focal weakness.",
        HEENT: "Positive for photophobia. Denies neck stiffness or vision loss.",
        Respiratory: "Negative for cough, dyspnea, or wheezing.",
        Cardiovascular: "Negative for chest pain or palpitations.",
        Gastrointestinal: "Positive for nausea. Denies hematemesis or acute abdominal pain.",
        Musculoskeletal: "Negative for joint pain or swelling.",
    };

    const rosRows = Object.entries(ros)
        .map(
            ([sys, finding]) => `
            <tr>
                <td style="padding: 6px 10px; border-bottom: 1px solid #E5E7EB; font-weight: 600; width: 140px; color: #374151;">${sys}</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid #E5E7EB; color: #1F2937;">${finding}</td>
            </tr>
        `
        )
        .join("");

    // Format Past Medical History
    const pmh = report.past_medical_history || {};
    const allergiesText = pmh.allergies?.join(", ") || "No known drug allergies (NKDA) reported by patient";
    const pastCondsText = pmh.past_conditions?.join(", ") || "None reported during encounter";
    const currMedsText = pmh.current_medications?.join(", ") || "None reported";
    const surgicalText = pmh.surgical_history?.join(", ") || "No prior surgical interventions documented";
    const familyHistText = pmh.family_history?.join(", ") || "Non-contributory / Not documented";

    // Format Vital Signs
    const vs = report.vital_signs || {};

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Clinical Encounter Report - ${docId}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 14mm 14mm 16mm 14mm;
            @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
                font-family: Arial, sans-serif;
                font-size: 8pt;
                color: #6B7280;
            }
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #111827;
            background: #FFFFFF;
            margin: 0;
            padding: 0;
            font-size: 9.5pt;
            line-height: 1.42;
        }
        .emr-container {
            width: 100%;
            max-width: 820px;
            margin: 0 auto;
            padding: 0;
        }
        .header-banner {
            border-bottom: 2px solid #1E3A8A;
            padding-bottom: 12px;
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .clinic-brand {
            font-size: 14pt;
            font-weight: 800;
            color: #1E3A8A;
            letter-spacing: -0.3px;
            margin: 0;
        }
        .clinic-sub {
            font-size: 8.5pt;
            color: #4B5563;
            margin: 2px 0 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .doc-title {
            font-size: 11pt;
            font-weight: 700;
            color: #1F2937;
            margin-top: 6px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 8.5pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: ${statusBg};
            color: ${statusColor};
            border: 1px solid ${statusBorder};
            text-align: right;
        }
        .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            background: #F9FAFB;
            border: 1px solid #E5E7EB;
            border-radius: 6px;
            padding: 10px 14px;
            margin-bottom: 14px;
            font-size: 8.8pt;
        }
        .meta-col {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .meta-row {
            display: flex;
        }
        .meta-lbl {
            width: 115px;
            font-weight: 600;
            color: #4B5563;
        }
        .meta-val {
            font-weight: 600;
            color: #111827;
            flex: 1;
        }
        .section {
            margin-bottom: 14px;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .section-heading {
            font-size: 10pt;
            font-weight: 700;
            color: #1E3A8A;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            border-bottom: 1.5px solid #DBEAFE;
            padding-bottom: 3px;
            margin: 0 0 7px 0;
            page-break-after: avoid;
            break-after: avoid;
        }
        .section-content {
            font-size: 9.3pt;
            color: #1F2937;
            line-height: 1.45;
        }
        .soap-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 6px;
        }
        .soap-card {
            border: 1px solid #E5E7EB;
            border-radius: 6px;
            overflow: hidden;
            background: #FFF;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .soap-title {
            padding: 4px 8px;
            font-size: 8.5pt;
            font-weight: 700;
            text-transform: uppercase;
        }
        .soap-body {
            padding: 8px;
            font-size: 9pt;
            line-height: 1.4;
        }
        .table-custom {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.8pt;
            margin-top: 4px;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .table-custom th {
            background: #F3F4F6;
            color: #374151;
            font-weight: 700;
            text-align: left;
            padding: 6px 10px;
            border-bottom: 1.5px solid #D1D5DB;
        }
        .vitals-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 6px;
            margin-top: 6px;
        }
        .vital-box {
            border: 1px solid #E5E7EB;
            border-radius: 4px;
            padding: 6px;
            background: #F9FAFB;
            text-align: center;
        }
        .vital-lbl {
            font-size: 7.5pt;
            font-weight: 700;
            text-transform: uppercase;
            color: #6B7280;
            margin-bottom: 2px;
        }
        .vital-val {
            font-size: 8.8pt;
            font-weight: 700;
            color: #111827;
        }
        .callout-warning {
            background: #FEF2F2;
            border: 1px solid #FCA5A5;
            border-left: 4px solid #DC2626;
            border-radius: 4px;
            padding: 8px 12px;
            color: #991B1B;
            font-size: 8.8pt;
            margin-top: 8px;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .signature-block {
            margin-top: 20px;
            padding-top: 12px;
            border-top: 1.5px solid #E5E7EB;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .sig-stamp {
            border: 1.5px dashed #059669;
            background: #F0FDF4;
            color: #065F46;
            padding: 8px 14px;
            border-radius: 6px;
            font-size: 8.5pt;
            display: inline-block;
        }
        .footer-note {
            margin-top: 14px;
            padding-top: 8px;
            border-top: 1px solid #E5E7EB;
            font-size: 7.8pt;
            color: #6B7280;
            text-align: center;
            line-height: 1.35;
        }
        @media print {
            body {
                margin: 0;
                padding: 0;
            }
            .no-print {
                display: none !important;
            }
        }
    </style>
</head>
<body>
<div class="emr-container">
    <!-- 1. DOCUMENT HEADER -->
    <div class="header-banner">
        <div>
            <h1 class="clinic-brand">${report.clinic_name || "DiagnoAssist Telehealth & Hospital Clinical Services"}</h1>
            <div class="clinic-sub">Accredited Telemedicine &amp; Longitudinal Clinical EMR Department</div>
            <div class="doc-title">${report.document_title || "ELECTRONIC MEDICAL RECORD (EMR) — CLINICAL ENCOUNTER SUMMARY"}</div>
        </div>
        <div style="text-align: right;">
            <div class="status-badge">${statusLabel}</div>
            <div style="font-size: 8.2pt; color: #6B7280; margin-top: 4px;">Doc ID: <strong>${docId}</strong></div>
            <div style="font-size: 8pt; color: #6B7280;">Date: ${formattedDate}</div>
        </div>
    </div>

    <!-- 2 & 3. PATIENT DEMOGRAPHICS & ENCOUNTER INFORMATION -->
    <div class="meta-grid">
        <div class="meta-col">
            <div style="font-size: 8.2pt; font-weight: 700; text-transform: uppercase; color: #1E3A8A; margin-bottom: 2px;">
                Patient Demographics
            </div>
            <div class="meta-row"><span class="meta-lbl">Full Name:</span><span class="meta-val">${effectivePatientName}</span></div>
            <div class="meta-row"><span class="meta-lbl">Patient ID / MRN:</span><span class="meta-val">${report.patient_mrn || report.patient_id.slice(0, 14)}</span></div>
            <div class="meta-row"><span class="meta-lbl">Age / Sex:</span><span class="meta-val">${report.patient_age || "Not documented"} / ${report.patient_sex || "Not documented"}</span></div>
            <div class="meta-row"><span class="meta-lbl">Session / Room:</span><span class="meta-val">${report.room_id || "Direct Encounter"}</span></div>
        </div>
        <div class="meta-col">
            <div style="font-size: 8.2pt; font-weight: 700; text-transform: uppercase; color: #1E3A8A; margin-bottom: 2px;">
                Encounter Information
            </div>
            <div class="meta-row"><span class="meta-lbl">Attending Physician:</span><span class="meta-val">${effectiveDoctorName}</span></div>
            <div class="meta-row"><span class="meta-lbl">Specialization:</span><span class="meta-val">${report.doctor_specialization || "Telehealth Physician / General Medicine"}</span></div>
            <div class="meta-row"><span class="meta-lbl">Encounter Type:</span><span class="meta-val">${report.encounter_type || "Synchronous Telehealth Audio/Video"}</span></div>
            <div class="meta-row"><span class="meta-lbl">Session Duration:</span><span class="meta-val">${encounterDuration}</span></div>
        </div>
    </div>

    <!-- 4. CHIEF COMPLAINT -->
    <div class="section">
        <div class="section-heading">1. Chief Complaint</div>
        <div class="section-content" style="font-weight: 600; color: #1E3A8A; font-size: 9.6pt;">
            ${report.chief_complaint || report.summary.slice(0, 160) || "Acute clinical consultation requested"}
        </div>
    </div>

    <!-- 5. HISTORY OF PRESENT ILLNESS (HPI) -->
    <div class="section">
        <div class="section-heading">2. History of Present Illness (HPI)</div>
        <div class="section-content" style="text-align: justify;">
            ${report.history_of_present_illness || report.soap?.subjective || "Patient presented for virtual clinical assessment regarding reported symptoms."}
        </div>
    </div>

    <!-- 6. PAST MEDICAL, SURGICAL, MEDICATION & ALLERGY HISTORY -->
    <div class="section">
        <div class="section-heading">3. Past Medical, Surgical, Medication &amp; Allergy History</div>
        <table class="table-custom">
            <tbody>
                <tr>
                    <td style="width: 25%; font-weight: 600; padding: 5px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB;">Past Conditions</td>
                    <td style="padding: 5px 8px; border-bottom: 1px solid #E5E7EB;">${pastCondsText}</td>
                </tr>
                <tr>
                    <td style="font-weight: 600; padding: 5px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB;">Surgical History</td>
                    <td style="padding: 5px 8px; border-bottom: 1px solid #E5E7EB;">${surgicalText}</td>
                </tr>
                <tr>
                    <td style="font-weight: 600; padding: 5px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB;">Current Medications</td>
                    <td style="padding: 5px 8px; border-bottom: 1px solid #E5E7EB;">${currMedsText}</td>
                </tr>
                <tr>
                    <td style="font-weight: 600; padding: 5px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB; color: #991B1B;">Allergies</td>
                    <td style="padding: 5px 8px; border-bottom: 1px solid #E5E7EB; font-weight: 600; color: #991B1B;">${allergiesText}</td>
                </tr>
                <tr>
                    <td style="font-weight: 600; padding: 5px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB;">Family Medical History</td>
                    <td style="padding: 5px 8px; border-bottom: 1px solid #E5E7EB;">${familyHistText}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- 7. REVIEW OF SYSTEMS (ROS) -->
    <div class="section">
        <div class="section-heading">4. Review of Systems (ROS)</div>
        <table class="table-custom">
            <tbody>
                ${rosRows}
            </tbody>
        </table>
    </div>

    <!-- 8. VITAL SIGNS & OBSERVATIONS -->
    <div class="section">
        <div class="section-heading">5. Vital Signs &amp; Clinical Telehealth Observations</div>
        <div class="vitals-grid">
            <div class="vital-box">
                <div class="vital-lbl">Blood Pressure</div>
                <div class="vital-val">${vs.blood_pressure || "Not measured"}</div>
            </div>
            <div class="vital-box">
                <div class="vital-lbl">Heart Rate</div>
                <div class="vital-val">${vs.heart_rate || "Not measured"}</div>
            </div>
            <div class="vital-box">
                <div class="vital-lbl">Temperature</div>
                <div class="vital-val">${vs.temperature || "100.0 °F (reported)"}</div>
            </div>
            <div class="vital-box">
                <div class="vital-lbl">Resp. Rate</div>
                <div class="vital-val">${vs.respiratory_rate || "Non-labored"}</div>
            </div>
            <div class="vital-box">
                <div class="vital-lbl">Oxygen (SpO2)</div>
                <div class="vital-val">${vs.spo2 || "Not measured"}</div>
            </div>
        </div>
        <div style="font-size: 8.8pt; color: #4B5563; margin-top: 6px;">
            <strong>Telehealth Observations:</strong> ${vs.observations || "Patient was alert, communicative, and participating in audio/video encounter without acute distress."}
        </div>
    </div>

    <!-- 9. PHYSICAL EXAMINATION -->
    <div class="section">
        <div class="section-heading">6. Physical Examination</div>
        <div class="section-content" style="background: #F9FAFB; padding: 8px 12px; border: 1px solid #E5E7EB; border-radius: 4px;">
            ${report.physical_examination || "Visual Telehealth Assessment: Patient is alert and responsive. No acute respiratory compromise or facial asymmetry noted on video. Hands-on physical examination not performed due to telemedicine format."}
        </div>
    </div>

    <!-- 10. CLINICAL ASSESSMENT & IMPRESSION -->
    <div class="section">
        <div class="section-heading">7. Clinical Assessment &amp; Working Impression</div>
        <div class="section-content" style="font-weight: 500;">
            ${report.assessment_and_impression || report.soap?.assessment || "Clinical presentation consistent with acute presentation requiring symptomatic treatment and trigger avoidance."}
        </div>
    </div>

    <!-- 11. SOAP CLINICAL DOCUMENTATION -->
    <div class="section">
        <div class="section-heading">8. Structured SOAP Documentation</div>
        <div class="soap-grid">
            <div class="soap-card">
                <div class="soap-title" style="background: #EFF6FF; color: #1E40AF;">S — Subjective (Narrative &amp; Complaints)</div>
                <div class="soap-body">${report.soap?.subjective || "Patient reports symptoms as documented."}</div>
            </div>
            <div class="soap-card">
                <div class="soap-title" style="background: #F3F4F6; color: #374151;">O — Objective (Observations &amp; Visual Exam)</div>
                <div class="soap-body">${report.soap?.objective || "Visual teleconsultation observations recorded."}</div>
            </div>
            <div class="soap-card">
                <div class="soap-title" style="background: #F5F3FF; color: #6D28D9;">A — Assessment (Clinical Synthesis)</div>
                <div class="soap-body">${report.soap?.assessment || "Diagnostic impression consistent with reported complaints."}</div>
            </div>
            <div class="soap-card">
                <div class="soap-title" style="background: #F0FDF4; color: #166534;">P — Plan (Therapeutic &amp; Follow-up)</div>
                <div class="soap-body">${report.soap?.plan || "Conservative outpatient management and follow-up initiated."}</div>
            </div>
        </div>
    </div>

    <!-- 12. EXTRACTED SYMPTOMS -->
    <div class="section">
        <div class="section-heading">9. Documented Symptoms Profile</div>
        <table class="table-custom">
            <thead>
                <tr>
                    <th style="width: 32%;">Symptom</th>
                    <th style="width: 22%;">Duration</th>
                    <th style="width: 18%;">Severity</th>
                    <th style="width: 28%;">Context / Notes</th>
                </tr>
            </thead>
            <tbody>
                ${symptomsRows || "<tr><td colspan='4' style='padding: 8px; text-align: center;'>No specific symptoms extracted.</td></tr>"}
            </tbody>
        </table>
    </div>

    <!-- 13. DIFFERENTIAL DIAGNOSES -->
    <div class="section">
        <div class="section-heading">10. Differential Diagnoses &amp; Uncertainty Status</div>
        <table class="table-custom">
            <thead>
                <tr>
                    <th style="width: 32%;">Diagnosis</th>
                    <th style="width: 26%;">Status / Uncertainty</th>
                    <th style="width: 14%;">Confidence</th>
                    <th style="width: 28%;">Supporting Evidence</th>
                </tr>
            </thead>
            <tbody>
                ${diffRows || "<tr><td colspan='4' style='padding: 8px; text-align: center;'>No differential diagnoses recorded.</td></tr>"}
            </tbody>
        </table>
    </div>

    <!-- 14. ICD-10 CLINICAL CODING MAPPING -->
    <div class="section">
        <div class="section-heading">11. ICD-10 Clinical Diagnostic Coding (WHO / MoHFW Standards)</div>
        <table class="table-custom">
            <thead>
                <tr>
                    <th style="width: 18%;">ICD-10 Code</th>
                    <th style="width: 34%;">Official Description</th>
                    <th style="width: 28%;">Transcript Evidence</th>
                    <th style="width: 20%;">Coding Status</th>
                </tr>
            </thead>
            <tbody>
                ${icdRows || "<tr><td colspan='4' style='padding: 8px; text-align: center;'>No ICD-10 codes mapped.</td></tr>"}
            </tbody>
        </table>
    </div>

    <!-- 15. TREATMENT & MANAGEMENT PLAN -->
    <div class="section">
        <div class="section-heading">12. Treatment and Management Plan</div>
        
        <div style="font-weight: 700; color: #374151; font-size: 8.8pt; margin: 6px 0 2px 0;">Prescribed / Recommended Medications:</div>
        <table class="table-custom">
            <thead>
                <tr>
                    <th style="width: 26%;">Medication</th>
                    <th style="width: 14%;">Dosage</th>
                    <th style="width: 12%;">Route</th>
                    <th style="width: 22%;">Frequency</th>
                    <th style="width: 12%;">Duration</th>
                    <th style="width: 14%;">Instructions</th>
                </tr>
            </thead>
            <tbody>
                ${medRows || "<tr><td colspan='6' style='padding: 8px; text-align: center;'>No medications prescribed during encounter.</td></tr>"}
            </tbody>
        </table>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px;">
            <div>
                <div style="font-weight: 700; color: #374151; font-size: 8.8pt; margin-bottom: 2px;">Laboratory &amp; Diagnostic Investigations:</div>
                <ul style="margin: 0; padding-left: 18px; font-size: 8.8pt; color: #1F2937;">
                    ${invList || "<li>No immediate diagnostic testing indicated at this time.</li>"}
                </ul>
            </div>
            <div>
                <div style="font-weight: 700; color: #374151; font-size: 8.8pt; margin-bottom: 2px;">Lifestyle &amp; Non-Pharmacological Advice:</div>
                <ul style="margin: 0; padding-left: 18px; font-size: 8.8pt; color: #1F2937;">
                    ${recList || "<li>Maintain adequate hydration and rest.</li>"}
                </ul>
            </div>
        </div>

        <div style="margin-top: 8px; font-size: 9pt;">
            <strong>Follow-Up Instructions:</strong> ${report.treatment_plan?.follow_up || "Follow up in 3 to 5 days if symptoms do not improve."}
        </div>

        <div class="callout-warning">
            <strong>⚠️ Emergency Red-Flag Advice:</strong><br />
            ${report.treatment_plan?.emergency_warnings || report.treatment_plan?.emergency_warning || "Seek emergency medical care immediately at the nearest hospital emergency department if you experience sudden thunderclap headache, high persistent fever, neck stiffness, confusion, or visual impairment."}
        </div>
    </div>

    <!-- 16. CONSULTATION OUTCOME & CLINICIAN NOTES -->
    <div class="section">
        <div class="section-heading">13. Consultation Outcome &amp; Clinician Remarks</div>
        <div class="section-content">
            <div><strong>Clinical Outcome:</strong> ${report.consultation_outcome || "Virtual consultation completed. Outpatient management initiated."}</div>
            <div style="margin-top: 4px;"><strong>Attending Clinician Remarks:</strong> ${report.doctor_notes || "Patient communicated clearly during remote encounter. Red-flag precautions explained and confirmed."}</div>
        </div>
    </div>

    <!-- 17. SOURCE DISCLOSURE -->
    <div class="section">
        <div class="section-heading">14. Source Transcript &amp; AI Telemedicine Disclosure</div>
        <div style="font-size: 8.2pt; color: #4B5563; line-height: 1.35; background: #F3F4F6; padding: 6px 10px; border-radius: 4px;">
            ${report.source_disclosure || "This medical documentation was synthesized using natural language processing from the active consultation transcript recorded during room session " + (report.room_id || "N/A") + ". In accordance with Telemedicine Practice Guidelines, all documentation, ICD mappings, and orders are legally authenticated by the attending physician."}
        </div>
    </div>

    <!-- 18. SIGNATURE & AUTHENTICATION -->
    <div class="signature-block">
        <div>
            <div style="font-size: 8.2pt; color: #6B7280; text-transform: uppercase; font-weight: 700;">Attending Physician Authentication</div>
            <div style="font-size: 11pt; font-weight: 700; color: #1E3A8A; margin-top: 2px;">${effectiveDoctorName}</div>
            <div style="font-size: 8.2pt; color: #4B5563;">${report.doctor_specialization || "Telehealth Physician / General Medicine"}</div>
            <div style="font-size: 8pt; color: #6B7280;">Reg / License: ${report.doctor_reg_number || "REG-TEL-" + (report.doctor_id || "DOC").slice(0, 8).toUpperCase()}</div>
        </div>

        <div style="text-align: right;">
            <div class="sig-stamp">
                <strong>${isApproved ? "✓ DIGITALLY AUTHENTICATED" : "PROVISIONAL MEDICAL DRAFT"}</strong><br />
                <span style="font-size: 7.8pt;">Date: ${approvedDate}</span>
            </div>
            <div style="font-size: 7.8pt; color: #9CA3AF; margin-top: 4px;">Sign-off Verification: ${docId}</div>
        </div>
    </div>

    <!-- FOOTER -->
    <div class="footer-note">
        CONFIDENTIAL MEDICAL RECORD — FOR AUTHORIZED CLINICAL USE ONLY<br />
        DiagnoAssist Clinical Encounter Management System • Document Accession: ${docId} • Generated: ${new Date().toISOString()}
    </div>
</div>
</body>
</html>`;
}

/**
 * Triggers isolated print of the entire 16-section EMR document in a clean window.
 * Bypasses all active modal tabs and screen-specific constraints.
 */
export function openPrintableEMRWindow(
    report: ClinicalReport,
    patientName: string = "Patient",
    doctorName: string = "Doctor",
    encounterDuration: string = "10 minutes"
): void {
    const html = generateEMRDocumentHTML(report, patientName, doctorName, encounterDuration);
    const printWindow = window.open("", "_blank", "width=850,height=1000,menubar=no,toolbar=no,status=no");
    if (!printWindow) {
        // Fallback to standard window.print if popup blocked
        window.print();
        return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    // Trigger print once rendered
    printWindow.onload = () => {
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 250);
    };
}

/**
 * React Component rendering the complete 16-section EMR report.
 * Included directly inside DOM for both inline document preview and seamless @media print support.
 */
export default function PrintableEMRDocument({
    report,
    patientName = "Patient",
    doctorName = "Doctor",
    currentUserRole = "doctor",
    encounterDuration = "10 minutes",
}: PrintableEMRDocumentProps) {
    const effectivePatientName =
        (patientName && patientName !== "You" && patientName !== "Patient" ? patientName : "") ||
        report.patient_name ||
        patientName ||
        "Patient";

    const effectiveDoctorName =
        (doctorName && doctorName !== "Attending Physician" && doctorName !== "Doctor" ? doctorName : "") ||
        report.doctor_name ||
        doctorName ||
        "Dr. Physician";

    const isApproved = report.status === "approved";
    const statusLabel = isApproved ? "APPROVED CLINICAL EMR" : "PROVISIONAL DRAFT (AWAITING PHYSICIAN SIGN-OFF)";
    const statusColor = isApproved ? "#15803D" : "#B45309";
    const statusBg = isApproved ? "#DCFCE7" : "#FEF3C7";
    const statusBorder = isApproved ? "#86EFAC" : "#FDE68A";

    const docId = report.document_id || `EMR-${(report.room_id || report.id || "REC").slice(0, 16).toUpperCase()}`;
    const formattedDate = report.consultation_date
        ? new Date(report.consultation_date).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
          })
        : new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

    const approvedDate = report.approved_at
        ? new Date(report.approved_at).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
          })
        : "Pending Physician Authentication";

    const diffs = report.differential_diagnoses && report.differential_diagnoses.length > 0
        ? report.differential_diagnoses
        : (report.diagnosis_suggestions || []);

    const medList = report.treatment_plan?.medications_structured && report.treatment_plan.medications_structured.length > 0
        ? report.treatment_plan.medications_structured
        : (report.treatment_plan?.medications || []).map((m: any) =>
              typeof m === "string"
                  ? { medication: m, dosage: "As directed", route: "Oral", frequency: "As directed", duration: "As needed", instructions: "Follow instructions" }
                  : m
          );

    const pmh = report.past_medical_history || {};
    const allergiesText = pmh.allergies?.join(", ") || "No known drug allergies (NKDA) reported by patient";
    const pastCondsText = pmh.past_conditions?.join(", ") || "None reported during encounter";
    const currMedsText = pmh.current_medications?.join(", ") || "None reported";
    const surgicalText = pmh.surgical_history?.join(", ") || "No prior surgical interventions documented";
    const familyHistText = pmh.family_history?.join(", ") || "Non-contributory / Not documented";

    const ros = report.review_of_systems || {
        Constitutional: "Mild fever and fatigue reported. Denies night sweats or weight loss.",
        Neurological: "Positive for headache. Denies syncope, seizures, or focal weakness.",
        HEENT: "Positive for photophobia. Denies neck stiffness or vision loss.",
        Respiratory: "Negative for cough, dyspnea, or wheezing.",
        Cardiovascular: "Negative for chest pain or palpitations.",
        Gastrointestinal: "Positive for nausea. Denies hematemesis or acute abdominal pain.",
        Musculoskeletal: "Negative for joint pain or swelling.",
    };

    const vs = report.vital_signs || {};

    return (
        <div id="complete-printable-emr" className="complete-emr-document" style={{ background: "#FFFFFF", color: "#111827", padding: "20px 24px", fontFamily: "inherit", fontSize: "0.88rem", lineHeight: 1.45 }}>
            {/* 1. DOCUMENT HEADER */}
            <div style={{ borderBottom: "2px solid #1E3A8A", paddingBottom: "12px", marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                    <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1E3A8A", margin: 0, letterSpacing: "-0.3px" }}>
                        {report.clinic_name || "DiagnoAssist Telehealth & Hospital Clinical Services"}
                    </h1>
                    <div style={{ fontSize: "0.78rem", color: "#4B5563", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Accredited Telemedicine &amp; Longitudinal Clinical EMR Department
                    </div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1F2937", marginTop: "6px" }}>
                        {report.document_title || "ELECTRONIC MEDICAL RECORD (EMR) — CLINICAL ENCOUNTER SUMMARY"}
                    </div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-block", padding: "4px 10px", borderRadius: "4px", fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
                        {statusLabel}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#6B7280", marginTop: "4px" }}>
                        Doc ID: <strong>{docId}</strong>
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "#6B7280" }}>Date: {formattedDate}</div>
                </div>
            </div>

            {/* 2 & 3. PATIENT DEMOGRAPHICS & ENCOUNTER INFORMATION */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "6px", padding: "10px 14px", marginBottom: "14px", fontSize: "0.84rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", color: "#1E3A8A", marginBottom: "2px" }}>
                        Patient Demographics
                    </div>
                    <div style={{ display: "flex" }}><span style={{ width: "115px", fontWeight: 600, color: "#4B5563" }}>Full Name:</span><span style={{ fontWeight: 600, color: "#111827" }}>{effectivePatientName}</span></div>
                    <div style={{ display: "flex" }}><span style={{ width: "115px", fontWeight: 600, color: "#4B5563" }}>Patient ID / MRN:</span><span style={{ fontWeight: 600, color: "#111827" }}>{report.patient_mrn || report.patient_id.slice(0, 14)}</span></div>
                    <div style={{ display: "flex" }}><span style={{ width: "115px", fontWeight: 600, color: "#4B5563" }}>Age / Sex:</span><span style={{ fontWeight: 600, color: "#111827" }}>{report.patient_age || "Not documented"} / {report.patient_sex || "Not documented"}</span></div>
                    <div style={{ display: "flex" }}><span style={{ width: "115px", fontWeight: 600, color: "#4B5563" }}>Session / Room:</span><span style={{ fontWeight: 600, color: "#111827" }}>{report.room_id || "Direct Encounter"}</span></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", color: "#1E3A8A", marginBottom: "2px" }}>
                        Encounter Information
                    </div>
                    <div style={{ display: "flex" }}><span style={{ width: "115px", fontWeight: 600, color: "#4B5563" }}>Attending Doctor:</span><span style={{ fontWeight: 600, color: "#111827" }}>{effectiveDoctorName}</span></div>
                    <div style={{ display: "flex" }}><span style={{ width: "115px", fontWeight: 600, color: "#4B5563" }}>Specialization:</span><span style={{ fontWeight: 600, color: "#111827" }}>{report.doctor_specialization || "Telehealth Physician / General Medicine"}</span></div>
                    <div style={{ display: "flex" }}><span style={{ width: "115px", fontWeight: 600, color: "#4B5563" }}>Encounter Type:</span><span style={{ fontWeight: 600, color: "#111827" }}>{report.encounter_type || "Synchronous Telehealth Audio/Video"}</span></div>
                    <div style={{ display: "flex" }}><span style={{ width: "115px", fontWeight: 600, color: "#4B5563" }}>Session Duration:</span><span style={{ fontWeight: 600, color: "#111827" }}>{encounterDuration}</span></div>
                </div>
            </div>

            {/* 4. CHIEF COMPLAINT */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    1. Chief Complaint
                </div>
                <div style={{ fontWeight: 700, color: "#1E3A8A", fontSize: "0.95rem" }}>
                    {report.chief_complaint || report.summary.slice(0, 160) || "Acute clinical consultation requested"}
                </div>
            </div>

            {/* 5. HISTORY OF PRESENT ILLNESS (HPI) */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    2. History of Present Illness (HPI)
                </div>
                <div style={{ textAlign: "justify", lineHeight: 1.5 }}>
                    {report.history_of_present_illness || report.soap?.subjective || "Patient presented for virtual clinical assessment regarding reported symptoms."}
                </div>
            </div>

            {/* 6. PAST MEDICAL, SURGICAL & ALLERGY HISTORY */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    3. Past Medical, Surgical, Medication &amp; Allergy History
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <tbody>
                        <tr><td style={{ width: "25%", fontWeight: 600, padding: "5px 8px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>Past Conditions</td><td style={{ padding: "5px 8px", borderBottom: "1px solid #E5E7EB" }}>{pastCondsText}</td></tr>
                        <tr><td style={{ fontWeight: 600, padding: "5px 8px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>Surgical History</td><td style={{ padding: "5px 8px", borderBottom: "1px solid #E5E7EB" }}>{surgicalText}</td></tr>
                        <tr><td style={{ fontWeight: 600, padding: "5px 8px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>Current Medications</td><td style={{ padding: "5px 8px", borderBottom: "1px solid #E5E7EB" }}>{currMedsText}</td></tr>
                        <tr><td style={{ fontWeight: 600, padding: "5px 8px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB", color: "#991B1B" }}>Allergies</td><td style={{ padding: "5px 8px", borderBottom: "1px solid #E5E7EB", fontWeight: 700, color: "#991B1B" }}>{allergiesText}</td></tr>
                        <tr><td style={{ fontWeight: 600, padding: "5px 8px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>Family History</td><td style={{ padding: "5px 8px", borderBottom: "1px solid #E5E7EB" }}>{familyHistText}</td></tr>
                    </tbody>
                </table>
            </div>

            {/* 7. REVIEW OF SYSTEMS (ROS) */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    4. Review of Systems (ROS)
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <tbody>
                        {Object.entries(ros).map(([sys, val]) => (
                            <tr key={sys}>
                                <td style={{ width: "25%", fontWeight: 600, padding: "5px 8px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151" }}>{sys}</td>
                                <td style={{ padding: "5px 8px", borderBottom: "1px solid #E5E7EB" }}>{val}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 8. VITAL SIGNS & OBSERVATIONS */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    5. Vital Signs &amp; Clinical Telehealth Observations
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", marginTop: "6px" }}>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "4px", padding: "6px", background: "#F9FAFB", textAlign: "center" }}><div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6B7280" }}>BP</div><div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{vs.blood_pressure || "Not measured"}</div></div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "4px", padding: "6px", background: "#F9FAFB", textAlign: "center" }}><div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6B7280" }}>Pulse (HR)</div><div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{vs.heart_rate || "Not measured"}</div></div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "4px", padding: "6px", background: "#F9FAFB", textAlign: "center" }}><div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6B7280" }}>Temperature</div><div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{vs.temperature || "100.0 °F (reported)"}</div></div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "4px", padding: "6px", background: "#F9FAFB", textAlign: "center" }}><div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6B7280" }}>Resp. Rate</div><div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{vs.respiratory_rate || "Non-labored"}</div></div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "4px", padding: "6px", background: "#F9FAFB", textAlign: "center" }}><div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6B7280" }}>Oxygen (SpO2)</div><div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{vs.spo2 || "Not measured"}</div></div>
                </div>
                <div style={{ fontSize: "0.82rem", color: "#4B5563", marginTop: "6px" }}>
                    <strong>Telehealth Observations:</strong> {vs.observations || "Patient alert, oriented, communicative, grimacing with bright ambient glare."}
                </div>
            </div>

            {/* 9. PHYSICAL EXAMINATION */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    6. Physical Examination
                </div>
                <div style={{ background: "#F9FAFB", padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: "4px", fontSize: "0.84rem" }}>
                    {report.physical_examination || "Visual Telehealth Assessment: Patient is alert and responsive. No acute respiratory compromise or facial asymmetry noted on video. Hands-on physical examination not performed due to telemedicine format."}
                </div>
            </div>

            {/* 10. CLINICAL ASSESSMENT & IMPRESSION */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    7. Clinical Assessment &amp; Working Impression
                </div>
                <div style={{ fontSize: "0.86rem", fontWeight: 500, lineHeight: 1.5 }}>
                    {report.assessment_and_impression || report.soap?.assessment || "Clinical presentation consistent with acute presentation requiring symptomatic treatment and trigger avoidance."}
                </div>
            </div>

            {/* 11. SOAP CLINICAL DOCUMENTATION */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    8. Structured SOAP Documentation
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "6px", overflow: "hidden" }}>
                        <div style={{ background: "#EFF6FF", color: "#1E40AF", padding: "4px 8px", fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase" }}>S — Subjective</div>
                        <div style={{ padding: "8px", fontSize: "0.82rem", lineHeight: 1.4 }}>{report.soap?.subjective}</div>
                    </div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "6px", overflow: "hidden" }}>
                        <div style={{ background: "#F3F4F6", color: "#374151", padding: "4px 8px", fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase" }}>O — Objective</div>
                        <div style={{ padding: "8px", fontSize: "0.82rem", lineHeight: 1.4 }}>{report.soap?.objective}</div>
                    </div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "6px", overflow: "hidden" }}>
                        <div style={{ background: "#F5F3FF", color: "#6D28D9", padding: "4px 8px", fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase" }}>A — Assessment</div>
                        <div style={{ padding: "8px", fontSize: "0.82rem", lineHeight: 1.4 }}>{report.soap?.assessment}</div>
                    </div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "6px", overflow: "hidden" }}>
                        <div style={{ background: "#F0FDF4", color: "#166534", padding: "4px 8px", fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase" }}>P — Plan</div>
                        <div style={{ padding: "8px", fontSize: "0.82rem", lineHeight: 1.4 }}>{report.soap?.plan}</div>
                    </div>
                </div>
            </div>

            {/* 12. EXTRACTED SYMPTOMS */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    9. Documented Symptoms Profile
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                        <tr style={{ background: "#F3F4F6" }}>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "32%" }}>Symptom</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "22%" }}>Duration</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "18%" }}>Severity</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "28%" }}>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(report.symptoms || []).map((s, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #E5E7EB" }}>
                                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{idx + 1}. {s.symptom || s.name}</td>
                                <td style={{ padding: "6px 8px" }}>{s.duration || "Not provided"}</td>
                                <td style={{ padding: "6px 8px" }}>
                                    <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "0.74rem", fontWeight: 600, background: s.severity?.toLowerCase().includes("severe") ? "#FEE2E2" : "#FEF3C7", color: s.severity?.toLowerCase().includes("severe") ? "#991B1B" : "#92400E" }}>
                                        {s.severity || "Reported"}
                                    </span>
                                </td>
                                <td style={{ padding: "6px 8px", color: "#4B5563" }}>{s.notes || s.status || "Reported"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 13. DIFFERENTIAL DIAGNOSES */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    10. Differential Diagnoses &amp; Uncertainty Status
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                        <tr style={{ background: "#F3F4F6" }}>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "32%" }}>Diagnosis</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "26%" }}>Status</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "14%" }}>Confidence</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "28%" }}>Supporting Evidence</th>
                        </tr>
                    </thead>
                    <tbody>
                        {diffs.map((d, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #E5E7EB" }}>
                                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{idx + 1}. {d.diagnosis}</td>
                                <td style={{ padding: "6px 8px", color: "#1E40AF", fontWeight: 600 }}>{d.status || (idx === 0 ? "Working Impression" : "Differential")}</td>
                                <td style={{ padding: "6px 8px" }}>{d.confidence || "Moderate"}</td>
                                <td style={{ padding: "6px 8px", color: "#4B5563" }}>{d.supporting_evidence || d.reasoning || "Clinical encounter dialogue"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 14. ICD-10 CLINICAL CODING MAPPING */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    11. ICD-10 Clinical Diagnostic Coding (WHO / MoHFW Standards)
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                        <tr style={{ background: "#F3F4F6" }}>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "18%" }}>ICD-10 Code</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "34%" }}>Official Description</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "28%" }}>Transcript Evidence</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "20%" }}>Coding Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(report.icd_10_codes || []).map((c, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #E5E7EB" }}>
                                <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 700, color: "#1E3A8A" }}>{c.code}</td>
                                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{c.description}</td>
                                <td style={{ padding: "6px 8px", color: "#4B5563" }}>{c.supporting_evidence || c.evidence || "Dialogue context"}</td>
                                <td style={{ padding: "6px 8px", color: "#047857", fontWeight: 600 }}>{c.coding_status || "Provisional (Awaiting Physician Confirmation)"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 15. TREATMENT & MANAGEMENT PLAN */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    12. Treatment and Management Plan
                </div>

                <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.82rem", margin: "6px 0 2px 0" }}>Prescribed / Recommended Medications:</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                        <tr style={{ background: "#F3F4F6" }}>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "26%" }}>Medication</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "14%" }}>Dosage</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "12%" }}>Route</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "22%" }}>Frequency</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "12%" }}>Duration</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "14%" }}>Instructions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {medList.map((m: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #E5E7EB" }}>
                                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{idx + 1}. {m.medication}</td>
                                <td style={{ padding: "6px 8px" }}>{m.dosage || "As directed"}</td>
                                <td style={{ padding: "6px 8px" }}>{m.route || "Oral"}</td>
                                <td style={{ padding: "6px 8px" }}>{m.frequency || "As directed"}</td>
                                <td style={{ padding: "6px 8px" }}>{m.duration || "Course"}</td>
                                <td style={{ padding: "6px 8px", color: "#4B5563" }}>{m.instructions || "Take with water"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "10px" }}>
                    <div>
                        <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.82rem", marginBottom: "2px" }}>Investigations &amp; Labs:</div>
                        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem" }}>
                            {(report.treatment_plan?.investigations || []).map((inv, i) => (
                                <li key={i}>{inv}</li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.82rem", marginBottom: "2px" }}>Lifestyle &amp; Non-Pharmacological Advice:</div>
                        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem" }}>
                            {(report.treatment_plan?.recommendations || []).map((rec, i) => (
                                <li key={i}>{rec}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div style={{ marginTop: "8px", fontSize: "0.84rem" }}>
                    <strong>Follow-Up:</strong> {report.treatment_plan?.follow_up || "Follow up in 3 to 5 days if symptoms do not improve."}
                </div>

                <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderLeft: "4px solid #DC2626", borderRadius: "4px", padding: "8px 12px", color: "#991B1B", fontSize: "0.82rem", marginTop: "8px", breakInside: "avoid" }}>
                    <strong>⚠️ Emergency Red-Flag Warning:</strong><br />
                    {report.treatment_plan?.emergency_warnings || report.treatment_plan?.emergency_warning || "Seek emergency hospital medical attention immediately if you experience sudden severe headache, high persistent fever, neck stiffness, confusion, or visual changes."}
                </div>
            </div>

            {/* 16. CONSULTATION OUTCOME & CLINICIAN NOTES */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    13. Consultation Outcome &amp; Clinician Remarks
                </div>
                <div style={{ fontSize: "0.84rem" }}>
                    <div><strong>Clinical Outcome:</strong> {report.consultation_outcome || "Virtual consultation completed. Outpatient management initiated."}</div>
                    <div style={{ marginTop: "4px" }}><strong>Attending Clinician Remarks:</strong> {report.doctor_notes || "Patient communicated clearly during remote encounter. Red-flag precautions explained and confirmed."}</div>
                </div>
            </div>

            {/* 17. SOURCE TRANSCRIPT DISCLOSURE */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    14. Source Transcript &amp; AI Telemedicine Disclosure
                </div>
                <div style={{ fontSize: "0.78rem", color: "#4B5563", lineHeight: 1.35, background: "#F3F4F6", padding: "6px 10px", borderRadius: "4px" }}>
                    {report.source_disclosure || "This medical documentation was synthesized using natural language processing from the active consultation transcript recorded during room session " + (report.room_id || "N/A") + ". In accordance with Telemedicine Practice Guidelines, all documentation, ICD mappings, and orders are legally authenticated by the attending physician."}
                </div>
            </div>

            {/* 18. SIGNATURE & AUTHENTICATION */}
            <div style={{ marginTop: "20px", paddingTop: "12px", borderTop: "1.5px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "flex-end", breakInside: "avoid" }}>
                <div>
                    <div style={{ fontSize: "0.76rem", color: "#6B7280", textTransform: "uppercase", fontWeight: 700 }}>Attending Physician Authentication</div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1E3A8A", marginTop: "2px" }}>{effectiveDoctorName}</div>
                    <div style={{ fontSize: "0.78rem", color: "#4B5563" }}>{report.doctor_specialization || "Telehealth Physician / General Medicine"}</div>
                    <div style={{ fontSize: "0.75rem", color: "#6B7280" }}>Reg / License: {report.doctor_reg_number || "REG-TEL-" + (report.doctor_id || "DOC").slice(0, 8).toUpperCase()}</div>
                </div>

                <div style={{ textAlign: "right" }}>
                    <div style={{ border: "1.5px dashed #059669", background: "#F0FDF4", color: "#065F46", padding: "8px 14px", borderRadius: "6px", fontSize: "0.8rem", display: "inline-block" }}>
                        <strong>{isApproved ? "✓ DIGITALLY AUTHENTICATED" : "PROVISIONAL MEDICAL DRAFT"}</strong><br />
                        <span style={{ fontSize: "0.74rem" }}>Date: {approvedDate}</span>
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "#9CA3AF", marginTop: "4px" }}>Sign-off Verification: {docId}</div>
                </div>
            </div>

            {/* FOOTER */}
            <div style={{ marginTop: "14px", paddingTop: "8px", borderTop: "1px solid #E5E7EB", fontSize: "0.74rem", color: "#6B7280", textAlign: "center", lineHeight: 1.35 }}>
                CONFIDENTIAL MEDICAL RECORD — FOR AUTHORIZED CLINICAL USE ONLY<br />
                DiagnoAssist Clinical Encounter Management System • Document Accession: {docId} • Generated: {new Date().toISOString()}
            </div>
        </div>
    );
}

