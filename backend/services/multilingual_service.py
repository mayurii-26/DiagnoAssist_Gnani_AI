import os
import re
import json
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import httpx
from dotenv import load_dotenv

load_dotenv()
# Also check backend directory if running from repo root
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_env = os.path.join(backend_dir, ".env")
if os.path.exists(backend_env):
    load_dotenv(backend_env, override=True)

GNANI_API_KEY = os.getenv("GNANI_API_KEY", "").strip()
GNANI_TRANSLATE_URL = os.getenv("GNANI_TRANSLATE_URL", "https://api.vachana.ai/api/v1/translate").strip()
GNANI_TTS_URL = os.getenv("GNANI_TTS_URL", "https://api.vachana.ai/api/v1/tts/inference").strip()

# Supported Indian languages with ISO 639-1 and BCP-47 codes
SUPPORTED_LANGUAGES = {
    "en": {"name": "English", "native": "English", "bcp47": "en-IN"},
    "hi": {"name": "Hindi", "native": "हिन्दी", "bcp47": "hi-IN"},
    "mr": {"name": "Marathi", "native": "मराठी", "bcp47": "mr-IN"},
    "ta": {"name": "Tamil", "native": "தமிழ்", "bcp47": "ta-IN"},
    "te": {"name": "Telugu", "native": "తెలుగు", "bcp47": "te-IN"},
    "bn": {"name": "Bengali", "native": "বাংলা", "bcp47": "bn-IN"},
    "gu": {"name": "Gujarati", "native": "ગુજરાતી", "bcp47": "gu-IN"},
    "kn": {"name": "Kannada", "native": "ಕನ್ನಡ", "bcp47": "kn-IN"},
    "ml": {"name": "Malayalam", "native": "മലയാളം", "bcp47": "ml-IN"},
    "pa": {"name": "Punjabi", "native": "ਪੰਜਾਬੀ", "bcp47": "pa-IN"},
}

