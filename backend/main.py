import os
import asyncio
import json
from datetime import datetime, timezone
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import websockets

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
