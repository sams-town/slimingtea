<?php
// =============================================================
// MANUAL DEPLOY — Jalankan semua task .cpanel.yml via PHP NATIVE
// TANPA exec / shell_exec — 100% PHP filesystem function (cocok shared hosting disable exec)
// Termasuk: rsync (copy file), chmod, mkdir uploads/logs, clear OPcache, migrate SQL
// =============================================================
define('RUNNER_KEY', 'deploy_samboja_2026_ganti_segera');
if (!isset($_GET['key']) || !hash_equals(RUNNER_KEY, $_GET['key'])) {
    http_response_code(403);
    die('Access denied. ?key=...');
}
header('Content-Type: text/plain; charset=utf-8');
@ini_set('display_errors', 1);
@set_time_limit(1200);
@ini_set('memory_limit', '512M');

// REPO_DIR = source (git repo folder). DEPLOYPATH = tujuan public_html deploy.
// Defaultnya sama (cPanel .cpanel.yml rsync ke folder yang SAMA dengan repo).
$REPO_DIR   = __DIR__;
$DEPLOYPATH = $_GET['deploy_to'] ?? '/home/samst652/public_html/slimingtea';
echo "=== MANUAL DEPLOY via PHP Native (no shell) ===\n";
echo "Time     : " . date('Y-m-d H:i:s') . "\n";
echo "Source   : $REPO_DIR\n";
echo "Deploy to: $DEPLOYPATH\n\n";

// =============== EXCLUDE LIST (sesuai .cpanel.yml: rsync --exclude=...) ===============
$EXCLUDE = [
    '.git', '.gitignore', 'deploy', 'logs', '*.log', '.cpanel.yml',
    'deploy-runner.php','edit-git-config.php','migrate-treatments.php','cek-server.php','run-git.php','manual-deploy.php',
];
function isExcluded(string $rel, string $name): bool {
    global $EXCLUDE;
    $rel = str_replace('\\', '/', $rel);
    if (in_array($name, $EXCLUDE, true)) return true;
    foreach ($EXCLUDE as $ex) {
        if (str_contains($ex, '*')) {
            if (fnmatch($ex, $name) || fnmatch($ex, $rel)) return true;
        } else {
            if ($name === $ex) return true;
            if (str_starts_with($rel, trim($ex,'/').'/')) return true;
        }
    }
    return false;
}

// =============== FUNGSI: Copy directory recursive (mirip rsync -av --delete) ===============
$COPIED = 0; $SKIPPED = 0; $DELETED = 0; $ERRORS = [];
function copyDir(string $src, string $dst, string $baseSrc, string $baseDst): void {
    global $COPIED, $SKIPPED, $DELETED, $ERRORS;
    if (!is_dir($dst)) { if (!@mkdir($dst, 0755, true)) { $ERRORS[] = "mkdir FAIL $dst"; return; } }
    $items = @scandir($src); if (!$items) return;
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $s = $src . DIRECTORY_SEPARATOR . $item;
        $d = $dst . DIRECTORY_SEPARATOR . $item;
        $rel = substr($s, strlen($baseSrc) + 1);
        if (isExcluded($rel, $item)) { $SKIPPED++; continue; }
        if (is_dir($s)) {
            copyDir($s, $d, $baseSrc, $baseDst);
        } else {
            // Copy hanya jika ukuran / mtime berbeda (mirip rsync)
            $needCopy = !file_exists($d);
            if (!$needCopy) {
                $ss = @stat($s); $ds = @stat($d);
                if (!$ss || !$ds || $ss['size'] !== $ds['size'] || $ss['mtime'] > $ds['mtime']) $needCopy = true;
            }
            if ($needCopy) {
                if (@copy($s, $d)) { $COPIED++; @touch($d, filemtime($s)); }
                else $ERRORS[] = "copy FAIL $s → $d";
            } else { $SKIPPED++; }
        }
    }
}

// =============== FUNGSI: Hapus file di DEPLOYPATH yang TIDAK ADA di SOURCE (mirip rsync --delete) ===============
function deleteOrphan(string $dir, string $baseSrc, string $baseDst): void {
    global $DELETED, $EXCLUDE, $ERRORS;
    $items = @scandir($dir); if (!$items) return;
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $d = $dir . DIRECTORY_SEPARATOR . $item;
        $rel = substr($d, strlen($baseDst) + 1);
        if (isExcluded($rel, $item)) continue; // jangan hapus folder exclude (logs, uploads dll)
        // Cek pasangannya di source
        $s = $baseSrc . DIRECTORY_SEPARATOR . $rel;
        if (is_dir($d)) {
            if (!is_dir($s)) {
                // Hapus recursive
                $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($d, RecursiveDirectoryIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
                $ok = true;
                foreach ($it as $f) { $p = $f->getPathname(); if ($f->isDir()) $ok = $ok && @rmdir($p); else $ok = $ok && @unlink($p); }
                $ok = $ok && @rmdir($d);
                if ($ok) $DELETED++; else $ERRORS[] = "rmdir FAIL $d";
            } else {
                deleteOrphan($d, $baseSrc, $baseDst);
            }
        } else {
            if (!file_exists($s)) { if (@unlink($d)) $DELETED++; else $ERRORS[] = "unlink FAIL $d"; }
        }
    }
}

