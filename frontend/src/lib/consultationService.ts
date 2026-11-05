import { createClient } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface DoctorProfile {
    id: string;
    name: string;
    role: string;
    is_online: boolean;
    last_seen: string | null;
    specialization?: string;
    experience?: string;
    avatar_url?: string;
    email?: string;
}

export type RequestStatus = "pending" | "accepted" | "rejected" | "expired" | "cancelled";

export interface ConsultationRequest {
    id: string;
    patient_id: string;
    doctor_id: string;
    patient_name: string;
    doctor_name?: string;
    reason: string;
    status: RequestStatus;
    room_id: string;
    created_at: string;
    ended_at?: string | null;
}

// Active singleton channels to prevent duplicate listeners
let doctorChannel: RealtimeChannel | null = null;
let patientChannel: RealtimeChannel | null = null;
let presenceChannel: RealtimeChannel | null = null;

// Table detection cache: remembers if consultation_requests table exists
let prefersConsultationRequestsTable: boolean | null = null;

/**
 * Helper to encode/decode reason inside room_id for backward compatibility
 * when using video_calls table
 */
function packRoomPayload(roomId: string, reason: string, patientName?: string): string {
    return JSON.stringify({
        room: roomId,
        reason: reason || "General Medical Consultation",
        patient_name: patientName || "Patient",
    });
}

