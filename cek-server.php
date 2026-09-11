<?php
// =============================================================
// Tool: Cek kelengkapan file, config.php, dan tes panggil API
// TANPA shell_exec — pure PHP
// =============================================================
define('RUNNER_KEY', 'deploy_samboja_2026_ganti_segera');
if (!isset($_GET['key']) || !hash_equals(RUNNER_KEY, $_GET['key'])) {
    http_response_code(403);
    die('Access denied. Gunakan ?key=...');
}
header('Content-Type: text/plain; charset=utf-8');

echo "=== CEK SERVER HOMECARE SLIMING TEA ===\n";
echo "Waktu  : " . date('Y-m-d H:i:s') . "\n";
echo "PHP    : " . PHP_VERSION . " | SAPI: " . PHP_SAPI . "\n";
echo "Dir    : " . __DIR__ . "\n";
echo "HTTPS  : " . (empty($_SERVER['HTTPS']) ? 'NO ⚠️ (gunakan HTTPS!)' : 'YES ✅') . "\n";
echo "\n";

// 1. Cek ekstensi PHP
echo "=== 1. EKSTENSI PHP ===";
$exts = ['pdo','pdo_mysql','pdo_sqlite','gd','fileinfo','mbstring','json'];
$missExt = [];
foreach ($exts as $e) {
    $ok = extension_loaded($e);
    echo "\n  " . ($ok ? '✅' : '❌') . " $e: " . ($ok ? 'OK' : 'MISSING');
    if (!$ok) $missExt[] = $e;
}
echo "\n" . (empty($missExt) ? "✅ Semua ekstensi tersedia.\n" : "⚠️ Ekstensi kurang: " . implode(', ', $missExt) . "\n") . "\n";

// 2. Cek file penting
echo "=== 2. FILE PENTING ===\n";
$files = [
    'index.html', 'manifest.json', 'sw.js', '.htaccess', '.cpanel.yml',
    'api/auth.php','api/treatments.php','api/patients.php','api/helpers.php',
    'api/assessments.php','api/monitorings.php','api/photos.php','api/notes.php','api/sync.php',
    'config/database.php','config/config.example.php',
    'deploy/webhook.php','deploy/gh-webhook-deploy.sh',
    'assets/js/app.js','assets/js/db.js','assets/js/api.js','assets/css/app.css',
    'database/schema.sql','database/schema_mysql_hosting.sql','database/schema_sqlite.sql',
];
$missFiles = [];
foreach ($files as $f) {
    $ok = file_exists($f);
    if (!$ok) $missFiles[] = $f;
    echo "  " . ($ok ? '✅' : '❌') . " $f\n";
}
echo (empty($missFiles) ? "✅ Semua file penting ada.\n" : "⚠️ File kurang (" . count($missFiles) . "): " . implode(', ', $missFiles) . "\n") . "\n";

