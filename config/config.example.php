<?php
// ============================================================
// Homecare WMS — Template Konfigurasi
// SALIN file ini menjadi: config/config.php  lalu isi credential Anda.
// JANGAN commit config.php ke Git (sudah di .gitignore).
// ============================================================

define('APP_NAME',    'Homecare Sliming');
define('APP_VERSION', '1.2.0');

// ── Database Driver: 'mysql' (hosting cPanel) atau 'sqlite' (lokal)
define('DB_DRIVER', 'mysql');

// ── SQLite (lokal testing)
define('SQLITE_PATH', __DIR__ . '/../database/homecare.db');

// ── MySQL — Credential Hosting cPanel
define('MYSQL_HOST',    'localhost');
define('MYSQL_PORT',    3306);
define('MYSQL_DBNAME',  'samst652_oz');
define('MYSQL_USER',    'samst652_oz1');
define('MYSQL_PASS',    'PASSWORD_ANDA_DISINI');
define('MYSQL_CHARSET', 'utf8mb4');

// ── Upload
define('UPLOAD_DIR',      __DIR__ . '/../uploads/photos/');
define('UPLOAD_URL_PATH', 'uploads/photos/');
define('MAX_UPLOAD_MB',   10);

// ── Security
// GANTI dengan string acak panjang! Contoh: bin2hex(random_bytes(32))
define('API_TOKEN',      'samstown2025_GANTI_INI_DENGAN_RANDOM_64CHAR');
define('CORS_ORIGIN',    '*');
// Webhook secret GitHub — SAMA dengan yang diisi di GitHub Webhook Settings
define('WEBHOOK_SECRET', 'samboja90_deploy_secret_GANTI_JUGA_INI');

// ── Admin Login — GANTI SEGERA!
define('ADMIN_USERNAME', 'admin');
define('ADMIN_PASSWORD_HASH', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'); // default: "password"
// Generate hash baru via: php -r "echo password_hash('password_anda', PASSWORD_DEFAULT);"

// ── Timezone
date_default_timezone_set('Asia/Makassar');

// ── Error Reporting — MATIKAN di PRODUCTION
ini_set('display_errors', 0);
ini_set('log_errors',     1);
ini_set('error_log',      __DIR__ . '/../logs/php_errors.log');
error_reporting(E_ALL);

// ── Auto buat folder logs
$logDir = __DIR__ . '/../logs';
if (!is_dir($logDir)) @mkdir($logDir, 0755, true);