function unpackRoomPayload(rawRoom: string): { roomId: string; reason: string; patientName: string } {
    if (!rawRoom) {
        return { roomId: "room_general", reason: "General Medical Consultation", patientName: "Patient" };
    }
    try {
        if (rawRoom.startsWith("{") && rawRoom.endsWith("}")) {
            const parsed = JSON.parse(rawRoom);
            return {
                roomId: parsed.room || rawRoom,
                reason: parsed.reason || "General Medical Consultation",
                patientName: parsed.patient_name || "Patient",
            };
        }
    } catch {
        // Fallback for raw text
    }
    return { roomId: rawRoom, reason: "General Medical Consultation", patientName: "Patient" };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DOCTOR AVAILABILITY & PRESENCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Updates the user's presence record in `user_presence`.
 * Broadcasts the change to the `doctor-presence` Realtime channel.
 */
export async function updateDoctorPresence(userId: string, isOnline: boolean): Promise<void> {
    const supabase = createClient();
    const timestamp = new Date().toISOString();

    try {
        const { error } = await supabase
            .from("user_presence")
            .upsert({
                user_id: userId,
                is_online: isOnline,
                last_seen: timestamp,
            });

        if (error) {
            console.warn("Could not upsert user_presence table:", error.message);
        }

        // Broadcast to Realtime channel
        await broadcastPresenceChange(userId, isOnline, timestamp);
    } catch (err) {
        console.error("Error in updateDoctorPresence:", err);
    }
}

/**
 * Fetches all registered doctors with their real-time presence status.
 * Doctors with a last_seen older than 90 seconds are considered offline (stale heartbeat).
 */
export async function getRegisteredDoctors(): Promise<DoctorProfile[]> {
    const supabase = createClient();

    // 1. Query all users with role 'doctor'
    const { data: profiles, error: profileErr } = await supabase
        .from("user_profiles")
        .select("id, name, role, created_at")
        .eq("role", "doctor");

    if (profileErr) {
        console.error("Error fetching doctor profiles:", profileErr);
        return [];
    }

    if (!profiles || profiles.length === 0) {
        return [];
    }

    // 2. Query user_presence table
    const { data: presenceData, error: presenceErr } = await supabase
        .from("user_presence")
        .select("user_id, is_online, last_seen");

    if (presenceErr) {
        console.warn("Error fetching presence data:", presenceErr);
    }

    const presenceMap = new Map<string, { is_online: boolean; last_seen: string | null }>();
    if (presenceData) {
        for (const p of presenceData) {
            presenceMap.set(p.user_id, {
                is_online: Boolean(p.is_online),
                last_seen: p.last_seen || null,
            });
        }
    }

    const now = Date.now();
    const STALE_HEARTBEAT_THRESHOLD_MS = 90 * 1000; // 90 seconds

    // 3. Map into DoctorProfile with realistic clinical specializations
    const specializations = [
        "General Medicine",
        "Cardiology",
        "Neurology",
        "Internal Medicine",
        "Pediatrics",
    ];

    return profiles.map((doc, idx) => {
        const presence = presenceMap.get(doc.id);
        let isOnline = false;

        if (presence && presence.is_online && presence.last_seen) {
            const lastSeenTime = new Date(presence.last_seen).getTime();
            // Stale check
            if (now - lastSeenTime <= STALE_HEARTBEAT_THRESHOLD_MS) {
                isOnline = true;
            }
        }

        return {
            id: doc.id,
            name: doc.name || "Dr. Physician",
            role: "doctor",
            is_online: isOnline,
            last_seen: presence?.last_seen || null,
            specialization: specializations[idx % specializations.length],
            experience: `${5 + (idx * 2)} years exp.`,
            avatar_url: undefined,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CONSULTATION REQUEST MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new consultation request.
 * Prevents duplicate active requests from the same patient.
 */
export async function createConsultationRequest(
    patientId: string,
    doctorId: string,
    reason: string,
    patientName: string
): Promise<ConsultationRequest> {
    const supabase = createClient();

    // Check for existing pending request from this patient
    const existing = await getPatientActiveRequest(patientId);
    if (existing && existing.status === "pending") {
        throw new Error("You already have an active request pending with a doctor. Please wait or cancel it first.");
    }

    const uniqueRoomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    // 1. Try consultation_requests table first if not ruled out
    if (prefersConsultationRequestsTable !== false) {
        try {
            const { data, error } = await supabase
                .from("consultation_requests")
                .insert({
                    patient_id: patientId,
                    doctor_id: doctorId,
                    reason: reason.trim(),
                    patient_name: patientName,
                    status: "pending",
                    room_id: uniqueRoomId,
                })
                .select()
                .single();

            if (!error && data) {
                prefersConsultationRequestsTable = true;
                const created: ConsultationRequest = {
                    id: data.id,
                    patient_id: data.patient_id,
                    doctor_id: data.doctor_id,
                    patient_name: data.patient_name || patientName,
                    reason: data.reason,
                    status: data.status as RequestStatus,
                    room_id: data.room_id,
                    created_at: data.created_at,
                };
                // Broadcast to doctor
                await broadcastConsultationRequest(doctorId, created);
                return created;
            }
            if (error && error.code === "PGRST205") {
                // Table doesn't exist, fall back to video_calls
                prefersConsultationRequestsTable = false;
            }
        } catch {
            prefersConsultationRequestsTable = false;
        }
    }

    // 2. Fall back to video_calls table
    const roomPayload = packRoomPayload(uniqueRoomId, reason.trim(), patientName);
    const { data: vcData, error: vcError } = await supabase
        .from("video_calls")
        .insert({
            patient_id: patientId,
            doctor_id: doctorId,
            room_id: roomPayload,
            status: "pending",
        })
        .select()
        .single();

    if (vcError || !vcData) {
        throw new Error(vcError?.message || "Failed to create consultation request.");
    }

    const createdReq: ConsultationRequest = {
        id: vcData.id,
        patient_id: vcData.patient_id,
        doctor_id: vcData.doctor_id,
        patient_name: patientName,
        reason: reason.trim(),
        status: "pending",
        room_id: uniqueRoomId,
        created_at: vcData.created_at || nowIso,
    };

    // Broadcast event to doctor
    await broadcastConsultationRequest(doctorId, createdReq);

    return createdReq;
}

/**
 * Gets the current active request for a patient (pending or accepted).
 */
export async function getPatientActiveRequest(patientId: string): Promise<ConsultationRequest | null> {
    const supabase = createClient();

    // Try consultation_requests
    if (prefersConsultationRequestsTable !== false) {
        try {
            const { data, error } = await supabase
                .from("consultation_requests")
                .select("*")
                .eq("patient_id", patientId)
                .in("status", ["pending", "accepted"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!error && data) {
                prefersConsultationRequestsTable = true;
                return {
                    id: data.id,
                    patient_id: data.patient_id,
                    doctor_id: data.doctor_id,
                    patient_name: data.patient_name || "Patient",
                    reason: data.reason,
                    status: data.status as RequestStatus,
                    room_id: data.room_id,
                    created_at: data.created_at,
                };
            }
        } catch {
            // fall back
        }
    }

    // Fall back to video_calls
    const { data: vcData, error: vcErr } = await supabase
        .from("video_calls")
        .select("*")
        .eq("patient_id", patientId)
        .in("status", ["pending", "accepted"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (vcErr || !vcData) {
        return null;
    }

    const unpacked = unpackRoomPayload(vcData.room_id);
    return {
        id: vcData.id,
        patient_id: vcData.patient_id,
        doctor_id: vcData.doctor_id,
        patient_name: unpacked.patientName,
        reason: unpacked.reason,
        status: vcData.status as RequestStatus,
        room_id: unpacked.roomId,
        created_at: vcData.created_at,
    };
}

/**
 * Fetches all pending consultation requests assigned to a doctor.
 */
export async function getDoctorPendingRequests(doctorId: string): Promise<ConsultationRequest[]> {
    const supabase = createClient();

    if (prefersConsultationRequestsTable !== false) {
        try {
            const { data, error } = await supabase
                .from("consultation_requests")
                .select("*")
                .eq("doctor_id", doctorId)
                .eq("status", "pending")
                .order("created_at", { ascending: false });

            if (!error && data) {
                prefersConsultationRequestsTable = true;
                return data.map((d) => ({
                    id: d.id,
                    patient_id: d.patient_id,
                    doctor_id: d.doctor_id,
                    patient_name: d.patient_name || "Patient",
                    reason: d.reason,
                    status: d.status as RequestStatus,
                    room_id: d.room_id,
                    created_at: d.created_at,
                }));
            }
        } catch {
            // fall back
        }
    }

    const { data: vcData, error: vcErr } = await supabase
        .from("video_calls")
        .select("*")
        .eq("doctor_id", doctorId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

    if (vcErr || !vcData) {
        return [];
    }

    return vcData.map((vc) => {
        const unpacked = unpackRoomPayload(vc.room_id);
        return {
            id: vc.id,
            patient_id: vc.patient_id,
            doctor_id: vc.doctor_id,
            patient_name: unpacked.patientName,
            reason: unpacked.reason,
            status: "pending",
            room_id: unpacked.roomId,
            created_at: vc.created_at,
        };
    });
}

/**
 * Doctor responds to a consultation request (Accept or Reject).
 * Atomic operation: updates DB where id = requestId AND status = 'pending'.
 */
export async function respondToConsultationRequest(
    requestId: string,
    doctorId: string,
    patientId: string,
    accept: boolean,
    doctorName?: string
): Promise<boolean> {
    const supabase = createClient();
    const newStatus: RequestStatus = accept ? "accepted" : "rejected";
    let updated = false;
    let finalRoomId = `room_${requestId}`;

    if (prefersConsultationRequestsTable !== false) {
        try {
            const { data, error } = await supabase
                .from("consultation_requests")
                .update({
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", requestId)
                .eq("status", "pending")
                .select()
                .maybeSingle();

            if (!error && data) {
                updated = true;
                finalRoomId = data.room_id;
            }
        } catch {
            // fall back
        }
    }

    if (!updated) {
        const { data: vcData, error: vcErr } = await supabase
            .from("video_calls")
            .update({ status: newStatus })
            .eq("id", requestId)
            .eq("status", "pending")
            .select()
            .maybeSingle();

        if (!vcErr && vcData) {
            updated = true;
            finalRoomId = unpackRoomPayload(vcData.room_id).roomId;
        }
    }

    if (!updated) {
        console.warn(`Request ${requestId} was not in pending state or could not be updated.`);
        return false;
    }

    // Broadcast response to patient channel
    await broadcastConsultationResponse(patientId, {
        request_id: requestId,
        doctor_id: doctorId,
        doctor_name: doctorName || "Your Doctor",
        status: newStatus,
        room_id: finalRoomId,
        timestamp: new Date().toISOString(),
    });

    return true;
}

/**
 * Patient cancels their pending consultation request.
 */
export async function cancelConsultationRequest(requestId: string, patientId: string, doctorId: string): Promise<boolean> {
    const supabase = createClient();
    let updated = false;

    if (prefersConsultationRequestsTable !== false) {
        try {
            const { data, error } = await supabase
                .from("consultation_requests")
                .update({ status: "cancelled", updated_at: new Date().toISOString() })
                .eq("id", requestId)
                .eq("patient_id", patientId)
                .eq("status", "pending")
                .select()
                .maybeSingle();

            if (!error && data) updated = true;
        } catch {
            // fall back
        }
    }

    if (!updated) {
        const { data: vcData, error: vcErr } = await supabase
            .from("video_calls")
            .update({ status: "cancelled" })
            .eq("id", requestId)
            .eq("patient_id", patientId)
            .eq("status", "pending")
            .select()
            .maybeSingle();

        if (!vcErr && vcData) updated = true;
    }

    // Broadcast cancellation to doctor channel
    await broadcastRequestCancellation(doctorId, requestId);
    return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. REALTIME BROADCAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribes a doctor to incoming consultation requests in real time.
 */
export function subscribeToDoctorRequests(
    doctorId: string,
    onRequest: (req: ConsultationRequest) => void,
    onCancel?: (requestId: string) => void
): () => void {
    const supabase = createClient();
    const channelName = `consultation:doctor:${doctorId}`;

    if (doctorChannel) {
        doctorChannel.unsubscribe();
        doctorChannel = null;
    }

    const channel = supabase.channel(channelName);
    doctorChannel = channel;

    channel
        .on("broadcast", { event: "new_consultation_request" }, (payload) => {
            console.log("Doctor received new consultation request broadcast:", payload);
            if (payload?.payload) {
                onRequest(payload.payload as ConsultationRequest);
            }
        })
        .on("broadcast", { event: "request_cancelled" }, (payload) => {
            console.log("Doctor received request cancellation:", payload);
            if (payload?.payload?.request_id && onCancel) {
                onCancel(payload.payload.request_id);
            }
        })
        .subscribe((status) => {
            console.log(`Doctor channel [${channelName}] status:`, status);
        });

    return () => {
        channel.unsubscribe();
        if (doctorChannel === channel) doctorChannel = null;
    };
}

/**
 * Subscribes a patient to doctor acceptance/rejection updates in real time.
 */
export function subscribeToPatientUpdates(
    patientId: string,
    onResponse: (response: {
        request_id: string;
        doctor_id: string;
        doctor_name: string;
        status: RequestStatus;
        room_id: string;
        timestamp: string;
    }) => void
): () => void {
    const supabase = createClient();
    const channelName = `consultation:patient:${patientId}`;

    if (patientChannel) {
        patientChannel.unsubscribe();
        patientChannel = null;
    }

    const channel = supabase.channel(channelName);
    patientChannel = channel;

    channel
        .on("broadcast", { event: "consultation_response" }, (payload) => {
            console.log("Patient received consultation response broadcast:", payload);
            if (payload?.payload) {
                onResponse(payload.payload);
            }
        })
        .subscribe((status) => {
            console.log(`Patient channel [${channelName}] status:`, status);
        });

    return () => {
        channel.unsubscribe();
        if (patientChannel === channel) patientChannel = null;
    };
}

/**
 * Subscribes to global doctor presence updates so patients see live status toggles.
 */
export function subscribeToPresenceUpdates(
    onPresenceChange: (presence: { doctor_id: string; is_online: boolean; last_seen: string }) => void
): () => void {
    const supabase = createClient();
    const channelName = "doctor-presence";

    if (!presenceChannel) {
        presenceChannel = supabase.channel(channelName);
        presenceChannel
            .on("broadcast", { event: "presence_change" }, (payload) => {
                if (payload?.payload) {
                    onPresenceChange(payload.payload);
                }
            })
            .subscribe((status) => {
                console.log(`Presence channel status:`, status);
            });
    } else {
        presenceChannel.on("broadcast", { event: "presence_change" }, (payload) => {
            if (payload?.payload) {
                onPresenceChange(payload.payload);
            }
        });
    }

    return () => {
        // Keep channel alive for other listeners or unsubscribe if needed
    };
}

/**
 * Broadcast helper: sends new consultation request to doctor
 */
async function broadcastConsultationRequest(doctorId: string, request: ConsultationRequest): Promise<void> {
    const supabase = createClient();
    const channelName = `consultation:doctor:${doctorId}`;
    const channel = supabase.channel(channelName);

    await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
            await channel.send({
                type: "broadcast",
                event: "new_consultation_request",
                payload: request,
            });
            setTimeout(() => channel.unsubscribe(), 2000);
        }
    });
}

/**
 * Broadcast helper: sends accept/reject response to patient
 */
async function broadcastConsultationResponse(
    patientId: string,
    payload: {
        request_id: string;
        doctor_id: string;
        doctor_name: string;
        status: RequestStatus;
        room_id: string;
        timestamp: string;
    }
): Promise<void> {
    const supabase = createClient();
    const channelName = `consultation:patient:${patientId}`;
    const channel = supabase.channel(channelName);

    await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
            await channel.send({
                type: "broadcast",
                event: "consultation_response",
                payload,
            });
            setTimeout(() => channel.unsubscribe(), 2000);
        }
    });
}

/**
 * Broadcast helper: sends cancellation notice to doctor
 */
async function broadcastRequestCancellation(doctorId: string, requestId: string): Promise<void> {
    const supabase = createClient();
    const channelName = `consultation:doctor:${doctorId}`;
    const channel = supabase.channel(channelName);

    await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
            await channel.send({
                type: "broadcast",
                event: "request_cancelled",
                payload: { request_id: requestId },
            });
            setTimeout(() => channel.unsubscribe(), 2000);
        }
    });
}

/**
 * Broadcast helper: sends doctor online/offline presence change to all listening patients
 */
async function broadcastPresenceChange(doctorId: string, isOnline: boolean, lastSeen: string): Promise<void> {
    const supabase = createClient();
    const channel = supabase.channel("doctor-presence");

    await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
            await channel.send({
                type: "broadcast",
                event: "presence_change",
                payload: {
                    doctor_id: doctorId,
                    is_online: isOnline,
                    last_seen: lastSeen,
                },
            });
            setTimeout(() => channel.unsubscribe(), 1500);
        }
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// 4. WEBRTC SIGNALING & ROOM ACCESS (PHASE 2)
// ─────────────────────────────────────────────────────────────────────────────

export interface RoomSignal {
    type: "join" | "ready" | "offer" | "answer" | "ice_candidate" | "call_ended" | "peer_left" | "live_transcript";
    sender_id: string;
    sender_role?: "doctor" | "patient";
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    speaker_name?: string;
    transcript?: string;
    is_final?: boolean;
    timestamp?: string;
    sequence?: number;
}

// Module-level cache for active signaling channels to prevent duplicate subscriptions and premature unsubscriptions
const activeSignalingChannels = new Map<string, RealtimeChannel>();

export interface RoomAccessResult {
    authorized: boolean;
    error?: string;
    callId?: string;
    doctorId?: string;
    patientId?: string;
    doctorName?: string;
    patientName?: string;
    reason?: string;
    status?: string;
}

/**
 * Returns ICE servers configured with public STUN and optional TURN via env
 */
export function getIceServers(): RTCIceServer[] {
    const servers: RTCIceServer[] = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
    ];

    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
    const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
    const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

    if (turnUrl) {
        servers.push({
            urls: turnUrl,
            username: turnUsername,
            credential: turnCredential,
        });
    }

    return servers;
}

/**
 * Verifies that the authenticated user is an assigned participant (doctor or patient)
 * for the requested room_id.
 */
export async function verifyRoomAccess(roomId: string, currentUserId: string): Promise<RoomAccessResult> {
    const supabase = createClient();

    // 1. Check video_calls table
    const { data: calls, error: callErr } = await supabase
        .from("video_calls")
        .select("*")
        .or(`room_id.eq.${roomId},room_id.like.%${roomId}%`)
        .order("created_at", { ascending: false })
        .limit(1);

    if (!callErr && calls && calls.length > 0) {
        const call = calls[0];
        const isDoctor = call.doctor_id === currentUserId;
        const isPatient = call.patient_id === currentUserId;

        if (!isDoctor && !isPatient) {
            return {
                authorized: false,
                error: "Unauthorized: You are not an assigned participant in this consultation room.",
            };
        }

        const unpacked = unpackRoomPayload(call.room_id);

        // Fetch participant names
        const { data: docProfile } = await supabase
            .from("user_profiles")
            .select("name")
            .eq("id", call.doctor_id)
            .maybeSingle();

        const { data: patProfile } = await supabase
            .from("user_profiles")
            .select("name")
            .eq("id", call.patient_id)
            .maybeSingle();

        return {
            authorized: true,
            callId: call.id,
            doctorId: call.doctor_id,
            patientId: call.patient_id,
            doctorName: docProfile?.name || "Doctor",
            patientName: patProfile?.name || unpacked.patientName || "Patient",
            reason: unpacked.reason,
            status: call.status,
        };
    }

    // 2. Check consultation_requests table if present
    try {
        const { data: reqs, error: reqErr } = await supabase
            .from("consultation_requests")
            .select("*")
            .eq("room_id", roomId)
            .order("created_at", { ascending: false })
            .limit(1);

        if (!reqErr && reqs && reqs.length > 0) {
            const req = reqs[0];
            const isDoctor = req.doctor_id === currentUserId;
            const isPatient = req.patient_id === currentUserId;

            if (!isDoctor && !isPatient) {
                return {
                    authorized: false,
                    error: "Unauthorized: You are not an assigned participant in this consultation room.",
                };
            }

            return {
                authorized: true,
                callId: req.id,
                doctorId: req.doctor_id,
                patientId: req.patient_id,
                doctorName: "Doctor",
                patientName: req.patient_name || "Patient",
                reason: req.reason,
                status: req.status,
            };
        }
    } catch {
        // Ignore fallback error
    }

    return {
        authorized: false,
        error: "Consultation room not found or session has expired.",
    };
}

/**
 * Updates call status to 'active' when peers successfully connect
 */
export async function markCallActive(roomId: string): Promise<void> {
    const supabase = createClient();
    try {
        await supabase
            .from("video_calls")
            .update({ status: "active" })
            .or(`room_id.eq.${roomId},room_id.like.%${roomId}%`)
            .in("status", ["pending", "accepted"]);
    } catch (err) {
        console.warn("Could not mark call active in video_calls:", err);
    }
}

/**
 * Updates call status to 'ended' and sets ended_at timestamp
 */
export async function markCallEnded(roomId: string): Promise<void> {
    const supabase = createClient();
    const nowIso = new Date().toISOString();
    try {
        await supabase
            .from("video_calls")
            .update({ status: "ended", ended_at: nowIso })
            .or(`room_id.eq.${roomId},room_id.like.%${roomId}%`);
    } catch (err) {
        console.warn("Could not mark call ended in video_calls:", err);
    }
}

/**
 * Persists a WebRTC signal into the call_signals table (optional fallback/audit log)
 */
export async function recordCallSignal(roomId: string, senderId: string, signalType: string, signalData: any): Promise<void> {
    const supabase = createClient();
    try {
        await supabase.from("call_signals").insert({
            room_id: roomId,
            sender_id: senderId,
            signal_type: signalType,
            signal_data: signalData,
        });
    } catch {
        // Non-blocking
    }
}

/**
 * Subscribes to real-time WebRTC room signaling events via Supabase Realtime Broadcast.
 * Manages channel singleton to prevent duplicate subscriptions and premature tears.
 */
export function subscribeToRoomSignaling(
    roomId: string,
    onSignal: (signal: RoomSignal) => void
): { channel: RealtimeChannel; unsubscribe: () => void } {
    const supabase = createClient();
    const channelName = `room-signaling:${roomId}`;

    // Re-use existing active channel if already present
    let channel = activeSignalingChannels.get(roomId);
    if (!channel) {
        channel = supabase.channel(channelName);
        activeSignalingChannels.set(roomId, channel);
    }

    channel.on("broadcast", { event: "webrtc_signal" }, (payload) => {
        if (payload?.payload) {
            onSignal(payload.payload as RoomSignal);
        }
    });

    channel.subscribe((status) => {
        console.log(`[Signaling] Room channel [${channelName}] status:`, status);
    });

    return {
        channel,
        unsubscribe: () => {
            activeSignalingChannels.delete(roomId);
            channel.unsubscribe();
        },
    };
}

/**
 * Broadcasts a WebRTC signal (join, ready, offer, answer, ice_candidate, call_ended, live_transcript) to the room.
 * Uses cached channel if available or creates persistent room channel without destructive timeouts.
 */
export async function broadcastRoomSignal(
    channelOrRoomId: RealtimeChannel | string,
    signal: RoomSignal
): Promise<void> {
    try {
        if (typeof channelOrRoomId === "string") {
            const roomId = channelOrRoomId;
            let channel = activeSignalingChannels.get(roomId);
            if (!channel) {
                const supabase = createClient();
                const channelName = `room-signaling:${roomId}`;
                channel = supabase.channel(channelName);
                activeSignalingChannels.set(roomId, channel);
            }

            if (channel.state === "joined" || (channel as any).joinedOnce) {
                await channel.send({
                    type: "broadcast",
                    event: "webrtc_signal",
                    payload: signal,
                });
            } else {
                await new Promise<void>((resolve) => {
                    channel!.subscribe(async (status) => {
                        if (status === "SUBSCRIBED") {
                            await channel!.send({
                                type: "broadcast",
                                event: "webrtc_signal",
                                payload: signal,
                            });
                            resolve();
                        }
                    });
                });
            }
        } else {
            await channelOrRoomId.send({
                type: "broadcast",
                event: "webrtc_signal",
                payload: signal,
            });
        }
    } catch (err) {
        console.warn("[Signaling] Broadcast error:", err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. TRANSCRIPTION PERSISTENCE & HISTORY (PHASE 3)
// ─────────────────────────────────────────────────────────────────────────────

export interface CompletedConsultation {
    id: string;
    roomId: string;
    doctorId: string;
    patientId: string;
    doctorName: string;
    patientName: string;
    reason: string;
    duration: number; // in seconds
    transcript: string;
    transcriptId?: string;
    createdAt: string;
    status: string;
}

// In-memory set to prevent double saving during the same session
const savedRoomsCache = new Set<string>();

/**
 * Persists completed consultation transcript into Supabase transcriptions table.
 * Deduplicates to prevent duplicate saves when call ends or page reloads.
 */
export async function saveConsultationTranscript(
    roomId: string,
    doctorId: string,
    patientId: string,
    transcript: string,
    duration: number = 0
): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!transcript || !transcript.trim()) {
        return { success: true };
    }

    // Idempotency: if already saved in this session, skip
    if (savedRoomsCache.has(roomId)) {
        return { success: true };
    }

    const supabase = createClient();
    const nowIso = new Date().toISOString();

    // 1. Try backend API proxy first (bypasses RLS issues via service role client)
    try {
        const res = await fetch("http://localhost:8000/consultations/transcripts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                room_id: roomId,
                doctor_id: doctorId,
                patient_id: patientId,
                transcript: transcript.trim(),
                duration: Math.round(duration),
            }),
        });

        if (res.ok) {
            const data = await res.json();
            savedRoomsCache.add(roomId);
            return { success: true, id: data.id };
        }
    } catch {
        // Backend not reachable, fall back to direct Supabase
    }

    // 2. Direct Supabase insert / upsert fallback
    try {
        // Check for existing row
        const { data: existing } = await supabase
            .from("transcriptions")
            .select("id, transcript, named_entities")
            .eq("doctor_id", doctorId)
            .eq("patient_id", patientId);

        let matchId: string | null = null;
        if (existing) {
            for (const row of existing) {
                const ne = row.named_entities as any;
                if (ne && ne.room_id === roomId) {
                    matchId = row.id;
                    break;
                }
            }
        }

        if (matchId) {
            await supabase
                .from("transcriptions")
                .update({
                    transcript: transcript.trim(),
                    duration: Math.round(duration),
                    updated_at: nowIso,
                })
                .eq("id", matchId);
            savedRoomsCache.add(roomId);
            return { success: true, id: matchId };
        }

        const { data: inserted, error: insErr } = await supabase
            .from("transcriptions")
            .insert({
                doctor_id: doctorId,
                patient_id: patientId,
                transcript: transcript.trim(),
                duration: Math.round(duration),
                named_entities: { room_id: roomId },
                created_at: nowIso,
                updated_at: nowIso,
            })
            .select()
            .single();

        if (insErr) {
            console.error("Direct Supabase insert error:", insErr);
            return { success: false, error: insErr.message };
        }

        // Also mark video_calls as ended
        await supabase
            .from("video_calls")
            .update({ status: "ended", ended_at: nowIso })
            .or(`room_id.eq.${roomId},room_id.like.%${roomId}%`);

        savedRoomsCache.add(roomId);
        return { success: true, id: inserted?.id };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error saving transcript";
        return { success: false, error: msg };
    }
}

