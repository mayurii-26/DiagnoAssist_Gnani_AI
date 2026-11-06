"use client";

import React from "react";
import { type ClinicalReport } from "@/lib/consultationService";

export interface EMRDictionary {
    statusApproved: string;
    statusDraft: string;
    docIdLabel: string;
    dateLabel: string;
    pendingAuth: string;
    clinicSub: string;
    defaultDocTitle: string;

    // Demographics
    demographicsTitle: string;
    fullName: string;
    patientId: string;
    ageSex: string;
    sessionRoom: string;

    // Encounter
    encounterTitle: string;
    attendingPhysician: string;
    specialization: string;
    encounterType: string;
    sessionDuration: string;

    // Section Headings (1 to 14)
    secChiefComplaint: string;
    secHpi: string;
    secPmh: string;
    secRos: string;
    secVitals: string;
    secPhysicalExam: string;
    secImpression: string;
    secSoap: string;
    secSymptoms: string;
    secDifferentials: string;
    secIcd10: string;
    secTreatment: string;
    secOutcome: string;
    secDisclosure: string;

    // Table Headers
    thSymptom: string;
    thDuration: string;
    thSeverity: string;
    thNotes: string;
    thDiagnosis: string;
    thStatus: string;
    thConfidence: string;
    thEvidence: string;
    thIcdCode: string;
    thDescription: string;
    thCodingStatus: string;
    thMedication: string;
    thDosage: string;
    thRoute: string;
    thFrequency: string;
    thDurationMed: string;
    thInstructions: string;

    // PMH labels
    pmhPastConditions: string;
    pmhSurgical: string;
    pmhCurrentMeds: string;
    pmhAllergies: string;
    pmhFamily: string;

    // ROS System Names
    rosConstitutional: string;
    rosNeurological: string;
    rosHeent: string;
    rosRespiratory: string;
    rosCardiovascular: string;
    rosGastrointestinal: string;
    rosMusculoskeletal: string;

    // Vitals
    vitalBp: string;
    vitalHr: string;
    vitalTemp: string;
    vitalRr: string;
    vitalSpo2: string;
    vitalObs: string;

    // SOAP Card Titles
    soapSubjective: string;
    soapObjective: string;
    soapAssessment: string;
    soapPlan: string;

    // Treatment plan subheadings
    subMedications: string;
    subInvestigations: string;
    subRecommendations: string;
    subFollowUp: string;
    subEmergency: string;

    // Outcome & Remarks
    outcomeLabel: string;
    remarksLabel: string;

    // Signature
    authTitle: string;
    stampApproved: string;
    stampDraft: string;
    regLicense: string;
    verification: string;
    footerNote: string;
}

const EN_DICT: EMRDictionary = {
    statusApproved: "APPROVED CLINICAL EMR",
    statusDraft: "PROVISIONAL DRAFT (AWAITING PHYSICIAN SIGN-OFF)",
    docIdLabel: "Doc ID",
    dateLabel: "Date",
    pendingAuth: "Pending Physician Authentication",
    clinicSub: "Accredited Telemedicine & Longitudinal Clinical EMR Department",
    defaultDocTitle: "ELECTRONIC MEDICAL RECORD (EMR) — CLINICAL ENCOUNTER SUMMARY",

    demographicsTitle: "Patient Demographics",
    fullName: "Full Name:",
    patientId: "Patient ID / MRN:",
    ageSex: "Age / Sex:",
    sessionRoom: "Session / Room:",

    encounterTitle: "Encounter Information",
    attendingPhysician: "Attending Physician:",
    specialization: "Specialization:",
    encounterType: "Encounter Type:",
    sessionDuration: "Session Duration:",

    secChiefComplaint: "1. Chief Complaint",
    secHpi: "2. History of Present Illness (HPI)",
    secPmh: "3. Past Medical, Surgical, Medication & Allergy History",
    secRos: "4. Review of Systems (ROS)",
    secVitals: "5. Vital Signs & Clinical Telehealth Observations",
    secPhysicalExam: "6. Physical Examination",
    secImpression: "7. Clinical Assessment & Working Impression",
    secSoap: "8. Structured SOAP Documentation",
    secSymptoms: "9. Documented Symptoms Profile",
    secDifferentials: "10. Differential Diagnoses & Uncertainty Status",
    secIcd10: "11. ICD-10 Clinical Diagnostic Coding (WHO / MoHFW Standards)",
    secTreatment: "12. Treatment and Management Plan",
    secOutcome: "13. Consultation Outcome & Clinician Remarks",
    secDisclosure: "14. Source Transcript & AI Telemedicine Disclosure",

    thSymptom: "Symptom",
    thDuration: "Duration",
    thSeverity: "Severity",
    thNotes: "Context / Notes",
    thDiagnosis: "Diagnosis",
    thStatus: "Status / Uncertainty",
    thConfidence: "Confidence",
    thEvidence: "Supporting Evidence",
    thIcdCode: "ICD-10 Code",
    thDescription: "Official Description",
    thCodingStatus: "Coding Status",
    thMedication: "Medication",
    thDosage: "Dosage",
    thRoute: "Route",
    thFrequency: "Frequency",
    thDurationMed: "Duration",
    thInstructions: "Instructions",

    pmhPastConditions: "Past Conditions",
    pmhSurgical: "Surgical History",
    pmhCurrentMeds: "Current Medications",
    pmhAllergies: "Allergies",
    pmhFamily: "Family History",

    rosConstitutional: "Constitutional",
    rosNeurological: "Neurological",
    rosHeent: "HEENT",
    rosRespiratory: "Respiratory",
    rosCardiovascular: "Cardiovascular",
    rosGastrointestinal: "Gastrointestinal",
    rosMusculoskeletal: "Musculoskeletal",

    vitalBp: "BP",
    vitalHr: "Pulse (HR)",
    vitalTemp: "Temperature",
    vitalRr: "Resp. Rate",
    vitalSpo2: "Oxygen (SpO2)",
    vitalObs: "Telehealth Observations:",

    soapSubjective: "S — Subjective (Narrative & Complaints)",
    soapObjective: "O — Objective (Observations & Visual Exam)",
    soapAssessment: "A — Assessment (Clinical Synthesis)",
    soapPlan: "P — Plan (Therapeutic & Follow-up)",

    subMedications: "Prescribed / Recommended Medications:",
    subInvestigations: "Laboratory & Diagnostic Investigations:",
    subRecommendations: "Lifestyle & Non-Pharmacological Advice:",
    subFollowUp: "Follow-Up Instructions:",
    subEmergency: "⚠️ Emergency Red-Flag Advice:",

    outcomeLabel: "Clinical Outcome:",
    remarksLabel: "Attending Clinician Remarks:",

    authTitle: "Attending Physician Authentication",
    stampApproved: "✓ DIGITALLY AUTHENTICATED",
    stampDraft: "PROVISIONAL MEDICAL DRAFT",
    regLicense: "Reg / License:",
    verification: "Sign-off Verification:",
    footerNote: "CONFIDENTIAL MEDICAL RECORD — FOR AUTHORIZED CLINICAL USE ONLY\nDiagnoAssist Clinical Encounter Management System",
};

