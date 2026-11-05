const { createClient } = require('../frontend/node_modules/@supabase/supabase-js');
const fs = require('fs');

// Read frontend environment variables
const env = fs.readFileSync('frontend/.env.local', 'utf8');
let url = '', anonKey = '';
env.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) anonKey = line.split('=')[1].trim();
});

// Read backend environment variables for service key
let serviceKey = '';
if (fs.existsSync('backend/.env')) {
    const backendEnv = fs.readFileSync('backend/.env', 'utf8');
    backendEnv.split('\n').forEach(line => {
        if (line.startsWith('SUPABASE_SERVICE_KEY=')) serviceKey = line.split('=')[1].trim();
    });
}

const DOCTOR_EMAIL = 'doctor@gmail.com';
const PATIENT_EMAIL = 'john123@gmail.com';
const TEST_PASSWORD = 'Password123!';
const BACKEND_URL = 'http://127.0.0.1:8000';

async function runPhase4Tests() {
    console.log('================================================================');
    console.log('🧪 PHASE 4: AI CLINICAL DOCUMENTATION & EMR PERSISTENCE TEST');
    console.log('================================================================\n');

    let passedTests = 0;
    let totalTests = 0;

    function assert(condition, message) {
        totalTests++;
        if (condition) {
            console.log(`  ✓ PASS: ${message}`);
            passedTests++;
        } else {
            console.error(`  ✗ FAIL: ${message}`);
            throw new Error(`Test assertion failed: ${message}`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. AUTHENTICATION & SETUP
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[Step 1] Authenticating Doctor & Patient accounts...');

    const doctorClient = createClient(url, anonKey);
    const { data: docAuth, error: docErr } = await doctorClient.auth.signInWithPassword({
        email: DOCTOR_EMAIL,
        password: TEST_PASSWORD,
    });
    if (docErr) throw new Error('Doctor login failed: ' + docErr.message);
    const doctorId = docAuth.user.id;
    console.log(`  • Doctor: ${docAuth.user.email} (ID: ${doctorId})`);

    const patientClient = createClient(url, anonKey);
    const { data: patAuth, error: patErr } = await patientClient.auth.signInWithPassword({
        email: PATIENT_EMAIL,
        password: TEST_PASSWORD,
    });
    if (patErr) throw new Error('Patient login failed: ' + patErr.message);
    const patientId = patAuth.user.id;
    console.log(`  • Patient: ${patAuth.user.email} (ID: ${patientId})`);

    const adminClient = serviceKey ? createClient(url, serviceKey) : doctorClient;

    // ─────────────────────────────────────────────────────────────────────────
    // 2. CREATE A REALISTIC CONSULTATION TRANSCRIPT RECORD
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Step 2] Storing consultation dialogue transcript for testing...');
    const testRoomId = `session_p4_${Date.now()}`;
    const realisticTranscript = [
        "[Doctor]: Good afternoon, John. What brings you in today?",
        "[Patient]: Hello doctor. I have had a severe throbbing headache for the last 3 days. It is mostly on the left side of my head.",
        "[Doctor]: Does the headache get worse with bright light or loud sounds? Any nausea?",
        "[Patient]: Yes, bright light hurts my eyes terribly, and I feel nauseous. I also threw up once yesterday morning and have a mild fever around 100 degrees.",
        "[Doctor]: I see. Have you taken any medications so far?",
        "[Patient]: I took Paracetamol 500mg yesterday, but it only helped a little bit for a couple of hours.",
        "[Doctor]: Based on the unilateral throbbing, severe pain, photophobia, and nausea, this presents as an acute migraine episode with associated mild fever.",
        "[Doctor]: I am going to prescribe Sumatriptan 50mg to take at the onset of severe headache, plus Ondansetron 4mg for the nausea. Please stay in a dark, quiet room and drink plenty of fluids.",
        "[Doctor]: If you develop confusion, sudden extreme neck stiffness, or your fever rises above 102, seek immediate emergency medical care.",
        "[Patient]: Understood doctor. When should I follow up?",
        "[Doctor]: Follow up with me in 5 days if the headache does not improve.",
    ].join('\n');

    const { data: transRow, error: transErr } = await adminClient
        .from('transcriptions')
        .insert({
            doctor_id: doctorId,
            patient_id: patientId,
            transcript: realisticTranscript,
            duration: 380,
            named_entities: { room_id: testRoomId },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (transErr) throw new Error('Failed to insert test transcription: ' + transErr.message);
    const transcriptId = transRow.id;
    console.log(`  • Inserted transcript ID: ${transcriptId} for room: ${testRoomId}`);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. GENERATE AI CLINICAL DOCUMENTATION (DRAFT)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Step 3] Calling POST /consultations/generate-report...');
    const genRes = await fetch(`${BACKEND_URL}/consultations/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            transcript_id: transcriptId,
            room_id: testRoomId,
            doctor_id: doctorId,
            patient_id: patientId,
            transcript: realisticTranscript,
            patient_name: 'John Patient',
            doctor_name: 'Dr. Physician',
        }),
    });

    assert(genRes.ok, `generate-report returned HTTP ${genRes.status}`);
    const genData = await genRes.json();

    assert(genData.status === 'draft', `Report status is 'draft' (actual: ${genData.status})`);
    assert(Boolean(genData.report_id), `Report has an assigned ID: ${genData.report_id}`);

    const report = genData.report;
    assert(Boolean(report.summary && report.summary.length > 20), 'Generated clinical summary is present and detailed');
    console.log(`  • Summary: "${report.summary.slice(0, 100)}..."`);

    // Verify SOAP Notes
    assert(Boolean(report.soap && report.soap.subjective), 'SOAP Subjective is populated');
    assert(Boolean(report.soap && report.soap.objective), 'SOAP Objective is populated');
    assert(Boolean(report.soap && report.soap.assessment), 'SOAP Assessment is populated');
    assert(Boolean(report.soap && report.soap.plan), 'SOAP Plan is populated');
    console.log(`  • Assessment: "${report.soap.assessment.slice(0, 80)}..."`);

    // Verify Symptoms
    assert(Array.isArray(report.symptoms) && report.symptoms.length >= 2, `Extracted symptoms list: ${report.symptoms.length} symptoms`);
    const symptomNames = report.symptoms.map(s => (s.symptom || s.name || '').toLowerCase()).join(' ');
    assert(symptomNames.includes('headache') || symptomNames.includes('migraine'), 'Identified headache symptom');
    assert(symptomNames.includes('nausea') || symptomNames.includes('fever') || symptomNames.includes('photophobia'), 'Identified associated symptoms');

    // Verify Diagnoses & ICD-10
    assert(Array.isArray(report.diagnosis_suggestions) && report.diagnosis_suggestions.length > 0, 'Diagnosis suggestions provided');
    assert(Array.isArray(report.icd_10_codes) && report.icd_10_codes.length > 0, `ICD-10 codes suggested: ${report.icd_10_codes.length} codes`);
    const icdCodes = report.icd_10_codes.map(c => c.code);
    console.log(`  • Suggested ICD-10 codes: ${icdCodes.join(', ')}`);
    assert(icdCodes.some(c => c.startsWith('G43') || c.startsWith('R51')), 'Contains relevant migraine/headache ICD-10 code (G43 / R51)');

    // Verify Treatment Plan & Grounding
    assert(Boolean(report.treatment_plan), 'Treatment plan generated');
    assert(Array.isArray(report.treatment_plan.medications), 'Medications array exists');
    assert(Boolean(report.treatment_plan.follow_up), 'Follow up instruction included');
    assert(Boolean(report.treatment_plan.emergency_warnings || report.treatment_plan.emergency_warning), 'Emergency red-flag warnings included');

    // Verify Extended Hospital EMR Clinical Document Structure
    assert(Boolean(report.chief_complaint), 'Chief complaint is documented');
    assert(Boolean(report.history_of_present_illness), 'History of Present Illness (HPI) is documented');
    assert(Boolean(report.past_medical_history), 'Past medical history section is present');
    assert(Boolean(report.review_of_systems && Object.keys(report.review_of_systems).length >= 5), 'Review of Systems covers multiple organ systems');
    assert(Boolean(report.vital_signs && report.vital_signs.temperature), 'Vital signs section is documented');
    assert(Boolean(report.physical_examination), 'Physical examination section is documented');
    assert(Array.isArray(report.differential_diagnoses) && report.differential_diagnoses.length > 0, 'Differential diagnoses with uncertainty status present');
    assert(Boolean(report.icd_10_codes[0].coding_status), 'ICD-10 codes contain coding validation status');

    // ─────────────────────────────────────────────────────────────────────────
    // 4. ROLE-BASED DRAFT ACCESS CHECK (Doctor vs Patient)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Step 4] Checking role-based draft report visibility...');
    
    // Doctor queries reports: Draft must be visible
    const docQueryRes = await fetch(`${BACKEND_URL}/consultations/reports?user_id=${doctorId}&role=doctor&room_id=${testRoomId}`);
    assert(docQueryRes.ok, 'Doctor can query reports endpoint');
    const docReports = await docQueryRes.json();
    assert(docReports.length > 0, 'Doctor can see the newly generated draft report');
    console.log(`  • Doctor sees ${docReports.length} reports for room (Status: ${docReports[0].status})`);

    // Patient queries reports: Draft MUST NOT be visible before doctor sign-off
    const patQueryRes = await fetch(`${BACKEND_URL}/consultations/reports?user_id=${patientId}&role=patient&room_id=${testRoomId}`);
    assert(patQueryRes.ok, 'Patient can query reports endpoint');
    const patReports = await patQueryRes.json();
    assert(patReports.length === 0, 'Patient CANNOT see draft report before physician approval');
    console.log('  • Patient access check passed: Draft report strictly withheld from patient view.');

    // ─────────────────────────────────────────────────────────────────────────
    // 5. DOCTOR REVIEW, EDIT & APPROVAL SIGN-OFF
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Step 5] Doctor reviews, edits, and signs off on report (POST /consultations/approve-report)...');
    
    const approvedSummary = report.summary + ' [Reviewed and verified by attending physician]';
    const doctorNotes = 'Patient advised on proper hydration and rest in a dark, quiet room. Sumatriptan prescribed as acute abortive therapy.';
    
    const approveRes = await fetch(`${BACKEND_URL}/consultations/approve-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            report_id: genData.report_id,
            transcription_id: transcriptId,
            room_id: testRoomId,
            doctor_id: doctorId,
            patient_id: patientId,
            summary: approvedSummary,
            soap: report.soap,
            symptoms: report.symptoms,
            diagnosis_suggestions: report.diagnosis_suggestions,
            icd_10_codes: report.icd_10_codes,
            treatment_plan: report.treatment_plan,
            doctor_notes: doctorNotes,
            chief_complaint: report.chief_complaint,
            history_of_present_illness: report.history_of_present_illness,
            past_medical_history: report.past_medical_history,
            review_of_systems: report.review_of_systems,
            vital_signs: report.vital_signs,
            physical_examination: report.physical_examination,
            differential_diagnoses: report.differential_diagnoses,
        }),
    });

    assert(approveRes.ok, `approve-report returned HTTP ${approveRes.status}`);
    const approveData = await approveRes.json();
    assert(approveData.status === 'approved', `Sign-off status is 'approved' (actual: ${approveData.status})`);
    assert(Boolean(approveData.approved_at), `Approved timestamp recorded: ${approveData.approved_at}`);
    console.log(`  • Approved Report ID: ${approveData.report_id}`);

    // ─────────────────────────────────────────────────────────────────────────
    // 6. VERIFY PERSISTENCE IN DATABASE (patient_details & transcriptions)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Step 6] Verifying persistence in database tables...');

    // Check patient_details
    const { data: pdRows, error: pdErr } = await adminClient
        .from('patient_details')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

    assert(!pdErr, 'Queried patient_details without error');
    assert(pdRows && pdRows.length > 0, 'patient_details has recorded EMR entry');
    
    const latestPd = pdRows[0];
    const sd = latestPd.structured_diagnosis || {};
    const effectiveStatus = sd.status || latestPd.status;
    assert(effectiveStatus === 'approved', `patient_details record status is 'approved' (actual: ${effectiveStatus})`);
    assert(Boolean(sd.soap && sd.soap.subjective), 'patient_details contains structured SOAP notes');
    assert(Array.isArray(sd.symptoms), 'patient_details contains symptoms list');
    assert(Array.isArray(sd.icd_10_codes), 'patient_details contains ICD-10 codes');
    assert(Boolean(sd.chief_complaint), 'patient_details persisted chief complaint');
    assert(Boolean(sd.review_of_systems), 'patient_details persisted review of systems');
    assert(Boolean(sd.vital_signs), 'patient_details persisted vital signs');
    console.log('  • patient_details table persistence confirmed.');

    // Check transcriptions.icd_codes updated
    const { data: updatedTrans, error: utErr } = await adminClient
        .from('transcriptions')
        .select('id, icd_codes')
        .eq('id', transcriptId)
        .single();

    assert(!utErr, 'Queried transcriptions record without error');
    assert(Boolean(updatedTrans.icd_codes && updatedTrans.icd_codes.length > 0), 'transcriptions.icd_codes updated with clinical codes');
    console.log(`  • transcriptions.icd_codes persisted with ${updatedTrans.icd_codes.length} items.`);

    // ─────────────────────────────────────────────────────────────────────────
    // 7. VERIFY PATIENT VISIBILITY POST-APPROVAL
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Step 7] Checking patient visibility post-approval...');
    const patPostQuery = await fetch(`${BACKEND_URL}/consultations/reports?user_id=${patientId}&role=patient&room_id=${testRoomId}`);
    assert(patPostQuery.ok, 'Patient queried reports post-approval');
    const patPostReports = await patPostQuery.json();
    assert(patPostReports.length > 0, `Patient can now view the approved clinical report (${patPostReports.length} found)`);
    assert(patPostReports[0].status === 'approved', 'Report shown to patient is approved');
    console.log('  • Patient can now successfully view and export the finalized clinical documentation!');

    // ─────────────────────────────────────────────────────────────────────────
    // CLEANUP
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Cleanup] Cleaning up test records...');
    try {
        await adminClient.from('transcriptions').delete().eq('id', transcriptId);
        if (latestPd && latestPd.id) {
            await adminClient.from('patient_details').delete().eq('id', latestPd.id);
        }
        console.log('  • Test records cleaned up successfully.');
    } catch (e) {
        console.log('  • Cleanup note:', e.message);
    }

    console.log('\n================================================================');
    console.log(`🎉 ALL PHASE 4 TESTS PASSED! (${passedTests}/${totalTests} assertions passed)`);
    console.log('================================================================\n');
}

runPhase4Tests().catch((err) => {
    console.error('\n❌ Phase 4 Test Suite Failed:\n', err);
    process.exit(1);
});