/**
 * Fetches consultation history with associated transcripts for a user (doctor or patient)
 */
export async function getConsultationHistory(
    userId: string,
    role: "doctor" | "patient"
): Promise<CompletedConsultation[]> {
    const supabase = createClient();
    const idColumn = role === "doctor" ? "doctor_id" : "patient_id";

    // 1. Fetch completed / ended calls from video_calls
    const { data: calls } = await supabase
        .from("video_calls")
        .select("*")
        .eq(idColumn, userId)
        .order("created_at", { ascending: false });

    // 2. Fetch all transcripts for this user (try backend API with service role first, fallback to Supabase)
    let transcripts: any[] | null = null;
    try {
        const res = await fetch(`http://localhost:8000/consultations/transcripts?user_id=${userId}&role=${role}`);
        if (res.ok) {
            transcripts = await res.json();
        }
    } catch {
        // Fall back to direct Supabase client
    }

    if (!transcripts) {
        const { data } = await supabase
            .from("transcriptions")
            .select("*")
            .eq(idColumn, userId)
            .order("created_at", { ascending: false });
        transcripts = data;
    }

    // Build transcript map by room_id or by doctor_id + patient_id
    const transcriptByRoom = new Map<string, any>();
    const transcriptByPeer = new Map<string, any>();

    if (transcripts) {
        for (const t of transcripts) {
            const ne = t.named_entities as any;
            if (ne && ne.room_id) {
                transcriptByRoom.set(ne.room_id, t);
            }
            const peerKey = `${t.doctor_id}_${t.patient_id}`;
            if (!transcriptByPeer.has(peerKey)) {
                transcriptByPeer.set(peerKey, t);
            }
        }
    }

    // 3. Fetch user profiles for participant names
    const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, name, role");

    const nameMap = new Map<string, string>();
    if (profiles) {
        for (const p of profiles) {
            nameMap.set(p.id, p.name);
        }
    }

    const results: CompletedConsultation[] = [];

    // Map video_calls into CompletedConsultation
    if (calls && calls.length > 0) {
        for (const call of calls) {
            const unpacked = unpackRoomPayload(call.room_id);
            const matchedTranscript = transcriptByRoom.get(unpacked.roomId) ||
                transcriptByPeer.get(`${call.doctor_id}_${call.patient_id}`);

            const docName = nameMap.get(call.doctor_id) || "Doctor";
            const patName = nameMap.get(call.patient_id) || unpacked.patientName || "Patient";

            let duration = 0;
            if (matchedTranscript?.duration) {
                duration = matchedTranscript.duration;
            } else if (call.created_at && call.ended_at) {
                const diffMs = new Date(call.ended_at).getTime() - new Date(call.created_at).getTime();
                duration = Math.max(0, Math.round(diffMs / 1000));
            }

            results.push({
                id: call.id,
                roomId: unpacked.roomId,
                doctorId: call.doctor_id,
                patientId: call.patient_id,
                doctorName: docName,
                patientName: patName,
                reason: unpacked.reason,
                duration,
                transcript: matchedTranscript?.transcript || "",
                transcriptId: matchedTranscript?.id,
                createdAt: call.created_at,
                status: call.status || "ended",
            });
        }
    } else if (transcripts && transcripts.length > 0) {
        // If calls table is empty but transcripts exist
        for (const t of transcripts) {
            const ne = t.named_entities as any;
            const rId = ne?.room_id || `session_${t.id}`;
            results.push({
                id: t.id,
                roomId: rId,
                doctorId: t.doctor_id,
                patientId: t.patient_id,
                doctorName: nameMap.get(t.doctor_id) || "Doctor",
                patientName: nameMap.get(t.patient_id) || "Patient",
                reason: "Medical Consultation",
                duration: t.duration || 0,
                transcript: t.transcript || "",
                transcriptId: t.id,
                createdAt: t.created_at,
                status: "ended",
            });
        }
    }

    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PHASE 4: AI CLINICAL DOCUMENTATION & STRUCTURED EMR
// ─────────────────────────────────────────────────────────────────────────────

export interface SOAPNotes {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
}

export interface SymptomItem {
    symptom: string;
    name?: string;
    duration?: string;
    severity?: string;
    status?: string;
    notes?: string;
}

export interface DiagnosisItem {
    diagnosis: string;
    confidence?: string;
    status?: string;
    supporting_evidence?: string;
    reasoning?: string;
    is_differential?: boolean;
}

export interface ICD10CodeItem {
    code: string;
    description: string;
    clinical_concept?: string;
    evidence?: string;
    supporting_evidence?: string;
    coding_status?: string;
}

export interface StructuredMedication {
    medication: string;
    dosage?: string;
    route?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
}

export interface PastMedicalHistory {
    past_conditions?: string[];
    surgical_history?: string[];
    current_medications?: string[];
    allergies?: string[];
    family_history?: string[];
}

export interface VitalSigns {
    blood_pressure?: string;
    heart_rate?: string;
    temperature?: string;
    respiratory_rate?: string;
    spo2?: string;
    observations?: string;
}

export interface TreatmentPlan {
    medications?: string[];
    medications_structured?: StructuredMedication[];
    investigations?: string[];
    recommendations?: string[];
    follow_up?: string;
    emergency_warnings?: string;
    emergency_warning?: string;
}

export interface ClinicalReport {
    id?: string;
    patient_id: string;
    doctor_id?: string;
    doctor_name?: string;
    patient_name?: string;
    room_id?: string;
    transcription_id?: string;
    status: "draft" | "approved";
    summary: string;
    soap: SOAPNotes;
    symptoms: SymptomItem[];
    diagnosis_suggestions: DiagnosisItem[];
    differential_diagnoses?: DiagnosisItem[];
    icd_10_codes: ICD10CodeItem[];
    treatment_plan: TreatmentPlan;
    doctor_notes?: string;
    approved_at?: string;
    consultation_date?: string;
    created_at?: string;
    source?: string;
    // Hospital-style EMR encounter fields
    clinic_name?: string;
    document_title?: string;
    document_id?: string;
    encounter_type?: string;
    chief_complaint?: string;
    history_of_present_illness?: string;
    past_medical_history?: PastMedicalHistory;
    review_of_systems?: Record<string, string>;
    vital_signs?: VitalSigns;
    physical_examination?: string;
    assessment_and_impression?: string;
    consultation_outcome?: string;
    source_disclosure?: string;
    patient_age?: string;
    patient_sex?: string;
    patient_mrn?: string;
    patient_dob?: string;
    doctor_specialization?: string;
    doctor_reg_number?: string;
    duration?: number;
}

/**
 * Generate AI clinical documentation draft from consultation transcript.
 */
export async function generateClinicalReport(params: {
    transcriptId?: string;
    roomId?: string;
    doctorId: string;
    patientId: string;
    transcript?: string;
    patientName?: string;
    doctorName?: string;
}): Promise<{ success: boolean; report?: ClinicalReport; error?: string }> {
    try {
        const res = await fetch("http://localhost:8000/consultations/generate-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                transcript_id: params.transcriptId,
                room_id: params.roomId,
                doctor_id: params.doctorId,
                patient_id: params.patientId,
                transcript: params.transcript,
                patient_name: params.patientName || "Patient",
                doctor_name: params.doctorName || "Doctor",
            }),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ detail: "Failed to generate report" }));
            return { success: false, error: errData.detail || "Server error generating report" };
        }

        const data = await res.json();
        const rep = data.report || { ...data, status: "draft" };
        return {
            success: true,
            report: rep,
        };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Network error generating report";
        return { success: false, error: msg };
    }
}

