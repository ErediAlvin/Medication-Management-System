import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { execute, queryOne, closeDb } from './db.js';
import { initializeSchema } from './schema.js';

export async function seedDatabase() {
  console.log('[Seed] Initializing MySQL schema...');
  await initializeSchema();

  console.log('[Seed] Seeding initial master data in local MySQL database...');

  // 1. Seed Wards
  const existingWards = await queryOne('SELECT COUNT(*) as count FROM wards');
  if (existingWards.count === 0) {
    const insertWard = `
      INSERT INTO wards (id, name, code, capacity, location)
      VALUES (?, ?, ?, ?, ?)
    `;

    await execute(insertWard, ['ward-a', 'General Medicine Ward A', 'GEN-A', 20, 'Building 1, Floor 2']);
    await execute(insertWard, ['ward-b', 'Surgical & Post-Op Ward B', 'SURG-B', 15, 'Building 1, Floor 3']);
    await execute(insertWard, ['ward-c', 'Intensive Care Unit (ICU)', 'ICU', 10, 'Building 2, Floor 1']);
    console.log('[Seed] Wards seeded: General Medicine (Ward A), Surgical (Ward B), ICU (Ward C)');
  }

  // 2. Seed Users
  const existingUsers = await queryOne('SELECT COUNT(*) as count FROM users');
  if (existingUsers.count === 0) {
    const insertUser = `
      INSERT INTO users (id, name, email, password_hash, role, license_number, assigned_ward_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const adminHash = await bcrypt.hash('admin123', 10);
    const pharmHash = await bcrypt.hash('pharm123', 10);
    const nurseHash = await bcrypt.hash('nurse123', 10);

    // Admin
    await execute(insertUser, [
      'user-admin-1',
      'Hospital System Administrator',
      'admin@hospital.org',
      adminHash,
      'ADMIN',
      'SYS-ADM-001',
      null,
      'ACTIVE'
    ]);

    // Pharmacist
    await execute(insertUser, [
      'user-pharm-1',
      'Dr. Evelyn Reed, PharmD',
      'pharmacist@hospital.org',
      pharmHash,
      'PHARMACIST',
      'RPH-99241',
      null,
      'ACTIVE'
    ]);

    // Nurse Sarah (Ward A)
    await execute(insertUser, [
      'user-nurse-1',
      'Nurse Sarah Jenkins, RN',
      'nurse.sarah@hospital.org',
      nurseHash,
      'NURSE',
      'RN-44019',
      'ward-a',
      'ACTIVE'
    ]);

    // Nurse David (Ward B)
    await execute(insertUser, [
      'user-nurse-2',
      'Nurse David Chen, BSN',
      'nurse.david@hospital.org',
      nurseHash,
      'NURSE',
      'RN-55210',
      'ward-b',
      'ACTIVE'
    ]);

    console.log('[Seed] Users seeded: Admin, Pharmacist (Dr. Reed), Nurse Sarah (Ward A), Nurse David (Ward B)');
  }

  // 3. Seed Sample Medications
  const existingMeds = await queryOne('SELECT COUNT(*) as count FROM medications');
  if (existingMeds.count === 0) {
    const insertMed = `
      INSERT INTO medications (id, trade_name, generic_name, dosage_form, strength, default_route, warnings)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await execute(insertMed, ['med-1', 'Paracetamol', 'Acetaminophen', 'Tablet', '500 mg', 'Oral', 'Do not exceed 4000mg/24hr. Monitor liver function.']);
    await execute(insertMed, ['med-2', 'Amoxicillin', 'Amoxicillin Trihydrate', 'Capsule', '500 mg', 'Oral', 'Verify Penicillin allergy prior to dispensing.']);
    await execute(insertMed, ['med-3', 'Metformin HCl', 'Metformin Hydrochloride', 'Tablet', '850 mg', 'Oral', 'Administer with or after meals to minimize GI irritation.']);
    await execute(insertMed, ['med-4', 'Lisinopril', 'Lisinopril', 'Tablet', '10 mg', 'Oral', 'Monitor blood pressure and serum potassium.']);
    await execute(insertMed, ['med-5', 'Atorvastatin', 'Atorvastatin Calcium', 'Tablet', '20 mg', 'Oral', 'Target evening administration. Monitor for muscle tenderness.']);
    await execute(insertMed, ['med-6', 'Ceftriaxone', 'Ceftriaxone Sodium', 'Vial for Injection', '1 g', 'IV', 'Reconstitute as directed. Infuse over 30 minutes.']);
    await execute(insertMed, ['med-7', 'Insulin Glargine', 'Insulin Glargine (rDNA)', 'Pen Cartridge', '100 units/ml', 'Subcutaneous', 'High Alert: Rotate injection sites daily.']);
    console.log('[Seed] Medications catalog seeded.');
  }

  // 4. Seed Patients Partitioned by Ward
  const existingPatients = await queryOne('SELECT COUNT(*) as count FROM patients');
  if (existingPatients.count === 0) {
    const insertPatient = `
      INSERT INTO patients (id, mrn, full_name, dob, gender, ward_id, bed_number, allergies, diagnoses, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ward A Patients
    await execute(insertPatient, ['pat-1', 'MRN-10021', 'Eleanor Vance', '1962-04-12', 'Female', 'ward-a', 'Bed A-01', 'Penicillin', 'Type 2 Diabetes, Hypertension', 'ADMITTED']);
    await execute(insertPatient, ['pat-2', 'MRN-10022', 'James Kowalski', '1955-11-28', 'Male', 'ward-a', 'Bed A-02', 'Sulfa Drugs', 'Bacterial Pneumonia', 'ADMITTED']);
    await execute(insertPatient, ['pat-3', 'MRN-10023', 'Maria Santos', '1988-07-03', 'Female', 'ward-a', 'Bed A-03', 'None Known', 'Acute Bronchitis', 'ADMITTED']);

    // Ward B Patients
    await execute(insertPatient, ['pat-4', 'MRN-20054', 'Robert Sterling', '1974-02-19', 'Male', 'ward-b', 'Bed B-01', 'Aspirin', 'Post-Op Knee Arthroplasty', 'ADMITTED']);
    await execute(insertPatient, ['pat-5', 'MRN-20055', 'Amina Yusuf', '1991-09-14', 'Female', 'ward-b', 'Bed B-02', 'NSAIDs', 'Post-Op Appendectomy', 'ADMITTED']);

    // Ward C Patients (ICU)
    await execute(insertPatient, ['pat-6', 'MRN-30089', 'Thomas Gallagher', '1968-12-05', 'Male', 'ward-c', 'Bed ICU-01', 'Codeine', 'Sepsis, Acute Respiratory Failure', 'ADMITTED']);
    console.log('[Seed] Patients seeded across Ward A, Ward B, and ICU.');
  }

  // 5. Audit Log for System Initialization
  const auditId = 'audit-init-' + crypto.randomBytes(4).toString('hex');
  await execute(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [auditId, 'user-admin-1', 'SYSTEM_INITIALIZATION', 'SYSTEM', 'ROOT', 'Initial MySQL database schema and master seed data created successfully.']);

  console.log('[Seed] Local MySQL database initialization and seed completed successfully!');
}

// Run if called directly
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed Error]:', err);
      await closeDb();
      process.exit(1);
    });
}
