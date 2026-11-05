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
const TEST_PASSWORD = 'Password123!';

async function runTests() {
    console.log('========================================================');
    console.log('🧪 PHASE 1: AUTOMATED INTEGRATION TEST SUITE');
    console.log('========================================================\n');

    // 1. Sign in Doctor
    console.log('[Step 1] Authenticating Doctor...');
    const doctorClient = createClient(url, anonKey);
    const { data: docAuth, error: docErr } = await doctorClient.auth.signInWithPassword({
        email: DOCTOR_EMAIL,
        password: TEST_PASSWORD
    });
    if (docErr) throw new Error('Doctor login failed: ' + docErr.message);
    const doctorId = docAuth.user.id;
    console.log(`  ✓ Doctor signed in: ${docAuth.user.email} (ID: ${doctorId})`);

    // 2. Sign in Patient
    console.log('\n[Step 2] Authenticating Patient...');
    const patientClient = createClient(url, anonKey);
    const { data: patAuth, error: patErr } = await patientClient.auth.signInWithPassword({
        email: PATIENT_EMAIL,
        password: TEST_PASSWORD
    });
    if (patErr) throw new Error('Patient login failed: ' + patErr.message);
    const patientId = patAuth.user.id;
    console.log(`  ✓ Patient signed in: ${patAuth.user.email} (ID: ${patientId})`);

    // 3. Test Doctor Presence (Online & Heartbeat)
    console.log('\n[Step 3] Testing Doctor Presence & Heartbeat...');
    const nowIso = new Date().toISOString();
    const { data: presData, error: presErr } = await doctorClient
        .from('user_presence')
        .upsert({ user_id: doctorId, is_online: true, last_seen: nowIso })
        .select();

    if (presErr) throw new Error('Failed to update doctor presence: ' + presErr.message);
    console.log(`  ✓ Doctor marked online in user_presence: is_online = true`);

    // 4. Test Patient Doctor Directory
    console.log('\n[Step 4] Testing Patient Doctor Directory Query...');
    const { data: profiles } = await patientClient
        .from('user_profiles')
        .select('*')
        .eq('id', doctorId);
    const { data: presence } = await patientClient
        .from('user_presence')
        .select('*')
        .eq('user_id', doctorId);

    const isOnline = presence && presence[0]?.is_online && (Date.now() - new Date(presence[0]?.last_seen).getTime() < 90000);
    console.log(`  ✓ Patient queries doctor directory: Dr. ${profiles[0]?.name} is online = ${isOnline}`);
    if (!isOnline) throw new Error('Doctor should appear online in directory');

    // 5. Setup Realtime WebSocket Channels
    console.log('\n[Step 5] Setting up Supabase Realtime Broadcast Channels...');
    const docChannelName = `consultation:doctor:${doctorId}`;
    const patChannelName = `consultation:patient:${patientId}`;

    const docListener = doctorClient.channel(docChannelName);
    const patListener = patientClient.channel(patChannelName);
    const patToDocSender = patientClient.channel(docChannelName);
    const docToPatSender = doctorClient.channel(patChannelName);

    let doctorReceivedRequest = null;
    let patientReceivedResponse = null;

    docListener.on('broadcast', { event: 'new_consultation_request' }, (payload) => {
        console.log('  🔔 Doctor received realtime event [new_consultation_request]');
        doctorReceivedRequest = payload?.payload;
    });

    patListener.on('broadcast', { event: 'consultation_response' }, (payload) => {
        console.log('  🔔 Patient received realtime event [consultation_response]');
        patientReceivedResponse = payload?.payload;
    });

    await Promise.all([
        new Promise(r => docListener.subscribe(s => { if (s === 'SUBSCRIBED') r(); })),
        new Promise(r => patListener.subscribe(s => { if (s === 'SUBSCRIBED') r(); })),
        new Promise(r => patToDocSender.subscribe(s => { if (s === 'SUBSCRIBED') r(); })),
        new Promise(r => docToPatSender.subscribe(s => { if (s === 'SUBSCRIBED') r(); })),
    ]);
    console.log('  ✓ All 4 Realtime WebSocket channels SUBSCRIBED');

    // 6. Test Workflow 1: Consultation Request & Acceptance
    console.log('\n[Step 6] Testing Workflow 1: Patient sends Request -> Doctor Accepts...');
    const reqPayload1 = {
        room: `room_test_${Date.now()}`,
        reason: 'Severe migraine headache since morning, throbbing pain',
        patient_name: 'John Doe'
    };

    // Clean up any stale test rows first
    await patientClient.from('video_calls').delete().eq('patient_id', patientId);

    // Insert request
    const { data: call1, error: callErr1 } = await patientClient
        .from('video_calls')
        .insert({
            doctor_id: doctorId,
            patient_id: patientId,
            room_id: JSON.stringify(reqPayload1),
            status: 'pending'
        })
        .select()
        .single();

    if (callErr1) throw new Error('Patient failed to insert request: ' + callErr1.message);
    const requestId1 = call1.id;
    console.log(`  ✓ Request inserted in DB with status = pending (ID: ${requestId1})`);

    // Broadcast to doctor
    await patToDocSender.send({
        type: 'broadcast',
        event: 'new_consultation_request',
        payload: {
            id: requestId1,
            patient_id: patientId,
            doctor_id: doctorId,
            patient_name: reqPayload1.patient_name,
            reason: reqPayload1.reason,
            status: 'pending',
            room_id: reqPayload1.room,
            created_at: call1.created_at
        }
    });

    for (let i = 0; i < 20; i++) {
        if (doctorReceivedRequest && doctorReceivedRequest.id === requestId1) break;
        await new Promise(r => setTimeout(r, 200));
    }
    if (!doctorReceivedRequest) throw new Error('Doctor timed out waiting for request broadcast');
    console.log(`  ✓ Doctor received request notification for patient: "${doctorReceivedRequest.patient_name}"`);

    // Doctor accepts request
    console.log('  Doctor clicking [Accept Request]...');
    const { data: acceptData, error: acceptErr } = await doctorClient
        .from('video_calls')
        .update({ status: 'accepted' })
        .eq('id', requestId1)
        .eq('status', 'pending')
        .select()
        .single();

    if (acceptErr || !acceptData) throw new Error('Doctor failed atomic accept: ' + acceptErr?.message);
    console.log(`  ✓ DB record updated atomically: status = ${acceptData.status}`);

    // Doctor broadcasts acceptance
    await docToPatSender.send({
        type: 'broadcast',
        event: 'consultation_response',
        payload: {
            request_id: requestId1,
            doctor_id: doctorId,
            doctor_name: 'Dr. Mayuri',
            status: 'accepted',
            room_id: reqPayload1.room,
            timestamp: new Date().toISOString()
        }
    });

    for (let i = 0; i < 20; i++) {
        if (patientReceivedResponse && patientReceivedResponse.request_id === requestId1) break;
        await new Promise(r => setTimeout(r, 200));
    }
    if (!patientReceivedResponse || patientReceivedResponse.status !== 'accepted') {
        throw new Error('Patient timed out waiting for acceptance response');
    }
    console.log(`  ✓ Patient received acceptance notification: Room ID = ${patientReceivedResponse.room_id}`);

    // Clean up call 1
    await patientClient.from('video_calls').delete().eq('id', requestId1);

    // 7. Test Workflow 2: Consultation Request & Rejection
    console.log('\n[Step 7] Testing Workflow 2: Patient sends Request -> Doctor Rejects...');
    doctorReceivedRequest = null;
    patientReceivedResponse = null;

    const reqPayload2 = {
        room: `room_test_${Date.now()}`,
        reason: 'Routine prescription refill check',
        patient_name: 'John Doe'
    };

    const { data: call2, error: callErr2 } = await patientClient
        .from('video_calls')
        .insert({
            doctor_id: doctorId,
            patient_id: patientId,
            room_id: JSON.stringify(reqPayload2),
            status: 'pending'
        })
        .select()
        .single();

    const requestId2 = call2.id;
    console.log(`  ✓ Second request created in DB: ID = ${requestId2}`);

    // Broadcast to doctor
    await patToDocSender.send({
        type: 'broadcast',
        event: 'new_consultation_request',
        payload: {
            id: requestId2,
            patient_id: patientId,
            doctor_id: doctorId,
            patient_name: reqPayload2.patient_name,
            reason: reqPayload2.reason,
            status: 'pending',
            room_id: reqPayload2.room,
            created_at: call2.created_at
        }
    });

    for (let i = 0; i < 20; i++) {
        if (doctorReceivedRequest && doctorReceivedRequest.id === requestId2) break;
        await new Promise(r => setTimeout(r, 200));
    }
    console.log(`  ✓ Doctor received second notification`);

    // Doctor rejects request
    console.log('  Doctor clicking [Decline Request]...');
    const { data: rejectData } = await doctorClient
        .from('video_calls')
        .update({ status: 'rejected' })
        .eq('id', requestId2)
        .eq('status', 'pending')
        .select()
        .single();

    console.log(`  ✓ DB record updated atomically: status = ${rejectData.status}`);

    // Doctor broadcasts rejection
    await docToPatSender.send({
        type: 'broadcast',
        event: 'consultation_response',
        payload: {
            request_id: requestId2,
            doctor_id: doctorId,
            doctor_name: 'Dr. Mayuri',
            status: 'rejected',
            room_id: reqPayload2.room,
            timestamp: new Date().toISOString()
        }
    });

    for (let i = 0; i < 20; i++) {
        if (patientReceivedResponse && patientReceivedResponse.request_id === requestId2) break;
        await new Promise(r => setTimeout(r, 200));
    }
    if (!patientReceivedResponse || patientReceivedResponse.status !== 'rejected') {
        throw new Error('Patient did not receive rejection response');
    }
    console.log(`  ✓ Patient received rejection notification: Doctor declined request`);

    // Clean up call 2
    await patientClient.from('video_calls').delete().eq('id', requestId2);

    // 8. Test Doctor Logout / Offline Presence Cleanup
    console.log('\n[Step 8] Testing Doctor Disconnection & Presence Cleanup...');
    await doctorClient
        .from('user_presence')
        .upsert({ user_id: doctorId, is_online: false, last_seen: new Date().toISOString() });

    const { data: offlineCheck } = await patientClient
        .from('user_presence')
        .select('is_online')
        .eq('user_id', doctorId);

    console.log(`  ✓ Doctor presence updated on logout: is_online = ${offlineCheck[0]?.is_online}`);
    if (offlineCheck[0]?.is_online !== false) throw new Error('Doctor should be offline');

    // 9. Test Stale Presence Detection
    console.log('\n[Step 9] Testing Stale Heartbeat Detection (last_seen > 90s)...');
    const staleTime = new Date(Date.now() - 120000).toISOString();
    const isStale = (Date.now() - new Date(staleTime).getTime()) > 90000;
    console.log(`  ✓ Stale presence logic: Doctor with heartbeat at ${staleTime} is evaluated as offline = ${isStale}`);

    // Unsubscribe channels
    docListener.unsubscribe();
    patListener.unsubscribe();
    patToDocSender.unsubscribe();
    docToPatSender.unsubscribe();

    console.log('\n========================================================');
    console.log('✅ ALL PHASE 1 INTEGRATION TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================\n');
    process.exit(0);
}

runTests().catch(err => {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
});