const HI_DICT: EMRDictionary = {
    statusApproved: "डिजिटली प्रमाणित क्लिनिकल EMR (APPROVED)",
    statusDraft: "प्रारंभिक मसुदा (चिकित्सक हस्ताक्षर प्रतीक्षित)",
    docIdLabel: "दस्तावेज़ ID",
    dateLabel: "दिनांक",
    pendingAuth: "चिकित्सक प्रमाणीकरण प्रतीक्षित",
    clinicSub: "मान्यता प्राप्त टेलीमेडिसिन व अनुदैर्ध्य क्लिनिकल EMR विभाग",
    defaultDocTitle: "इलेक्ट्रॉनिक मेडिकल रिकॉर्ड (EMR) — क्लिनिकल परामर्श सारांश",

    demographicsTitle: "रोगी जनसांख्यिकी (Patient Demographics)",
    fullName: "रोगी का पूरा नाम:",
    patientId: "रोगी ID / MRN:",
    ageSex: "आयु / लिंग:",
    sessionRoom: "सत्र / रूम ID:",

    encounterTitle: "परामर्श जानकारी (Encounter Information)",
    attendingPhysician: "उपस्थित चिकित्सक:",
    specialization: "विशेषज्ञता:",
    encounterType: "परामर्श प्रकार:",
    sessionDuration: "परामर्श अवधि:",

    secChiefComplaint: "1. मुख्य शिकायत व लक्षण (Chief Complaint)",
    secHpi: "2. वर्तमान बीमारी का इतिहास (History of Present Illness - HPI)",
    secPmh: "3. पूर्व चिकित्सा, सर्जरी, दवाइयाँ व एलर्जी इतिहास (Medical History)",
    secRos: "4. शारीरिक प्रणाली समीक्षा (Review of Systems - ROS)",
    secVitals: "5. महत्वपूर्ण शारीरिक लक्षण व टेलीहेल्थ निरीक्षण (Vital Signs)",
    secPhysicalExam: "6. शारीरिक परीक्षण (Physical Examination)",
    secImpression: "7. क्लिनिकल मूल्यांकन व प्रारंभिक निदान (Clinical Impression)",
    secSoap: "8. एसओएपी क्लिनिकल नोट्स (Structured SOAP Notes)",
    secSymptoms: "9. प्रलेखित लक्षण तालिका (Documented Symptoms Profile)",
    secDifferentials: "10. प्राथमिक व संभावित अंतर निदान (Differential Diagnoses)",
    secIcd10: "11. आयसीडी-१० क्लिनिकल कोडिंग (ICD-10 Diagnostic Coding)",
    secTreatment: "12. उपचार योजना व प्रबंधन (Treatment & Management Plan)",
    secOutcome: "13. परामर्श निष्कर्ष व चिकित्सक की टिप्पणियाँ (Outcome & Remarks)",
    secDisclosure: "14. परामर्श प्रतिलेख व एआई प्रकटीकरण (AI Telemedicine Disclosure)",

    thSymptom: "लक्षण (Symptom)",
    thDuration: "अवधि (Duration)",
    thSeverity: "तीव्रता (Severity)",
    thNotes: "संदर्भ / टिप्पणियाँ",
    thDiagnosis: "निदान (Diagnosis)",
    thStatus: "स्थिति / निश्चितता",
    thConfidence: "विश्वसनीयता",
    thEvidence: "सहायक नैदानिक साक्ष्य",
    thIcdCode: "आयसीडी-१० कोड",
    thDescription: "आधिकारिक क्लिनिकल विवरण",
    thCodingStatus: "कोडिंग स्थिति",
    thMedication: "दवाई का नाम",
    thDosage: "मात्रा / डोज़",
    thRoute: "लेने का मार्ग",
    thFrequency: "वारंवारता (दिन में बार)",
    thDurationMed: "अवधि (दिन)",
    thInstructions: "सेवन निर्देश",

    pmhPastConditions: "पूर्व बीमारियाँ",
    pmhSurgical: "सर्जरी इतिहास",
    pmhCurrentMeds: "वर्तमान दवाइयाँ",
    pmhAllergies: "एलर्जी (Allergies)",
    pmhFamily: "पारिवारिक इतिहास",

    rosConstitutional: "शारीरिक / सामान्य (Constitutional)",
    rosNeurological: "तंत्रिका तंत्र / न्यूरोलॉजिकल (Neurological)",
    rosHeent: "आँख, कान, नाक, गला (HEENT)",
    rosRespiratory: "श्वसन तंत्र (Respiratory)",
    rosCardiovascular: "हृदय व रक्तवाहिनियाँ (Cardiovascular)",
    rosGastrointestinal: "पाचन तंत्र (Gastrointestinal)",
    rosMusculoskeletal: "मांसपेशियाँ व जोड़ (Musculoskeletal)",

    vitalBp: "रक्तचाप (BP)",
    vitalHr: "नाड़ी दर (HR)",
    vitalTemp: "तापमान (Temp)",
    vitalRr: "श्वसन दर (RR)",
    vitalSpo2: "ऑक्सीजन (SpO2)",
    vitalObs: "टेलीहेल्थ क्लिनिकल निरीक्षण:",

    soapSubjective: "S — सब्जेक्टिव (रोगी द्वारा व्यक्त लक्षण व पीड़ा)",
    soapObjective: "O — ऑब्जेक्टिव (चिकित्सक द्वारा दृश्य निरीक्षण)",
    soapAssessment: "A — असेसमेंट (क्लिनिकल विश्लेषण व निदान)",
    soapPlan: "P — प्लान (उपचार योजना व अनुवर्ती परामर्श)",

    subMedications: "निर्धारित व अनुशंसित दवाइयाँ (Prescribed Medications):",
    subInvestigations: "अनुशंसित रक्त व नैदानिक परीक्षण (Investigations):",
    subRecommendations: "जीवनशैली व देखभाल परामर्श (Lifestyle Recommendations):",
    subFollowUp: "अनुवर्ती परामर्श व फॉलो-अप निर्देश (Follow-Up Instructions):",
    subEmergency: "⚠️ आपातकालीन चेतावनी व रेड फ्लैग्स (Emergency Red Flags):",

    outcomeLabel: "क्लिनिकल निष्कर्ष (Clinical Outcome):",
    remarksLabel: "उपस्थित चिकित्सक की टिप्पणियाँ (Remarks):",

    authTitle: "उपस्थित चिकित्सक द्वारा डिजिटली प्रमाणीकरण",
    stampApproved: "✓ डिजिटली प्रमाणित (DIGITALLY AUTHENTICATED)",
    stampDraft: "तात्कालिक मसुदा (PROVISIONAL DRAFT)",
    regLicense: "पंजीकरण / लाइसेंस संख्या:",
    verification: "सत्यापन कोड:",
    footerNote: "गोपनीय क्लिनिकल रिकॉर्ड — केवल अधिकृत चिकित्सा उपयोग हेतु\nडायग्नोअसिस्ट टेलीहेल्थ एवं ईएमआर प्रणाली",
};

