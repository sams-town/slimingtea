<?php
// ============================================================
// Homecare Weight Management System — Configuration
// PRODUCTION: hosting cPanel
// ============================================================

define('APP_NAME',    'Homecare Weight Management');
define('APP_VERSION', '1.1.0');

// ── Database Driver: 'mysql' (hosting) ──────────────────────
define('DB_DRIVER', 'mysql');

// ── SQLite (nonaktif di production) ─────────────────────────
define('SQLITE_PATH', __DIR__ . '/../database/homecare.db');

// ── MySQL — Credentials Hosting ─────────────────────────────
define('MYSQL_HOST',    'localhost');
define('MYSQL_PORT',    3306);
define('MYSQL_DBNAME',  'samst652_oz');
define('MYSQL_USER',    'samst652_oz1');
define('MYSQL_PASS',    'samboja90');
define('MYSQL_CHARSET', 'utf8mb4');

// ── Upload ───────────────────────────────────────────────────
define('UPLOAD_DIR',      __DIR__ . '/../uploads/photos/');
define('UPLOAD_URL_PATH', 'uploads/photos/');
define('MAX_UPLOAD_MB',   10);

// ── Security ─────────────────────────────────────────────────
// GANTI token ini setelah deploy pertama!
define('API_TOKEN',   'hcwm-samst652-2025-x9k2');
define('CORS_ORIGIN', '*');

// ── Timezone ─────────────────────────────────────────────────
date_default_timezone_set('Asia/Makassar');

// ── Error Reporting: MATIKAN di production ───────────────────
ini_set('display_errors', 0);
ini_set('log_errors',     1);
ini_set('error_log',      __DIR__ . '/../logs/php_errors.log');
error_reporting(E_ALL);

// ── Buat folder logs jika belum ada ──────────────────────────
$logDir = __DIR__ . '/../logs';
if (!is_dir($logDir)) @mkdir($logDir, 0755, true);
