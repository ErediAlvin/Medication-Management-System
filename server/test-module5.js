import http from 'http';
import app from './src/app.js';
import { execute, closeDb } from './src/db/db.js';
import { seedDatabase } from './src/db/seed.js';

let server;
const PORT = 5095;

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
  console.log('--- STARTING MODULE 5 VERIFICATION (SAFE DISPENSING & SOD) ---');

  await seedDatabase();

  server = app.listen(PORT, async () => {
    try {
      // 1. Role Authentication
      console.log('\n[Test 1] Login Nurse and Pharmacist:');
      const nurseLogin = await request('POST', '/api/auth/login', {
        email: 'nurse.sarah@hospital.org',
        password: 'nurse123'
      });
      console.log('Nurse Sarah status:', nurseLogin.status, '| Role:', nurseLogin.body?.user?.role);
      const nurseToken = nurseLogin.body?.token;

      const pharmLogin = await request('POST', '/api/auth/login', {
        email: 'pharmacist@hospital.org',
        password: 'pharm123'
      });
      console.log('Pharmacist Alex status:', pharmLogin.status, '| Role:', pharmLogin.body?.user?.role);
      const pharmToken = pharmLogin.body?.token;

      if (!nurseToken || !pharmToken) {
        throw new Error('Authentication failed for test roles');
      }

      // 2. Fetch Daily Schedule to locate target dose
      console.log('\n[Test 2] Fetch Daily Schedule for Administration:');
      const scheduleRes = await request('GET', '/api/schedules/daily?slot=ALL', null, nurseToken);
      console.log('Schedule status:', scheduleRes.status, '| Total doses found:', scheduleRes.body?.doses?.length);

      const targetDose = scheduleRes.body?.doses?.find(d => d.status === 'PENDING') || scheduleRes.body?.doses?.[0];
      if (!targetDose) {
        throw new Error('No doses found in schedule');
      }
      console.log(`Target dose selected: ID ${targetDose.id} | ${targetDose.trade_name} (${targetDose.slot})`);

      // 3. Nurse records safe dose administration
      console.log('\n[Test 3] Nurse Sarah records dose administration:');
      const adminRes = await request('POST', '/api/administration/record', {
        dose_schedule_id: targetDose.id,
        status: 'ADMINISTERED',
        notes: 'Administered orally with 200ml water after vitals verified.',
        vitals: 'BP: 120/80 mmHg, HR: 72 bpm, Temp: 36.6 C'
      }, nurseToken);
      console.log('Admin record status:', adminRes.status, '| Message:', adminRes.body?.message);
      if (adminRes.status !== 200 || !adminRes.body?.success) {
        throw new Error('Nurse administration failed: ' + JSON.stringify(adminRes.body));
      }

      // 4. DUPLICATE ADMINISTRATION PREVENTION CHECK
      console.log('\n[Test 4] Duplicate Administration Prevention (Same Dose):');
      const duplicateRes = await request('POST', '/api/administration/record', {
        dose_schedule_id: targetDose.id,
        status: 'ADMINISTERED',
        notes: 'Accidental second administration attempt.'
      }, nurseToken);
      console.log('Duplicate attempt status:', duplicateRes.status, '| Error alert:', duplicateRes.body?.error);
      if (duplicateRes.status !== 409) {
        throw new Error(`Expected 409 Conflict for duplicate dose, got: ${duplicateRes.status}`);
      }

      // 5. STRICT SOD / PHARMACIST BLOCK CHECK
      console.log('\n[Test 5] Separation of Duties (Pharmacist CANNOT administer):');
      const pharmAttempt = await request('POST', '/api/administration/record', {
        dose_schedule_id: targetDose.id,
        status: 'ADMINISTERED',
        notes: 'Pharmacist trying to administer dose.'
      }, pharmToken);
      console.log('Pharmacist attempt status:', pharmAttempt.status, '| Block reason:', pharmAttempt.body?.error);
      if (pharmAttempt.status !== 403) {
        throw new Error(`Expected 403 Forbidden for pharmacist administration, got: ${pharmAttempt.status}`);
      }

      // 6. Patient Administration History
      console.log('\n[Test 6] Patient Administration Audit History:');
      const historyRes = await request('GET', `/api/administration/history/${targetDose.patient_id}`, null, nurseToken);
      console.log('History status:', historyRes.status, '| Records logged:', historyRes.body?.count);
      const lastEntry = historyRes.body?.history?.[0];
      console.log('Most recent dose:', lastEntry?.trade_name, '| By:', lastEntry?.nurse_name, '| At:', lastEntry?.administered_at);

      // 7. Shift Handover Reconciliation
      console.log('\n[Test 7] Shift Handover Reconciliation:');
      const reconRes = await request('GET', `/api/administration/reconciliation?ward_id=${targetDose.ward_id}`, null, nurseToken);
      console.log('Reconciliation status:', reconRes.status, '| Summary:', reconRes.body?.summary);

      console.log('\n🎉 ALL MODULE 5 VERIFICATION TESTS PASSED SUCCESSFULLY!');
      server.close(async () => {
        await closeDb();
        process.exit(0);
      });
    } catch (err) {
      console.error('\n❌ Module 5 Test Suite Failed:', err);
      if (server) server.close();
      await closeDb();
      process.exit(1);
    }
  });
}

runTests();