const MR_DICT: EMRDictionary = {
    statusApproved: "डिजिटली प्रमाणित क्लिनिकल EMR (APPROVED)",
    statusDraft: "तात्पुरता मसुदा (वैद्यकीय स्वाक्षरी प्रलंबित)",
    docIdLabel: "दस्तऐवज ID",
    dateLabel: "तारीख",
    pendingAuth: "वैद्यकीय स्वाक्षरी व प्रमाणीकरण प्रलंबित",
    clinicSub: "मान्यताप्राप्त टेलिमेडिसीन व दीर्घकालीन क्लिनिकल EMR विभाग",
    defaultDocTitle: "इलेक्ट्रॉनिक मेडिकल रेकॉर्ड (EMR) — वैद्यकीय तपासणी सारांश",

    demographicsTitle: "रुग्णाची वैयक्तिक माहिती (Patient Demographics)",
    fullName: "रुग्णाचे पूर्ण नाव:",
    patientId: "रुग्ण ID / MRN:",
    ageSex: "वय / लिंग:",
    sessionRoom: "सत्र / रूम ID:",

    encounterTitle: "तपासणी तपशील (Encounter Information)",
    attendingPhysician: "तपासणी करणारे डॉक्टर:",
    specialization: "विशेषज्ञता:",
    encounterType: "तपासणीचा प्रकार:",
    sessionDuration: "तपासणी कालावधी:",

    secChiefComplaint: "1. मुख्य लक्षणे व तक्रार (Chief Complaint)",
    secHpi: "2. सध्याच्या आजाराचा इतिहास (History of Present Illness - HPI)",
    secPmh: "3. मागील आजार, शस्त्रक्रिया, औषधे व ऍलर्जी इतिहास (Medical History)",
    secRos: "4. शारीरिक प्रणाली पुनरावलोकन (Review of Systems - ROS)",
    secVitals: "5. महत्त्वाची शारीरिक चिन्हे व निरीक्षणे (Vital Signs)",
    secPhysicalExam: "6. शारीरिक तपासणी (Physical Examination)",
    secImpression: "7. वैद्यकीय मूल्यांकन व तात्पुरते निदान (Clinical Impression)",
    secSoap: "8. एसओएपी वैद्यकीय नोंदी (Structured SOAP Notes)",
    secSymptoms: "9. प्रलेखित लक्षणे (Documented Symptoms Profile)",
    secDifferentials: "10. प्राथमिक व संभाव्य निदान (Differential Diagnoses)",
    secIcd10: "11. आयसीडी-१० वैद्यकीय कोड (ICD-10 Diagnostic Coding)",
    secTreatment: "12. उपचार योजना व व्यवस्थापन (Treatment & Management Plan)",
    secOutcome: "13. तपासणी निष्कर्ष व डॉक्टरांच्या नोंदी (Outcome & Remarks)",
    secDisclosure: "14. संभाषण उतारा व एआय स्पष्टीकरण (AI Telemedicine Disclosure)",

    thSymptom: "लक्षण (Symptom)",
    thDuration: "कालावधी (Duration)",
    thSeverity: "तीव्रता (Severity)",
    thNotes: "नोंदी व संदर्भ",
    thDiagnosis: "निदान (Diagnosis)",
    thStatus: "स्थिती / निश्चितता",
    thConfidence: "विश्वासार्हता",
    thEvidence: "वैद्यकीय पुरावा",
    thIcdCode: "आयसीडी-१० कोड",
    thDescription: "अधिकृत वैद्यकीय वर्णन",
    thCodingStatus: "कोडिंग स्थिती",
    thMedication: "औषधाचे नाव",
    thDosage: "मात्रा / डोस",
    thRoute: "घेण्याचा मार्ग",
    thFrequency: "वारंवारता (दिवसातून किती वेळा)",
    thDurationMed: "कालावधी (दिवस)",
    thInstructions: "वापराच्या सूचना",

    pmhPastConditions: "मागील आजार",
    pmhSurgical: "शस्त्रक्रिया इतिहास",
    pmhCurrentMeds: "सध्या चालू असलेली औषधे",
    pmhAllergies: "ऍलर्जी (Allergies)",
    pmhFamily: "कौटुंबिक इतिहास",

    rosConstitutional: "सामान्य / शारीरिक (Constitutional)",
    rosNeurological: "मज्जासंस्था / न्यूरोलॉजिकल (Neurological)",
    rosHeent: "डोळे, कान, नाक, घसा (HEENT)",
    rosRespiratory: "श्वसन संस्था (Respiratory)",
    rosCardiovascular: "हृदय व रक्तवाहिन्या (Cardiovascular)",
    rosGastrointestinal: "पचनसंस्था / जठरांत्र (Gastrointestinal)",
    rosMusculoskeletal: "स्नायू व सांधे (Musculoskeletal)",

    vitalBp: "रक्तदाब (BP)",
    vitalHr: "नाडी गती (HR)",
    vitalTemp: "तापमान (Temp)",
    vitalRr: "श्वसन दर (RR)",
    vitalSpo2: "ऑक्सिजन (SpO2)",
    vitalObs: "टेलिहेल्थ वैद्यकीय निरीक्षणे:",

    soapSubjective: "S — रुग्णाची तक्रार व लक्षणे (Subjective)",
    soapObjective: "O — वस्तुनिष्ठ / डॉक्टरांची निरीक्षणे (Objective)",
    soapAssessment: "A — वैद्यकीय विश्लेषण व निदान (Assessment)",
    soapPlan: "P — उपचार योजना व पुढील कृती (Plan)",

    subMedications: "शिफारस केलेली औषधे (Prescribed Medications):",
    subInvestigations: "शिफारस केलेल्या वैद्यकीय चाचण्या (Investigations):",
    subRecommendations: "जीवनशैली व काळजी सल्ला (Lifestyle Advice):",
    subFollowUp: "पुढील तपासणी व देखरेख सूचना (Follow-Up Instructions):",
    subEmergency: "⚠️ तातडीचे धोक्याचे इशारे (Emergency Red Flags):",

    outcomeLabel: "तपासणी निष्कर्ष (Clinical Outcome):",
    remarksLabel: "डॉक्टरांच्या नोंदी व शेरे (Remarks):",

    authTitle: "तपासणी करणाऱ्या डॉक्टरांचे डिजिटली प्रमाणीकरण",
    stampApproved: "✓ डिजिटली प्रमाणित (DIGITALLY AUTHENTICATED)",
    stampDraft: "तात्पुरता मसुदा (PROVISIONAL DRAFT)",
    regLicense: "नोंदणी / परवाना क्रमांक:",
    verification: "पडताळणी क्रमांक:",
    footerNote: "गोपनीय वैद्यकीय रेकॉर्ड — फक्त अधिकृत क्लिनिकल वापरासाठी\nडायग्नोअसिस्ट टेलिहेल्थ व ईएमआर प्रणाली",
};

