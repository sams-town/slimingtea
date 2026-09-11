-- ============================================================
-- Homecare Weight Management System
-- MySQL / MariaDB Schema - UNTUK PHPMY ADMIN HOSTING
-- Database: samst652_oz
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- Tabel: patients
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `patients` (
  `id`                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`                  CHAR(36) NOT NULL UNIQUE,
  `name`                  VARCHAR(150) NOT NULL,
  `dob`                   DATE NULL,
  `age`                   TINYINT UNSIGNED NULL,
  `sex`                   ENUM('male','female') NOT NULL,
  `phone`                 VARCHAR(20) NULL,
  `address`               TEXT NULL,
  `registration_date`     DATE NOT NULL,
  `registration_status`   ENUM('quick','full') NOT NULL DEFAULT 'quick',
  `last_visit_date`       DATE NULL,
  `visit_count`           SMALLINT UNSIGNED DEFAULT 0,
  `diabetes`              TINYINT(1) DEFAULT 0,
  `hypertension`          TINYINT(1) DEFAULT 0,
  `dyslipidemia`          TINYINT(1) DEFAULT 0,
  `hyperuricemia`         TINYINT(1) DEFAULT 0,
  `heart_disease`         TINYINT(1) DEFAULT 0,
  `other_conditions`      TEXT NULL,
  `allergies`             TEXT NULL,
  `sleep_hours`           DECIMAL(4,1) NULL,
  `sleep_quality`         ENUM('good','fair','poor') NULL,
  `activity_level`        ENUM('sedentary','lightly_active','moderately_active','very_active') NULL,
  `activity_detail`       TEXT NULL,
  `diet_pattern`          ENUM('regular','low_carb','vegetarian','vegan','intermittent_fasting','other') NULL,
  `diet_detail`           TEXT NULL,
  `synced`                TINYINT(1) DEFAULT 0,
  `created_at`            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`            TIMESTAMP NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabel: initial_assessments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `initial_assessments` (
  `id`                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`                  CHAR(36) NOT NULL UNIQUE,
  `patient_id`            INT UNSIGNED NOT NULL,
  `gds`                   DECIMAL(6,2) NULL,
  `total_cholesterol`     DECIMAL(6,2) NULL,
  `ldl`                   DECIMAL(6,2) NULL,
  `hdl`                   DECIMAL(6,2) NULL,
  `triglycerides`         DECIMAL(6,2) NULL,
  `uric_acid`             DECIMAL(5,2) NULL,
  `hba1c`                 DECIMAL(5,2) NULL,
  `creatinine`            DECIMAL(5,2) NULL,
  `sgot`                  DECIMAL(6,2) NULL,
  `sgpt`                  DECIMAL(6,2) NULL,
  `initial_weight`        DECIMAL(5,2) NULL,
  `initial_height`        DECIMAL(5,2) NULL,
  `initial_bmi`           DECIMAL(5,2) NULL,
  `target_weight`         DECIMAL(5,2) NULL,
  `target_waist`          DECIMAL(5,2) NULL,
  `main_goal`             TEXT NULL,
  `medication`            ENUM('none','Semaglutide','Tirzepatide','Liraglutide','Orlistat','Other') DEFAULT 'none',
  `medication_other`      VARCHAR(100) NULL,
  `starting_dose`         VARCHAR(50) NULL,
  `date_started`          DATE NULL,
  `meal_plan`             TEXT NULL,
  `exercise_plan`         TEXT NULL,
  `additional_notes`      TEXT NULL,
  `synced`                TINYINT(1) DEFAULT 0,
  `created_at`            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabel: weekly_monitorings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `weekly_monitorings` (
  `id`                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`                  CHAR(36) NOT NULL UNIQUE,
  `patient_id`            INT UNSIGNED NOT NULL,
  `week_number`           TINYINT UNSIGNED NOT NULL,
  `visit_date`            DATE NOT NULL,
  `weight_kg`             DECIMAL(5,2) NULL,
  `bmi`                   DECIMAL(5,2) NULL,
  `body_fat_pct`          DECIMAL(5,2) NULL,
  `body_fat_kg`           DECIMAL(5,2) NULL,
  `visceral_fat`          DECIMAL(5,2) NULL,
  `muscle_mass_kg`        DECIMAL(5,2) NULL,
  `body_age`              TINYINT UNSIGNED NULL,
  `waist_cm`              DECIMAL(5,2) NULL,
  `abdomen_cm`            DECIMAL(5,2) NULL,
  `hip_cm`                DECIMAL(5,2) NULL,
  `bp_systolic`           SMALLINT UNSIGNED NULL,
  `bp_diastolic`          SMALLINT UNSIGNED NULL,
  `heart_rate`            SMALLINT UNSIGNED NULL,
  `fasting_glucose`       DECIMAL(6,2) NULL,
  `notes`                 TEXT NULL,
  `synced`                TINYINT(1) DEFAULT 0,
  `created_at`            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_patient_week` (`patient_id`, `week_number`),
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabel: body_circumferences
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `body_circumferences` (
  `id`                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`                  CHAR(36) NOT NULL UNIQUE,
  `patient_id`            INT UNSIGNED NOT NULL,
  `week_number`           TINYINT UNSIGNED NOT NULL,
  `visit_date`            DATE NOT NULL,
  `arm_right_cm`          DECIMAL(5,2) NULL,
  `arm_left_cm`           DECIMAL(5,2) NULL,
  `chest_cm`              DECIMAL(5,2) NULL,
  `waist_cm`              DECIMAL(5,2) NULL,
  `abdomen_cm`            DECIMAL(5,2) NULL,
  `hip_cm`                DECIMAL(5,2) NULL,
  `thigh_right_cm`        DECIMAL(5,2) NULL,
  `thigh_left_cm`         DECIMAL(5,2) NULL,
  `synced`                TINYINT(1) DEFAULT 0,
  `created_at`            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_circ_patient_week` (`patient_id`, `week_number`),
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabel: patient_photos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `patient_photos` (
  `id`                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`                  CHAR(36) NOT NULL UNIQUE,
  `patient_id`            INT UNSIGNED NOT NULL,
  `week_number`           TINYINT UNSIGNED NOT NULL,
  `visit_date`            DATE NOT NULL,
  `photo_path`            VARCHAR(255) NOT NULL,
  `photo_type`            ENUM('front','side','back','other') DEFAULT 'front',
  `file_size`             INT UNSIGNED NULL,
  `synced`                TINYINT(1) DEFAULT 0,
  `created_at`            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabel: doctor_notes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `doctor_notes` (
  `id`                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`                  CHAR(36) NOT NULL UNIQUE,
  `patient_id`            INT UNSIGNED NOT NULL,
  `week_number`           TINYINT UNSIGNED NULL,
  `visit_date`            DATE NOT NULL,
  `note`                  TEXT NOT NULL,
  `author`                VARCHAR(100) NULL DEFAULT 'Doctor',
  `synced`                TINYINT(1) DEFAULT 0,
  `created_at`            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabel: sync_queue
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sync_queue` (
  `id`                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `table_name`            VARCHAR(50) NOT NULL,
  `record_uuid`           CHAR(36) NOT NULL,
  `operation`             ENUM('insert','update','delete') NOT NULL,
  `payload`               LONGTEXT NOT NULL,
  `status`                ENUM('pending','synced','failed') DEFAULT 'pending',
  `attempts`              TINYINT UNSIGNED DEFAULT 0,
  `last_attempt_at`       TIMESTAMP NULL,
  `created_at`            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
