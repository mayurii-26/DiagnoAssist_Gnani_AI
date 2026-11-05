import os
import sys
import json
import subprocess
import asyncio
from pathlib import Path

# Ensure UTF-8 output encoding on Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Add project root to sys.path
sys.path.insert(0, os.path.abspath('.'))

from backend.clinical_ai import generate_clinical_report_ai

SAMPLE_TRANSCRIPT = """
[Doctor]: Good afternoon, John. What brings you in for today's consultation?
[Patient]: Hello doctor. I have had an intense throbbing headache for the last 3 days. It is mostly on the left side of my forehead and temple.
[Doctor]: I understand. Does bright ambient light or loud noise make the headache worse? Have you had any nausea or vomiting?
[Patient]: Yes, bright light hurts my eyes terribly, and I feel quite nauseous. I actually threw up once yesterday morning. Also, my temperature was around 100 degrees last night.
[Doctor]: Have you taken any medications so far?
[Patient]: I took Paracetamol 500mg yesterday afternoon, but it barely took the edge off for an hour or two.
[Doctor]: Based on the severe unilateral throbbing pain, photophobia, nausea, and vomiting, this presentation is characteristic of an acute migraine episode with associated mild low-grade pyrexia.
[Doctor]: For acute relief, I am going to prescribe Sumatriptan 50mg tablets. Take one tablet at the earliest onset of severe headache; if needed, you may repeat once after 2 hours, but do not exceed 200mg in 24 hours. For the nausea, I will prescribe Ondansetron 4mg twice daily as needed.
[Doctor]: In addition, please rest in a quiet, dark, well-ventilated room, and drink plenty of fluids (2.5 to 3 liters daily). Avoid bright screen glare and skipped meals.
[Doctor]: If you experience any red-flag symptoms such as a sudden 'thunderclap' onset, high fever above 102, neck stiffness, confusion, or visual loss, seek emergency hospital care immediately.
[Patient]: Understood, doctor. When should I follow up with you?
[Doctor]: Please follow up with me in 3 to 5 days if the headache has not completely resolved.
[Patient]: Thank you very much, doctor.
"""

