<?php
// =============================================================
// RUN-GIT — Eksekusi git via proc_open() dari PHP browser
// Berfungsi jika: allow_url_fopen ON DAN proc_open TIDAK di-disable
// PAT sudah diset di .git/config dari edit-git-config.php (sebelumnya BERHASIL ✅)
// =============================================================
define('RUNNER_KEY', 'deploy_samboja_2026_ganti_segera');
if (!isset($_GET['key']) || !hash_equals(RUNNER_KEY, $_GET['key'])) {
    http_response_code(403);
    die('Access denied. ?key=...');
}
header('Content-Type: text/plain; charset=utf-8');
@ini_set('display_errors', 1);
@set_time_limit(600);

$REPO = __DIR__;
echo "=== RUN GIT via PHP proc_open ===\n";
echo "Repo : $REPO\n";
echo "Time : " . date('Y-m-d H:i:s') . "\n";
echo "proc_open  : " . (function_exists('proc_open') ? 'YES' : 'NO ❌') . "\n";
echo "exec       : " . (function_exists('exec') ? 'YES' : 'NO') . "\n";
echo "shell_exec : " . (function_exists('shell_exec') ? 'YES' : 'NO') . "\n";
echo "passthru   : " . (function_exists('passthru') ? 'YES' : 'NO') . "\n";
echo "\n";

// 🔥 Coba deteksi path git binary
$GIT = 'git';  // default, coba PATH
foreach (['/usr/local/cpanel/3rdparty/libexec/git-core/git','/usr/bin/git','/usr/local/bin/git','/opt/cpanel/ea-git/bin/git'] as $t) {
    if (@is_executable($t)) { $GIT = $t; break; }
}
echo "GIT binary dicoba pakai: $GIT\n";

// Function: execute command via proc_open + print output
function run(string $cmd, ?string $cwd = null): int {
    global $REPO;
    $cwd = $cwd ?? $REPO;
    echo "─── $ " . $cmd . "\n";
    $desc = [['pipe','r'],['pipe','w'],['pipe','w']];
    $proc = @proc_open($cmd, $desc, $pipes, $cwd,
        // set HOME, agar git credential cache (jika ada) nyimpan di ~ user cPanel
        ['HOME' => getenv('HOME') ?: '/home/samst652', 'PATH' => '/usr/local/cpanel/3rdparty/libexec/git-core:/usr/bin:/bin:/usr/local/bin']);
    if (!is_resource($proc)) { echo "proc_open FAILED\n"; return 127; }
    fclose($pipes[0]);
    $out = stream_get_contents($pipes[1]); fclose($pipes[1]);
    $err = stream_get_contents($pipes[2]); fclose($pipes[2]);
    $exit = proc_close($proc);
    if (trim($out) !== '') echo rtrim($out) . "\n";
    if (trim($err) !== '') echo "[STDERR]\n" . rtrim($err) . "\n";
    echo "[exit=$exit]\n\n";
    return $exit;
}

// --- Test git version dulu ---
echo "=== TEST GIT BINARY ===\n";
run("$GIT --version");

$do = $_GET['do'] ?? 'status';
$cmds = [];
if (str_contains($do, 'status'))  $cmds[] = "$GIT status -sb";
if (str_contains($do, 'remote'))  $cmds[] = "$GIT remote -v";
if (str_contains($do, 'log'))     $cmds[] = "$GIT log --oneline -5";
if (str_contains($do, 'reset'))   $cmds[] = "$GIT reset --hard HEAD";
if (str_contains($do, 'clean'))   $cmds[] = "$GIT clean -fd";
if (str_contains($do, 'fetch'))   $cmds[] = "$GIT -c http.sslVerify=true fetch --prune origin main";
if (str_contains($do, 'pull')) {
    $cmds[] = "$GIT -c http.sslVerify=true checkout -f main";
    $cmds[] = "$GIT -c http.sslVerify=true fetch origin main";
    $cmds[] = "$GIT -c http.sslVerify=true reset --hard origin/main";
    $cmds[] = "$GIT submodule update --init --recursive 2>/dev/null || true";
    $cmds[] = "$GIT log --oneline -5";
}

echo "=== AKSI: do=$do (".count($cmds)." command) ===\n";
foreach ($cmds as $c) { run($c); }

echo "\n=== SELESAI ===\n";
echo "Jika git pull sudah HEAD = commit terbaru (e961579), LANJUT ke manual-deploy.php?key=...&do=all\n";
?>
