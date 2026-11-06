import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath('.'))

from backend.main import app

client = TestClient(app)

def test_endpoints():
    print("--- 1. Testing GET /multilingual/supported-languages ---")
    res = client.get("/multilingual/supported-languages")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    languages = res.json().get("supported_languages", [])
    print(f"Supported languages count: {len(languages)}")
    assert len(languages) >= 9
    lang_codes = [l["code"] for l in languages]
    assert "hi" in lang_codes
    assert "mr" in lang_codes
    print("✓ GET /multilingual/supported-languages passed")

    print("\n--- 2. Testing POST /multilingual/detect-language ---")
    res_detect = client.post("/multilingual/detect-language", json={"text": "मला खूप ताप आहे"})
    assert res_detect.status_code == 200
    detected = res_detect.json()
    print("Detected language:", detected)
    assert detected["language"] in ["mr", "hi"]
    print("✓ POST /multilingual/detect-language passed")

    print("\n--- 3. Testing POST /multilingual/translate (en -> hi) ---")
    res_trans = client.post("/multilingual/translate", json={
        "text": "The patient is advised to take adequate rest and drink water.",
        "target_language": "hi",
        "source_language": "en"
    })
    assert res_trans.status_code == 200, res_trans.text
    trans_data = res_trans.json()
    print("Translated text:", trans_data["translated_text"])
    assert len(trans_data["translated_text"]) > 0
    print("✓ POST /multilingual/translate passed")

    print("\n--- 4. Testing POST /multilingual/translate-transcript ---")
    sample_transcript = (
        "[Dr. Physician] (05:30 PM): How long have you had this fever?\n"
        "[Patient]: For three days, doctor."
    )
    res_trans_tr = client.post("/multilingual/translate-transcript", json={
        "transcript": sample_transcript,
        "target_language": "mr",
        "source_language": "en"
    })
    assert res_trans_tr.status_code == 200, res_trans_tr.text
    tr_data = res_trans_tr.json()
    print("Translated transcript:\n", tr_data["translated_transcript"])
    assert "[Dr. Physician]" in tr_data["translated_transcript"]
    assert "[Patient]" in tr_data["translated_transcript"]
    print("✓ POST /multilingual/translate-transcript passed")

    print("\n--- 5. Testing POST /consultations/chatbot (Hindi query & emergency screening) ---")
    # Routine medical question
    res_bot = client.post("/consultations/chatbot", json={
        "message": "मुझे दो दिन से सिरदर्द और चक्कर आ रहे हैं",
        "language": "hi"
    })
    assert res_bot.status_code == 200, res_bot.text
    bot_data = res_bot.json()
    print("Chatbot Reply (hi):", bot_data["reply"])
    assert len(bot_data["reply"]) > 0
    assert bot_data["is_emergency"] is False

    # Emergency medical question
    res_em = client.post("/consultations/chatbot", json={
        "message": "Severe crushing chest pain and shortness of breath",
        "language": "en"
    })
    assert res_em.status_code == 200
    em_data = res_em.json()
    print("Emergency Reply:", em_data["reply"])
    assert em_data["is_emergency"] is True
    print("✓ POST /consultations/chatbot passed")

    print("\n--- 6. Testing POST /multilingual/tts ---")
    res_tts = client.post("/multilingual/tts", json={
        "text": "नमस्ते डॉक्टर साहब",
        "language_code": "hi-IN"
    })
    assert res_tts.status_code == 200, res_tts.text
    assert res_tts.headers["content-type"] == "audio/wav"
    assert len(res_tts.content) > 1000
    print("✓ POST /multilingual/tts passed (received", len(res_tts.content), "bytes)")

    print("\n==========================================")
    print("ALL BACKEND MULTILINGUAL API TESTS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    test_endpoints()