// =============== FUNGSI: Recursive chmod (sesuai .cpanel.yml) ===============
function recChmod(string $dir, int $fileMode = 0644, int $dirMode = 0755, ?array $excludeDirs = null): void {
    global $ERRORS;
    $items = @scandir($dir); if (!$items) return;
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $p = $dir . DIRECTORY_SEPARATOR . $item;
        if ($excludeDirs && is_dir($p) && in_array(basename($p), $excludeDirs, true)) continue;
        if (is_dir($p)) {
            @chmod($p, $dirMode);
            recChmod($p, $fileMode, $dirMode, $excludeDirs);
        } else {
            $ext = strtolower(pathinfo($p, PATHINFO_EXTENSION));
            if ($ext === 'php' || $ext === 'html' || $ext === 'js' || $ext === 'css' || $ext === 'json' || $ext === 'map' || $ext === 'png' || $ext === 'jpg' || $ext === 'svg' || $ext === 'ico' || $ext === 'sql' || $ext === 'md' || $ext === 'yml' || $ext === 'yaml' || $ext === 'htaccess' || $ext === 'sh' || $ext === '' ) {
                @chmod($p, $fileMode);
            }
        }
    }
}

// ============================== TASK 1: COPY FILES ======================================
$do = $_GET['do'] ?? 'all';
if (str_contains($do, 'copy') || str_contains($do, 'all')) {
    echo "[TASK 1] Copy file dari REPO → DEPLOYPATH...\n";
    $t0 = microtime(true);
    copyDir($REPO_DIR, $DEPLOYPATH, $REPO_DIR, $DEPLOYPATH);
    echo "  Copied    : $COPIED file\n";
    echo "  Skipped   : $SKIPPED file (exclude / sama ukuran&mtime)\n";
    $t1 = microtime(true); printf("  Selesai dalam %.2f detik\n\n", $t1 - $t0);
}

// ============================== TASK 2: DELETE ORPHAN FILES =============================
if (str_contains($do, 'delete') || str_contains($do, 'all')) {
    echo "[TASK 2] Hapus file orphan di DEPLOYPATH (tidak ada di source)...\n";
    $before = $DELETED;
    deleteOrphan($DEPLOYPATH, $REPO_DIR, $DEPLOYPATH);
    $n = $DELETED - $before;
    echo "  Dihapus   : $n item\n\n";
}

// ============================== TASK 3: CHMOD ===========================================
if (str_contains($do, 'chmod') || str_contains($do, 'all')) {
    echo "[TASK 3] Set permission file (chmod)...\n";
    @chmod($DEPLOYPATH, 0755);
    // .htaccess dan index.html 644
    @chmod($DEPLOYPATH . '/.htaccess', 0644);
    @chmod($DEPLOYPATH . '/index.html',  0644);
    // Folder api, config, assets, database 755
    foreach (['api','config','assets','database'] as $f) { if (is_dir($DEPLOYPATH.'/'.$f)) @chmod($DEPLOYPATH.'/'.$f, 0755); }
    // Semua file *.php → 644, folder → 755
    recChmod($DEPLOYPATH, 0644, 0755, ['.git','vendor']);
    echo "  Selesai.\n\n";
}

// ============================== TASK 4: MKDIR uploads + logs ============================
if (str_contains($do, 'mkdir') || str_contains($do, 'all')) {
    echo "[TASK 4] Buat folder uploads/photos + logs & set 775...\n";
    foreach ([$DEPLOYPATH.'/uploads/photos', $DEPLOYPATH.'/logs'] as $d) {
        if (!is_dir($d)) { if (@mkdir($d, 0775, true)) echo "  ✅ mkdir $d\n"; else $ERRORS[] = "mkdir FAIL $d"; }
        else echo "  ℹ️ sudah ada $d\n";
        @chmod($d, 0775);
    }
    @chmod($DEPLOYPATH.'/uploads', 0775);
    echo "\n";
}

