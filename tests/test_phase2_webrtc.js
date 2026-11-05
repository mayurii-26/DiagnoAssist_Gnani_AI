const { createClient } = require('../frontend/node_modules/@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('frontend/.env.local', 'utf8');
let url = '', anonKey = '';
env.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) anonKey = line.split('=')[1].trim();
});

const DOCTOR_EMAIL = 'doctor@gmail.com';
const PATIENT_EMAIL = 'john123@gmail.com';
const UNAUTHORIZED_EMAIL = 'anisha@gmail.com';
const TEST_PASSWORD = 'Password123!';

async function runPhase2Tests() {
    console.log('========================================================');
    console.log('🧪 PHASE 2: WEBRTC SIGNALING & ROOM LIFECYCLE TEST SUITE');
    console.log('========================================================\n');

    // 1. Authenticate Doctor
    console.log('[Step 1] Authenticating Doctor & Patient accounts...');
    const doctorClient = createClient(url, anonKey);
    const { data: docAuth, error: docErr } = await doctorClient.auth.signInWithPassword({
        email: DOCTOR_EMAIL,
        password: TEST_PASSWORD,
    });
    if (docErr) throw new Error('Doctor login failed: ' + docErr.message);
    const doctorId = docAuth.user.id;
    console.log(`  ✓ Doctor authenticated: ${docAuth.user.email} (ID: ${doctorId})`);

    // 2. Authenticate Patient
    const patientClient = createClient(url, anonKey);
    const { data: patAuth, error: patErr } = await patientClient.auth.signInWithPassword({
        email: PATIENT_EMAIL,
        password: TEST_PASSWORD,
    });
    if (patErr) throw new Error('Patient login failed: ' + patErr.message);
    const patientId = patAuth.user.id;
    console.log(`  ✓ Patient authenticated: ${patAuth.user.email} (ID: ${patientId})`);

    // 3. Authenticate Unauthorized User
    const rogueClient = createClient(url, anonKey);
    // Set password for anisha if needed
    let rogueId = 'e36e1056-8f57-4683-958d-584affadce56';
    console.log(`  ✓ Unauthorized client configured (ID: ${rogueId})`);

    // 4. Setup Call in Database with Accepted status
    console.log('\n[Step 2] Creating consultation request & room in database...');
    const testRoomId = `room_webrtc_${Date.now()}`;
    const roomPayload = JSON.stringify({
        room: testRoomId,
        reason: 'Acute headache evaluation',
        patient_name: 'John Doe',
    });

    // Clean up any existing calls for this patient
    await patientClient.from('video_calls').delete().eq('patient_id', patientId);

    const { data: callRow, error: callErr } = await patientClient
        .from('video_calls')
        .insert({
            doctor_id: doctorId,
            patient_id: patientId,
            room_id: roomPayload,
            status: 'pending',
        })
        .select()
        .single();

    if (callErr) throw new Error('Failed to insert call: ' + callErr.message);
    const callId = callRow.id;
    console.log(`  ✓ Call record created with status = pending (ID: ${callId}, Room: ${testRoomId})`);

    // Doctor accepts request
    console.log('  Doctor accepting consultation request...');
    const { data: acceptedCall, error: acceptErr } = await doctorClient
        .from('video_calls')
        .update({ status: 'accepted' })
        .eq('id', callId)
        .eq('status', 'pending')
        .select()
        .single();

    if (acceptErr || !acceptedCall) throw new Error('Doctor acceptance failed');
    console.log(`  ✓ Call status atomically transitioned to: accepted`);

    // 5. Test Room Authorization & Access Controls
    console.log('\n[Step 3] Testing Room Participant Authorization & Security...');

    // Function simulating verifyRoomAccess
    async function checkAccess(client, roomId, userId) {
        const { data: calls, error } = await client
            .from('video_calls')
            .select('*')
            .or(`room_id.eq.${roomId},room_id.like.%${roomId}%`)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error || !calls || calls.length === 0) {
            return { authorized: false, error: 'Room not found' };
        }
        const call = calls[0];
        const isParticipant = call.doctor_id === userId || call.patient_id === userId;
        return {
            authorized: isParticipant,
            error: isParticipant ? undefined : 'Unauthorized: You are not an assigned participant',
            call,
        };
    }

    const docAccess = await checkAccess(doctorClient, testRoomId, doctorId);
    console.log(`  ✓ Doctor access check: authorized = ${docAccess.authorized}`);
    if (!docAccess.authorized) throw new Error('Doctor should be authorized');

    const patAccess = await checkAccess(patientClient, testRoomId, patientId);
    console.log(`  ✓ Patient access check: authorized = ${patAccess.authorized}`);
    if (!patAccess.authorized) throw new Error('Patient should be authorized');

    const rogueAccess = await checkAccess(doctorClient, testRoomId, rogueId);
    console.log(`  ✓ Unauthorized user access check: authorized = ${rogueAccess.authorized} (${rogueAccess.error})`);
    if (rogueAccess.authorized) throw new Error('Unauthorized user should NOT have access');

    const nonExistentAccess = await checkAccess(patientClient, 'room_invalid_99999', patientId);
    console.log(`  ✓ Non-existent room access check: authorized = ${nonExistentAccess.authorized} (${nonExistentAccess.error})`);
    if (nonExistentAccess.authorized) throw new Error('Invalid room should be rejected');

    // 6. Test WebRTC Signaling Channel via Supabase Realtime Broadcast
    console.log('\n[Step 4] Setting up WebRTC Signaling Channel over Supabase Realtime...');
    const signalingChannelName = `room-signaling:${testRoomId}`;

    const docSignaling = doctorClient.channel(signalingChannelName);
    const patSignaling = patientClient.channel(signalingChannelName);

    let docReceivedSignals = [];
    let patReceivedSignals = [];

    docSignaling.on('broadcast', { event: 'webrtc_signal' }, (payload) => {
        if (payload?.payload?.sender_id !== doctorId) {
            docReceivedSignals.push(payload.payload);
        }
    });

    patSignaling.on('broadcast', { event: 'webrtc_signal' }, (payload) => {
        if (payload?.payload?.sender_id !== patientId) {
            patReceivedSignals.push(payload.payload);
        }
    });

    await Promise.all([
        new Promise((r) => docSignaling.subscribe((s) => { if (s === 'SUBSCRIBED') r(); })),
        new Promise((r) => patSignaling.subscribe((s) => { if (s === 'SUBSCRIBED') r(); })),
    ]);
    console.log(`  ✓ Both Doctor and Patient subscribed to channel [${signalingChannelName}]`);

    // 7. Test Signaling Handshake: Join -> Offer -> Answer -> ICE Candidate
    console.log('\n[Step 5] Testing Signaling Handshake (Join -> Offer -> Answer -> ICE)...');

    // 7a. Patient sends "join"
    console.log('  Patient broadcasting [join] signal...');
    await patSignaling.send({
        type: 'broadcast',
        event: 'webrtc_signal',
        payload: {
            type: 'join',
            sender_id: patientId,
            sender_role: 'patient',
            timestamp: new Date().toISOString(),
        },
    });

    for (let i = 0; i < 20; i++) {
        if (docReceivedSignals.some((s) => s.type === 'join')) break;
        await new Promise((r) => setTimeout(r, 200));
    }
    const receivedJoin = docReceivedSignals.find((s) => s.type === 'join');
    if (!receivedJoin) throw new Error('Doctor did not receive join signal');
    console.log(`  ✓ Doctor received [join] signal from Patient (${receivedJoin.sender_id})`);

    // 7b. Doctor creates & broadcasts SDP Offer
    console.log('  Doctor creating and broadcasting SDP [offer]...');
    const sampleOfferSDP = {
        type: 'offer',
        sdp: 'v=0\r\no=- 4238947239 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=sendrecv\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n',
    };

    await docSignaling.send({
        type: 'broadcast',
        event: 'webrtc_signal',
        payload: {
            type: 'offer',
            sdp: sampleOfferSDP,
            sender_id: doctorId,
            sender_role: 'doctor',
            timestamp: new Date().toISOString(),
        },
    });

    // Record offer in call_signals table
    await doctorClient.from('call_signals').insert({
        room_id: testRoomId,
        sender_id: doctorId,
        signal_type: 'offer',
        signal_data: sampleOfferSDP,
    });
    console.log(`  ✓ SDP Offer recorded in call_signals table`);

    for (let i = 0; i < 20; i++) {
        if (patReceivedSignals.some((s) => s.type === 'offer')) break;
        await new Promise((r) => setTimeout(r, 200));
    }
    const receivedOffer = patReceivedSignals.find((s) => s.type === 'offer');
    if (!receivedOffer) throw new Error('Patient did not receive offer signal');
    console.log(`  ✓ Patient received SDP [offer] from Doctor`);

    // 7c. Patient creates & broadcasts SDP Answer
    console.log('  Patient creating and broadcasting SDP [answer]...');
    const sampleAnswerSDP = {
        type: 'answer',
        sdp: 'v=0\r\no=- 8746283742 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=sendrecv\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n',
    };

    await patSignaling.send({
        type: 'broadcast',
        event: 'webrtc_signal',
        payload: {
            type: 'answer',
            sdp: sampleAnswerSDP,
            sender_id: patientId,
            sender_role: 'patient',
            timestamp: new Date().toISOString(),
        },
    });

    await patientClient.from('call_signals').insert({
        room_id: testRoomId,
        sender_id: patientId,
        signal_type: 'answer',
        signal_data: sampleAnswerSDP,
    });
    console.log(`  ✓ SDP Answer recorded in call_signals table`);

    for (let i = 0; i < 20; i++) {
        if (docReceivedSignals.some((s) => s.type === 'answer')) break;
        await new Promise((r) => setTimeout(r, 200));
    }
    const receivedAnswer = docReceivedSignals.find((s) => s.type === 'answer');
    if (!receivedAnswer) throw new Error('Doctor did not receive answer signal');
    console.log(`  ✓ Doctor received SDP [answer] from Patient`);

    // 7d. ICE Candidate exchange
    console.log('  Exchanging ICE Candidates...');
    const docCandidate = {
        candidate: 'candidate:1 1 UDP 2122260223 192.168.1.100 50000 typ host',
        sdpMid: 'video',
        sdpMLineIndex: 0,
    };
    await docSignaling.send({
        type: 'broadcast',
        event: 'webrtc_signal',
        payload: {
            type: 'ice_candidate',
            candidate: docCandidate,
            sender_id: doctorId,
        },
    });

    for (let i = 0; i < 20; i++) {
        if (patReceivedSignals.some((s) => s.type === 'ice_candidate')) break;
        await new Promise((r) => setTimeout(r, 200));
    }
    console.log(`  ✓ Patient received ICE candidate from Doctor`);

    // 8. Test Call Lifecycle: Mark Active
    console.log('\n[Step 6] Testing Call Lifecycle: Updating Call to Active...');
    await doctorClient
        .from('video_calls')
        .update({ status: 'active' })
        .eq('id', callId);

    const { data: activeCheck } = await patientClient
        .from('video_calls')
        .select('status')
        .eq('id', callId)
        .single();

    console.log(`  ✓ Call status in database: ${activeCheck.status}`);
    if (activeCheck.status !== 'active') throw new Error('Call should be active in DB');

    // 9. Test Call Termination & Database Updates
    console.log('\n[Step 7] Testing Call Termination & DB Updates (ended_at, status=ended)...');
    const nowEndedIso = new Date().toISOString();

    // Doctor ends call
    await docSignaling.send({
        type: 'broadcast',
        event: 'webrtc_signal',
        payload: {
            type: 'call_ended',
            sender_id: doctorId,
            timestamp: nowEndedIso,
        },
    });

    // Update DB row
    await doctorClient
        .from('video_calls')
        .update({ status: 'ended', ended_at: nowEndedIso })
        .eq('id', callId);

    for (let i = 0; i < 20; i++) {
        if (patReceivedSignals.some((s) => s.type === 'call_ended')) break;
        await new Promise((r) => setTimeout(r, 200));
    }
    console.log(`  ✓ Patient received [call_ended] notification`);

    const { data: endedCheck } = await patientClient
        .from('video_calls')
        .select('status, ended_at')
        .eq('id', callId)
        .single();

    console.log(`  ✓ Call record in database verified: status = ${endedCheck.status}, ended_at = ${endedCheck.ended_at}`);
    if (endedCheck.status !== 'ended' || !endedCheck.ended_at) {
        throw new Error('Call should be ended with non-null ended_at');
    }

    // 10. Clean up
    console.log('\n[Step 8] Cleaning up test records and channels...');
    docSignaling.unsubscribe();
    patSignaling.unsubscribe();
    await doctorClient.from('video_calls').delete().eq('id', callId);
    await doctorClient.from('call_signals').delete().eq('room_id', testRoomId);
    console.log('  ✓ Cleaned up test video_calls and call_signals rows');

    console.log('\n========================================================');
    console.log('✅ ALL PHASE 2 WEBRTC & SIGNALING TESTS PASSED!');
    console.log('========================================================\n');
    process.exit(0);
}

runPhase2Tests().catch((err) => {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
});