/**
 * Doctor approval and EMR sign-off for clinical report.
 */
export async function approveClinicalReport(payload: {
    report_id?: string;
    transcription_id?: string;
    room_id?: string;
    doctor_id: string;
    patient_id: string;
    doctor_name?: string;
    patient_name?: string;
    summary: string;
    soap: SOAPNotes;
    symptoms: SymptomItem[];
    diagnosis_suggestions: DiagnosisItem[];
    differential_diagnoses?: DiagnosisItem[];
    icd_10_codes: ICD10CodeItem[];
    treatment_plan: TreatmentPlan;
    doctor_notes?: string;
    chief_complaint?: string;
    history_of_present_illness?: string;
    past_medical_history?: PastMedicalHistory;
    review_of_systems?: Record<string, string>;
    vital_signs?: VitalSigns;
    physical_examination?: string;
    assessment_and_impression?: string;
    consultation_outcome?: string;
    source_disclosure?: string;
    clinic_name?: string;
    document_title?: string;
    document_id?: string;
    encounter_type?: string;
}): Promise<{ success: boolean; reportId?: string; error?: string }> {
    try {
        const res = await fetch("http://localhost:8000/consultations/approve-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ detail: "Failed to approve report" }));
            return { success: false, error: errData.detail || "Server error approving report" };
        }

        const data = await res.json();
        return { success: true, reportId: data.report_id };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Network error approving report";
        return { success: false, error: msg };
    }
}

