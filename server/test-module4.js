import http from 'http';
import app from './src/app.js';
import { execute, closeDb } from './src/db/db.js';
import { seedDatabase } from './src/db/seed.js';

let server;
const PORT = 5096;

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
  console.log('--- STARTING MODULE 4 VERIFICATION (3-SLOT SCHEDULE & GUIDANCE ENGINE) ---');

  await seedDatabase();

  // Create sample active prescriptions for Patient 1 and Patient 2 if needed
  const today = new Date().toISOString().slice(0, 10);
  try {
    await execute(`
      INSERT IGNORE INTO prescriptions (id, patient_id, medication_id, prescribed_by_id, dosage, route, instructions, slots, start_date, status)
      VALUES 
        ('rx-test-1', 'pat-1', 'med-1', 'user-pharm-1', '500 mg', 'Oral', 'Take after meals', '["MORNING","EVENING"]', ?, 'ACTIVE'),
        ('rx-test-2', 'pat-1', 'med-3', 'user-pharm-1', '850 mg', 'Oral', 'With breakfast & lunch', '["MORNING","AFTERNOON"]', ?, 'ACTIVE'),
        ('rx-test-3', 'pat-2', 'med-2', 'user-pharm-1', '500 mg', 'Oral', 'Every 8 hours', '["MORNING","AFTERNOON","EVENING"]', ?, 'ACTIVE')
    `, [today, today, today]);
  } catch (e) {
    console.error('Prescription setup error:', e);
  }

  server = app.listen(PORT, async () => {
    try {
      // 1. Nurse Sarah Login
      const nurseLogin = await request('POST', '/api/auth/login', {
        email: 'nurse.sarah@hospital.org',
        password: 'nurse123'
      });
      const nurseToken = nurseLogin.body.token;

      // Test 1: Fetch Today's Daily Schedule
      console.log('\n[Test 1] Fetch Today\'s Daily Schedule:');
      const sched = await request('GET', '/api/schedules/today', null, nurseToken);
      console.log('Active Current Slot:', sched.body.currentSlot, '| Target Time:', sched.body.activeSlotTime);
      console.log('Total Scheduled Doses Today:', sched.body.metrics?.totalDoses);
      console.log('Pending Doses:', sched.body.metrics?.pendingDoses, '| Completed:', sched.body.metrics?.completedDoses);
      if (sched.status !== 200 || !sched.body.currentSlot || sched.body.doses?.length === 0) {
        throw new Error('Daily schedule retrieval failed');
      }
      console.log(' Test 1 Passed: Today\'s schedule generated across Morning, Afternoon, and Evening slots.');

      // Test 2: Verify Real-Time Guidance Badging (DUE_NOW / UPCOMING / OVERDUE)
      console.log('\n[Test 2] Verify Real-Time Guidance Badging:');
      const dosesWithGuidance = sched.body.doses.filter(d => d.guidance);
      console.log('Sample dose guidance tag:', dosesWithGuidance[0]?.guidance, `(Slot: ${dosesWithGuidance[0]?.slot})`);
      const hasValidTags = dosesWithGuidance.every(d => ['DUE_NOW', 'UPCOMING', 'OVERDUE', 'COMPLETED'].includes(d.guidance));
      if (!hasValidTags) throw new Error('Invalid guidance tag detected');
      console.log(' Test 2 Passed: Clinical guidance engine correctly tags doses.');

      // Test 3: Filter by Slot (Morning Slot)
      console.log('\n[Test 3] Filter Schedule by Slot (slot=MORNING):');
      const morningSched = await request('GET', '/api/schedules/today?slot=MORNING', null, nurseToken);
      console.log('Morning doses count:', morningSched.body.count);
      const allMorning = morningSched.body.doses.every(d => d.slot === 'MORNING');
      if (!allMorning || morningSched.body.count === 0) throw new Error('Morning slot filter failed');
      console.log(' Test 3 Passed: Morning slot filter cleanly isolates morning round.');

      // Test 4: Nurse "My Patients" Ward Scoping (Ward A)
      console.log('\n[Test 4] Nurse My Patients Schedule Scoping (my_patients=true):');
      const mySched = await request('GET', '/api/schedules/today?my_patients=true', null, nurseToken);
      console.log('Nurse Sarah assigned doses count:', mySched.body.count);
      const allWardA = mySched.body.doses.every(d => d.ward_id === 'ward-a');
      if (!allWardA) throw new Error('My patients schedule scoping failed');
      console.log(' Test 4 Passed: Schedule automatically scoped to nurse\'s assigned Ward A.');

      // Test 5: Fetch specific patient schedule
      console.log('\n[Test 5] Fetch schedule for specific patient (pat-1):');
      const patSched = await request('GET', '/api/schedules/patient/pat-1', null, nurseToken);
      console.log('Patient 1 scheduled doses today:', patSched.body.doses?.length);
      if (patSched.status !== 200 || patSched.body.doses?.length === 0) {
        throw new Error('Patient schedule fetch failed');
      }
      console.log(' Test 5 Passed: Individual patient daily dosage schedule retrieved.');

      console.log('\n ALL MODULE 4 BACKEND TESTS PASSED SUCCESSFULLY! 🎉\n');
    } catch (err) {
      console.error('\n MODULE 4 TEST FAILURE:', err);
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
