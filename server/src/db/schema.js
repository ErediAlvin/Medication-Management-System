import { execute, query } from './db.js';

export async function initializeSchema() {
  // 1. Wards Table
  await execute(`
    CREATE TABLE IF NOT EXISTS wards (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      code VARCHAR(32) NOT NULL UNIQUE,
      capacity INT NOT NULL DEFAULT 10,
      location VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. Users Table
  await execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(160) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('ADMIN', 'NURSE', 'PHARMACIST') NOT NULL,
      license_number VARCHAR(64) NULL,
      assigned_ward_id VARCHAR(64) NULL,
      status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_users_role (role),
      INDEX idx_users_ward (assigned_ward_id),
      CONSTRAINT fk_users_ward FOREIGN KEY (assigned_ward_id) REFERENCES wards(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Patients Table (Partitioned by Ward)
  await execute(`
    CREATE TABLE IF NOT EXISTS patients (
      id VARCHAR(64) PRIMARY KEY,
      mrn VARCHAR(64) NOT NULL UNIQUE,
      full_name VARCHAR(120) NOT NULL,
      dob DATE NOT NULL,
      gender VARCHAR(20) NOT NULL,
      ward_id VARCHAR(64) NOT NULL,
      bed_number VARCHAR(32) NOT NULL,
      allergies TEXT NULL,
      diagnoses TEXT NULL,
      status ENUM('ADMITTED', 'DISCHARGED') NOT NULL DEFAULT 'ADMITTED',
      admission_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_patients_ward (ward_id),
      INDEX idx_patients_status (status),
      CONSTRAINT fk_patients_ward FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4. Medication Master Catalog
  await execute(`
    CREATE TABLE IF NOT EXISTS medications (
      id VARCHAR(64) PRIMARY KEY,
      trade_name VARCHAR(120) NOT NULL,
      generic_name VARCHAR(120) NOT NULL,
      dosage_form VARCHAR(64) NOT NULL,
      strength VARCHAR(64) NOT NULL,
      default_route VARCHAR(64) NOT NULL,
      warnings TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_medications_names (trade_name, generic_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 5. Prescriptions (Assigned by Pharmacists)
  await execute(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id VARCHAR(64) PRIMARY KEY,
      patient_id VARCHAR(64) NOT NULL,
      medication_id VARCHAR(64) NOT NULL,
      prescribed_by_id VARCHAR(64) NOT NULL,
      dosage VARCHAR(64) NOT NULL,
      route VARCHAR(64) NOT NULL,
      instructions TEXT NULL,
      slots JSON NOT NULL, -- e.g. ["MORNING", "EVENING"]
      start_date DATE NOT NULL,
      end_date DATE NULL,
      status ENUM('ACTIVE', 'COMPLETED', 'DISCONTINUED') NOT NULL DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_prescriptions_patient (patient_id),
      INDEX idx_prescriptions_status (status),
      CONSTRAINT fk_prescriptions_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      CONSTRAINT fk_prescriptions_medication FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE RESTRICT,
      CONSTRAINT fk_prescriptions_user FOREIGN KEY (prescribed_by_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 6. Daily Dose Schedules (Morning, Afternoon, Evening)
  // UNIQUE KEY uk_prescription_date_slot prevents duplicate scheduling entries
  await execute(`
    CREATE TABLE IF NOT EXISTS dose_schedules (
      id VARCHAR(64) PRIMARY KEY,
      prescription_id VARCHAR(64) NOT NULL,
      patient_id VARCHAR(64) NOT NULL,
      date DATE NOT NULL,
      slot ENUM('MORNING', 'AFTERNOON', 'EVENING') NOT NULL,
      status ENUM('PENDING', 'ADMINISTERED', 'MISSED', 'HELD') NOT NULL DEFAULT 'PENDING',
      target_time VARCHAR(20) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_prescription_date_slot (prescription_id, date, slot),
      INDEX idx_dose_patient_date (patient_id, date),
      INDEX idx_dose_slot_status (slot, status),
      CONSTRAINT fk_dose_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
      CONSTRAINT fk_dose_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 7. Dose Administration Logs (Recorded by Nurses)
  await execute(`
    CREATE TABLE IF NOT EXISTS administration_logs (
      id VARCHAR(64) PRIMARY KEY,
      dose_schedule_id VARCHAR(64) NOT NULL,
      prescription_id VARCHAR(64) NOT NULL,
      patient_id VARCHAR(64) NOT NULL,
      administered_by_id VARCHAR(64) NOT NULL,
      administered_at DATETIME NOT NULL,
      status ENUM('ADMINISTERED', 'HELD', 'REFUSED', 'MISSED') NOT NULL,
      notes TEXT NULL,
      vitals VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin_logs_patient (patient_id),
      CONSTRAINT fk_admin_schedule FOREIGN KEY (dose_schedule_id) REFERENCES dose_schedules(id) ON DELETE RESTRICT,
      CONSTRAINT fk_admin_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE RESTRICT,
      CONSTRAINT fk_admin_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
      CONSTRAINT fk_admin_nurse FOREIGN KEY (administered_by_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 8. Immutable Security & Access Audit Log
  await execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NULL,
      action VARCHAR(80) NOT NULL,
      entity_type VARCHAR(64) NOT NULL,
      entity_id VARCHAR(64) NULL,
      ward_id VARCHAR(64) NULL,
      details TEXT NULL,
      ip_address VARCHAR(64) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_created (created_at),
      INDEX idx_audit_user (user_id),
      CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('[Database] MySQL schema verified and initialized successfully in local database.');
}