// ============================== TASK 5: MIGRATION TABEL sliming_treatments ===============
if (str_contains($do, 'migrate') || str_contains($do, 'all')) {
    echo "[TASK 5] Migrasi tabel sliming_treatments...\n";
    $configPath = $DEPLOYPATH . '/config/config.php';
    $dbPath     = $DEPLOYPATH . '/config/database.php';
    if (!file_exists($configPath)) {
        echo "  ⚠️ config.php TIDAK ADA. Buat via copy config.example.php → config.php di File Manager.\n";
    } elseif (!file_exists($dbPath)) {
        echo "  ⚠️ config/database.php TIDAK ADA.\n";
    } else {
        require_once $configPath;
        require_once $dbPath;
        try {
            $pdo = Database::getInstance();
            $isMy = DB_DRIVER === 'mysql';
            if ($isMy) {
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
            } else {
                $sql = "CREATE TABLE IF NOT EXISTS sliming_treatments (
                  id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT NOT NULL UNIQUE, code TEXT NOT NULL UNIQUE,
                  name TEXT NOT NULL, category TEXT NULL, duration_minutes INTEGER DEFAULT 0,
                  price REAL DEFAULT 0, description TEXT NULL, include_injections INTEGER DEFAULT 0,
                  injection_type TEXT NULL, include_consultation INTEGER DEFAULT 1,
                  session_count INTEGER DEFAULT 1, is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0,
                  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), deleted_at TEXT NULL
                )";
            }
            $pdo->exec($sql);
            echo "  ✅ Query dijalankan.\n";
            // Verifikasi
            $ok = false;
            try {
                if ($isMy) { $ok = $pdo->query("SHOW TABLES LIKE 'sliming_treatments'")->rowCount() > 0; }
                else { $st = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='sliming_treatments'"); $ok = !!$st->fetch(); }
            } catch (Throwable $e) { $ok = false; }
            echo "  " . ($ok ? "✅ TABEL sliming_treatments ADA." : "❌ TABEL TIDAK DITEMUKAN.") . "\n";
        } catch (Throwable $e) {
            $ERRORS[] = "Migrasi FAIL: " . $e->getMessage();
            echo "  ❌ Migrasi error: " . $e->getMessage() . "\n";
        }
    }
    echo "\n";
}

// ============================== TASK 6: CLEAR CACHE PHP ==================================
if (str_contains($do, 'cache') || str_contains($do, 'all')) {
    echo "[TASK 6] Clear OPcache / APC / Wincache...\n";
    if (function_exists('opcache_reset'))     { $r = @opcache_reset();     echo "  OPcache reset : " . ($r ? "OK ✅" : "FAIL ⚠️") . "\n"; }
    else echo "  OPcache       : tidak aktif\n";
    if (function_exists('apc_clear_cache'))   { $r = @apc_clear_cache();   echo "  APC clear     : " . ($r ? "OK ✅" : "FAIL ⚠️") . "\n"; }
    if (function_exists('wincache_ucache_clear')) { @wincache_ucache_clear(); echo "  WinCache clear: OK ✅\n"; }
    // Clear realpath & stat cache (PHP)
    clearstatcache(true);
    if (function_exists('realpath_cache_size')) {
        // reset dengan cara dummy
    }
    echo "\n";
}

// ============================== TASK 7: CLEAN uncommitted changes di .git repo (agar nanti UI cPanel tidak marah) ======
if (str_contains($do, 'gitclean')) {
    echo "[TASK 7] git clean working tree repo (opsional)...\n";
    // Jalankan via fungsi shell_exec jika bisa — tapi karena kita sudah punya run-git.php, lewat sana saja.
    echo "  Jalankan run-git.php?key=...&do=reset+clean secara terpisah.\n\n";
}

// ============================== RINGKASAN ERROR =========================================
echo "=== RINGKASAN ===\n";
echo "Copied : $COPIED\n";
echo "Skipped: $SKIPPED\n";
echo "Deleted: $DELETED\n";
if (empty($ERRORS)) {
    echo "✅ TIDAK ADA ERROR.\n";
} else {
    echo "⚠️ ERROR (" . count($ERRORS) . "):\n";
    foreach ($ERRORS as $e) echo "  • $e\n";
}

echo "\n=== SELESAI ===\n";
echo "Langkah selanjutnya:\n";
echo "1. Buka cek-server.php?key=... → verifikasi semua checklist ✅\n";
echo "2. Buka https://samstown.xyz/slimingtea/ → test login admin/admin123\n";
echo "3. JANGAN LUPA HAPUS SEMUA FILE HELPER: deploy-runner.php, edit-git-config.php, migrate-treatments.php, cek-server.php, run-git.php, manual-deploy.php\n";
?>
