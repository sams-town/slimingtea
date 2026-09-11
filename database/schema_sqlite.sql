-- ============================================================
-- Homecare Weight Management System - SQLite Schema
-- Gunakan file ini jika menggunakan SQLite (tanpa MySQL)
-- ============================================================

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS patients (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  dob                 TEXT NULL,
  age                 INTEGER NULL,
  sex                 TEXT NOT NULL CHECK(sex IN ('male','female')),
  phone               TEXT NULL,
  address             TEXT NULL,
  registration_date   TEXT NOT NULL DEFAULT (date('now')),
  diabetes            INTEGER DEFAULT 0,
  hypertension        INTEGER DEFAULT 0,
  dyslipidemia        INTEGER DEFAULT 0,
  hyperuricemia       INTEGER DEFAULT 0,
  heart_disease       INTEGER DEFAULT 0,
  other_conditions    TEXT NULL,
  allergies           TEXT NULL,
  sleep_hours         REAL NULL,
  sleep_quality       TEXT NULL CHECK(sleep_quality IN ('good','fair','poor') OR sleep_quality IS NULL),
  activity_level      TEXT NULL,
  activity_detail     TEXT NULL,
  diet_pattern        TEXT NULL,
  diet_detail         TEXT NULL,
  registration_status TEXT NOT NULL DEFAULT 'quick'
                      CHECK(registration_status IN ('quick','full')),
  last_visit_date     TEXT NULL,
  visit_count         INTEGER DEFAULT 0,
  synced              INTEGER DEFAULT 0,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now')),
  deleted_at          TEXT NULL
);

CREATE TABLE IF NOT EXISTS initial_assessments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                TEXT NOT NULL UNIQUE,
  patient_id          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  gds                 REAL NULL,
  total_cholesterol   REAL NULL,
  ldl                 REAL NULL,
  hdl                 REAL NULL,
  triglycerides       REAL NULL,
  uric_acid           REAL NULL,
  hba1c               REAL NULL,
  creatinine          REAL NULL,
  sgot                REAL NULL,
  sgpt                REAL NULL,
  initial_weight      REAL NULL,
  initial_height      REAL NULL,
  initial_bmi         REAL NULL,
  target_weight       REAL NULL,
  target_waist        REAL NULL,
  main_goal           TEXT NULL,
  medication          TEXT DEFAULT 'none',
  medication_other    TEXT NULL,
  starting_dose       TEXT NULL,
  date_started        TEXT NULL,
  meal_plan           TEXT NULL,
  exercise_plan       TEXT NULL,
  additional_notes    TEXT NULL,
  synced              INTEGER DEFAULT 0,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weekly_monitorings (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                TEXT NOT NULL UNIQUE,
  patient_id          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  week_number         INTEGER NOT NULL CHECK(week_number BETWEEN 0 AND 8),
  visit_date          TEXT NOT NULL,
  weight_kg           REAL NULL,
  bmi                 REAL NULL,
  body_fat_pct        REAL NULL,
  body_fat_kg         REAL NULL,
  visceral_fat        REAL NULL,
  muscle_mass_kg      REAL NULL,
  body_age            INTEGER NULL,
  waist_cm            REAL NULL,
  abdomen_cm          REAL NULL,
  hip_cm              REAL NULL,
  bp_systolic         INTEGER NULL,
  bp_diastolic        INTEGER NULL,
  heart_rate          INTEGER NULL,
  fasting_glucose     REAL NULL,
  notes               TEXT NULL,
  synced              INTEGER DEFAULT 0,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now')),
  UNIQUE(patient_id, week_number)
);

CREATE TABLE IF NOT EXISTS body_circumferences (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                TEXT NOT NULL UNIQUE,
  patient_id          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  week_number         INTEGER NOT NULL,
  visit_date          TEXT NOT NULL,
  arm_right_cm        REAL NULL,
  arm_left_cm         REAL NULL,
  chest_cm            REAL NULL,
  waist_cm            REAL NULL,
  abdomen_cm          REAL NULL,
  hip_cm              REAL NULL,
  thigh_right_cm      REAL NULL,
  thigh_left_cm       REAL NULL,
  synced              INTEGER DEFAULT 0,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now')),
  UNIQUE(patient_id, week_number)
);

CREATE TABLE IF NOT EXISTS patient_photos (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                TEXT NOT NULL UNIQUE,
  patient_id          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  week_number         INTEGER NOT NULL,
  visit_date          TEXT NOT NULL,
  photo_path          TEXT NOT NULL,
  photo_type          TEXT DEFAULT 'front' CHECK(photo_type IN ('front','side','back','other')),
  file_size           INTEGER NULL,
  synced              INTEGER DEFAULT 0,
  created_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doctor_notes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                TEXT NOT NULL UNIQUE,
  patient_id          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  week_number         INTEGER NULL,
  visit_date          TEXT NOT NULL,
  note                TEXT NOT NULL,
  author              TEXT DEFAULT 'Doctor',
  synced              INTEGER DEFAULT 0,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name          TEXT NOT NULL,
  record_uuid         TEXT NOT NULL,
  operation           TEXT NOT NULL CHECK(operation IN ('insert','update','delete')),
  payload             TEXT NOT NULL,
  status              TEXT DEFAULT 'pending' CHECK(status IN ('pending','synced','failed')),
  attempts            INTEGER DEFAULT 0,
  last_attempt_at     TEXT NULL,
  created_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sliming_treatments (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                  TEXT NOT NULL UNIQUE,
  code                  TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  category              TEXT NULL,
  duration_minutes      INTEGER DEFAULT 0,
  price                 REAL DEFAULT 0,
  description           TEXT NULL,
  include_injections    INTEGER DEFAULT 0,
  injection_type        TEXT NULL,
  include_consultation  INTEGER DEFAULT 1,
  session_count         INTEGER DEFAULT 1,
  is_active             INTEGER DEFAULT 1,
  sort_order            INTEGER DEFAULT 0,
  created_at            TEXT DEFAULT (datetime('now')),
  updated_at            TEXT DEFAULT (datetime('now')),
  deleted_at            TEXT NULL
);