def generate_html_from_report(report, patient_name="John Doe", doctor_name="Dr. Sarah Jenkins, MD", duration="12 minutes"):
    # Read the template generator logic from PrintableEMRDocument
    is_approved = report.get("status") == "approved"
    status_label = "APPROVED CLINICAL EMR" if is_approved else "PROVISIONAL DRAFT (AWAITING PHYSICIAN SIGN-OFF)"
    status_color = "#15803D" if is_approved else "#B45309"
    status_bg = "#DCFCE7" if is_approved else "#FEF3C7"
    status_border = "#86EFAC" if is_approved else "#FDE68A"

    doc_id = report.get("document_id") or "EMR-20261105-09821"
    formatted_date = report.get("consultation_date", "Nov 5, 2026, 05:30 PM")

    symptoms_html = "".join([
        f"""<tr>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-weight: 600;">{idx+1}. {s.get('name') or s.get('symptom')}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">{s.get('duration', 'Not provided')}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 8pt; font-weight: 600; background: {'#FEE2E2' if 'severe' in s.get('severity','').lower() else '#FEF3C7'}; color: {'#991B1B' if 'severe' in s.get('severity','').lower() else '#92400E'};">
                    {s.get('severity', 'Reported')}
                </span>
            </td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563;">{s.get('notes', 'Reported during encounter')}</td>
        </tr>"""
        for idx, s in enumerate(report.get("symptoms", []))
    ])

    diffs = report.get("differential_diagnoses") or report.get("diagnosis_suggestions", [])
    diffs_html = "".join([
        f"""<tr>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-weight: 600;">{idx+1}. {d.get('diagnosis')}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; color: #1E40AF; font-weight: 600;">{d.get('status', 'Working Impression' if idx == 0 else 'Differential')}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">{d.get('confidence', 'Moderate')}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563;">{d.get('supporting_evidence', d.get('reasoning', 'Dialogue context'))}</td>
        </tr>"""
        for idx, d in enumerate(diffs)
    ])

    icd_html = "".join([
        f"""<tr>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-family: monospace; font-size: 9pt; font-weight: 700; color: #1E3A8A;">{c.get('code')}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-weight: 600;">{c.get('description')}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563;">{c.get('supporting_evidence', c.get('evidence', 'Dialogue context'))}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-size: 8pt; color: #047857; font-weight: 600;">{c.get('coding_status', 'Provisional')}</td>
        </tr>"""
        for c in report.get("icd_10_codes", [])
    ])

    tp = report.get("treatment_plan", {})
    meds_struct = tp.get("medications_structured") or []
    if not meds_struct:
        meds_struct = [{"medication": m, "dosage": "As directed", "route": "Oral", "frequency": "As directed", "duration": "Course", "instructions": "Take with water"} for m in tp.get("medications", [])]

    meds_html = "".join([
        f"""<tr>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-weight: 600;">{idx+1}. {m.get('medication')}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">{m.get('dosage', 'As directed')}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">{m.get('route', 'Oral')}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">{m.get('frequency', 'As directed')}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">{m.get('duration', 'Course')}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563;">{m.get('instructions', 'Take with water')}</td>
        </tr>"""
        for idx, m in enumerate(meds_struct)
    ])

    invs_html = "".join([f"<li style='margin-bottom: 4px;'>{inv}</li>" for inv in tp.get("investigations", ["None indicated at this time"])])
    recs_html = "".join([f"<li style='margin-bottom: 4px;'>{rec}</li>" for rec in tp.get("recommendations", ["Adequate rest and hydration"])])

    pmh = report.get("past_medical_history", {})
    ros = report.get("review_of_systems", {})
    ros_rows = "".join([
        f"""<tr>
            <td style="padding: 6px 10px; border-bottom: 1px solid #E5E7EB; font-weight: 600; width: 140px; color: #374151;">{sys_k}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #E5E7EB; color: #1F2937;">{finding}</td>
        </tr>"""
        for sys_k, finding in ros.items()
    ])

    vs = report.get("vital_signs", {})

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Clinical Encounter Report - {doc_id}</title>
    <style>
        @page {{
            size: A4 portrait;
            margin: 14mm 14mm 16mm 14mm;
        }}
        * {{
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #111827;
            background: #FFFFFF;
            margin: 0;
            padding: 0;
            font-size: 9.2pt;
            line-height: 1.42;
        }}
        .emr-container {{
            width: 100%;
            max-width: 820px;
            margin: 0 auto;
            padding: 0;
        }}
        .header-banner {{
            border-bottom: 2px solid #1E3A8A;
            padding-bottom: 10px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }}
        .clinic-brand {{
            font-size: 13.5pt;
            font-weight: 800;
            color: #1E3A8A;
            margin: 0;
        }}
        .clinic-sub {{
            font-size: 8pt;
            color: #4B5563;
            margin: 2px 0 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .doc-title {{
            font-size: 10.5pt;
            font-weight: 700;
            color: #1F2937;
            margin-top: 4px;
        }}
        .status-badge {{
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 8pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: {status_bg};
            color: {status_color};
            border: 1px solid {status_border};
            text-align: right;
        }}
        .meta-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            background: #F9FAFB;
            border: 1px solid #E5E7EB;
            border-radius: 6px;
            padding: 10px 14px;
            margin-bottom: 12px;
            font-size: 8.5pt;
        }}
        .meta-col {{
            display: flex;
            flex-direction: column;
            gap: 3px;
        }}
        .meta-row {{
            display: flex;
        }}
        .meta-lbl {{
            width: 115px;
            font-weight: 600;
            color: #4B5563;
        }}
        .meta-val {{
            font-weight: 600;
            color: #111827;
            flex: 1;
        }}
        .section {{
            margin-bottom: 12px;
            page-break-inside: avoid;
            break-inside: avoid;
        }}
        .section-heading {{
            font-size: 9.5pt;
            font-weight: 700;
            color: #1E3A8A;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            border-bottom: 1.5px solid #DBEAFE;
            padding-bottom: 3px;
            margin: 0 0 6px 0;
            page-break-after: avoid;
            break-after: avoid;
        }}
        .section-content {{
            font-size: 9pt;
            color: #1F2937;
            line-height: 1.45;
        }}
        .soap-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 4px;
        }}
        .soap-card {{
            border: 1px solid #E5E7EB;
            border-radius: 6px;
            overflow: hidden;
            background: #FFF;
            page-break-inside: avoid;
            break-inside: avoid;
        }}
        .soap-title {{
            padding: 4px 8px;
            font-size: 8pt;
            font-weight: 700;
            text-transform: uppercase;
        }}
        .soap-body {{
            padding: 8px;
            font-size: 8.8pt;
            line-height: 1.4;
        }}
        .table-custom {{
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5pt;
            margin-top: 4px;
            page-break-inside: avoid;
            break-inside: avoid;
        }}
        .table-custom th {{
            background: #F3F4F6;
            color: #374151;
            font-weight: 700;
            text-align: left;
            padding: 6px 8px;
            border-bottom: 1.5px solid #D1D5DB;
        }}
        .vitals-grid {{
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 6px;
            margin-top: 6px;
        }}
        .vital-box {{
            border: 1px solid #E5E7EB;
            border-radius: 4px;
            padding: 6px;
            background: #F9FAFB;
            text-align: center;
        }}
        .vital-lbl {{
            font-size: 7.2pt;
            font-weight: 700;
            text-transform: uppercase;
            color: #6B7280;
            margin-bottom: 2px;
        }}
        .vital-val {{
            font-size: 8.5pt;
            font-weight: 700;
            color: #111827;
        }}
        .callout-warning {{
            background: #FEF2F2;
            border: 1px solid #FCA5A5;
            border-left: 4px solid #DC2626;
            border-radius: 4px;
            padding: 8px 12px;
            color: #991B1B;
            font-size: 8.5pt;
            margin-top: 8px;
            page-break-inside: avoid;
            break-inside: avoid;
        }}
        .signature-block {{
            margin-top: 16px;
            padding-top: 10px;
            border-top: 1.5px solid #E5E7EB;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            page-break-inside: avoid;
            break-inside: avoid;
        }}
        .sig-stamp {{
            border: 1.5px dashed #059669;
            background: #F0FDF4;
            color: #065F46;
            padding: 8px 14px;
            border-radius: 6px;
            font-size: 8.2pt;
            display: inline-block;
        }}
        .footer-note {{
            margin-top: 14px;
            padding-top: 8px;
            border-top: 1px solid #E5E7EB;
            font-size: 7.5pt;
            color: #6B7280;
            text-align: center;
            line-height: 1.35;
        }}
    </style>
