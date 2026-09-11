<?php
// =================================================================
// DEPLOY RUNNER — Untuk server yang TIDAK PUNYA SSH/Terminal
// Eksekusi via browser: https://domain-anda/deploy-runner.php?key=YOUR_KEY
// HAPUS FILE INI SETELAH SELESAI DIGUNAKAN!
// =================================================================

// GANTI INI DENGAN RANDOM KEY PANJANG (sama dengan di URL)
define('RUNNER_KEY', 'deploy_samboja_2026_ganti_segera');

// ─────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────
if (!isset($_GET['key']) || !hash_equals(RUNNER_KEY, $_GET['key'])) {
    http_response_code(403);
    die('Access denied. Kirim ?key=... di URL.');
}
@ini_set('display_errors', 1);
@ini_set('memory_limit', '256M');
@set_time_limit(300);

$REPO_DIR = __DIR__; // asumsi file ini di root repo
header('Content-Type: text/plain; charset=utf-8');
echo "=== DEPLOY RUNNER @ " . date('Y-m-d H:i:s') . " ===\n";
echo "Repo dir: $REPO_DIR\n";
echo "PHP user: " . get_current_user() . " | UID:" . getmyuid() . "\n";
echo "shell_exec available: " . (function_exists('shell_exec') ? 'YES' : 'NO') . "\n\n";

// ─────────────────────────────────────────────────────────────────
// Helper: run command
// ─────────────────────────────────────────────────────────────────
function run(string $cmd, ?string $cwd = null): void {
    echo "─── $ " . trim($cmd) . "\n";
    $cwd  = $cwd ?? $GLOBALS['REPO_DIR'];
    $desc = [0 => ['pipe','r'], 1 => ['pipe','w'], 2 => ['pipe','w']];
    $proc = proc_open($cmd, $desc, $pipes, $cwd);
    if (!is_resource($proc)) { echo "proc_open FAILED\n\n"; return; }
    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]); fclose($pipes[1]);
    $stderr = stream_get_contents($pipes[2]); fclose($pipes[2]);
    $exit   = proc_close($proc);
    if ($stdout !== '') echo rtrim($stdout) . "\n";
    if ($stderr !== '') echo "[STDERR] " . rtrim($stderr) . "\n";
    echo "[exit=$exit]\n\n";
}

// ─────────────────────────────────────────────────────────────────
// Step 1 — Cek status repo saat ini
// ─────────────────────────────────────────────────────────────────
echo "========== STEP 1: GIT STATUS SAAT INI ==========\n";
run('git status -sb');
run('git log --oneline -5');
run('git remote -v');

// ─────────────────────────────────────────────────────────────────
// Step 2 — Set credential untuk remote GitHub (jika ada token di URL)
//   Contoh: &pat=ghp_xxxxx
// ─────────────────────────────────────────────────────────────────
if (!empty($_GET['pat'])) {
    echo "========== STEP 2: SET GIT CREDENTIAL (PAT) ==========\n";
    $pat = $_GET['pat'];
    // Simpan ke git config url.insteadOf (tembak PAT ke URL origin)
    $insteadOf = 'https://sams-town:' . escapeshellarg($pat) . '@github.com/sams-town/slimingtea.git';
    run('git config --local url.' . $insteadOf . '.insteadOf https://github.com/sams-town/slimingtea.git');
    run('git config --local --list | grep -E "(url\.|remote\.)"');
}

// ─────────────────────────────────────────────────────────────────
// Step 3 — Bersihkan working tree + pull
//   Action via URL: &do=pull   atau &do=reset+pull
// ─────────────────────────────────────────────────────────────────
$do = $_GET['do'] ?? '';
if (str_contains($do, 'reset')) {
    echo "========== STEP 3a: RESET WORKING TREE ==========\n";
    run('git reset --hard HEAD');
    run('git clean -fd');
}
if (str_contains($do, 'pull')) {
    echo "========== STEP 3b: FETCH + PULL ORIGIN MAIN ==========\n";
    run('git fetch origin main');
    run('git checkout -f main');
    run('git pull --ff-only origin main || git reset --hard origin/main');
    run('git log --oneline -5');
}

