# Gnani AI Prisma Speech-to-Text Setup & Usage Guide

This project integrates **Gnani AI Prisma Speech-to-Text (STT v3)** for clinical voice documentation and transcription across Indian languages and English.

---

## 1. Prerequisites & Environment Setup

### Backend Setup

1. **Install Dependencies:**
   Ensure you have installed the required Python packages in `backend/requirements.txt`:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Configure Environment Variables:**
   Copy `backend/.env.example` to `backend/.env` (if not already present):
   ```bash
   cp .env.example .env
   ```
   Add your Gnani AI credentials in `backend/.env`:
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SERVICE_KEY=your-supabase-service-role-key

   # Gnani AI Prisma STT Configuration
   GNANI_API_KEY=your-gnani-api-key-here
   GNANI_STT_URL=wss://api.vachana.ai/stt/v3/stream
   GNANI_MODEL=prisma-v3.0
   ```

3. **Start the FastAPI Backend:**
   ```bash
   cd backend
   python -m uvicorn main:app --reload --port 8000
   ```

---

## 2. Frontend Setup

1. **Start the Next.js Development Server:**
   ```bash
   cd frontend
   npm run dev
   ```
2. Open your browser at `http://localhost:3000`.

---

## 3. Supported Languages

DiagnoAssist currently supports three primary languages via Gnani Prisma v3:
- **English (India):** `en-IN`
- **Hindi (India):** `hi-IN`
- **Marathi (India):** `mr-IN`

Users can toggle their preferred clinical documentation language directly from the **Spoken Language** dropdown in the Live Interaction panel before starting a recording.

---

## 4. Architecture & Audio Streaming Flow

1. **Microphone Capture:** The frontend `VoicePanel` requests browser microphone access via Web Audio API.
2. **Audio Format:**
   - **Sample Rate:** 16,000 Hz (16 kHz)
   - **Channels:** Single channel (Mono)
   - **Bit Depth:** 16-bit signed PCM, little-endian (`pcm_s16le`)
   - **Chunk Size:** 4,096 samples per frame (~8,192 bytes, ~256 ms duration)
3. **Secure WebSocket Proxy:**
   - The browser opens a WebSocket connection to `ws://localhost:8000/ws/transcribe?lang=<selected_language>`.
   - The FastAPI backend authenticates with Gnani AI using the `x-api-key-id` header and opens an upstream connection to `wss://api.vachana.ai/stt/v3/stream`.
   - Your Gnani API key is kept secure on the backend and is never exposed to browser clients.
4. **Real-Time Transcription:**
   - As audio chunks are forwarded, Gnani's Voice Activity Detection (VAD) emits speech events.
   - When a speech segment concludes, Gnani returns a finalized transcript with `type: "transcript"`.
   - The backend proxies transcripts to the frontend in real time.
5. **Graceful Teardown:**
   - When the user clicks "Stop", the frontend sends an `{"action": "stop"}` control frame over the WebSocket.
   - The backend flushes remaining audio, awaits the final transcript confirmation, and safely closes the session.

---

## 5. End-to-End Verification Test

To verify the integration with a microphone:
1. Navigate to the consultation screen (`/doctor/consultation` or `/patient/consultation`).
2. Select your spoken language (English, Hindi, or Marathi).
3. Click the red microphone button.
4. Speak your clinical notes or patient symptoms.
5. Click the stop button. The final confirmed transcript will appear in the transcription box.