// 3. Config.php ada & DB connect
echo "=== 3. CONFIG DAN KONEKSI DB ===\n";
$configPath = __DIR__ . '/config/config.php';
if (!file_exists($configPath)) {
    echo "❌ config/config.php TIDAK ADA. Buat DULU VIA FILE MANAGER:\n";
    echo "   → slimingtea/config/ → copy config.example.php → rename jadi config.php\n";
    echo "   → Edit: MYSQL_PASS, MYSQL_USER, MYSQL_DBNAME, API_TOKEN, ADMIN_PASSWORD_HASH\n";
} else {
    echo "✅ config/config.php ada.\n";
    @require_once $configPath;
    echo "   APP_NAME    : " . (defined('APP_NAME') ? APP_NAME : '?') . "\n";
    echo "   APP_VERSION : " . (defined('APP_VERSION') ? APP_VERSION : '?') . "\n";
    echo "   DB_DRIVER   : " . (defined('DB_DRIVER') ? DB_DRIVER : '?') . "\n";
    echo "   API_TOKEN   : " . (defined('API_TOKEN') ? (strlen(API_TOKEN) >= 16 ? '✅ di-set ('.strlen(API_TOKEN).' char)' : '⚠️ TERLALU PENDEK') : 'TIDAK ADA') . "\n";
    echo "   ADMIN_USER  : " . (defined('ADMIN_USERNAME') ? ADMIN_USERNAME : '?') . "\n";
    echo "   ADMIN_HASH  : " . (defined('ADMIN_PASSWORD_HASH') ? (strlen(ADMIN_PASSWORD_HASH) > 30 ? '✅ di-set' : '⚠️ KOSONG/pendek (fallback password=admin123)') : 'TIDAK ADA') . "\n";
    if (defined('WEBHOOK_SECRET') && WEBHOOK_SECRET !== '') {
        echo "   WEBHOOK_SCR : di-set ✅\n";
    } else {
        echo "   WEBHOOK_SCR : KOSONG ⚠️\n";
    }
    if (defined('MYSQL_PASS') && MYSQL_PASS === 'PASSWORD_ANDA_DISINI') {
        echo "   ⚠️  MYSQL_PASS MASIH DEFAULT! Edit config.php SEGERA.\n";
    }
    // Test koneksi
    $dbPath = __DIR__ . '/config/database.php';
    if (file_exists($dbPath)) {
        require_once $dbPath;
        try {
            $pdo = Database::getInstance();
            echo "   ✅ Koneksi DB berhasil.\n";
            // Cek tabel sliming_treatments dan patients
            $chkT = false; $chkP = false;
            try {
                if (DB_DRIVER === 'mysql') {
                    $chkT = $pdo->query("SHOW TABLES LIKE 'sliming_treatments'")->rowCount() > 0;
                    $chkP = $pdo->query("SHOW TABLES LIKE 'patients'")->rowCount() > 0;
                } else {
                    $chkT = !!$pdo->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sliming_treatments'")->fetch();
                    $chkP = !!$pdo->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='patients'")->fetch();
                }
            } catch (Throwable $e) { echo "   Cek tabel warn: ".$e->getMessage()."\n"; }
            echo "   TABEL patients           : " . ($chkP ? '✅ ADA' : '❌ TIDAK ADA (jalankan migrate)') . "\n";
            echo "   TABEL sliming_treatments: " . ($chkT ? '✅ ADA' : '❌ TIDAK ADA (jalankan migrate-treatments.php)') . "\n";
        } catch (Throwable $e) {
            echo "   ❌ Koneksi DB GAGAL: " . $e->getMessage() . "\n";
            echo "   → Periksa MYSQL_HOST/USER/PASS/DBNAME di config/config.php\n";
        }
    }
}
echo "\n";

// 4. Clear OPcache
echo "=== 4. CACHE PHP ===\n";
if (function_exists('opcache_reset')) {
    $ok = @opcache_reset();
    echo ($ok ? "✅ OPcache di-reset.\n" : "⚠️ OPcache reset gagal / opcode off.\n");
} else {
    echo "ℹ️ OPcache tidak aktif.\n";
}
if (function_exists('apc_clear_cache')) { @apc_clear_cache(); echo "✅ APC cache di-clear.\n"; }
echo "\n";

// 5. Permission folder uploads & logs
echo "=== 5. FOLDER UPLOADS + LOGS (permission) ===\n";
$photoDir = __DIR__ . '/uploads/photos';
$logDir   = __DIR__ . '/logs';
if (!is_dir($photoDir)) { @mkdir($photoDir, 0755, true); echo "📂 Folder uploads/photos dibuat.\n"; }
if (!is_dir($logDir))   { @mkdir($logDir,   0755, true); echo "📂 Folder logs/ dibuat.\n"; }
echo "  uploads/photos writable: " . (is_writable($photoDir) ? '✅' : '❌ → CHMOD 775') . "\n";
echo "  logs/ writable         : " . (is_writable($logDir)   ? '✅' : '❌ → CHMOD 775') . "\n";
echo "\n";

echo "=== RANGKUMAN ===\n";
echo "→ Buka index.html → Test login admin/admin123\n";
echo "→ Test CRUD Treatments: buka menu Paket Perawatan.\n";
echo "→ JANGAN LUPA HAPUS: cek-server.php, edit-git-config.php, migrate-treatments.php, deploy-runner.php SETELAH SEMUA OK!\n";
?>