// ─────────────────────────────────────────────────────────────────
// Step 4 — Jalankan task .cpanel.yml (rsync + chmod)
//   &do=deploy
// ─────────────────────────────────────────────────────────────────
if (str_contains($do, 'deploy')) {
    echo "========== STEP 4: DEPLOY (rsync + chmod seperti .cpanel.yml) ==========\n";
    $DEPLOYPATH = '/home/samst652/public_html/slimingtea';
    run("mkdir -p " . escapeshellarg($DEPLOYPATH));
    $rsync = "rsync -av --exclude='.git' --exclude='.gitignore' --exclude='deploy' --exclude='logs' --exclude='*.log' --delete ./ " . escapeshellarg($DEPLOYPATH.'/');
    run($rsync);
    run("chmod -R 755 " . escapeshellarg($DEPLOYPATH));
    run("find " . escapeshellarg($DEPLOYPATH) . " -type f -name '*.php' -exec chmod 644 {} \\;");
    run("find " . escapeshellarg($DEPLOYPATH) . " -type d -exec chmod 755 {} \\;");
    run("mkdir -p " . escapeshellarg("$DEPLOYPATH/uploads/photos") . " " . escapeshellarg("$DEPLOYPATH/logs"));
    run("chmod -R 775 " . escapeshellarg("$DEPLOYPATH/uploads") . " " . escapeshellarg("$DEPLOYPATH/logs"));
}

// ─────────────────────────────────────────────────────────────────
// Step 5 — Migration DB: buat tabel sliming_treatments
//   &do=migrate   (pakai config.php server untuk koneksi)
// ─────────────────────────────────────────────────────────────────
if (str_contains($do, 'migrate')) {
    echo "========== STEP 5: MIGRASI TABEL sliming_treatments ==========\n";
    $config = __DIR__ . '/config/config.php';
    if (!file_exists($config)) {
        echo "[ERROR] config.php TIDAK ADA. Buat dulu via File Manager (copy config.example.php).\n\n";
    } else {
        require_once $config;
        require_once __DIR__ . '/config/database.php';
        try {
            $pdo = Database::getInstance();
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
            $pdo->exec($sql);
            echo "[OK] Tabel sliming_treatments dibuat / sudah ada.\n";
            $chk = $pdo->query("SHOW TABLES LIKE 'sliming_treatments'")->rowCount();
            echo "[CHECK] SHOW TABLES: " . ($chk ? "EXISTS ($chk)" : "TIDAK ADA") . "\n";
        } catch (Throwable $e) {
            echo "[ERROR] " . $e->getMessage() . "\n";
        }
    }
}

// ─────────────────────────────────────────────────────────────────
// Step 6 — Cek file penting + clear OPcache
//   &do=check
// ─────────────────────────────────────────────────────────────────
if (str_contains($do, 'check')) {
    echo "========== STEP 6: CHECK FILE PENTING + CLEAR CACHE ==========\n";
    $check = [
        'api/auth.php','api/treatments.php','config/config.example.php',
        'deploy/webhook.php','deploy/gh-webhook-deploy.sh','deploy-runner.php'
    ];
    foreach ($check as $f) {
        echo (file_exists($f) ? "[EXIST]  $f (" . filesize($f) . " bytes)\n" : "[MISSING] $f\n");
    }
    echo "config/config.php: " . (file_exists('config/config.php') ? 'EXIST ✓' : 'MISSING ⚠️ BUAT DULU VIA FILE MANAGER') . "\n";
    if (function_exists('opcache_reset')) {
        opcache_reset();
        echo "OPcache reset OK\n";
    } else {
        echo "OPcache tidak aktif\n";
    }
    if (function_exists('apc_clear_cache')) { @apc_clear_cache(); echo "APC clear OK\n"; }
}

echo "\n=== SELESAI ===\n";
echo "CATATAN: JANGAN LUPA HAPUS deploy-runner.php SETELAH SEMUA BERES!\n";
?>
