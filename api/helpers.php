<?php
// ============================================================
// API Helpers - shared utilities untuk semua endpoint
// ============================================================
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';

// --- CORS & Headers ---
function setCorsHeaders(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . CORS_ORIGIN);
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Token');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// --- Auth Token Check (kompatibel CGI/FastCGI/cPanel) ---
function requireAuth(): void {
    $token = '';

    // 1. Coba dari getallheaders() (paling reliable untuk CGI/FastCGI)
    if (function_exists('getallheaders')) {
        $headers = getallheaders() ?: [];
        foreach ($headers as $k => $v) {
            $kl = strtolower($k);
            if ($kl === 'x-api-token')           { $token = $v; break; }
            if ($kl === 'authorization')         { $token = $v; }
        }
    }

    // 2. Fallback: $_SERVER (untuk Apache mod_php)
    if ($token === '') {
        $token = $_SERVER['HTTP_X_API_TOKEN']
              ?? $_SERVER['HTTP_AUTHORIZATION']
              ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
              ?? '';
    }

    // 3. Fallback terakhir: query param (untuk testing / webhook)
    if ($token === '') {
        $token = $_GET['token'] ?? '';
    }

    $token = preg_replace('/^Bearer\s+/i', '', trim($token));
    if ($token !== API_TOKEN) {
        jsonResponse([
            'success' => false,
            'message' => 'Unauthorized — token tidak valid atau header tidak terbaca (cPanel CGI). Gunakan Authorization: Bearer.',
            'debug'   => (defined('WP_DEBUG') && WP_DEBUG) ? true : false
        ], 401);
    }
}

// --- JSON Response ---
function jsonResponse(array $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// --- Get JSON Body ---
function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

// --- Generate UUID v4 ---
function generateUuid(): string {
    $data    = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

// --- Pagination helper ---
function getPagination(): array {
    $page  = max(1, (int)($_GET['page']  ?? 1));
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
    return ['page' => $page, 'limit' => $limit, 'offset' => ($page - 1) * $limit];
}

// --- Sanitize: ambil hanya kolom yang diizinkan ---
function pick(array $data, array $allowed): array {
    return array_intersect_key($data, array_flip($allowed));
}

// --- Build SET clause untuk UPDATE ---
function buildSet(array $fields): string {
    return implode(', ', array_map(fn($f) => "`$f` = :$f", $fields));
}
