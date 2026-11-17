import http from 'http';
import app from './src/app.js';
import { execute, closeDb } from './src/db/db.js';
import { seedDatabase } from './src/db/seed.js';

let server;
const PORT = 5097;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (dataString) headers['Content-Length'] = Buffer.byteLength(dataString);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers
    }, (res) => {
      let rawData = '';
      res.on('data', chunk => { rawData += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(rawData) });
        } catch {
          resolve({ status: res.statusCode, raw: rawData });
        }
      });
    });

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING MODULE 3 VERIFICATION (PHARMACY & MULTI-MEDICATION ASSIGNMENT) ---');
  
  // Clean test prescriptions for clean idempotent test run
  await seedDatabase();
  await execute('DELETE FROM administration_logs');
  await execute('DELETE FROM dose_schedules');
  await execute('DELETE FROM prescriptions');

  server = app.listen(PORT, async () => {
    try {
      // 1. Pharmacist Login
      const pharmLogin = await request('POST', '/api/auth/login', {
        email: 'pharmacist@hospital.org',
        password: 'pharm123'
      });
      const pharmToken = pharmLogin.body.token;

      // 2. Nurse Login
      const nurseLogin = await request('POST', '/api/auth/login', {
        email: 'nurse.sarah@hospital.org',
        password: 'nurse123'
      });
      const nurseToken = nurseLogin.body.token;

      // Test 1: Fetch Drug Catalog
      console.log('\n[Test 1] Fetch Drug Catalog:');
      const catalog = await request('GET', '/api/medications', null, pharmToken);
      console.log('Catalog items count:', catalog.body.count);
      if (catalog.status !== 200 || catalog.body.count < 5) throw new Error('Catalog fetch failed');
      console.log('✅ Test 1 Passed: Drug catalog loaded.');

      // Test 2: Nurse attempts to assign medication -> Blocked with 403 Forbidden
      console.log('\n[Test 2] Nurse attempts to assign medication (Should be 403 Forbidden):');
      const nurseAssign = await request('POST', '/api/prescriptions', {
        patient_id: 'pat-1',
        medication_id: 'med-1',
        dosage: '500 mg',
        route: 'Oral',
        slots: ['MORNING']
      }, nurseToken);
      console.log('Nurse Assign Status:', nurseAssign.status);
      if (nurseAssign.status !== 403) throw new Error('Nurse should be blocked from prescribing with 403');
      console.log('✅ Test 2 Passed: RBAC properly prevents nurses from assigning medications.');

      // Test 3: Pharmacist assigns Paracetamol to Patient 1
      console.log('\n[Test 3] Pharmacist assigns Paracetamol to Patient 1:');
      const pharmAssign = await request('POST', '/api/prescriptions', {
        patient_id: 'pat-1',
        medication_id: 'med-1',
        dosage: '500 mg',
        route: 'Oral',
        instructions: 'Take after breakfast and dinner',
        slots: ['MORNING', 'EVENING']
      }, pharmToken);
      console.log('Pharmacist Assign Status:', pharmAssign.status, '| Rx ID:', pharmAssign.body.prescription?.id);
      if (pharmAssign.status !== 201) throw new Error('Pharmacist assignment failed: ' + pharmAssign.body.error);
      console.log('✅ Test 3 Passed: Pharmacist assigned medication with daily slots.');

      // Test 4: Assign SECOND medication (Metformin) to Patient 1 (Multi-Medication):
      console.log('\n[Test 4] Assign SECOND medication (Metformin) to Patient 1 (Multi-Medication):');
      const secondMed = await request('POST', '/api/prescriptions', {
        patient_id: 'pat-1',
        medication_id: 'med-3',
        dosage: '850 mg',
        route: 'Oral',
        instructions: 'Take with morning and evening meals',
        slots: ['MORNING', 'AFTERNOON', 'EVENING']
      }, pharmToken);
      console.log('Second Rx Status:', secondMed.status, '| Rx ID:', secondMed.body.prescription?.id);
      if (secondMed.status !== 201) throw new Error('Second medication assignment failed');
      console.log('✅ Test 4 Passed: Multi-medication tracking confirmed (patient has multiple concurrent active medications).');

      // Test 5: Prevent duplicate active prescription for same medication
      console.log('\n[Test 5] Prevent duplicate active prescription for same medication:');
      const dupRx = await request('POST', '/api/prescriptions', {
        patient_id: 'pat-1',
        medication_id: 'med-1', // Already prescribed above!
        dosage: '500 mg',
        route: 'Oral',
        slots: ['MORNING']
      }, pharmToken);
      console.log('Duplicate Rx Status (Should be 409 Conflict):', dupRx.status);
      if (dupRx.status !== 409) throw new Error('Duplicate prescription should be rejected with 409');
      console.log('✅ Test 5 Passed: System prevented duplicate active prescription of same drug.');

      // Test 6: Allergy warning detection
      console.log('\n[Test 6] Allergy warning detection (Patient 1 is allergic to Penicillin, prescribing Amoxicillin):');
      const allergyRx = await request('POST', '/api/prescriptions', {
        patient_id: 'pat-1',
        medication_id: 'med-2', // Amoxicillin (Penicillin class)
        dosage: '500 mg',
        route: 'Oral',
        slots: ['MORNING']
      }, pharmToken);
      console.log('Prescribed with Allergy Warning:', allergyRx.body.allergyWarning);
      if (!allergyRx.body.allergyWarning) throw new Error('Expected allergy conflict warning');
      console.log('✅ Test 6 Passed: Critical allergy conflict detected and flagged.');

      console.log('\n🎉 ALL MODULE 3 BACKEND TESTS PASSED SUCCESSFULLY! 🎉\n');
    } catch (err) {
      console.error('\n❌ MODULE 3 TEST FAILURE:', err);
      process.exitCode = 1;
    } finally {
      server.close(async () => {
        await closeDb();
        process.exit();
      });
    }
  });
}

runTests();