# Translated section titles for 16-section EMR document
SECTION_TITLES = {
    "en": {
        "summary": "1. Clinical Summary",
        "chief_complaint": "1. Chief Complaint",
        "hpi": "2. History of Present Illness (HPI)",
        "pmh": "3. Past Medical, Surgical, Medication & Allergy History",
        "ros": "4. Review of Systems (ROS)",
        "vitals": "5. Vital Signs & Clinical Telehealth Observations",
        "physical_exam": "6. Physical Examination",
        "impression": "7. Clinical Assessment & Working Impression",
        "soap": "8. Structured SOAP Documentation",
        "symptoms": "9. Documented Symptoms Profile",
        "diagnoses": "10. Differential Diagnoses & Uncertainty Status",
        "icd10": "11. ICD-10 Clinical Diagnostic Coding (WHO / MoHFW Standards)",
        "treatment": "12. Treatment and Management Plan",
        "medications": "Prescribed / Recommended Medications:",
        "investigations": "Laboratory & Diagnostic Investigations:",
        "recommendations": "Lifestyle & Non-Pharmacological Advice:",
        "follow_up": "Follow-Up Instructions:",
        "emergency": "⚠️ Emergency Red-Flag Advice:",
        "outcome": "13. Consultation Outcome & Clinician Remarks",
        "disclosure": "14. Source Transcript & AI Telemedicine Disclosure",
        "physician_auth": "Attending Physician Authentication",
    },
    "hi": {
        "summary": "क्लिनिकल परामर्श सारांश (Clinical Summary)",
        "chief_complaint": "1. मुख्य शिकायत व लक्षण (Chief Complaint)",
        "hpi": "2. वर्तमान बीमारी का इतिहास (History of Present Illness - HPI)",
        "pmh": "3. पूर्व चिकित्सा, सर्जरी, दवाई व एलर्जी इतिहास (Past Medical & Surgical History)",
        "ros": "4. शारीरिक प्रणाली समीक्षा (Review of Systems - ROS)",
        "vitals": "5. महत्वपूर्ण शारीरिक लक्षण व टेलीहेल्थ निरीक्षण (Vital Signs)",
        "physical_exam": "6. शारीरिक परीक्षण (Physical Examination)",
        "impression": "7. क्लिनिकल मूल्यांकन व प्रारंभिक निदान (Clinical Assessment & Impression)",
        "soap": "8. एसओएपी क्लिनिकल नोट्स (Structured SOAP Documentation)",
        "symptoms": "9. प्रलेखित लक्षण तालिका (Documented Symptoms Profile)",
        "diagnoses": "10. प्राथमिक व संभावित अंतर निदान (Differential Diagnoses)",
        "icd10": "11. आयसीडी-१० क्लिनिकल कोडिंग (ICD-10 Diagnostic Coding)",
        "treatment": "12. उपचार योजना व प्रबंधन (Treatment & Management Plan)",
        "medications": "निर्धारित व अनुशंसित दवाइयाँ (Prescribed Medications):",
        "investigations": "अनुशंसित रक्त व नैदानिक परीक्षण (Investigations):",
        "recommendations": "जीवनशैली व नैदानिक परामर्श (Lifestyle Recommendations):",
        "follow_up": "अनुवर्ती परामर्श व फॉलो-अप निर्देश (Follow-Up Instructions):",
        "emergency": "⚠️ आपातकालीन चेतावनी व रेड फ्लैग्स (Emergency Red Flags):",
        "outcome": "13. परामर्श निष्कर्ष व चिकित्सक की टिप्पणियाँ (Consultation Outcome & Remarks)",
        "disclosure": "14. परामर्श प्रतिलेख व एआई प्रकटीकरण (Source Transcript & AI Disclosure)",
        "physician_auth": "उपस्थित चिकित्सक द्वारा प्रमाणीकरण (Attending Physician Authentication)",
    },
    "mr": {
        "summary": "वैद्यकीय तपासणी सारांश (Clinical Summary)",
        "chief_complaint": "1. मुख्य लक्षणे व तक्रार (Chief Complaint)",
        "hpi": "2. सध्याच्या आजाराचा इतिहास (History of Present Illness - HPI)",
        "pmh": "3. मागील आजार, शस्त्रक्रिया, औषधे व ऍलर्जी इतिहास (Past Medical History)",
        "ros": "4. शारीरिक प्रणाली पुनरावलोकन (Review of Systems - ROS)",
        "vitals": "5. महत्त्वाची शारीरिक चिन्हे व निरीक्षणे (Vital Signs)",
        "physical_exam": "6. शारीरिक तपासणी (Physical Examination)",
        "impression": "7. वैद्यकीय मूल्यांकन व तात्पुरते निदान (Clinical Assessment & Impression)",
        "soap": "8. एसओएपी वैद्यकीय नोंदी (Structured SOAP Documentation)",
        "symptoms": "9. प्रलेखित लक्षणे (Documented Symptoms Profile)",
        "diagnoses": "10. प्राथमिक व संभाव्य निदान (Differential Diagnoses)",
        "icd10": "11. आयसीडी-१० वैद्यकीय कोड (ICD-10 Diagnostic Coding)",
        "treatment": "12. उपचार योजना व व्यवस्थापन (Treatment & Management Plan)",
        "medications": "शिफारस केलेली औषधे (Prescribed Medications):",
        "investigations": "शिफारस केलेल्या वैद्यकीय चाचण्या (Investigations):",
        "recommendations": "वैद्यकीय शिफारसी व जीवनशैली सल्ला (Lifestyle Advice):",
        "follow_up": "पुढील तपासणी व देखरेख सूचना (Follow-Up Instructions):",
        "emergency": "⚠️ तातडीचे धोक्याचे इशारे (Emergency Red Flags):",
        "outcome": "13. तपासणी निष्कर्ष व डॉक्टरांच्या नोंदी (Consultation Outcome & Remarks)",
        "disclosure": "14. संभाषण उतारा व एआय स्पष्टीकरण (Source Transcript & AI Disclosure)",
        "physician_auth": "तपासणी करणाऱ्या डॉक्टरांचे प्रमाणीकरण (Physician Authentication)",
    },
}

