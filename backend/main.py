import os
import asyncio
import json
from datetime import datetime, timezone
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
import websockets

try:
    from clinical_ai import generate_clinical_report_ai
except ImportError:
    try:
        from backend.clinical_ai import generate_clinical_report_ai
    except ImportError:
        generate_clinical_report_ai = None

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = None

load_dotenv()

# ---------- Supabase client ----------
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if (create_client and SUPABASE_URL and SUPABASE_KEY) else None

# ---------- Gnani Prisma STT Configuration ----------
GNANI_API_KEY: str = os.getenv("GNANI_API_KEY", "").strip()
GNANI_STT_URL: str = os.getenv("GNANI_STT_URL", "wss://api.vachana.ai/stt/v3/stream").strip()
GNANI_MODEL: str = os.getenv("GNANI_MODEL", "prisma-v3.0").strip()

SUPPORTED_LANGUAGES = {"en-IN", "hi-IN", "mr-IN"}

# ---------- FastAPI app ----------
app = FastAPI(title="Mediq API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Schemas ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str


# ---------- Routes ----------
@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    """Authenticate a user via Supabase Auth."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized or dependency missing.")
    try:
        response = supabase.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )

        session = response.session
        user = response.user

        if not session or not user:
            raise HTTPException(status_code=401, detail="Invalid email or password.")

        return LoginResponse(
            access_token=session.access_token,
            user_id=user.id,
            email=user.email or payload.email,
        )

    except Exception as e:
        error_message = str(e)
        if "Invalid" in error_message or "credentials" in error_message.lower():
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        raise HTTPException(status_code=500, detail="Authentication service error.")


class SaveTranscriptRequest(BaseModel):
    room_id: str
    doctor_id: str
    patient_id: str
    transcript: str
    duration: int = 0


@app.post("/consultations/transcripts")
def save_consultation_transcript(payload: SaveTranscriptRequest):
    """
    Persist completed consultation transcript into Supabase transcriptions table.
    Ensures idempotency / duplicate prevention by checking if a transcript
    for this room_id already exists.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database client not initialized.")

    if not payload.transcript.strip():
        return {"status": "skipped", "message": "Transcript was empty"}

    try:
        now_iso = datetime.now(timezone.utc).isoformat()

        # Check for existing transcript to prevent duplicates
        existing = (
            supabase.table("transcriptions")
            .select("id, transcript, named_entities")
            .eq("doctor_id", payload.doctor_id)
            .eq("patient_id", payload.patient_id)
            .execute()
        )

        existing_record = None
        if existing and existing.data:
            for row in existing.data:
                ne = row.get("named_entities")
                if isinstance(ne, dict) and ne.get("room_id") == payload.room_id:
                    existing_record = row
                    break

        if existing_record:
            # Update existing record if new text is longer or updated
            if len(payload.transcript) >= len(existing_record.get("transcript") or ""):
                supabase.table("transcriptions").update({
                    "transcript": payload.transcript,
                    "duration": payload.duration,
                    "updated_at": now_iso
                }).eq("id", existing_record["id"]).execute()

            return {
                "status": "updated",
                "id": existing_record["id"],
                "message": "Existing transcript updated"
            }

        # Otherwise, insert new transcript row
        res = supabase.table("transcriptions").insert({
            "doctor_id": payload.doctor_id,
            "patient_id": payload.patient_id,
            "transcript": payload.transcript.strip(),
            "duration": payload.duration,
            "named_entities": {"room_id": payload.room_id},
            "created_at": now_iso,
            "updated_at": now_iso
        }).execute()

        # Update call status in video_calls
        try:
            supabase.table("video_calls").update({
                "status": "ended",
                "ended_at": now_iso
            }).or_(f"room_id.eq.{payload.room_id},room_id.like.%{payload.room_id}%").execute()
        except Exception:
            pass

        inserted_id = res.data[0]["id"] if (res and res.data) else None
        return {"status": "created", "id": inserted_id}

    except Exception as e:
        print(f"Error persisting transcript: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/consultations/transcripts")
def get_consultation_transcripts(user_id: str, role: str = "patient"):
    """
    Fetch consultation transcripts for an authorized participant (doctor or patient).
    Uses service key client to ensure reliable access for both roles.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database client not initialized.")

    try:
        id_column = "doctor_id" if role == "doctor" else "patient_id"
        res = (
            supabase.table("transcriptions")
            .select("*")
            .eq(id_column, user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print(f"Error fetching transcripts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class GenerateReportRequest(BaseModel):
    transcript_id: Optional[str] = None
    room_id: Optional[str] = None
    doctor_id: str
    patient_id: str
    transcript: Optional[str] = None
    patient_name: Optional[str] = "Patient"
    doctor_name: Optional[str] = "Doctor"


class ApproveReportRequest(BaseModel):
    report_id: Optional[str] = None
    transcription_id: Optional[str] = None
    room_id: Optional[str] = None
    doctor_id: str
    patient_id: str
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None
    summary: str
    soap: Dict[str, Any]
    symptoms: List[Dict[str, Any]]
    diagnosis_suggestions: List[Dict[str, Any]]
    icd_10_codes: List[Dict[str, Any]]
    treatment_plan: Dict[str, Any]
    doctor_notes: Optional[str] = ""
    # Extended hospital EMR clinical fields
    chief_complaint: Optional[str] = None
    history_of_present_illness: Optional[str] = None
    past_medical_history: Optional[Dict[str, Any]] = None
    review_of_systems: Optional[Dict[str, Any]] = None
    vital_signs: Optional[Dict[str, Any]] = None
    physical_examination: Optional[str] = None
    assessment_and_impression: Optional[str] = None
    differential_diagnoses: Optional[List[Dict[str, Any]]] = None
    consultation_outcome: Optional[str] = None
    source_disclosure: Optional[str] = None
    clinic_name: Optional[str] = None
    document_title: Optional[str] = None
    document_id: Optional[str] = None
    encounter_type: Optional[str] = None


@app.post("/consultations/generate-report")
async def generate_clinical_report_endpoint(payload: GenerateReportRequest):
    """
    Phase 4: AI Clinical Documentation Generator.
    Processes saved Gnani AI transcript and generates structured clinical documentation (Draft):
    - Clinical Summary
    - SOAP Notes
    - Symptoms
    - Diagnosis Suggestions
    - ICD-10 Codes
    - Treatment Plan
    Grounded strictly in the transcript without hallucinations.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database client not initialized.")

    raw_transcript = payload.transcript or ""

    # If transcript not passed directly in payload, fetch from transcriptions table
    if not raw_transcript.strip():
        try:
            query = supabase.table("transcriptions").select("id, transcript, named_entities")
            if payload.transcript_id:
                query = query.eq("id", payload.transcript_id)
            elif payload.room_id:
                query = query.eq("doctor_id", payload.doctor_id).eq("patient_id", payload.patient_id)
            res = query.execute()

            if res.data and len(res.data) > 0:
                if payload.room_id:
                    for row in res.data:
                        ne = row.get("named_entities")
                        if isinstance(ne, dict) and ne.get("room_id") == payload.room_id:
                            raw_transcript = row.get("transcript") or ""
                            payload.transcript_id = row.get("id")
                            break
                if not raw_transcript and len(res.data) > 0:
                    raw_transcript = res.data[0].get("transcript") or ""
                    payload.transcript_id = res.data[0].get("id")
        except Exception as e:
            print(f"[Generate Report] Error retrieving transcript from db: {e}")

    if not raw_transcript.strip():
        raise HTTPException(status_code=400, detail="No consultation dialogue transcript available to generate report.")

    if not generate_clinical_report_ai:
        raise HTTPException(status_code=500, detail="Clinical AI generation service unavailable.")

    try:
        report = await generate_clinical_report_ai(
            raw_transcript,
            payload.patient_name or "Patient",
            payload.doctor_name or "Doctor"
        )
        report["status"] = "draft"
        report["doctor_id"] = payload.doctor_id
        report["patient_id"] = payload.patient_id
        report["room_id"] = payload.room_id or ""
        report["transcription_id"] = payload.transcript_id or ""

        now_iso = datetime.now(timezone.utc).isoformat()
        report["created_at"] = now_iso

        # Save draft into patient_details
        created_report_id = None
        try:
            # 1. Try insert with extended columns
            draft_payload = {
                "patient_id": payload.patient_id,
                "doctor_id": payload.doctor_id,
                "room_id": payload.room_id,
                "transcription_id": payload.transcript_id,
                "summary": report.get("summary", ""),
                "structured_diagnosis": report,
                "status": "draft",
                "consultation_date": now_iso,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            ins = supabase.table("patient_details").insert(draft_payload).execute()
            if ins.data and len(ins.data) > 0:
                created_report_id = ins.data[0].get("id")
        except Exception:
            # 2. Fall back to base columns if extended columns not present
            try:
                base_payload = {
                    "patient_id": payload.patient_id,
                    "summary": report.get("summary", ""),
                    "structured_diagnosis": report,
                    "consultation_date": now_iso,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }
                ins = supabase.table("patient_details").insert(base_payload).execute()
                if ins.data and len(ins.data) > 0:
                    created_report_id = ins.data[0].get("id")
            except Exception as ins_err:
                print(f"[Generate Report] Warning saving draft to patient_details: {ins_err}")

        # Link draft to transcriptions table
        if payload.transcript_id:
            try:
                supabase.table("transcriptions").update({
                    "icd_codes": report.get("icd_10_codes"),
                    "updated_at": now_iso,
                }).eq("id", payload.transcript_id).execute()
            except Exception:
                pass

        report["id"] = created_report_id or f"draft_{int(datetime.now().timestamp())}"
        return {
            "status": "draft",
            "report_id": report["id"],
            "report": report
        }

    except Exception as e:
        print(f"[Generate Report] AI Generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/consultations/approve-report")
def approve_clinical_report_endpoint(payload: ApproveReportRequest):
    """
    Phase 4: Doctor Review & Sign-Off.
    Transitions an AI-generated draft report into a finalized, approved clinical record.
    Persists to patient_details, transcriptions (icd_codes), and patients longitudinal summary.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database client not initialized.")

    now_iso = datetime.now(timezone.utc).isoformat()

    full_approved_doc = {
        "status": "approved",
        "doctor_id": payload.doctor_id,
        "patient_id": payload.patient_id,
        "doctor_name": payload.doctor_name,
        "patient_name": payload.patient_name,
        "room_id": payload.room_id,
        "transcription_id": payload.transcription_id,
        "summary": payload.summary,
        "soap": payload.soap,
        "symptoms": payload.symptoms,
        "diagnosis_suggestions": payload.diagnosis_suggestions,
        "icd_10_codes": payload.icd_10_codes,
        "treatment_plan": payload.treatment_plan,
        "doctor_notes": payload.doctor_notes or "",
        "approved_at": now_iso,
        "updated_at": now_iso,
        "chief_complaint": payload.chief_complaint or "",
        "history_of_present_illness": payload.history_of_present_illness or "",
        "past_medical_history": payload.past_medical_history or {},
        "review_of_systems": payload.review_of_systems or {},
        "vital_signs": payload.vital_signs or {},
        "physical_examination": payload.physical_examination or "",
        "assessment_and_impression": payload.assessment_and_impression or "",
        "differential_diagnoses": payload.differential_diagnoses or [],
        "consultation_outcome": payload.consultation_outcome or "",
        "source_disclosure": payload.source_disclosure or "",
        "clinic_name": payload.clinic_name or "DiagnoAssist Telehealth & Hospital Clinical Services",
        "document_title": payload.document_title or "ELECTRONIC MEDICAL RECORD (EMR) — CLINICAL ENCOUNTER SUMMARY",
        "document_id": payload.document_id or f"EMR-{payload.room_id or 'REC'}",
        "encounter_type": payload.encounter_type or "Synchronous Telehealth Video Consultation",
    }

    report_id = payload.report_id

    # 1. Update / Insert into patient_details
    try:
        updated = False
        if report_id and not report_id.startswith("draft_"):
            try:
                upd = (
                    supabase.table("patient_details")
                    .update({
                        "summary": payload.summary,
                        "structured_diagnosis": full_approved_doc,
                        "updated_at": now_iso,
                    })
                    .eq("id", report_id)
                    .execute()
                )
                if upd.data and len(upd.data) > 0:
                    updated = True
            except Exception:
                pass

        if not updated:
            # Insert approved record
            try:
                ins = supabase.table("patient_details").insert({
                    "patient_id": payload.patient_id,
                    "doctor_id": payload.doctor_id,
                    "room_id": payload.room_id,
                    "transcription_id": payload.transcription_id,
                    "summary": payload.summary,
                    "structured_diagnosis": full_approved_doc,
                    "status": "approved",
                    "consultation_date": now_iso,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }).execute()
                if ins.data and len(ins.data) > 0:
                    report_id = ins.data[0]["id"]
            except Exception:
                # Fallback to base schema
                ins = supabase.table("patient_details").insert({
                    "patient_id": payload.patient_id,
                    "summary": payload.summary,
                    "structured_diagnosis": full_approved_doc,
                    "consultation_date": now_iso,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }).execute()
                if ins.data and len(ins.data) > 0:
                    report_id = ins.data[0]["id"]
    except Exception as e:
        print(f"[Approve Report] Error updating patient_details: {e}")

    # 2. Update transcriptions with approved ICD-10 codes & metadata
    try:
        t_query = supabase.table("transcriptions").update({
            "icd_codes": payload.icd_10_codes,
            "updated_at": now_iso,
        })
        if payload.transcription_id:
            t_query.eq("id", payload.transcription_id).execute()
        elif payload.room_id:
            t_query.eq("doctor_id", payload.doctor_id).eq("patient_id", payload.patient_id).execute()
    except Exception as te:
        print(f"[Approve Report] Warning updating transcriptions: {te}")

    # 3. Update patients table longitudinal summary if present
    try:
        supabase.table("patients").update({
            "summary": payload.summary,
            "structured_diagnosis": {
                "latest_soap": payload.soap,
                "diagnoses": payload.diagnosis_suggestions,
                "treatment_plan": payload.treatment_plan,
                "approved_at": now_iso,
            },
            "updated_at": now_iso,
        }).eq("user_profile_id", payload.patient_id).execute()
    except Exception:
        pass

    return {
        "status": "approved",
        "report_id": report_id,
        "approved_at": now_iso,
        "message": "Clinical report reviewed, approved, and persisted to EMR records."
    }


@app.get("/consultations/reports")
def get_consultation_reports(
    user_id: str,
    role: str = "doctor",
    room_id: Optional[str] = None
):
    """
    Phase 4: Fetch clinical reports for a user.
    - Doctors can view drafts and approved reports.
    - Patients can only view finalized/approved reports.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database client not initialized.")

    try:
        # Fetch from patient_details
        query = supabase.table("patient_details").select("*")
        if role == "patient":
            query = query.eq("patient_id", user_id)
        query = query.order("created_at", desc=True)

        res = query.execute()
        raw_rows = res.data or []

        results = []
        for row in raw_rows:
            sd = row.get("structured_diagnosis") or {}
            # Verify status and role permissions
            row_status = sd.get("status") or row.get("status") or "approved"
            row_doctor_id = sd.get("doctor_id") or row.get("doctor_id")
            row_room_id = sd.get("room_id") or row.get("room_id")

            # Doctor access check: if filtering for doctor, ensure doctor_id matches
            if role == "doctor" and row_doctor_id and row_doctor_id != user_id:
                continue

            # Patient access check: patients only see approved reports
            if role == "patient" and row_status != "approved":
                continue

            if room_id and row_room_id and row_room_id != room_id:
                continue

            results.append({
                "id": row.get("id"),
                "patient_id": row.get("patient_id"),
                "doctor_id": row_doctor_id,
                "doctor_name": sd.get("doctor_name"),
                "patient_name": sd.get("patient_name"),
                "room_id": row_room_id,
                "status": row_status,
                "summary": row.get("summary") or sd.get("summary", ""),
                "soap": sd.get("soap", {}),
                "symptoms": sd.get("symptoms", []),
                "diagnosis_suggestions": sd.get("diagnosis_suggestions", []),
                "icd_10_codes": sd.get("icd_10_codes", []),
                "treatment_plan": sd.get("treatment_plan", {}),
                "doctor_notes": sd.get("doctor_notes", ""),
                "approved_at": sd.get("approved_at"),
                "consultation_date": row.get("consultation_date"),
                "created_at": row.get("created_at"),
                "chief_complaint": sd.get("chief_complaint", ""),
                "history_of_present_illness": sd.get("history_of_present_illness", ""),
                "past_medical_history": sd.get("past_medical_history", {}),
                "review_of_systems": sd.get("review_of_systems", {}),
                "vital_signs": sd.get("vital_signs", {}),
                "physical_examination": sd.get("physical_examination", ""),
                "assessment_and_impression": sd.get("assessment_and_impression", ""),
                "differential_diagnoses": sd.get("differential_diagnoses", []),
                "consultation_outcome": sd.get("consultation_outcome", ""),
                "source_disclosure": sd.get("source_disclosure", ""),
                "clinic_name": sd.get("clinic_name", "DiagnoAssist Telehealth & Hospital Clinical Services"),
                "document_title": sd.get("document_title", "ELECTRONIC MEDICAL RECORD (EMR) — CLINICAL ENCOUNTER SUMMARY"),
                "document_id": sd.get("document_id", f"EMR-{row_room_id or row.get('id')}"),
                "encounter_type": sd.get("encounter_type", "Synchronous Telehealth Video Consultation"),
            })

        return results
    except Exception as e:
        print(f"Error fetching clinical reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/transcribe")
async def transcribe_audio(websocket: WebSocket, lang: str = "en-IN"):
    """
    WebSocket endpoint for real-time speech-to-text.
    Proxies 16kHz PCM audio stream from frontend to Gnani AI Prisma STT.
    Supports languages: en-IN, hi-IN, mr-IN.
    """
    await websocket.accept()
    print(f"WebSocket client connected with language: {lang}")

    selected_lang = lang if lang in SUPPORTED_LANGUAGES else "en-IN"

    if not GNANI_API_KEY:
        print("Error: GNANI_API_KEY is not configured")
        await websocket.send_json({
            "type": "error",
            "message": "GNANI_API_KEY is not configured in backend/.env"
        })
        await websocket.close(code=1008)
        return

    headers = {
        "x-api-key-id": GNANI_API_KEY,
        "language_code": selected_lang,
        "model": GNANI_MODEL,
    }

    try:
        async with websockets.connect(GNANI_STT_URL, additional_headers=headers) as gnani_ws:
            # Await initial confirmation from Gnani VAD/STT server
            try:
                init_raw = await asyncio.wait_for(gnani_ws.recv(), timeout=8.0)
                init_msg = json.loads(init_raw)
                print(f"Gnani service connected successfully (type: {init_msg.get('type')})")
                await websocket.send_json({
                    "type": "connected",
                    "language": selected_lang,
                    "message": "Connected to Gnani STT service",
                    "status": "ready"
                })
            except Exception as e:
                print(f"Failed to receive Gnani handshake: {e}")
                await websocket.send_json({
                    "type": "error",
                    "message": "Failed to initialize Gnani STT stream."
                })
                await websocket.close(code=1011)
                return

            accumulated_transcripts: list[str] = []
            stop_requested = asyncio.Event()

            async def forward_frontend_to_gnani():
                """Reads PCM audio or control frames from frontend and forwards to Gnani."""
                try:
                    while not stop_requested.is_set():
                        message = await websocket.receive()
                        if "bytes" in message and message["bytes"]:
                            data = message["bytes"]
                            # Forward raw PCM binary chunk directly to Gnani
                            await gnani_ws.send(data)
                        elif "text" in message and message["text"]:
                            try:
                                control = json.loads(message["text"])
                                if control.get("action") == "stop":
                                    print("Received stop action from frontend")
                                    # Send ~800ms of trailing silence to trigger Gnani VAD segment completion
                                    silence = b"\x00" * 1024
                                    for _ in range(25):
                                        await gnani_ws.send(silence)
                                        await asyncio.sleep(0.032)
                                    stop_requested.set()
                                    break
                            except json.JSONDecodeError:
                                pass
                except WebSocketDisconnect:
                    print("Frontend WebSocket disconnected")
                    stop_requested.set()
                except Exception as e:
                    print(f"Error forwarding audio to Gnani: {e}")
                    stop_requested.set()

            async def forward_gnani_to_frontend():
                """Reads transcription and status events from Gnani and forwards to frontend."""
                try:
                    while not stop_requested.is_set():
                        try:
                            gnani_raw = await asyncio.wait_for(gnani_ws.recv(), timeout=0.5)
                        except asyncio.TimeoutError:
                            continue

                        data = json.loads(gnani_raw)
                        event_type = data.get("type")

                        if event_type == "speech_start":
                            await websocket.send_json({
                                "type": "speech_start",
                                "message": "Speech detected..."
                            })

                        elif event_type == "processing":
                            await websocket.send_json({
                                "type": "processing",
                                "message": "Processing..."
                            })

                        elif event_type == "transcript":
                            segment_text = data.get("text", "").strip()
                            if segment_text:
                                accumulated_transcripts.append(segment_text)
                                print(f"Gnani transcript [{selected_lang}]: {segment_text}")
                                await websocket.send_json({
                                    "type": "transcript",
                                    "transcript": segment_text,
                                    "is_final": True,
                                    "language": data.get("detected_language_code", selected_lang)
                                })

                        elif event_type == "error":
                            err_msg = data.get("message", "Gnani STT error")
                            print(f"Gnani error: {err_msg}")
                            await websocket.send_json({
                                "type": "error",
                                "message": err_msg
                            })

                except Exception as e:
                    if not stop_requested.is_set():
                        print(f"Error reading from Gnani: {e}")

            # Run forwarders concurrently
            sender_task = asyncio.create_task(forward_frontend_to_gnani())
            receiver_task = asyncio.create_task(forward_gnani_to_frontend())

            await sender_task

            # Grace period to collect in-flight final segment from Gnani
            try:
                drain_deadline = asyncio.get_event_loop().time() + 2.5
                while asyncio.get_event_loop().time() < drain_deadline:
                    remaining = drain_deadline - asyncio.get_event_loop().time()
                    if remaining <= 0:
                        break
                    try:
                        gnani_raw = await asyncio.wait_for(gnani_ws.recv(), timeout=min(remaining, 1.0))
                        data = json.loads(gnani_raw)
                        if data.get("type") == "transcript":
                            segment_text = data.get("text", "").strip()
                            if segment_text:
                                accumulated_transcripts.append(segment_text)
                                await websocket.send_json({
                                    "type": "transcript",
                                    "transcript": segment_text,
                                    "is_final": True
                                })
                                break
                    except asyncio.TimeoutError:
                        continue
            except Exception:
                pass

            stop_requested.set()
            receiver_task.cancel()

            # Send complete accumulated transcript
            final_text = " ".join(accumulated_transcripts).strip()
            try:
                await websocket.send_json({
                    "type": "complete",
                    "complete": True,
                    "transcript": final_text,
                    "is_final": True
                })
            except Exception:
                pass

    except websockets.exceptions.InvalidStatus as e:
        print(f"Gnani authentication / connection error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": f"Gnani authentication error: {e}"
            })
            await websocket.close(code=1008)
        except Exception:
            pass

    except Exception as e:
        print(f"Gnani STT session error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": f"STT session error: {str(e)}"
            })
            await websocket.close(code=1011)
        except Exception:
            pass
