import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath('.'))

from backend.services.multilingual_service import (
    SUPPORTED_LANGUAGES,
    normalize_lang_code,
    detect_script_language,
    translate_text_gnani,
    translate_transcript_lines,
    translate_clinical_report,
    synthesize_speech_gnani
)

async def test_all():
    print("--- 1. Testing normalize_lang_code ---")
    assert normalize_lang_code("hi-IN") == "hi"
    assert normalize_lang_code("mr") == "mr"
    assert normalize_lang_code("en-US") == "en"
    print("✓ normalize_lang_code passed")

    print("\n--- 2. Testing detect_script_language ---")
    assert detect_script_language("नमस्ते आप कैसे हैं?") == "hi"
    assert detect_script_language("मला ताप येत आहे") == "mr"
    assert detect_script_language("I have a headache") == "en"
    print("✓ detect_script_language passed")

    print("\n--- 3. Testing translate_text_gnani (en -> mr) ---")
    mr_text = await translate_text_gnani("I have high fever and severe headache.", "mr", "en")
    print("Translated (mr):", mr_text)
    assert len(mr_text) > 0
    print("✓ translate_text_gnani passed")

    print("\n--- 4. Testing translate_transcript_lines ---")
    sample_transcript = (
        "[Dr. Physician] (05:30 PM): Hello John, how are you feeling today?\n"
        "[John Doe] (05:31 PM): Doctor, I have been having a severe headache and chills."
    )
    translated_transcript = await translate_transcript_lines(sample_transcript, "hi", "en")
    print("Translated Transcript (hi):\n", translated_transcript)
    assert "[Dr. Physician]" in translated_transcript
    assert "[John Doe]" in translated_transcript
    print("✓ translate_transcript_lines passed")

    print("\n--- 5. Testing translate_clinical_report ---")
    sample_report = {
        "id": "test-rep-1",
        "doctor_name": "Dr. Physician",
        "patient_name": "John Doe",
        "chief_complaint": "Severe throbbing headache for 3 days",
        "summary": "Patient presents with acute migraine signs.",
        "soap": {
            "subjective": "Headache with light sensitivity.",
            "objective": "Normotensive on visual exam.",
            "assessment": "Acute migraine without aura.",
            "plan": "Prescribe acute analgesics and dark room rest."
        },
        "icd_10_codes": [{"code": "G43.909", "description": "Migraine"}],
        "treatment_plan": {
            "medications": [{"medication": "Sumatriptan", "dosage": "50 mg", "instructions": "Take at onset of pain"}],
            "recommendations": ["Avoid bright screens", "Maintain adequate hydration"]
        }
    }
    trans_rep = await translate_clinical_report(sample_report, "mr", "en")
    print("Translated Report (mr) Chief Complaint:", trans_rep["chief_complaint"])
    print("Translated Report (mr) SOAP Subjective:", trans_rep["soap"]["subjective"])
    assert trans_rep["translation_metadata"]["is_translated"] is True
    assert trans_rep["icd_10_codes"][0]["code"] == "G43.909"  # Must stay untranslated!
    print("✓ translate_clinical_report passed")

    print("\n--- 6. Testing synthesize_speech_gnani (TTS) ---")
    wav_bytes = await synthesize_speech_gnani("आपकी रिपोर्ट तैयार है", "hi-IN")
    print("TTS WAV Bytes generated:", len(wav_bytes))
    assert len(wav_bytes) > 500
    print("✓ synthesize_speech_gnani passed")

    print("\n==========================================")
    print("ALL MULTILINGUAL SERVICE TESTS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    asyncio.run(test_all())

