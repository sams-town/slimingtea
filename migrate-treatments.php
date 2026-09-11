<?php
// =============================================================
// Migration: Buat tabel sliming_treatments
// TANPA shell_exec — pure PDO. Jalankan via browser.
// =============================================================
define('RUNNER_KEY', 'deploy_samboja_2026_ganti_segera');
if (!isset($_GET['key']) || !hash_equals(RUNNER_KEY, $_GET['key'])) {
    http_response_code(403);
    die('Access denied. Gunakan ?key=...');
}
header('Content-Type: text/plain; charset=utf-8');

echo "=== MIGRASI TABEL sliming_treatments (pure PDO) ===\n\n";

// Load config
$configPath = __DIR__ . '/config/config.php';
$dbPath     = __DIR__ . '/config/database.php';
if (!file_exists($configPath)) {
    echo "[ERROR] config/config.php TIDAK ADA.\n";
    echo "SOLUSI: Buka File Manager → slimingtea/config/\n";
    echo "→ Copy 'config.example.php' → rename jadi 'config.php'\n";
    echo "→ Edit config.php: ISI MYSQL_PASS dengan password DB asli server.\n";
    die();
}
require_once $configPath;
if (!file_exists($dbPath)) {
    die("[ERROR] config/database.php TIDAK ADA.\n");
}
require_once $dbPath;

echo "DB Driver: " . DB_DRIVER . "\n";
if (DB_DRIVER === 'mysql') {
    echo "MySQL DB : " . MYSQL_DBNAME . " @ " . MYSQL_HOST . "\n";
} else {
    echo "SQLite   : " . SQLITE_PATH . "\n";
}
echo "\n";

try {
    $pdo = Database::getInstance();
    echo "[OK] Koneksi DB berhasil.\n\n";
} catch (Throwable $e) {
    echo "[ERROR] Koneksi DB GAGAL: " . $e->getMessage() . "\n";
    echo "\nSOLUSI: Edit config/config.php → pastikan:\n";
    echo "  MYSQL_HOST, MYSQL_DBNAME, MYSQL_USER, MYSQL_PASS sudah BENAR.\n";
    die();
}

// Buat tabel
$sql = "CREATE TABLE IF NOT EXISTS `sliming_treatments` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(200) NOT NULL,
  `category` VARCHAR(100) NULL,
  `duration_minutes` SMALLINT UNSIGNED DEFAULT 0,
  `price` DECIMAL(12,0) DEFAULT 0,
  `description` TEXT NULL,
  `include_injections` TINYINT(1) DEFAULT 0,
  `injection_type` VARCHAR(100) NULL,
  `include_consultation` TINYINT(1) DEFAULT 1,
  `session_count` TINYINT UNSIGNED DEFAULT 1,
  `is_active` TINYINT(1) DEFAULT 1,
  `sort_order` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  INDEX `idx_active` (`is_active`),
  INDEX `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

// Untuk SQLite, ganti sintaks MySQL
if (DB_DRIVER === 'sqlite') {
    $sql = "CREATE TABLE IF NOT EXISTS sliming_treatments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NULL,
      duration_minutes INTEGER DEFAULT 0,
      price REAL DEFAULT 0,
      description TEXT NULL,
      include_injections INTEGER DEFAULT 0,
      injection_type TEXT NULL,
      include_consultation INTEGER DEFAULT 1,
      session_count INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT NULL
    )";
}

try {
    $pdo->exec($sql);
    echo "[OK] Query CREATE TABLE dieksekusi.\n";
} catch (Throwable $e) {
    echo "[ERROR] Query GAGAL: " . $e->getMessage() . "\n";
    die();
}

// VERIFIKASI tabel ada
echo "\n=== VERIFIKASI ===\n";
$tableExist = false;
try {
    if (DB_DRIVER === 'mysql') {
        $stmt = $pdo->query("SHOW TABLES LIKE 'sliming_treatments'");
        $tableExist = $stmt && $stmt->rowCount() > 0;
    } else {
        $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='sliming_treatments'");
        $tableExist = $stmt && $stmt->fetch() !== false;
    }
} catch (Throwable $e) {
    echo "[WARN] Cek tabel gagal: " . $e->getMessage() . "\n";
}

if ($tableExist) {
    echo "[OK] ✅ TABEL sliming_treatments SUDAH ADA di DB.\n";
    // Cek kolom
    $cols = [];
    try {
        if (DB_DRIVER === 'mysql') {
            $res = $pdo->query("DESCRIBE sliming_treatments");
            while ($r = $res->fetch(PDO::FETCH_ASSOC)) { $cols[] = $r['Field']; }
        } else {
            $res = $pdo->query("PRAGMA table_info(sliming_treatments)");
            while ($r = $res->fetch(PDO::FETCH_ASSOC)) { $cols[] = $r['name']; }
        }
    } catch (Throwable $e) { echo "Cek kolom error: ".$e->getMessage()."\n"; }
    $required = ['id','uuid','code','name','price','is_active','created_at','deleted_at'];
    $miss = array_diff($required, $cols);
    echo (empty($miss) ? "[OK] Semua kolom KRITIS terpenuhi.\n"
                       : "[WARN] Kolom yang kurang: " . implode(', ', $miss) . "\n");
    echo "  Daftar kolom ditemukan (".count($cols)."): " . implode(', ', $cols) . "\n";
} else {
    echo "[ERROR] ❌ TABEL sliming_treatments TIDAK DITEMUKAN setelah query.\n";
    die();
}

echo "\n=== SELESAI ===\n";
echo "Langkah berikutnya: cek-server.php?key=... untuk verifikasi file & API.\n";
?>