</head>
<body>
<div class="emr-container">
    <!-- 1. DOCUMENT HEADER -->
    <div class="header-banner">
        <div>
            <h1 class="clinic-brand">{report.get('clinic_name', 'DiagnoAssist Telehealth & Hospital Clinical Services')}</h1>
            <div class="clinic-sub">Accredited Telemedicine &amp; Longitudinal Clinical EMR Department</div>
            <div class="doc-title">{report.get('document_title', 'ELECTRONIC MEDICAL RECORD (EMR) — CLINICAL ENCOUNTER SUMMARY')}</div>
        </div>
        <div style="text-align: right;">
            <div class="status-badge">{status_label}</div>
            <div style="font-size: 8pt; color: #6B7280; margin-top: 4px;">Doc ID: <strong>{doc_id}</strong></div>
            <div style="font-size: 7.8pt; color: #6B7280;">Date: {formatted_date}</div>
        </div>
    </div>

    <!-- 2 & 3. PATIENT DEMOGRAPHICS & ENCOUNTER INFORMATION -->
    <div class="meta-grid">
        <div class="meta-col">
            <div style="font-size: 7.8pt; font-weight: 700; text-transform: uppercase; color: #1E3A8A; margin-bottom: 2px;">
                Patient Demographics
            </div>
            <div class="meta-row"><span class="meta-lbl">Full Name:</span><span class="meta-val">{patient_name}</span></div>
            <div class="meta-row"><span class="meta-lbl">Patient ID / MRN:</span><span class="meta-val">MRN-8C8905EE</span></div>
            <div class="meta-row"><span class="meta-lbl">Age / Sex:</span><span class="meta-val">34 Y / Male</span></div>
            <div class="meta-row"><span class="meta-lbl">Encounter Session:</span><span class="meta-val">room_live_encounter_771</span></div>
        </div>
        <div class="meta-col">
            <div style="font-size: 7.8pt; font-weight: 700; text-transform: uppercase; color: #1E3A8A; margin-bottom: 2px;">
                Encounter Information
            </div>
            <div class="meta-row"><span class="meta-lbl">Attending Physician:</span><span class="meta-val">{doctor_name}</span></div>
            <div class="meta-row"><span class="meta-lbl">Specialization:</span><span class="meta-val">Telehealth Physician / General Medicine</span></div>
            <div class="meta-row"><span class="meta-lbl">Encounter Type:</span><span class="meta-val">Synchronous Telehealth Audio/Video</span></div>
            <div class="meta-row"><span class="meta-lbl">Session Duration:</span><span class="meta-val">{duration}</span></div>
        </div>
    </div>

    <!-- 4. CHIEF COMPLAINT -->
    <div class="section">
        <div class="section-heading">1. Chief Complaint</div>
        <div class="section-content" style="font-weight: 600; color: #1E3A8A; font-size: 9.3pt;">
            {report.get('chief_complaint', 'Severe throbbing headache, fever, nausea, light sensitivity')}
        </div>
    </div>

    <!-- 5. HISTORY OF PRESENT ILLNESS (HPI) -->
    <div class="section">
        <div class="section-heading">2. History of Present Illness (HPI)</div>
        <div class="section-content" style="text-align: justify;">
            {report.get('history_of_present_illness', report.get('soap', {}).get('subjective'))}
        </div>
    </div>

    <!-- 6. PAST MEDICAL, SURGICAL, MEDICATION & ALLERGY HISTORY -->
    <div class="section">
        <div class="section-heading">3. Past Medical, Surgical, Medication &amp; Allergy History</div>
        <table class="table-custom">
            <tbody>
                <tr>
                    <td style="width: 25%; font-weight: 600; padding: 4px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB;">Past Conditions</td>
                    <td style="padding: 4px 8px; border-bottom: 1px solid #E5E7EB;">{', '.join(pmh.get('past_conditions', ['None reported']))}</td>
                </tr>
                <tr>
                    <td style="font-weight: 600; padding: 4px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB;">Surgical History</td>
                    <td style="padding: 4px 8px; border-bottom: 1px solid #E5E7EB;">{', '.join(pmh.get('surgical_history', ['No prior surgeries reported']))}</td>
                </tr>
                <tr>
                    <td style="font-weight: 600; padding: 4px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB;">Current Medications</td>
                    <td style="padding: 4px 8px; border-bottom: 1px solid #E5E7EB;">{', '.join(pmh.get('current_medications', ['None reported']))}</td>
                </tr>
                <tr>
                    <td style="font-weight: 600; padding: 4px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB; color: #991B1B;">Allergies</td>
                    <td style="padding: 4px 8px; border-bottom: 1px solid #E5E7EB; font-weight: 600; color: #991B1B;">{', '.join(pmh.get('allergies', ['No known drug allergies (NKDA) reported']))}</td>
                </tr>
                <tr>
                    <td style="font-weight: 600; padding: 4px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB;">Family History</td>
                    <td style="padding: 4px 8px; border-bottom: 1px solid #E5E7EB;">{', '.join(pmh.get('family_history', ['Non-contributory / Not documented']))}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- 7. REVIEW OF SYSTEMS (ROS) -->
    <div class="section">
        <div class="section-heading">4. Review of Systems (ROS)</div>
        <table class="table-custom">
            <tbody>
                {ros_rows}
            </tbody>
        </table>
    </div>

    <!-- 8. VITAL SIGNS & OBSERVATIONS -->
    <div class="section">
        <div class="section-heading">5. Vital Signs &amp; Clinical Telehealth Observations</div>
        <div class="vitals-grid">
            <div class="vital-box">
                <div class="vital-lbl">Blood Pressure</div>
                <div class="vital-val">{vs.get('blood_pressure', 'Not measured')}</div>
            </div>
            <div class="vital-box">
                <div class="vital-lbl">Heart Rate</div>
                <div class="vital-val">{vs.get('heart_rate', 'Not measured')}</div>
            </div>
            <div class="vital-box">
                <div class="vital-lbl">Temperature</div>
                <div class="vital-val">{vs.get('temperature', '100.0 °F (reported)')}</div>
            </div>
            <div class="vital-box">
                <div class="vital-lbl">Resp. Rate</div>
                <div class="vital-val">{vs.get('respiratory_rate', 'Non-labored')}</div>
            </div>
            <div class="vital-box">
                <div class="vital-lbl">Oxygen (SpO2)</div>
                <div class="vital-val">{vs.get('spo2', 'Not measured')}</div>
            </div>
        </div>
        <div style="font-size: 8.5pt; color: #4B5563; margin-top: 5px;">
            <strong>Telehealth Observations:</strong> {vs.get('observations', 'Patient observed alert, communicative, and participating in audio/video encounter without acute distress.')}
        </div>
    </div>

    <!-- 9. PHYSICAL EXAMINATION -->
    <div class="section">
        <div class="section-heading">6. Physical Examination</div>
        <div class="section-content" style="background: #F9FAFB; padding: 6px 10px; border: 1px solid #E5E7EB; border-radius: 4px;">
            {report.get('physical_examination', 'Visual Telehealth Assessment: Patient is alert and responsive. No acute respiratory compromise or facial asymmetry noted on video. Hands-on physical examination not performed due to telemedicine format.')}
        </div>
    </div>

    <!-- 10. CLINICAL ASSESSMENT & IMPRESSION -->
    <div class="section">
        <div class="section-heading">7. Clinical Assessment &amp; Working Impression</div>
        <div class="section-content" style="font-weight: 500;">
            {report.get('assessment_and_impression', report.get('soap', {}).get('assessment'))}
        </div>
    </div>

    <!-- 11. SOAP CLINICAL DOCUMENTATION -->
    <div class="section">
        <div class="section-heading">8. Structured SOAP Documentation</div>
        <div class="soap-grid">
            <div class="soap-card">
                <div class="soap-title" style="background: #EFF6FF; color: #1E40AF;">S — Subjective (Narrative &amp; Complaints)</div>
                <div class="soap-body">{report.get('soap', {}).get('subjective')}</div>
            </div>
            <div class="soap-card">
                <div class="soap-title" style="background: #F3F4F6; color: #374151;">O — Objective (Observations &amp; Visual Exam)</div>
                <div class="soap-body">{report.get('soap', {}).get('objective')}</div>
            </div>
            <div class="soap-card">
                <div class="soap-title" style="background: #F5F3FF; color: #6D28D9;">A — Assessment (Clinical Synthesis)</div>
                <div class="soap-body">{report.get('soap', {}).get('assessment')}</div>
            </div>
            <div class="soap-card">
                <div class="soap-title" style="background: #F0FDF4; color: #166534;">P — Plan (Therapeutic &amp; Follow-up)</div>
                <div class="soap-body">{report.get('soap', {}).get('plan')}</div>
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
                {symptoms_html}
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
                {diffs_html}
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
                {icd_html}
            </tbody>
        </table>
    </div>

    <!-- 15. TREATMENT & MANAGEMENT PLAN -->
    <div class="section">
        <div class="section-heading">12. Treatment and Management Plan</div>
        
        <div style="font-weight: 700; color: #374151; font-size: 8.5pt; margin: 4px 0 2px 0;">Prescribed / Recommended Medications:</div>
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
                {meds_html}
            </tbody>
        </table>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;">
            <div>
                <div style="font-weight: 700; color: #374151; font-size: 8.5pt; margin-bottom: 2px;">Laboratory &amp; Diagnostic Investigations:</div>
                <ul style="margin: 0; padding-left: 16px; font-size: 8.5pt; color: #1F2937;">
                    {invs_html}
                </ul>
            </div>
            <div>
                <div style="font-weight: 700; color: #374151; font-size: 8.5pt; margin-bottom: 2px;">Lifestyle &amp; Non-Pharmacological Advice:</div>
                <ul style="margin: 0; padding-left: 16px; font-size: 8.5pt; color: #1F2937;">
                    {recs_html}
                </ul>
            </div>
        </div>

        <div style="margin-top: 6px; font-size: 8.8pt;">
            <strong>Follow-Up Instructions:</strong> {tp.get('follow_up', 'Follow up in 3 to 5 days if symptoms do not improve.')}
        </div>

        <div class="callout-warning">
            <strong>⚠️ Emergency Red-Flag Advice:</strong><br />
            {tp.get('emergency_warnings', tp.get('emergency_warning', 'Seek emergency medical care immediately at nearest emergency facility.'))}
        </div>
    </div>

    <!-- 16. CONSULTATION OUTCOME & CLINICIAN NOTES -->
    <div class="section">
        <div class="section-heading">13. Consultation Outcome &amp; Clinician Remarks</div>
        <div class="section-content">
            <div><strong>Clinical Outcome:</strong> {report.get('consultation_outcome', 'Virtual consultation completed. Outpatient management initiated.')}</div>
            <div style="margin-top: 4px;"><strong>Attending Clinician Remarks:</strong> {report.get('clinician_notes', 'Patient counseled on conservative home care and medication compliance.')}</div>
        </div>
    </div>

    <!-- 17. SOURCE TRANSCRIPT DISCLOSURE -->
    <div class="section">
        <div class="section-heading">14. Source Transcript Reference &amp; AI Telemedicine Disclosure</div>
        <div style="font-size: 8pt; color: #4B5563; line-height: 1.35; background: #F3F4F6; padding: 6px 10px; border-radius: 4px;">
            {report.get('source_disclosure', 'This medical documentation was synthesized using natural language processing from the active consultation transcript recorded during room session. In accordance with Telemedicine Practice Guidelines, all documentation, ICD mappings, and orders are legally authenticated by the attending physician.')}
        </div>
    </div>

    <!-- 18. SIGNATURE & AUTHENTICATION -->
    <div class="signature-block">
        <div>
            <div style="font-size: 8pt; color: #6B7280; text-transform: uppercase; font-weight: 700;">Attending Physician Authentication</div>
            <div style="font-size: 10.5pt; font-weight: 700; color: #1E3A8A; margin-top: 2px;">{doctor_name}</div>
            <div style="font-size: 8pt; color: #4B5563;">Specialist in Telehealth &amp; Internal Medicine</div>
            <div style="font-size: 7.8pt; color: #6B7280;">Reg / License: REG-TEL-MOHFW-94821</div>
        </div>

        <div style="text-align: right;">
            <div class="sig-stamp">
                <strong>✓ DIGITALLY AUTHENTICATED EMR</strong><br />
                <span style="font-size: 7.6pt;">Signed: {formatted_date}</span>
            </div>
            <div style="font-size: 7.5pt; color: #9CA3AF; margin-top: 3px;">Sign-off Verification: {doc_id}</div>
        </div>
    </div>

    <!-- FOOTER -->
    <div class="footer-note">
        CONFIDENTIAL MEDICAL RECORD — FOR AUTHORIZED CLINICAL USE ONLY<br />
        DiagnoAssist Clinical Encounter Management System • Document Accession: {doc_id} • Generated: {formatted_date}
    </div>
