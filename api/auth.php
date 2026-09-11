<?php
// ============================================================
// API: /api/auth.php — Login / Logout / Check Session
// ============================================================
require_once __DIR__ . '/helpers.php';
setCorsHeaders();

$action = $_GET['action'] ?? 'check';
$method = $_SERVER['REQUEST_METHOD'];

function currentUser(): ?array {
    return $_SESSION['auth_user'] ?? null;
}

// ---- CHECK ----
if ($action === 'check') {
    $u = currentUser();
    jsonResponse([
        'success'     => true,
        'authed'      => $u !== null,
        'user'        => $u,
        'app_name'    => APP_NAME,
        'app_version' => APP_VERSION,
    ]);
}

// ---- LOGIN ----
if ($action === 'login' && $method === 'POST') {
    $body = getBody();
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    if ($username === '' || $password === '') {
        jsonResponse(['success' => false, 'message' => 'Username dan password wajib diisi'], 400);
    }

    // Regenerate session untuk keamanan
    session_regenerate_id(true);

    $userOk = hash_equals(ADMIN_USERNAME, $username);
    $passOk = password_verify($password, ADMIN_PASSWORD_HASH);

    // Fallback jika hash belum di-set (plain compare) — AMANKAN DI PRODUKSI!
    if (!$passOk && ADMIN_PASSWORD_HASH === '') {
        $passOk = ($password === 'admin123');
    }

    if (!$userOk || !$passOk) {
        // Tambah delay untuk throttle brute force
        usleep(random_int(100000, 300000));
        jsonResponse(['success' => false, 'message' => 'Username atau password salah'], 401);
    }

    $_SESSION['auth_user'] = [
        'username'  => ADMIN_USERNAME,
        'role'      => 'admin',
        'login_at'  => date('Y-m-d H:i:s'),
        'client_ip' => $_SERVER['REMOTE_ADDR'] ?? 'cli',
    ];

    jsonResponse([
        'success' => true,
        'message' => 'Login berhasil',
        'user'    => $_SESSION['auth_user'],
    ]);
}

// ---- LOGOUT ----
if ($action === 'logout' && in_array($method, ['GET','POST'])) {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    jsonResponse(['success' => true, 'message' => 'Logout berhasil']);
}

jsonResponse(['success' => false, 'message' => 'Unknown action'], 400);
