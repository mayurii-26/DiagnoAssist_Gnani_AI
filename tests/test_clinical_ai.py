import asyncio
import json
import sys
import os

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath('.'))

from backend.clinical_ai import generate_clinical_report_ai

sample_transcript = """[John Doe] (05:30 PM): Hello doctor, I have been experiencing severe headache, nausea, and fever for 2 days.
[Dr. Physician] (05:31 PM): I understand John. Does bright light or sunlight make the throbbing pain worse?
[John Doe] (05:31 PM): Yes, sunlight makes it unbearable.
[Dr. Physician] (05:32 PM): This presentation strongly aligns with acute migraine. I will prescribe acute relief medication and recommend resting in a quiet, dark room."""

async def main():
    report = await generate_clinical_report_ai(sample_transcript, 'John Doe', 'Dr. Physician')
    print("SUCCESS: Report generated!")
    print("Summary:", report.get("summary"))
    print("SOAP Subjective:", report.get("soap", {}).get("subjective"))
    print("SOAP Assessment:", report.get("soap", {}).get("assessment"))
    print("Symptoms count:", len(report.get("symptoms", [])))
    print("ICD-10 count:", len(report.get("icd_10_codes", [])))
    print("Diagnosis suggestions count:", len(report.get("diagnosis_suggestions", [])))
    print("First ICD code:", report.get("icd_10_codes", [])[0])
    print("Full JSON:")
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    asyncio.run(main())

