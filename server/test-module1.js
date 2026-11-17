import http from 'http';
import app from './src/app.js';
import { closeDb } from './src/db/db.js';
import { seedDatabase } from './src/db/seed.js';

let server;
const PORT = 5099; // isolated test port

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
  console.log('--- STARTING MODULE 1 VERIFICATION SUITE (LOCAL MYSQL DATABASE) ---');

  // Seed data in MySQL
  await seedDatabase();

  server = app.listen(PORT, async () => {
    try {
      // Test 1: Health check & DB connection
      console.log('\n[Test 1] Health & DB Connection check:');
      const health = await request('GET', '/api/health');
      console.log('Status:', health.status, '| DB:', health.body.database, `(${health.body.host}:${health.body.port}/${health.body.databaseName})`);
      if (health.status !== 200 || !health.body.database.includes('CONNECTED')) {
        throw new Error('Health check failed');
      }
      console.log('✅ Test 1 Passed: Local MySQL Server connected and responsive.');

      // Test 2: Demo Accounts Listing
      console.log('\n[Test 2] Demo Accounts Endpoint:');
      const demo = await request('GET', '/api/auth/demo-accounts');
      console.log(`Found ${demo.body.accounts?.length} demo accounts.`);
      if (demo.status !== 200 || !demo.body.accounts?.length) {
        throw new Error('Demo accounts failed');
      }
      console.log('✅ Test 2 Passed: Demo accounts retrieved from MySQL.');

      // Test 3: Admin Login
      console.log('\n[Test 3] Admin Login:');
      const adminLogin = await request('POST', '/api/auth/login', {
        email: 'admin@hospital.org',
        password: 'admin123'
      });
      console.log('Admin Login Status:', adminLogin.status, '| Role:', adminLogin.body.user?.role);
      const adminToken = adminLogin.body.token;
      if (adminLogin.status !== 200 || !adminToken || adminLogin.body.user.role !== 'ADMIN') {
        throw new Error('Admin login failed');
      }
      console.log('✅ Test 3 Passed: Admin login authenticated successfully against MySQL.');

      // Test 4: Pharmacist Login & Permission Guard Verification
      console.log('\n[Test 4] Pharmacist Login & Permission Check:');
      const pharmLogin = await request('POST', '/api/auth/login', {
        email: 'pharmacist@hospital.org',
        password: 'pharm123'
      });
      console.log('Pharm Login Status:', pharmLogin.status, '| Role:', pharmLogin.body.user?.role);
      console.log('canAdministerMedication:', pharmLogin.body.permissions?.canAdministerMedication);
      const pharmToken = pharmLogin.body.token;
      if (pharmLogin.body.permissions?.canAdministerMedication !== false) {
        throw new Error('Pharmacist should NOT have canAdministerMedication permission');
      }
      console.log('✅ Test 4 Passed: Pharmacist verified and restricted from administering medication.');

      // Test 5: Nurse Sarah Login & Ward Scoping
      console.log('\n[Test 5] Nurse Sarah Login (Ward A):');
      const nurseLogin = await request('POST', '/api/auth/login', {
        email: 'nurse.sarah@hospital.org',
        password: 'nurse123'
      });
      console.log('Nurse Login Status:', nurseLogin.status, '| Assigned Ward:', nurseLogin.body.user?.assigned_ward_id);
      console.log('canAdministerMedication:', nurseLogin.body.permissions?.canAdministerMedication);
      const nurseToken = nurseLogin.body.token;
      if (nurseLogin.body.permissions?.canAdministerMedication !== true || nurseLogin.body.user.assigned_ward_id !== 'ward-a') {
        throw new Error('Nurse permissions or ward assignment failed');
      }
      console.log('✅ Test 5 Passed: Nurse Sarah correctly authenticated with Ward A assignment.');

      // Test 6: RBAC Route Guard (Admin-only Users endpoint)
      console.log('\n[Test 6] RBAC Guard on /api/users:');
      const nurseAccessUsers = await request('GET', '/api/users', null, nurseToken);
      console.log('Nurse access to /api/users (Should be 403):', nurseAccessUsers.status);
      if (nurseAccessUsers.status !== 403) {
        throw new Error('Nurse should be blocked from /api/users with 403');
      }

      const adminAccessUsers = await request('GET', '/api/users', null, adminToken);
      console.log('Admin access to /api/users (Should be 200):', adminAccessUsers.status, `| Total users: ${adminAccessUsers.body.users?.length}`);
      if (adminAccessUsers.status !== 200 || !adminAccessUsers.body.users?.length) {
        throw new Error('Admin access to /api/users failed');
      }
      console.log('✅ Test 6 Passed: RBAC properly blocks non-admins and allows admins.');

      // Test 7: Wards Listing
      console.log('\n[Test 7] Wards Listing /api/wards:');
      const wardsRes = await request('GET', '/api/wards', null, nurseToken);
      console.log('Wards Status:', wardsRes.status, `| Count: ${wardsRes.body.wards?.length}`);
      if (wardsRes.status !== 200 || wardsRes.body.wards?.length !== 3) {
        throw new Error('Failed to retrieve 3 wards');
      }
      console.log('✅ Test 7 Passed: Wards retrieved with bed and staff statistics.');

      console.log('\n🎉 ALL MODULE 1 TESTS PASSED ON LOCAL MYSQL DATABASE! 🎉\n');
    } catch (err) {
      console.error('\n❌ TEST FAILURE:', err);
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