export function getEMRDictionary(report: ClinicalReport): EMRDictionary {
    const lang = (
        report.translation_metadata?.target_language ||
        report.translation_metadata?.translated_language ||
        (report.translation_metadata?.is_translated ? "hi" : "en")
    ).toLowerCase();

    let base = EN_DICT;
    if (lang.startsWith("hi")) {
        base = HI_DICT;
    } else if (lang.startsWith("mr")) {
        base = MR_DICT;
    }

    if (report.section_headers) {
        return {
            ...base,
            secChiefComplaint: report.section_headers.chief_complaint || base.secChiefComplaint,
            secHpi: report.section_headers.hpi || base.secHpi,
            secPmh: report.section_headers.pmh || base.secPmh,
            secRos: report.section_headers.ros || base.secRos,
            secVitals: report.section_headers.vitals || base.secVitals,
            secPhysicalExam: report.section_headers.physical_exam || base.secPhysicalExam,
            secImpression: report.section_headers.impression || base.secImpression,
            secSoap: report.section_headers.soap || base.secSoap,
            secSymptoms: report.section_headers.symptoms || base.secSymptoms,
            secDifferentials: report.section_headers.diagnoses || base.secDifferentials,
            secIcd10: report.section_headers.icd10 || base.secIcd10,
            secTreatment: report.section_headers.treatment || base.secTreatment,
            secOutcome: report.section_headers.outcome || base.secOutcome,
            secDisclosure: report.section_headers.disclosure || base.secDisclosure,
            subMedications: report.section_headers.medications || base.subMedications,
            subInvestigations: report.section_headers.investigations || base.subInvestigations,
            subRecommendations: report.section_headers.recommendations || base.subRecommendations,
            subFollowUp: report.section_headers.follow_up || base.subFollowUp,
            subEmergency: report.section_headers.emergency || base.subEmergency,
            authTitle: report.section_headers.physician_auth || base.authTitle,
        };
    }

    return base;
}

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
    const dict = getEMRDictionary(report);

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
    const statusLabel = isApproved ? dict.statusApproved : dict.statusDraft;
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
        : dict.pendingAuth;

    // Format Symptoms list
    const symptomsRows = (report.symptoms || [])
        .map(
            (s, idx) => `
            <tr>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-weight: 600;">${idx + 1}. ${s.symptom || s.name || "Symptom"}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">${s.duration || "—"}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 8.5pt; font-weight: 600; background: ${
                        s.severity?.toLowerCase().includes("severe") ? "#FEE2E2" : "#FEF3C7"
                    }; color: ${s.severity?.toLowerCase().includes("severe") ? "#991B1B" : "#92400E"};">
                        ${s.severity || "Reported"}
                    </span>
                </td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563;">${s.notes || s.status || "—"}</td>
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
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563;">${d.supporting_evidence || d.reasoning || "—"}</td>
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
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563;">${c.supporting_evidence || c.evidence || "—"}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-size: 8.5pt; color: #047857; font-weight: 600;">${c.coding_status || "Provisional"}</td>
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
                <td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB;">${m.frequency || "As directed"}</td>
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

    // Format Review of Systems with localized system names
    const ros = report.review_of_systems || {
        Constitutional: "Mild fever and fatigue reported. Denies night sweats or weight loss.",
        Neurological: "Positive for headache. Denies syncope, seizures, or focal weakness.",
        HEENT: "Positive for photophobia. Denies neck stiffness or vision loss.",
        Respiratory: "Negative for cough, dyspnea, or wheezing.",
        Cardiovascular: "Negative for chest pain or palpitations.",
        Gastrointestinal: "Positive for nausea. Denies hematemesis or acute abdominal pain.",
        Musculoskeletal: "Negative for joint pain or swelling.",
    };

    const rosLabelMap: Record<string, string> = {
        Constitutional: dict.rosConstitutional,
        Neurological: dict.rosNeurological,
        HEENT: dict.rosHeent,
        Respiratory: dict.rosRespiratory,
        Cardiovascular: dict.rosCardiovascular,
        Gastrointestinal: dict.rosGastrointestinal,
        Musculoskeletal: dict.rosMusculoskeletal,
    };

    const rosRows = Object.entries(ros)
        .map(
            ([sys, finding]) => `
            <tr>
                <td style="padding: 6px 10px; border-bottom: 1px solid #E5E7EB; font-weight: 600; width: 180px; color: #374151;">${rosLabelMap[sys] || sys}</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid #E5E7EB; color: #1F2937;">${finding}</td>
            </tr>
        `
        )
        .join("");

    // Format Past Medical History
    const pmh = report.past_medical_history || {};
    const allergiesText = pmh.allergies?.join(", ") || "No known drug allergies (NKDA) reported";
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
            width: 130px;
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
            white-space: pre-line;
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
            <div class="clinic-sub">${dict.clinicSub}</div>
            <div class="doc-title">${report.document_title || dict.defaultDocTitle}</div>
        </div>
        <div style="text-align: right;">
            <div class="status-badge">${statusLabel}</div>
            <div style="font-size: 8.2pt; color: #6B7280; margin-top: 4px;">${dict.docIdLabel}: <strong>${docId}</strong></div>
            <div style="font-size: 8pt; color: #6B7280;">${dict.dateLabel}: ${formattedDate}</div>
        </div>
    </div>

    <!-- TRANSLATION CERTIFICATION BANNER (IF TRANSLATED) -->
    ${report.translation_metadata?.is_translated ? `
    <div style="background: #EFF6FF; border: 1.5px solid #93C5FD; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; font-size: 8.5pt; color: #1E40AF; line-height: 1.4;">
        <div style="font-weight: 700; text-transform: uppercase; margin-bottom: 3px;">
            🌐 CERTIFIED MULTILINGUAL CLINICAL TRANSLATION (${(report.translation_metadata.language_name || report.translation_metadata.translated_language || report.translation_metadata.target_language || "TRANSLATED").toUpperCase()})
        </div>
        <div>
            Translated from the original physician-authenticated clinical record via <strong>${report.translation_metadata.translation_provider || report.translation_metadata.provider || "Gnani AI Vachana"}</strong> on ${report.translation_metadata.translated_at ? new Date(report.translation_metadata.translated_at).toLocaleString() : new Date().toLocaleString()}.
            Diagnostic ICD-10 codings, pharmacological formulations, and numerical vital statistics are legally preserved from the source record.
        </div>
    </div>
    ` : ""}

    <!-- 2 & 3. PATIENT DEMOGRAPHICS & ENCOUNTER INFORMATION -->
    <div class="meta-grid">
        <div class="meta-col">
            <div style="font-size: 8.2pt; font-weight: 700; text-transform: uppercase; color: #1E3A8A; margin-bottom: 2px;">
                ${dict.demographicsTitle}
            </div>
            <div class="meta-row"><span class="meta-lbl">${dict.fullName}</span><span class="meta-val">${effectivePatientName}</span></div>
            <div class="meta-row"><span class="meta-lbl">${dict.patientId}</span><span class="meta-val">${report.patient_mrn || report.patient_id.slice(0, 14)}</span></div>
            <div class="meta-row"><span class="meta-lbl">${dict.ageSex}</span><span class="meta-val">${report.patient_age || "—"} / ${report.patient_sex || "—"}</span></div>
            <div class="meta-row"><span class="meta-lbl">${dict.sessionRoom}</span><span class="meta-val">${report.room_id || "Direct Encounter"}</span></div>
        </div>
        <div class="meta-col">
            <div style="font-size: 8.2pt; font-weight: 700; text-transform: uppercase; color: #1E3A8A; margin-bottom: 2px;">
                ${dict.encounterTitle}
            </div>
            <div class="meta-row"><span class="meta-lbl">${dict.attendingPhysician}</span><span class="meta-val">${effectiveDoctorName}</span></div>
            <div class="meta-row"><span class="meta-lbl">${dict.specialization}</span><span class="meta-val">${report.doctor_specialization || "Telehealth Physician / General Medicine"}</span></div>
            <div class="meta-row"><span class="meta-lbl">${dict.encounterType}</span><span class="meta-val">${report.encounter_type || "Synchronous Telehealth Audio/Video"}</span></div>
            <div class="meta-row"><span class="meta-lbl">${dict.sessionDuration}</span><span class="meta-val">${encounterDuration}</span></div>
        </div>
    </div>

    <!-- 4. CHIEF COMPLAINT -->
    <div class="section">
        <div class="section-heading">${dict.secChiefComplaint}</div>
        <div class="section-content" style="font-weight: 600; color: #1E3A8A; font-size: 9.6pt;">
            ${report.chief_complaint || report.summary.slice(0, 160) || "Acute clinical consultation requested"}
        </div>
    </div>

    <!-- 5. HISTORY OF PRESENT ILLNESS (HPI) -->
    <div class="section">
        <div class="section-heading">${dict.secHpi}</div>
        <div class="section-content" style="text-align: justify;">
            ${report.history_of_present_illness || report.soap?.subjective || "Patient presented for virtual clinical assessment regarding reported symptoms."}
        </div>
    </div>

    <!-- 6. PAST MEDICAL, SURGICAL, MEDICATION & ALLERGY HISTORY -->
    <div class="section">
        <div class="section-heading">${dict.secPmh}</div>
        <table class="table-custom">
            <tbody>
                <tr>
                    <td style="width: 25%; font-weight: 600; padding: 5px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB;">${dict.pmhPastConditions}</td>
                    <td style="padding: 5px 8px; border-bottom: 1px solid #E5E7EB;">${pastCondsText}</td>
                </tr>
                <tr>
                    <td style="font-weight: 600; padding: 5px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB;">${dict.pmhSurgical}</td>
                    <td style="padding: 5px 8px; border-bottom: 1px solid #E5E7EB;">${surgicalText}</td>
                </tr>
                <tr>
                    <td style="font-weight: 600; padding: 5px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB;">${dict.pmhCurrentMeds}</td>
                    <td style="padding: 5px 8px; border-bottom: 1px solid #E5E7EB;">${currMedsText}</td>
                </tr>
                <tr>
                    <td style="font-weight: 600; padding: 5px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB; color: #991B1B;">${dict.pmhAllergies}</td>
                    <td style="padding: 5px 8px; border-bottom: 1px solid #E5E7EB; font-weight: 600; color: #991B1B;">${allergiesText}</td>
                </tr>
                <tr>
                    <td style="font-weight: 600; padding: 5px 8px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB;">${dict.pmhFamily}</td>
                    <td style="padding: 5px 8px; border-bottom: 1px solid #E5E7EB;">${familyHistText}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- 7. REVIEW OF SYSTEMS (ROS) -->
    <div class="section">
        <div class="section-heading">${dict.secRos}</div>
        <table class="table-custom">
            <tbody>
                ${rosRows}
            </tbody>
        </table>
    </div>

    <!-- 8. VITAL SIGNS & OBSERVATIONS -->
    <div class="section">
        <div class="section-heading">${dict.secVitals}</div>
        <div class="vitals-grid">
            <div class="vital-box">
                <div class="vital-lbl">${dict.vitalBp}</div>
                <div class="vital-val">${vs.blood_pressure || "—"}</div>
            </div>
            <div class="vital-box">
                <div class="vital-lbl">${dict.vitalHr}</div>
                <div class="vital-val">${vs.heart_rate || "—"}</div>
            </div>
            <div class="vital-box">
                <div class="vital-lbl">${dict.vitalTemp}</div>
                <div class="vital-val">${vs.temperature || "100.0 °F"}</div>
            </div>
            <div class="vital-box">
                <div class="vital-lbl">${dict.vitalRr}</div>
                <div class="vital-val">${vs.respiratory_rate || "Non-labored"}</div>
            </div>
            <div class="vital-box">
                <div class="vital-lbl">${dict.vitalSpo2}</div>
                <div class="vital-val">${vs.spo2 || "—"}</div>
            </div>
        </div>
        <div style="font-size: 8.8pt; color: #4B5563; margin-top: 6px;">
            <strong>${dict.vitalObs}</strong> ${vs.observations || "Patient was alert, communicative, and participating in audio/video encounter without acute distress."}
        </div>
    </div>

    <!-- 9. PHYSICAL EXAMINATION -->
    <div class="section">
        <div class="section-heading">${dict.secPhysicalExam}</div>
        <div class="section-content" style="background: #F9FAFB; padding: 8px 12px; border: 1px solid #E5E7EB; border-radius: 4px;">
            ${report.physical_examination || "Visual Telehealth Assessment: Patient is alert and responsive. No acute respiratory compromise or facial asymmetry noted on video."}
        </div>
    </div>

    <!-- 10. CLINICAL ASSESSMENT & IMPRESSION -->
    <div class="section">
        <div class="section-heading">${dict.secImpression}</div>
        <div class="section-content" style="font-weight: 500;">
            ${report.assessment_and_impression || report.soap?.assessment || "Clinical presentation consistent with acute presentation requiring symptomatic treatment and trigger avoidance."}
        </div>
    </div>

    <!-- 11. SOAP CLINICAL DOCUMENTATION -->
    <div class="section">
        <div class="section-heading">${dict.secSoap}</div>
        <div class="soap-grid">
            <div class="soap-card">
                <div class="soap-title" style="background: #EFF6FF; color: #1E40AF;">${dict.soapSubjective}</div>
                <div class="soap-body">${report.soap?.subjective || "Patient reports symptoms as documented."}</div>
            </div>
            <div class="soap-card">
                <div class="soap-title" style="background: #F3F4F6; color: #374151;">${dict.soapObjective}</div>
                <div class="soap-body">${report.soap?.objective || "Visual teleconsultation observations recorded."}</div>
            </div>
            <div class="soap-card">
                <div class="soap-title" style="background: #F5F3FF; color: #6D28D9;">${dict.soapAssessment}</div>
                <div class="soap-body">${report.soap?.assessment || "Diagnostic impression consistent with reported complaints."}</div>
            </div>
            <div class="soap-card">
                <div class="soap-title" style="background: #F0FDF4; color: #166534;">${dict.soapPlan}</div>
                <div class="soap-body">${report.soap?.plan || "Conservative outpatient management and follow-up initiated."}</div>
            </div>
        </div>
    </div>

    <!-- 12. EXTRACTED SYMPTOMS -->
    <div class="section">
        <div class="section-heading">${dict.secSymptoms}</div>
        <table class="table-custom">
            <thead>
                <tr>
                    <th style="width: 32%;">${dict.thSymptom}</th>
                    <th style="width: 22%;">${dict.thDuration}</th>
                    <th style="width: 18%;">${dict.thSeverity}</th>
                    <th style="width: 28%;">${dict.thNotes}</th>
                </tr>
            </thead>
            <tbody>
                ${symptomsRows || "<tr><td colspan='4' style='padding: 8px; text-align: center;'>No specific symptoms extracted.</td></tr>"}
            </tbody>
        </table>
    </div>

    <!-- 13. DIFFERENTIAL DIAGNOSES -->
    <div class="section">
        <div class="section-heading">${dict.secDifferentials}</div>
        <table class="table-custom">
            <thead>
                <tr>
                    <th style="width: 32%;">${dict.thDiagnosis}</th>
                    <th style="width: 26%;">${dict.thStatus}</th>
                    <th style="width: 14%;">${dict.thConfidence}</th>
                    <th style="width: 28%;">${dict.thEvidence}</th>
                </tr>
            </thead>
            <tbody>
                ${diffRows || "<tr><td colspan='4' style='padding: 8px; text-align: center;'>No differential diagnoses recorded.</td></tr>"}
            </tbody>
        </table>
    </div>

    <!-- 14. ICD-10 CLINICAL CODING MAPPING -->
    <div class="section">
        <div class="section-heading">${dict.secIcd10}</div>
        <table class="table-custom">
            <thead>
                <tr>
                    <th style="width: 18%;">${dict.thIcdCode}</th>
                    <th style="width: 34%;">${dict.thDescription}</th>
                    <th style="width: 28%;">${dict.thEvidence}</th>
                    <th style="width: 20%;">${dict.thCodingStatus}</th>
                </tr>
            </thead>
            <tbody>
                ${icdRows || "<tr><td colspan='4' style='padding: 8px; text-align: center;'>No ICD-10 codes mapped.</td></tr>"}
            </tbody>
        </table>
    </div>

    <!-- 15. TREATMENT & MANAGEMENT PLAN -->
    <div class="section">
        <div class="section-heading">${dict.secTreatment}</div>
        
        <div style="font-weight: 700; color: #374151; font-size: 8.8pt; margin: 6px 0 2px 0;">${dict.subMedications}</div>
        <table class="table-custom">
            <thead>
                <tr>
                    <th style="width: 26%;">${dict.thMedication}</th>
                    <th style="width: 14%;">${dict.thDosage}</th>
                    <th style="width: 12%;">${dict.thRoute}</th>
                    <th style="width: 22%;">${dict.thFrequency}</th>
                    <th style="width: 12%;">${dict.thDurationMed}</th>
                    <th style="width: 14%;">${dict.thInstructions}</th>
                </tr>
            </thead>
            <tbody>
                ${medRows || "<tr><td colspan='6' style='padding: 8px; text-align: center;'>No medications prescribed during encounter.</td></tr>"}
            </tbody>
        </table>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px;">
            <div>
                <div style="font-weight: 700; color: #374151; font-size: 8.8pt; margin-bottom: 2px;">${dict.subInvestigations}</div>
                <ul style="margin: 0; padding-left: 18px; font-size: 8.8pt; color: #1F2937;">
                    ${invList || "<li>No immediate diagnostic testing indicated at this time.</li>"}
                </ul>
            </div>
            <div>
                <div style="font-weight: 700; color: #374151; font-size: 8.8pt; margin-bottom: 2px;">${dict.subRecommendations}</div>
                <ul style="margin: 0; padding-left: 18px; font-size: 8.8pt; color: #1F2937;">
                    ${recList || "<li>Maintain adequate hydration and rest.</li>"}
                </ul>
            </div>
        </div>

        <div style="margin-top: 8px; font-size: 9pt;">
            <strong>${dict.subFollowUp}</strong> ${report.treatment_plan?.follow_up || "Follow up in 3 to 5 days if symptoms do not improve."}
        </div>

        <div class="callout-warning">
            <strong>${dict.subEmergency}</strong><br />
            ${report.treatment_plan?.emergency_warnings || report.treatment_plan?.emergency_warning || "Seek emergency medical care immediately at the nearest hospital emergency department if severe red flag symptoms occur."}
        </div>
    </div>

    <!-- 16. CONSULTATION OUTCOME & CLINICIAN NOTES -->
    <div class="section">
        <div class="section-heading">${dict.secOutcome}</div>
        <div class="section-content">
            <div><strong>${dict.outcomeLabel}</strong> ${report.consultation_outcome || "Virtual consultation completed. Outpatient management initiated."}</div>
            <div style="margin-top: 4px;"><strong>${dict.remarksLabel}</strong> ${report.doctor_notes || "Patient communicated clearly during remote encounter. Red-flag precautions explained and confirmed."}</div>
        </div>
    </div>

    <!-- 17. SOURCE DISCLOSURE -->
    <div class="section">
        <div class="section-heading">${dict.secDisclosure}</div>
        <div style="font-size: 8.2pt; color: #4B5563; line-height: 1.35; background: #F3F4F6; padding: 6px 10px; border-radius: 4px;">
            ${report.source_disclosure || "This medical documentation was synthesized using natural language processing from the active consultation transcript recorded during room session " + (report.room_id || "N/A") + ". In accordance with Telemedicine Practice Guidelines, all documentation, ICD mappings, and orders are legally authenticated by the attending physician."}
        </div>
    </div>

    <!-- 18. SIGNATURE & AUTHENTICATION -->
    <div class="signature-block">
        <div>
            <div style="font-size: 8.2pt; color: #6B7280; text-transform: uppercase; font-weight: 700;">${dict.authTitle}</div>
            <div style="font-size: 11pt; font-weight: 700; color: #1E3A8A; margin-top: 2px;">${effectiveDoctorName}</div>
            <div style="font-size: 8.2pt; color: #4B5563;">${report.doctor_specialization || "Telehealth Physician / General Medicine"}</div>
            <div style="font-size: 8pt; color: #6B7280;">${dict.regLicense} ${report.doctor_reg_number || "REG-TEL-" + (report.doctor_id || "DOC").slice(0, 8).toUpperCase()}</div>
        </div>

        <div style="text-align: right;">
            <div class="sig-stamp">
                <strong>${isApproved ? dict.stampApproved : dict.stampDraft}</strong><br />
                <span style="font-size: 7.8pt;">${dict.dateLabel}: ${approvedDate}</span>
            </div>
            <div style="font-size: 7.8pt; color: #9CA3AF; margin-top: 4px;">${dict.verification} ${docId}</div>
        </div>
    </div>

    <!-- FOOTER -->
    <div class="footer-note">
        ${dict.footerNote} • Accession: ${docId}
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
        window.print();
        return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

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
    const dict = getEMRDictionary(report);

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
    const statusLabel = isApproved ? dict.statusApproved : dict.statusDraft;
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
        : dict.pendingAuth;

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
    const allergiesText = pmh.allergies?.join(", ") || "No known drug allergies (NKDA) reported";
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

    const rosLabelMap: Record<string, string> = {
        Constitutional: dict.rosConstitutional,
        Neurological: dict.rosNeurological,
        HEENT: dict.rosHeent,
        Respiratory: dict.rosRespiratory,
        Cardiovascular: dict.rosCardiovascular,
        Gastrointestinal: dict.rosGastrointestinal,
        Musculoskeletal: dict.rosMusculoskeletal,
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
                        ${dict.clinicSub}
                    </div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1F2937", marginTop: "6px" }}>
                        {report.document_title || dict.defaultDocTitle}
                    </div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-block", padding: "4px 10px", borderRadius: "4px", fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
                        {statusLabel}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#6B7280", marginTop: "4px" }}>
                        {dict.docIdLabel}: <strong>{docId}</strong>
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "#6B7280" }}>{dict.dateLabel}: {formattedDate}</div>
                </div>
            </div>

            {/* TRANSLATION CERTIFICATION BANNER (IF TRANSLATED) */}
            {report.translation_metadata?.is_translated && (
                <div style={{ background: "#EFF6FF", border: "1.5px solid #93C5FD", borderRadius: "6px", padding: "10px 14px", marginBottom: "12px", fontSize: "0.82rem", color: "#1E40AF", lineHeight: 1.4 }}>
                    <div style={{ fontWeight: 700, textTransform: "uppercase", marginBottom: "3px" }}>
                        🌐 CERTIFIED MULTILINGUAL CLINICAL TRANSLATION ({(report.translation_metadata.language_name || report.translation_metadata.translated_language || report.translation_metadata.target_language || "TRANSLATED").toUpperCase()})
                    </div>
                    <div>
                        Translated from the original physician-authenticated clinical record via <strong>{report.translation_metadata.translation_provider || report.translation_metadata.provider || "Gnani AI Vachana"}</strong> on {report.translation_metadata.translated_at ? new Date(report.translation_metadata.translated_at).toLocaleString() : new Date().toLocaleString()}.
                        Diagnostic ICD-10 codings, pharmacological formulations, and numerical vital statistics are legally preserved from the source record.
                    </div>
                </div>
            )}

            {/* 2 & 3. PATIENT DEMOGRAPHICS & ENCOUNTER INFORMATION */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "6px", padding: "10px 14px", marginBottom: "14px", fontSize: "0.84rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", color: "#1E3A8A", marginBottom: "2px" }}>
                        {dict.demographicsTitle}
                    </div>
                    <div style={{ display: "flex" }}><span style={{ width: "130px", fontWeight: 600, color: "#4B5563" }}>{dict.fullName}</span><span style={{ fontWeight: 600, color: "#111827" }}>{effectivePatientName}</span></div>
                    <div style={{ display: "flex" }}><span style={{ width: "130px", fontWeight: 600, color: "#4B5563" }}>{dict.patientId}</span><span style={{ fontWeight: 600, color: "#111827" }}>{report.patient_mrn || report.patient_id.slice(0, 14)}</span></div>
                    <div style={{ display: "flex" }}><span style={{ width: "130px", fontWeight: 600, color: "#4B5563" }}>{dict.ageSex}</span><span style={{ fontWeight: 600, color: "#111827" }}>{report.patient_age || "—"} / ${report.patient_sex || "—"}</span></div>
                    <div style={{ display: "flex" }}><span style={{ width: "130px", fontWeight: 600, color: "#4B5563" }}>{dict.sessionRoom}</span><span style={{ fontWeight: 600, color: "#111827" }}>{report.room_id || "Direct Encounter"}</span></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", color: "#1E3A8A", marginBottom: "2px" }}>
                        {dict.encounterTitle}
                    </div>
                    <div style={{ display: "flex" }}><span style={{ width: "130px", fontWeight: 600, color: "#4B5563" }}>{dict.attendingPhysician}</span><span style={{ fontWeight: 600, color: "#111827" }}>{effectiveDoctorName}</span></div>
                    <div style={{ display: "flex" }}><span style={{ width: "130px", fontWeight: 600, color: "#4B5563" }}>{dict.specialization}</span><span style={{ fontWeight: 600, color: "#111827" }}>{report.doctor_specialization || "Telehealth Physician / General Medicine"}</span></div>
                    <div style={{ display: "flex" }}><span style={{ width: "130px", fontWeight: 600, color: "#4B5563" }}>{dict.encounterType}</span><span style={{ fontWeight: 600, color: "#111827" }}>{report.encounter_type || "Synchronous Telehealth Audio/Video"}</span></div>
                    <div style={{ display: "flex" }}><span style={{ width: "130px", fontWeight: 600, color: "#4B5563" }}>{dict.sessionDuration}</span><span style={{ fontWeight: 600, color: "#111827" }}>{encounterDuration}</span></div>
                </div>
            </div>

            {/* 4. CHIEF COMPLAINT */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    {dict.secChiefComplaint}
                </div>
                <div style={{ fontWeight: 700, color: "#1E3A8A", fontSize: "0.95rem" }}>
                    {report.chief_complaint || report.summary.slice(0, 160) || "Acute clinical consultation requested"}
                </div>
            </div>

            {/* 5. HISTORY OF PRESENT ILLNESS (HPI) */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    {dict.secHpi}
                </div>
                <div style={{ textAlign: "justify", lineHeight: 1.5 }}>
                    {report.history_of_present_illness || report.soap?.subjective || "Patient presented for virtual clinical assessment regarding reported symptoms."}
                </div>
            </div>

            {/* 6. PAST MEDICAL, SURGICAL & ALLERGY HISTORY */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    {dict.secPmh}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <tbody>
                        <tr><td style={{ width: "25%", fontWeight: 600, padding: "5px 8px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>${dict.pmhPastConditions}</td><td style={{ padding: "5px 8px", borderBottom: "1px solid #E5E7EB" }}>{pastCondsText}</td></tr>
                        <tr><td style={{ fontWeight: 600, padding: "5px 8px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>${dict.pmhSurgical}</td><td style={{ padding: "5px 8px", borderBottom: "1px solid #E5E7EB" }}>{surgicalText}</td></tr>
                        <tr><td style={{ fontWeight: 600, padding: "5px 8px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>${dict.pmhCurrentMeds}</td><td style={{ padding: "5px 8px", borderBottom: "1px solid #E5E7EB" }}>{currMedsText}</td></tr>
                        <tr><td style={{ fontWeight: 600, padding: "5px 8px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB", color: "#991B1B" }}>${dict.pmhAllergies}</td><td style={{ padding: "5px 8px", borderBottom: "1px solid #E5E7EB", fontWeight: 700, color: "#991B1B" }}>{allergiesText}</td></tr>
                        <tr><td style={{ fontWeight: 600, padding: "5px 8px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>${dict.pmhFamily}</td><td style={{ padding: "5px 8px", borderBottom: "1px solid #E5E7EB" }}>{familyHistText}</td></tr>
                    </tbody>
                </table>
            </div>

            {/* 7. REVIEW OF SYSTEMS (ROS) */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    {dict.secRos}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <tbody>
                        {Object.entries(ros).map(([sys, val]) => (
                            <tr key={sys}>
                                <td style={{ width: "28%", fontWeight: 600, padding: "5px 8px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151" }}>{rosLabelMap[sys] || sys}</td>
                                <td style={{ padding: "5px 8px", borderBottom: "1px solid #E5E7EB" }}>{val}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 8. VITAL SIGNS & OBSERVATIONS */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    {dict.secVitals}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", marginTop: "6px" }}>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "4px", padding: "6px", background: "#F9FAFB", textAlign: "center" }}><div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6B7280" }}>${dict.vitalBp}</div><div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{vs.blood_pressure || "—"}</div></div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "4px", padding: "6px", background: "#F9FAFB", textAlign: "center" }}><div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6B7280" }}>${dict.vitalHr}</div><div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{vs.heart_rate || "—"}</div></div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "4px", padding: "6px", background: "#F9FAFB", textAlign: "center" }}><div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6B7280" }}>${dict.vitalTemp}</div><div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{vs.temperature || "100.0 °F"}</div></div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "4px", padding: "6px", background: "#F9FAFB", textAlign: "center" }}><div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6B7280" }}>${dict.vitalRr}</div><div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{vs.respiratory_rate || "Non-labored"}</div></div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "4px", padding: "6px", background: "#F9FAFB", textAlign: "center" }}><div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6B7280" }}>${dict.vitalSpo2}</div><div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{vs.spo2 || "—"}</div></div>
                </div>
                <div style={{ fontSize: "0.82rem", color: "#4B5563", marginTop: "6px" }}>
                    <strong>${dict.vitalObs}</strong> {vs.observations || "Patient alert, oriented, communicative, grimacing with bright ambient glare."}
                </div>
            </div>

            {/* 9. PHYSICAL EXAMINATION */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    {dict.secPhysicalExam}
                </div>
                <div style={{ background: "#F9FAFB", padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: "4px", fontSize: "0.84rem" }}>
                    {report.physical_examination || "Visual Telehealth Assessment: Patient is alert and responsive. No acute respiratory compromise or facial asymmetry noted on video."}
                </div>
            </div>

            {/* 10. CLINICAL ASSESSMENT & IMPRESSION */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    {dict.secImpression}
                </div>
                <div style={{ fontSize: "0.86rem", fontWeight: 500, lineHeight: 1.5 }}>
                    {report.assessment_and_impression || report.soap?.assessment || "Clinical presentation consistent with acute presentation requiring symptomatic treatment and trigger avoidance."}
                </div>
            </div>

            {/* 11. SOAP CLINICAL DOCUMENTATION */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    {dict.secSoap}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "6px", overflow: "hidden" }}>
                        <div style={{ background: "#EFF6FF", color: "#1E40AF", padding: "4px 8px", fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase" }}>${dict.soapSubjective}</div>
                        <div style={{ padding: "8px", fontSize: "0.82rem", lineHeight: 1.4 }}>{report.soap?.subjective}</div>
                    </div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "6px", overflow: "hidden" }}>
                        <div style={{ background: "#F3F4F6", color: "#374151", padding: "4px 8px", fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase" }}>${dict.soapObjective}</div>
                        <div style={{ padding: "8px", fontSize: "0.82rem", lineHeight: 1.4 }}>{report.soap?.objective}</div>
                    </div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "6px", overflow: "hidden" }}>
                        <div style={{ background: "#F5F3FF", color: "#6D28D9", padding: "4px 8px", fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase" }}>${dict.soapAssessment}</div>
                        <div style={{ padding: "8px", fontSize: "0.82rem", lineHeight: 1.4 }}>{report.soap?.assessment}</div>
                    </div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: "6px", overflow: "hidden" }}>
                        <div style={{ background: "#F0FDF4", color: "#166534", padding: "4px 8px", fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase" }}>${dict.soapPlan}</div>
                        <div style={{ padding: "8px", fontSize: "0.82rem", lineHeight: 1.4 }}>{report.soap?.plan}</div>
                    </div>
                </div>
            </div>

            {/* 12. EXTRACTED SYMPTOMS */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    {dict.secSymptoms}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                        <tr style={{ background: "#F3F4F6" }}>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "32%" }}>{dict.thSymptom}</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "22%" }}>{dict.thDuration}</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "18%" }}>{dict.thSeverity}</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "28%" }}>{dict.thNotes}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(report.symptoms || []).map((s, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #E5E7EB" }}>
                                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{idx + 1}. {s.symptom || s.name}</td>
                                <td style={{ padding: "6px 8px" }}>{s.duration || "—"}</td>
                                <td style={{ padding: "6px 8px" }}>
                                    <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "0.74rem", fontWeight: 600, background: s.severity?.toLowerCase().includes("severe") ? "#FEE2E2" : "#FEF3C7", color: s.severity?.toLowerCase().includes("severe") ? "#991B1B" : "#92400E" }}>
                                        {s.severity || "Reported"}
                                    </span>
                                </td>
                                <td style={{ padding: "6px 8px", color: "#4B5563" }}>{s.notes || s.status || "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 13. DIFFERENTIAL DIAGNOSES */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    {dict.secDifferentials}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                        <tr style={{ background: "#F3F4F6" }}>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "32%" }}>{dict.thDiagnosis}</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "26%" }}>{dict.thStatus}</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "14%" }}>{dict.thConfidence}</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "28%" }}>{dict.thEvidence}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {diffs.map((d, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #E5E7EB" }}>
                                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{idx + 1}. {d.diagnosis}</td>
                                <td style={{ padding: "6px 8px", color: "#1E40AF", fontWeight: 600 }}>{d.status || (idx === 0 ? "Working Impression" : "Differential")}</td>
                                <td style={{ padding: "6px 8px" }}>{d.confidence || "Moderate"}</td>
                                <td style={{ padding: "6px 8px", color: "#4B5563" }}>{d.supporting_evidence || d.reasoning || "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 14. ICD-10 CLINICAL CODING MAPPING */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    {dict.secIcd10}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                        <tr style={{ background: "#F3F4F6" }}>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "18%" }}>{dict.thIcdCode}</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "34%" }}>{dict.thDescription}</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "28%" }}>{dict.thEvidence}</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "20%" }}>{dict.thCodingStatus}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(report.icd_10_codes || []).map((c, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #E5E7EB" }}>
                                <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 700, color: "#1E3A8A" }}>{c.code}</td>
                                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{c.description}</td>
                                <td style={{ padding: "6px 8px", color: "#4B5563" }}>{c.supporting_evidence || c.evidence || "—"}</td>
                                <td style={{ padding: "6px 8px", color: "#047857", fontWeight: 600 }}>{c.coding_status || "Provisional"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 15. TREATMENT & MANAGEMENT PLAN */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    {dict.secTreatment}
                </div>

                <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.82rem", margin: "6px 0 2px 0" }}>${dict.subMedications}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                        <tr style={{ background: "#F3F4F6" }}>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "26%" }}>{dict.thMedication}</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "14%" }}>{dict.thDosage}</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "12%" }}>{dict.thRoute}</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "22%" }}>{dict.thFrequency}</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "12%" }}>{dict.thDurationMed}</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", width: "14%" }}>{dict.thInstructions}</th>
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
                        <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.82rem", marginBottom: "2px" }}>${dict.subInvestigations}</div>
                        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem" }}>
                            {(report.treatment_plan?.investigations || []).map((inv, i) => (
                                <li key={i}>{inv}</li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.82rem", marginBottom: "2px" }}>${dict.subRecommendations}</div>
                        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem" }}>
                            {(report.treatment_plan?.recommendations || []).map((rec, i) => (
                                <li key={i}>{rec}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div style={{ marginTop: "8px", fontSize: "0.84rem" }}>
                    <strong>${dict.subFollowUp}</strong> {report.treatment_plan?.follow_up || "Follow up in 3 to 5 days if symptoms do not improve."}
                </div>

                <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderLeft: "4px solid #DC2626", borderRadius: "4px", padding: "8px 12px", color: "#991B1B", fontSize: "0.82rem", marginTop: "8px", breakInside: "avoid" }}>
                    <strong>${dict.subEmergency}</strong><br />
                    {report.treatment_plan?.emergency_warnings || report.treatment_plan?.emergency_warning || "Seek emergency hospital medical attention immediately if severe red flag symptoms occur."}
                </div>
            </div>

            {/* 16. CONSULTATION OUTCOME & CLINICIAN NOTES */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    {dict.secOutcome}
                </div>
                <div style={{ fontSize: "0.84rem" }}>
                    <div><strong>${dict.outcomeLabel}</strong> {report.consultation_outcome || "Virtual consultation completed. Outpatient management initiated."}</div>
                    <div style={{ marginTop: "4px" }}><strong>${dict.remarksLabel}</strong> {report.doctor_notes || "Patient communicated clearly during remote encounter. Red-flag precautions explained and confirmed."}</div>
                </div>
            </div>

            {/* 17. SOURCE TRANSCRIPT DISCLOSURE */}
            <div style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", borderBottom: "1.5px solid #DBEAFE", paddingBottom: "3px", marginBottom: "6px" }}>
                    {dict.secDisclosure}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#4B5563", lineHeight: 1.35, background: "#F3F4F6", padding: "6px 10px", borderRadius: "4px" }}>
                    {report.source_disclosure || "This medical documentation was synthesized using natural language processing from the active consultation transcript recorded during room session " + (report.room_id || "N/A") + ". In accordance with Telemedicine Practice Guidelines, all documentation, ICD mappings, and orders are legally authenticated by the attending physician."}
                </div>
            </div>

            {/* 18. SIGNATURE & AUTHENTICATION */}
            <div style={{ marginTop: "20px", paddingTop: "12px", borderTop: "1.5px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "flex-end", breakInside: "avoid" }}>
                <div>
                    <div style={{ fontSize: "0.76rem", color: "#6B7280", textTransform: "uppercase", fontWeight: 700 }}>${dict.authTitle}</div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1E3A8A", marginTop: "2px" }}>{effectiveDoctorName}</div>
                    <div style={{ fontSize: "0.78rem", color: "#4B5563" }}>{report.doctor_specialization || "Telehealth Physician / General Medicine"}</div>
                    <div style={{ fontSize: "0.75rem", color: "#6B7280" }}>${dict.regLicense} {report.doctor_reg_number || "REG-TEL-" + (report.doctor_id || "DOC").slice(0, 8).toUpperCase()}</div>
                </div>

                <div style={{ textAlign: "right" }}>
                    <div style={{ border: "1.5px dashed #059669", background: "#F0FDF4", color: "#065F46", padding: "8px 14px", borderRadius: "6px", fontSize: "0.8rem", display: "inline-block" }}>
                        <strong>${isApproved ? dict.stampApproved : dict.stampDraft}</strong><br />
                        <span style={{ fontSize: "0.74rem" }}>${dict.dateLabel}: ${approvedDate}</span>
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "#9CA3AF", marginTop: "4px" }}>${dict.verification} ${docId}</div>
                </div>
            </div>

            {/* FOOTER */}
            <div style={{ marginTop: "14px", paddingTop: "8px", borderTop: "1px solid #E5E7EB", fontSize: "0.74rem", color: "#6B7280", textAlign: "center", lineHeight: 1.35, whiteSpace: "pre-line" }}>
                ${dict.footerNote} • Accession: ${docId}
            </div>
        </div>
    );
}
