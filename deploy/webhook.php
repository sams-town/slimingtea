<?php
// ============================================================
// GitHub Webhook Endpoint — Auto Deploy cPanel
// URL: https://your-domain.com/deploy/webhook.php
// Method: POST | Content-Type: application/json
// Header: X-Hub-Signature-256: sha256=xxxx
// ============================================================

header('Content-Type: application/json; charset=utf-8');

// ── Konfigurasi (SESUAIKAN!) ─────────────────────────────────
$WEBHOOK_SECRET = 'samboja90_deploy_secret'; // SAMA dengan di GitHub Webhook
$GIT_REPO_DIR   = '/home/samst652/public_html/slimingtea'; // Path repo di cPanel
$DEPLOY_LOG     = __DIR__ . '/../logs/webhook-deploy.log';
$ALLOWED_BRANCH = 'main';
$ALLOWED_EVENTS = ['push', 'ping'];
// ─────────────────────────────────────────────────────────────

// --- Bikin log folder ---
$logDir = dirname($DEPLOY_LOG);
if (!is_dir($logDir)) @mkdir($logDir, 0755, true);

function writeLog(string $msg, string $level = 'INFO'): void {
    global $DEPLOY_LOG;
    $line = sprintf("[%s] [%s] %s\n", date('Y-m-d H:i:s'), $level, $msg);
    @file_put_contents($DEPLOY_LOG, $line, FILE_APPEND | LOCK_EX);
}

function sendJson(array $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

writeLog('=== Webhook dipanggil ===');
writeLog('Method: ' . ($_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN'));

// --- Validasi method ---
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    writeLog('Invalid method: ' . $_SERVER['REQUEST_METHOD'], 'ERROR');
    sendJson(['success' => false, 'message' => 'Method harus POST'], 405);
}

// --- Ambil payload ---
$rawBody = file_get_contents('php://input');
if (!$rawBody) {
    writeLog('Empty body', 'ERROR');
    sendJson(['success' => false, 'message' => 'Payload kosong'], 400);
}

$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    writeLog('Invalid JSON', 'ERROR');
    sendJson(['success' => false, 'message' => 'JSON tidak valid'], 400);
}

// --- Cek event type ---
$eventType = $_SERVER['HTTP_X_GITHUB_EVENT'] ?? $_SERVER['HTTP_X_GITLAB_EVENT'] ?? 'unknown';
writeLog("Event type: $eventType");

if ($eventType === 'ping') {
    writeLog('Ping OK — webhook tersambung');
    sendJson(['success' => true, 'message' => 'Pong! Webhook terkonfigurasi dengan benar.']);
}

if (!in_array($eventType, $ALLOWED_EVENTS, true)) {
    writeLog("Event tidak diizinkan: $eventType", 'WARN');
    sendJson(['success' => false, 'message' => "Event '$eventType' tidak didukung"], 400);
}

// --- Verifikasi signature HMAC SHA256 ---
$sigHeader = $_SERVER['HTTP_X_HUB_SIGNATURE_256']
          ?? $_SERVER['HTTP_X_GITLAB_TOKEN']
          ?? '';

if ($WEBHOOK_SECRET !== '' && $eventType === 'push') {
    if ($sigHeader === '') {
        writeLog('Signature header kosong', 'ERROR');
        sendJson(['success' => false, 'message' => 'Missing signature (X-Hub-Signature-256)'], 403);
    }

    if (str_starts_with($sigHeader, 'sha256=')) {
        $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $WEBHOOK_SECRET);
        if (!hash_equals($expected, $sigHeader)) {
            writeLog("Signature mismatch. Expected: $expected, Got: $sigHeader", 'ERROR');
            sendJson(['success' => false, 'message' => 'Signature tidak valid'], 403);
        }
    } else {
        if ($sigHeader !== $WEBHOOK_SECRET) {
            writeLog('Token mismatch (GitLab style)', 'ERROR');
            sendJson(['success' => false, 'message' => 'Token tidak valid'], 403);
        }
    }
    writeLog('Signature verified OK');
}

// --- Cek branch ---
$ref       = $payload['ref'] ?? '';
$pushedBy  = $payload['pusher']['name'] ?? ($payload['user_name'] ?? 'unknown');
$commitMsg = $payload['head_commit']['message'] ?? ($payload['commits'][0]['message'] ?? '-');
writeLog("Ref: $ref | By: $pushedBy | Commit: " . trim($commitMsg));

if ($ref !== "refs/heads/$ALLOWED_BRANCH") {
    writeLog("Skip — branch bukan $ALLOWED_BRANCH", 'WARN');
    sendJson([
        'success' => true,
        'skipped' => true,
        'message' => "Push ke $ref, skip (hanya deploy branch $ALLOWED_BRANCH)"
    ]);
}

// --- Pastikan repo dir ada ---
if (!is_dir($GIT_REPO_DIR . '/.git')) {
    writeLog("Repo tidak ada di: $GIT_REPO_DIR", 'ERROR');
    sendJson(['success' => false, 'message' => "Git repo tidak ditemukan di $GIT_REPO_DIR"], 500);
}

// --- Jalankan deploy script via shell_exec di background ---
$scriptPath = __DIR__ . '/gh-webhook-deploy.sh';
if (!file_exists($scriptPath)) {
    writeLog("Deploy script tidak ada: $scriptPath", 'ERROR');
    sendJson(['success' => false, 'message' => 'Script deploy tidak ditemukan'], 500);
}

// Jalankan di background agar GitHub tidak timeout
$cmd = sprintf(
    'nohup /bin/bash %s %s >> %s 2>&1 & echo $!',
    escapeshellarg($scriptPath),
    escapeshellarg($GIT_REPO_DIR),
    escapeshellarg($DEPLOY_LOG)
);

writeLog("Execute: $cmd");
$pid = shell_exec($cmd);

writeLog("Deploy dijalankan di background PID: " . trim($pid));

sendJson([
    'success'   => true,
    'deploying' => true,
    'message'   => "Deploy branch $ALLOWED_BRANCH dimulai di background oleh $pushedBy",
    'pid'       => trim($pid),
    'commit'    => [
        'message' => $commitMsg,
        'by'      => $pushedBy,
        'ref'     => $ref,
    ],
]);