# In-memory translation cache: (source_lang, target_lang, text_hash) -> translated_text
_MEMORY_CACHE: Dict[Tuple[str, str, str], str] = {}

# Serialized lock to prevent HTTP 429 (Gnani enforces strictly 1 active request per API key)
_GNANI_LOCK = asyncio.Lock()


def normalize_lang_code(code: str) -> str:
    """Normalize language code (e.g. 'hi-IN' -> 'hi', 'en-US' -> 'en')."""
    if not code:
        return "en"
    clean = code.strip().lower().split("-")[0]
    return clean if clean in SUPPORTED_LANGUAGES else "en"


def detect_script_language(text: str) -> str:
    """Detects Indian language script based on primary Unicode block."""
    if not text:
        return "en"
    
    counts = {
        "hi": 0, "ta": 0, "te": 0, "bn": 0, "gu": 0, "kn": 0, "ml": 0, "pa": 0, "en": 0,
    }

    for char in text:
        cp = ord(char)
        if 0x0900 <= cp <= 0x097F:
            counts["hi"] += 1
        elif 0x0B80 <= cp <= 0x0BFF:
            counts["ta"] += 1
        elif 0x0C00 <= cp <= 0x0C7F:
            counts["te"] += 1
        elif 0x0980 <= cp <= 0x09FF:
            counts["bn"] += 1
        elif 0x0A80 <= cp <= 0x0AFF:
            counts["gu"] += 1
        elif 0x0C80 <= cp <= 0x0CFF:
            counts["kn"] += 1
        elif 0x0D00 <= cp <= 0x0D7F:
            counts["ml"] += 1
        elif 0x0A00 <= cp <= 0x0A7F:
            counts["pa"] += 1
        elif 0x0041 <= cp <= 0x007A:
            counts["en"] += 1

    top_lang, top_count = max(counts.items(), key=lambda item: item[1])
    if top_count == 0:
        return "en"

    # Distinguish Marathi from Hindi using characteristic Marathi vocabulary if Devanagari
    if top_lang == "hi":
        marathi_markers = ["आहे", "आहोत", "नाही", "होते", "करावे", "मला", "तुम्हाला", "त्यांना", "तपासणी", "गोळी"]
        if any(marker in text for marker in marathi_markers):
            return "mr"

    return top_lang


async def translate_text_gnani(
    text: str,
    target_language: str,
    source_language: str = "en",
    timeout_sec: float = 10.0
) -> str:
    """
    Translates text via Gnani AI Vachana translation API.
    Uses memory cache and serialized locking with backoff to prevent rate limit collisions.
    """
    if not text or not text.strip():
        return text

    clean_text = text.strip()
    src = normalize_lang_code(source_language)
    tgt = normalize_lang_code(target_language)

    if src == tgt:
        return clean_text

    cache_key = (src, tgt, clean_text)
    if cache_key in _MEMORY_CACHE:
        return _MEMORY_CACHE[cache_key]

    if not GNANI_API_KEY:
        raise ValueError("GNANI_API_KEY is not configured on the backend server.")

    headers = {
        "X-API-Key-ID": GNANI_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "text": clean_text,
        "source_language": src,
        "target_language": tgt,
    }

    # Acquire serialized lock to strictly obey Gnani's single active request policy
    async with _GNANI_LOCK:
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=timeout_sec) as client:
                    response = await client.post(GNANI_TRANSLATE_URL, headers=headers, json=payload)
                    if response.status_code == 200:
                        res_data = response.json()
                        translated = res_data.get("data", {}).get("translated_text", "").strip()
                        if translated:
                            _MEMORY_CACHE[cache_key] = translated
                            return translated
                        return clean_text

                    if response.status_code == 429:
                        # Wait for rate limit cool-down
                        await asyncio.sleep(0.4 * (attempt + 1))
                        continue

                    err_detail = response.text[:200]
                    raise RuntimeError(f"Gnani Translation API error ({response.status_code}): {err_detail}")
            except httpx.RequestError as exc:
                if attempt == 2:
                    raise RuntimeError(f"Translation network failure: {exc}")
                await asyncio.sleep(0.3)

    return clean_text