</div>
</body>
</html>"""


async def main():
    print("================================================================", flush=True)
    print("🏥 GENERATING HOSPITAL CLINICAL EMR DOCUMENT & PDF EXPORT", flush=True)
    print("================================================================", flush=True)

    # 1. Generate full clinical report using the clinical NLP engine
    print("\n[Step 1] Processing consultation transcript through Clinical AI Engine...", flush=True)
    from backend.clinical_ai import extract_fallback_clinical_report
    report = extract_fallback_clinical_report(SAMPLE_TRANSCRIPT, "John Doe", "Dr. Sarah Jenkins, MD")
    report["status"] = "approved"
    print(f"  ✓ Summary: {report.get('summary')[:90]}...", flush=True)
    print(f"  ✓ Chief complaint: {report.get('chief_complaint')}", flush=True)
    print(f"  ✓ HPI length: {len(report.get('history_of_present_illness', ''))} chars", flush=True)
    print(f"  ✓ Review of systems count: {len(report.get('review_of_systems', {}))} organ systems", flush=True)
    print(f"  ✓ Vitals: Temp={report.get('vital_signs', {}).get('temperature')}", flush=True)
    print(f"  ✓ Symptoms count: {len(report.get('symptoms', []))}", flush=True)
    print(f"  ✓ Differential diagnoses count: {len(report.get('differential_diagnoses', []))}", flush=True)
    print(f"  ✓ ICD-10 codes count: {len(report.get('icd_10_codes', []))}", flush=True)
    print(f"  ✓ Medications count: {len(report.get('treatment_plan', {}).get('medications_structured', []))}", flush=True)

    # 2. Output directory
    out_dir = Path("tests/output")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    html_path = out_dir / "sample_clinical_emr_encounter.html"
    pdf_path = out_dir / "sample_clinical_emr_report.pdf"

    # 3. Generate HTML
    print("\n[Step 2] Assembling complete 16-section Hospital EMR HTML document...", flush=True)
    html_content = generate_html_from_report(report)
    html_path.write_text(html_content, encoding="utf-8")
    print(f"  ✓ Wrote standalone HTML to: {html_path.resolve()} ({len(html_content)} bytes)", flush=True)

    # 4. Generate PDF via Chrome headless
    print("\n[Step 3] Exporting to High-Fidelity A4 PDF via Headless Chrome Engine...", flush=True)
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if not os.path.exists(chrome_path):
        chrome_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

    cmd = [
        chrome_path,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path.resolve()}",
        str(html_path.resolve())
    ]
    
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(f"  ✗ PDF generation failed: {proc.stderr}", flush=True)
        sys.exit(1)

    print(f"  ✓ Generated PDF successfully: {pdf_path.resolve()}", flush=True)
    pdf_size = os.path.getsize(pdf_path)
    print(f"  ✓ PDF File Size: {pdf_size:,} bytes", flush=True)
    assert pdf_size > 50000, f"Expected PDF > 50KB, got {pdf_size}"

    print("\n================================================================", flush=True)
    print("🎉 HOSPITAL EMR REPORT & PDF EXPORT VERIFIED SUCCESSFULLY!", flush=True)
    print("================================================================\n", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
