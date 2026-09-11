<?php
// =============================================================
// Tool: Edit .git/config untuk set URL origin dengan embedded PAT
// TANPA shell_exec / proc_open — pure file operation PHP
// =============================================================
define('RUNNER_KEY', 'deploy_samboja_2026_ganti_segera');
if (!isset($_GET['key']) || !hash_equals(RUNNER_KEY, $_GET['key'])) {
    http_response_code(403);
    die('Access denied. Gunakan ?key=...');
}
header('Content-Type: text/plain; charset=utf-8');

$repoRoot   = __DIR__;
$configPath = $repoRoot . '/.git/config';
echo "=== EDIT GIT CONFIG (pure PHP) ===\n";
echo "Repo root : $repoRoot\n";
echo "Config    : $configPath\n\n";

if (!file_exists($configPath)) {
    die("[ERROR] File .git/config TIDAK DITEMUKAN. Pastikan file ini di ROOT repo yang punya folder .git/.\n");
}
if (!is_writable($configPath)) {
    die("[ERROR] .git/config TIDAK BISA DITULIS. Cek permission file.\n");
}

// Baca config lama
$cfg = file_get_contents($configPath);
echo "--- ISI SEBELUMNYA ---\n";
echo $cfg . "\n";

// --- Persiapan URL baru dengan embedded PAT ---
$GITHUB_USER = 'sams-town';
$GITHUB_REPO = 'slimingtea';
$OLD_URLS = [
    "https://github.com/$GITHUB_USER/$GITHUB_REPO.git",
    "https://github.com/$GITHUB_USER/$GITHUB_REPO",
];

$pat = $_GET['pat'] ?? '';
if ($pat === '') {
    echo "\n[INFO] Parameter &pat=... TIDAK ADA. Tampilkan saja config lama.\nTambahkan &pat=GHP_TOKEN_ANDA di URL untuk mengganti URL origin.\n";
    exit;
}

$newUrl = "https://" . rawurlencode($GITHUB_USER) . ":" . rawurlencode($pat) . "@github.com/$GITHUB_USER/$GITHUB_REPO.git";
echo "\nNEW URL akan diset: " . preg_replace('#:(ghp_[^@]+)@#', ':***@', $newUrl) . " (token disamarkan)\n";

// Ganti URL lama di [remote "origin"] ... url = ...
$replaced = 0;
foreach ($OLD_URLS as $old) {
    $oldQ = preg_quote($old, '#');
    // Pattern: cocokkan baris url = <old>
    $new = preg_replace('#(url\s*=\s*)' . $oldQ . '#', '${1}' . $newUrl, $cfg, -1, $c1);
    $replaced += $c1;
    if ($c1 > 0) $cfg = $new;
    // Juga coba jika ada baris url tanpa .git suffix
    $oldNoGit = preg_quote(rtrim($old, '.git'), '#');
    $new2 = preg_replace('#(url\s*=\s*)' . $oldNoGit . '(?!\.git)#', '${1}' . $newUrl, $cfg, -1, $c2);
    $replaced += $c2;
    if ($c2 > 0) $cfg = $new2;
}

// Fallback: jika remote origin section ada tapi url tidak cocok pattern di atas,
// cari url = https://github... lalu ganti semuanya
if ($replaced === 0) {
    $new = preg_replace('#(url\s*=\s*)https://(?:[^:\s]+:[^@\s]+@)?github\.com/' . preg_quote($GITHUB_USER, '#') . '/' . preg_quote($GITHUB_REPO, '#') . '(?:\.git)?#', '${1}' . $newUrl, $cfg, -1, $c);
    if ($c > 0) { $cfg = $new; $replaced = $c; }
}

// Tulis kembali
file_put_contents($configPath, $cfg);

echo "\n--- ISI SETELAH PERUBAHAN (token disamarkan) ---\n";
echo preg_replace('#:(ghp_[^@\s]+)@#', ':***@', $cfg) . "\n";
echo "\n[RESULT] Replacement count: $replaced\n";
echo ($replaced > 0 ? "[OK] URL origin berhasil di-update dengan PAT.\n"
                    : "[PERINGATAN] Tidak ada baris URL yang diganti. Periksa manual isi .git/config.\n");

echo "\nLANGKAH SELANJUTNYA:\n";
echo "1. Kembali ke cPanel → Git™ Version Control → Manage (slimingtea)\n";
echo "2. Tab 'Pull or Deploy' — Error merah 'could not contact remote' SEHARUSNYA hilang.\n";
echo "3. Klik tombol 'Update from Remote'.\n";
echo "4. Setelah pull berhasil, klik 'Deploy HEAD Commit'.\n";
echo "5. Jalankan migrate-treatments.php?key=... buat tabel DB.\n";
?>