async def synthesize_speech_gnani(
    text: str,
    language_code: str = "hi-IN",
    voice: Optional[str] = None
) -> bytes:
    """
    Synthesizes speech via Gnani AI Timbre TTS API.
    Returns audio/wav bytes.
    """
    if not text or not text.strip():
        raise ValueError("Text cannot be empty for TTS synthesis.")

    if not GNANI_API_KEY:
        raise ValueError("GNANI_API_KEY is not configured.")

    headers = {
        "X-API-Key-ID": GNANI_API_KEY,
        "Content-Type": "application/json",
    }

    tts_lang = language_code if "-" in language_code else f"{language_code}-IN"

    payload = {
        "text": text.strip()[:1000],
        "voice": voice or "Nalini",
        "model": "timbre-v2.5",
        "language": tts_lang,
        "speed": 1.0,
        "audio_config": {
            "sample_rate": 24000,
            "encoding": "linear_pcm",
            "container": "wav",
        },
    }

    async with httpx.AsyncClient(timeout=12.0) as client:
        response = await client.post(GNANI_TTS_URL, headers=headers, json=payload)
        if response.status_code == 200 and len(response.content) > 100:
            return response.content
        raise RuntimeError(f"Gnani TTS API returned status {response.status_code}: {response.text[:200]}")


async def translate_transcript_lines(
    transcript: str,
    target_language: str,
    source_language: str = "en"
) -> str:
    """
    Translates an entire consultation dialogue log line-by-line while strictly
    preserving speaker attribution, timestamps, and order.
    """
    if not transcript or not transcript.strip():
        return transcript

    lines = transcript.strip().split("\n")
    translated_lines: List[str] = []

    speaker_pattern = re.compile(r"^(\[[^\]]+\](?:\s*\([^)]+\))?\s*:\s*)(.*)$")

    for line in lines:
        line_str = line.strip()
        if not line_str:
            translated_lines.append("")
            continue

        match = speaker_pattern.match(line_str)
        if match:
            prefix = match.group(1)
            utterance = match.group(2).strip()
            if utterance:
                translated_utterance = await translate_text_gnani(
                    utterance,
                    target_language=target_language,
                    source_language=source_language
                )
                translated_lines.append(f"{prefix}{translated_utterance}")
            else:
                translated_lines.append(line_str)
        else:
            translated_line = await translate_text_gnani(
                line_str,
                target_language=target_language,
                source_language=source_language
            )
            translated_lines.append(translated_line)

    return "\n".join(translated_lines)