/**
 * Retrieve clinical reports from backend or Supabase client.
 * Doctors see drafts + approved. Patients only see approved.
 */
export async function getClinicalReports(
    userId: string,
    role: "doctor" | "patient",
    roomId?: string
): Promise<ClinicalReport[]> {
    try {
        let url = `http://localhost:8000/consultations/reports?user_id=${userId}&role=${role}`;
        if (roomId) {
            url += `&room_id=${encodeURIComponent(roomId)}`;
        }
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            return data;
        }
    } catch (e) {
        console.warn("Backend reports endpoint failed, falling back to Supabase client:", e);
    }

    // Direct Supabase fallback
    const supabase = createClient();
    try {
        let query = supabase.from("patient_details").select("*");
        if (role === "patient") {
            query = query.eq("patient_id", userId);
        }
        query = query.order("created_at", { ascending: false });
        const { data } = await query;
        if (!data) return [];

        const reports: ClinicalReport[] = [];
        for (const row of data) {
            const sd = (row.structured_diagnosis as any) || {};
            const rowStatus = sd.status || (row as any).status || "approved";
            const rowDoctorId = sd.doctor_id || (row as any).doctor_id;
            const rowRoomId = sd.room_id || (row as any).room_id;

            if (role === "doctor" && rowDoctorId && rowDoctorId !== userId) {
                continue;
            }
            if (role === "patient" && rowStatus !== "approved") {
                continue;
            }
            if (roomId && rowRoomId && rowRoomId !== roomId) {
                continue;
            }

            reports.push({
                id: row.id,
                patient_id: row.patient_id,
                doctor_id: rowDoctorId,
                room_id: rowRoomId,
                status: rowStatus,
                summary: row.summary || sd.summary || "",
                soap: sd.soap || { subjective: "", objective: "", assessment: "", plan: "" },
                symptoms: sd.symptoms || [],
                diagnosis_suggestions: sd.diagnosis_suggestions || [],
                differential_diagnoses: sd.differential_diagnoses || [],
                icd_10_codes: sd.icd_10_codes || [],
                treatment_plan: sd.treatment_plan || {},
                doctor_notes: sd.doctor_notes || "",
                approved_at: sd.approved_at,
                consultation_date: row.consultation_date,
                created_at: row.created_at,
                chief_complaint: sd.chief_complaint || "",
                history_of_present_illness: sd.history_of_present_illness || "",
                past_medical_history: sd.past_medical_history || {},
                review_of_systems: sd.review_of_systems || {},
                vital_signs: sd.vital_signs || {},
                physical_examination: sd.physical_examination || "",
                assessment_and_impression: sd.assessment_and_impression || "",
                consultation_outcome: sd.consultation_outcome || "",
                source_disclosure: sd.source_disclosure || "",
                clinic_name: sd.clinic_name || "DiagnoAssist Telehealth & Hospital Clinical Services",
                document_title: sd.document_title || "ELECTRONIC MEDICAL RECORD (EMR) — CLINICAL ENCOUNTER SUMMARY",
                document_id: sd.document_id || `EMR-${rowRoomId || row.id}`,
                encounter_type: sd.encounter_type || "Synchronous Telehealth Video Consultation",
            });
        }
        return reports;
    } catch {
        return [];
    }
}
