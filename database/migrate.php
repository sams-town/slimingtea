<?php
// ============================================================
// Migration Script - jalankan sekali via CLI atau browser
// php database/migrate.php
// ============================================================
require_once __DIR__ . '/../config/database.php';

$pdo    = Database::getInstance();
$driver = DB_DRIVER;

echo "=== Homecare WMS Migration ===\n";
echo "Driver : " . strtoupper($driver) . "\n\n";

$schemaFile = $driver === 'sqlite'
    ? __DIR__ . '/schema_sqlite.sql'
    : __DIR__ . '/schema.sql';

if (!file_exists($schemaFile)) {
    die("ERROR: Schema file not found: $schemaFile\n");
}

$sql = file_get_contents($schemaFile);

// Pisahkan statement per titik-koma, skip komentar
$statements = array_filter(
    array_map('trim', explode(';', $sql)),
    fn($s) => !empty($s) && !str_starts_with(ltrim($s), '--')
);

$success = 0;
$failed  = 0;

foreach ($statements as $stmt) {
    if (empty(trim($stmt))) continue;
    try {
        $pdo->exec($stmt);
        $success++;
    } catch (PDOException $e) {
        // Abaikan "already exists" untuk re-run yang aman
        if (str_contains($e->getMessage(), 'already exists') ||
            str_contains($e->getMessage(), 'duplicate')) {
            $success++;
        } else {
            echo "WARN: " . $e->getMessage() . "\n";
            $failed++;
        }
    }
}

echo "Statements executed : $success\n";
echo "Warnings/Errors     : $failed\n";

// ============================================================
// ALTER TABLE — tambah kolom baru yang mungkin belum ada
// (aman dijalankan berulang kali)
// ============================================================
echo "\n--- Running column migrations ---\n";

$alterations = [];

if ($driver === 'sqlite') {
    // SQLite: cek via PRAGMA table_info
    $cols = $pdo->query("PRAGMA table_info(patients)")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('registration_status', $cols)) {
        $alterations[] = "ALTER TABLE patients ADD COLUMN registration_status TEXT NOT NULL DEFAULT 'quick'";
    }
    if (!in_array('last_visit_date', $cols)) {
        $alterations[] = "ALTER TABLE patients ADD COLUMN last_visit_date TEXT NULL";
    }
    if (!in_array('visit_count', $cols)) {
        $alterations[] = "ALTER TABLE patients ADD COLUMN visit_count INTEGER DEFAULT 0";
    }
} else {
    // MySQL: cek via INFORMATION_SCHEMA
    $dbName = MYSQL_DBNAME;
    $existCols = $pdo->query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA='$dbName' AND TABLE_NAME='patients'"
    )->fetchAll(PDO::FETCH_COLUMN);

    if (!in_array('registration_status', $existCols)) {
        $alterations[] = "ALTER TABLE `patients` ADD COLUMN `registration_status`
                          ENUM('quick','full') NOT NULL DEFAULT 'quick'
                          COMMENT 'quick=daftar cepat, full=sudah lengkap'";
    }
    if (!in_array('last_visit_date', $existCols)) {
        $alterations[] = "ALTER TABLE `patients` ADD COLUMN `last_visit_date` DATE NULL";
    }
    if (!in_array('visit_count', $existCols)) {
        $alterations[] = "ALTER TABLE `patients` ADD COLUMN `visit_count` SMALLINT UNSIGNED DEFAULT 0";
    }
}

foreach ($alterations as $alt) {
    try {
        $pdo->exec($alt);
        echo "  ADDED  : " . trim(preg_replace('/\s+/', ' ', substr($alt, 0, 80))) . "...\n";
    } catch (PDOException $e) {
        echo "  SKIP   : " . $e->getMessage() . "\n";
    }
}

if (empty($alterations)) {
    echo "  All columns already up-to-date.\n";
}

echo "\nMigration completed!\n";

if ($driver === 'sqlite') {
    echo "SQLite DB path: " . SQLITE_PATH . "\n";
}