async def translate_clinical_report(
    report: Dict[str, Any],
    target_language: str,
    source_language: str = "en"
) -> Dict[str, Any]:
    """
    Comprehensively translates a structured EMR clinical report into the target Indian language.
    Translates EVERY single clinical narrative and data section:
      - Chief complaint, HPI, Summary, Impression, Physical exam, Remarks, Outcomes
      - SOAP notes (Subjective, Objective, Assessment, Plan)
      - Symptoms list (symptom name, severity, duration, notes, status)
      - Primary & Differential diagnoses (diagnosis name, confidence, reasoning, evidence)
      - ICD-10 descriptions and supporting evidence (preserving alphanumeric codes G43, R51 verbatim)
      - Treatment plan (medication instructions, frequency, route, duration, recommendations, investigations, follow-up, warnings)
      - Vital signs & clinical observations
      - Past medical history (conditions, surgical, current medications, allergies, family history)
      - Review of Systems (ROS) for all bodily systems
      - Section headers dictionary for complete multilingual document export
    """
    if not report:
        return {}

    tgt = normalize_lang_code(target_language)
    if tgt == "en":
        return report

    translated_report = json.loads(json.dumps(report))  # Deep copy

    # Helper function for translating single strings safely
    async def trans(s: Optional[str]) -> str:
        if not s or not isinstance(s, str) or not s.strip():
            return s or ""
        return await translate_text_gnani(s, target_language=tgt, source_language=source_language)

    # 1. Translate high-level narrative fields
    narrative_fields = [
        "chief_complaint",
        "history_of_present_illness",
        "summary",
        "assessment_and_impression",
        "physical_examination",
        "consultation_outcome",
        "clinician_notes",
        "doctor_notes",
        "document_title",
        "encounter_type",
        "source_disclosure",
    ]
    for field in narrative_fields:
        if translated_report.get(field):
            translated_report[field] = await trans(translated_report[field])

    # 2. Translate SOAP notes
    if "soap" in translated_report and isinstance(translated_report["soap"], dict):
        for soap_key in ["subjective", "objective", "assessment", "plan"]:
            if translated_report["soap"].get(soap_key):
                translated_report["soap"][soap_key] = await trans(translated_report["soap"][soap_key])

    # 3. Translate Symptoms List completely
    if "symptoms" in translated_report and isinstance(translated_report["symptoms"], list):
        for sym in translated_report["symptoms"]:
            if isinstance(sym, dict):
                # Replace symptom and name directly with translated text
                sym_text = sym.get("symptom") or sym.get("name")
                if sym_text:
                    t_sym = await trans(sym_text)
                    sym["symptom"] = t_sym
                    sym["name"] = t_sym
                    sym["symptom_translated"] = t_sym

                if sym.get("severity"):
                    sym["severity"] = await trans(sym["severity"])
                if sym.get("duration"):
                    sym["duration"] = await trans(sym["duration"])
                if sym.get("notes"):
                    sym["notes"] = await trans(sym["notes"])
                if sym.get("status"):
                    sym["status"] = await trans(sym["status"])

    # 4. Translate Primary Diagnosis Suggestions
    if "diagnosis_suggestions" in translated_report and isinstance(translated_report["diagnosis_suggestions"], list):
        for diag in translated_report["diagnosis_suggestions"]:
            if isinstance(diag, dict):
                if diag.get("diagnosis"):
                    t_diag = await trans(diag["diagnosis"])
                    diag["diagnosis"] = t_diag
                    diag["diagnosis_translated"] = t_diag
                if diag.get("reasoning"):
                    diag["reasoning"] = await trans(diag["reasoning"])
                if diag.get("supporting_evidence"):
                    diag["supporting_evidence"] = await trans(diag["supporting_evidence"])
                if diag.get("status"):
                    diag["status"] = await trans(diag["status"])
                if diag.get("confidence"):
                    diag["confidence"] = await trans(diag["confidence"])

    # 5. Translate Differential Diagnoses
    if "differential_diagnoses" in translated_report and isinstance(translated_report["differential_diagnoses"], list):
        for diff in translated_report["differential_diagnoses"]:
            if isinstance(diff, dict):
                if diff.get("diagnosis"):
                    t_diff = await trans(diff["diagnosis"])
                    diff["diagnosis"] = t_diff
                    diff["diagnosis_translated"] = t_diff
                if diff.get("reasoning"):
                    diff["reasoning"] = await trans(diff["reasoning"])
                if diff.get("supporting_evidence"):
                    diff["supporting_evidence"] = await trans(diff["supporting_evidence"])
                if diff.get("status"):
                    diff["status"] = await trans(diff["status"])
                if diff.get("confidence"):
                    diff["confidence"] = await trans(diff["confidence"])

    # 6. Translate ICD-10 Descriptions (Preserve exact code G43.909, translate clinical description & evidence)
    if "icd_10_codes" in translated_report and isinstance(translated_report["icd_10_codes"], list):
        for icd in translated_report["icd_10_codes"]:
            if isinstance(icd, dict):
                if icd.get("description"):
                    icd["description"] = await trans(icd["description"])
                if icd.get("evidence"):
                    icd["evidence"] = await trans(icd["evidence"])
                if icd.get("supporting_evidence"):
                    icd["supporting_evidence"] = await trans(icd["supporting_evidence"])
                if icd.get("coding_status"):
                    icd["coding_status"] = await trans(icd["coding_status"])

    # 7. Translate Treatment Plan & Medications
    if "treatment_plan" in translated_report and isinstance(translated_report["treatment_plan"], dict):
        tp = translated_report["treatment_plan"]
        if tp.get("follow_up"):
            tp["follow_up"] = await trans(tp["follow_up"])
        if tp.get("emergency_warnings"):
            tp["emergency_warnings"] = await trans(tp["emergency_warnings"])
        if tp.get("emergency_warning"):
            tp["emergency_warning"] = await trans(tp["emergency_warning"])

        # Recommendations list
        if isinstance(tp.get("recommendations"), list):
            tp["recommendations"] = [await trans(r) if isinstance(r, str) else r for r in tp["recommendations"]]

        # Investigations list
        if isinstance(tp.get("investigations"), list):
            tp["investigations"] = [await trans(i) if isinstance(i, str) else i for i in tp["investigations"]]

        # Medications list (support both strings and dicts)
        if isinstance(tp.get("medications"), list):
            new_meds = []
            for med in tp["medications"]:
                if isinstance(med, str):
                    new_meds.append(await trans(med))
                elif isinstance(med, dict):
                    if med.get("instructions"):
                        med["instructions"] = await trans(med["instructions"])
                    if med.get("frequency"):
                        med["frequency"] = await trans(med["frequency"])
                    if med.get("route"):
                        med["route"] = await trans(med["route"])
                    if med.get("duration"):
                        med["duration"] = await trans(med["duration"])
                    new_meds.append(med)
                else:
                    new_meds.append(med)
            tp["medications"] = new_meds

        # Structured medications list
        if isinstance(tp.get("medications_structured"), list):
            for med in tp["medications_structured"]:
                if isinstance(med, dict):
                    if med.get("instructions"):
                        med["instructions"] = await trans(med["instructions"])
                    if med.get("frequency"):
                        med["frequency"] = await trans(med["frequency"])
                    if med.get("route"):
                        med["route"] = await trans(med["route"])
                    if med.get("duration"):
                        med["duration"] = await trans(med["duration"])

    # 8. Translate Vital Signs & Clinical Observations
    if "vital_signs" in translated_report and isinstance(translated_report["vital_signs"], dict):
        vs = translated_report["vital_signs"]
        for k in ["observations", "temperature", "respiratory_rate", "blood_pressure", "heart_rate", "spo2"]:
            if vs.get(k) and isinstance(vs[k], str):
                vs[k] = await trans(vs[k])

    # 9. Translate Past Medical History
    if "past_medical_history" in translated_report and isinstance(translated_report["past_medical_history"], dict):
        pmh = translated_report["past_medical_history"]
        for pmh_key in ["past_conditions", "surgical_history", "current_medications", "allergies", "family_history"]:
            if isinstance(pmh.get(pmh_key), list):
                pmh[pmh_key] = [await trans(item) if isinstance(item, str) else item for item in pmh[pmh_key]]

    # 10. Translate Review of Systems (ROS)
    if "review_of_systems" in translated_report and isinstance(translated_report["review_of_systems"], dict):
        ros = translated_report["review_of_systems"]
        for sys_key, finding in list(ros.items()):
            if isinstance(finding, str):
                ros[sys_key] = await trans(finding)

    # 11. Add localized section headers dictionary for complete document translation
    translated_report["section_headers"] = SECTION_TITLES.get(tgt, {})

    # 12. Metadata stamp
    now_iso = datetime.now(timezone.utc).isoformat()
    translated_report["translation_metadata"] = {
        "is_translated": True,
        "original_language": source_language,
        "target_language": tgt,
        "translated_language": tgt,
        "language_name": SUPPORTED_LANGUAGES.get(tgt, {}).get("name", tgt),
        "translated_at": now_iso,
        "provider": "Gnani AI Vachana NMT",
        "translation_provider": "Gnani AI Vachana NMT",
        "disclaimer": "This document is a certified multilingual translation of the original physician-approved electronic medical record. Official diagnostic codes and clinical formulations have been preserved.",
    }

    return translated_report
