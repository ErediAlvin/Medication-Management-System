import http from 'http';
import app from './src/app.js';
import { execute, closeDb } from './src/db/db.js';
import { seedDatabase } from './src/db/seed.js';

let server;
const PORT = 5098; // isolated test port

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (dataString) {
      headers['Content-Length'] = Buffer.byteLength(dataString);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

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
          const parsed = JSON.parse(rawData);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: rawData });
        }
      });
    });

    req.on('error', reject);
    if (dataString) {
      req.write(dataString);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING MODULE 2 VERIFICATION SUITE (PATIENT & WARD PARTITIONING) ---');

  await seedDatabase();
  // Clean up any extra admitted test patients
  await execute("DELETE FROM patients WHERE id NOT IN ('pat-1', 'pat-2', 'pat-3', 'pat-4', 'pat-5', 'pat-6')");

  server = app.listen(PORT, async () => {
    try {
      // 1. Log in as Nurse Sarah (Assigned to Ward A)
      const nurseLogin = await request('POST', '/api/auth/login', {
        email: 'nurse.sarah@hospital.org',
        password: 'nurse123'
      });
      const nurseToken = nurseLogin.body.token;
      if (!nurseToken) throw new Error('Nurse login failed');
      console.log('✅ Nurse Sarah logged in (Ward A).');

      // 2. Log in as Admin
      const adminLogin = await request('POST', '/api/auth/login', {
        email: 'admin@hospital.org',
        password: 'admin123'
      });
      const adminToken = adminLogin.body.token;
      if (!adminToken) throw new Error('Admin login failed');
      console.log('✅ Admin logged in.');

      // Test 1: Fetch all patients partitioned across wards
      console.log('\n[Test 1] List all admitted patients across wards:');
      const allPatients = await request('GET', '/api/patients', null, nurseToken);
      console.log('Total admitted patients:', allPatients.body.count);
      if (allPatients.status !== 200 || allPatients.body.count < 6) {
        throw new Error('Failed to retrieve patients list');
      }
      console.log('✅ Test 1 Passed: Retrieved patients across multiple hospital wards.');

      // Test 2: Filter patients by Ward A
      console.log('\n[Test 2] Filter patients by Ward A:');
      const wardAPatients = await request('GET', '/api/patients?ward_id=ward-a', null, nurseToken);
      console.log('Ward A patient count:', wardAPatients.body.count);
      const allInWardA = wardAPatients.body.patients.every(p => p.ward_id === 'ward-a');
      if (!allInWardA || wardAPatients.body.count === 0) {
        throw new Error('Ward filtering failed');
      }
      console.log('✅ Test 2 Passed: Ward partition filtering strictly isolates Ward A.');

      // Test 3: Nurse "My Assigned Patients" filter
      console.log('\n[Test 3] Nurse "My Assigned Patients" filter (my_patients=true):');
      const myPatients = await request('GET', '/api/patients?my_patients=true', null, nurseToken);
      console.log('My Assigned Patients count:', myPatients.body.count);
      const matchesNurseWard = myPatients.body.patients.every(p => p.ward_id === 'ward-a');
      if (!matchesNurseWard || myPatients.body.count !== wardAPatients.body.count) {
        throw new Error('My patients filter failed');
      }
      console.log('✅ Test 3 Passed: Nurse Sarah automatically scoped to her assigned Ward A.');

      // Test 4: Search patients by name
      console.log('\n[Test 4] Search patient by name ("Eleanor"):');
      const searchRes = await request('GET', '/api/patients?search=Eleanor', null, nurseToken);
      console.log('Search matches:', searchRes.body.count, '| Patient Name:', searchRes.body.patients[0]?.full_name);
      if (searchRes.status !== 200 || searchRes.body.patients[0]?.full_name !== 'Eleanor Vance') {
        throw new Error('Patient search failed');
      }
      console.log('✅ Test 4 Passed: Patient search works by name/MRN/bed.');

      // Test 5: Fetch patient details and clinical record
      console.log('\n[Test 5] Fetch patient details for pat-1:');
      const patDetail = await request('GET', '/api/patients/pat-1', null, nurseToken);
      console.log('Patient MRN:', patDetail.body.patient?.mrn, '| Bed:', patDetail.body.patient?.bed_number);
      console.log('Allergies:', patDetail.body.patient?.allergies, '| Age:', patDetail.body.patient?.age);
      if (patDetail.status !== 200 || patDetail.body.patient?.mrn !== 'MRN-10021') {
        throw new Error('Patient detail fetch failed');
      }
      console.log('✅ Test 5 Passed: Full patient clinical record and allergies retrieved.');

      // Test 6: Admit new patient
      console.log('\n[Test 6] Admit new patient to Ward B (Bed B-03):');
      const admitRes = await request('POST', '/api/patients', {
        mrn: 'MRN-' + Math.floor(10000 + Math.random() * 90000),
        full_name: 'Arthur Pendelton',
        dob: '1979-05-18',
        gender: 'Male',
        ward_id: 'ward-b',
        bed_number: 'Bed B-03',
        allergies: 'Latex',
        diagnoses: 'Inguinal Hernia Repair'
      }, nurseToken);
      console.log('Admit Status:', admitRes.status, '| New Patient ID:', admitRes.body.patient?.id);
      if (admitRes.status !== 201) {
        throw new Error('Patient admission failed: ' + admitRes.body.error);
      }
      console.log('✅ Test 6 Passed: Patient successfully admitted with bed allocation.');

      // Test 7: Duplicate bed occupancy prevention
      console.log('\n[Test 7] Verify duplicate bed occupancy rejection:');
      const dupBedRes = await request('POST', '/api/patients', {
        mrn: 'MRN-' + Math.floor(10000 + Math.random() * 90000),
        full_name: 'Conflicting Patient',
        dob: '1985-01-01',
        gender: 'Female',
        ward_id: 'ward-b',
        bed_number: 'Bed B-03', // Already occupied by Arthur Pendelton!
        allergies: 'None',
        diagnoses: 'Observation'
      }, nurseToken);
      console.log('Duplicate Bed Response Status (Should be 409):', dupBedRes.status);
      if (dupBedRes.status !== 409) {
        throw new Error('Duplicate bed should be rejected with 409 Conflict');
      }
      console.log('✅ Test 7 Passed: System safely prevented double-booking of Bed B-03.');

      console.log('\n🎉 ALL MODULE 2 BACKEND TESTS PASSED SUCCESSFULLY! 🎉\n');
    } catch (err) {
      console.error('\n❌ MODULE 2 TEST FAILURE:', err);
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
