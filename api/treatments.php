<?php
// ============================================================
// API: /api/treatments.php — Master Paket Perawatan Sliming
// CRUD: list, get, create, update, delete
// ============================================================
require_once __DIR__ . '/helpers.php';
setCorsHeaders();
requireAuth();

$pdo    = Database::getInstance();
$action = $_GET['action'] ?? 'list';
$method = $_SERVER['REQUEST_METHOD'];

$ALLOWED_FIELDS = [
    'uuid','code','name','category','duration_minutes',
    'price','description','include_injections','injection_type',
    'include_consultation','session_count','is_active','sort_order'
];

// ---- LIST ----
if ($action === 'list') {
    $onlyActive = ($_GET['active'] ?? '0') === '1';
    $q          = trim($_GET['q'] ?? '');
    $where      = 'WHERE deleted_at IS NULL';
    $params     = [];

    if ($onlyActive) { $where .= ' AND is_active = 1'; }
    if ($q !== '') {
        $where        .= ' AND (name LIKE :q OR code LIKE :q2 OR category LIKE :q3)';
        $params[':q']  = "%$q%";
        $params[':q2'] = "%$q%";
        $params[':q3'] = "%$q%";
    }

    $total = $pdo->prepare("SELECT COUNT(*) FROM sliming_treatments $where");
    $total->execute($params);
    $count = (int)$total->fetchColumn();

    $stmt = $pdo->prepare(
        "SELECT * FROM sliming_treatments $where ORDER BY sort_order ASC, name ASC LIMIT 200"
    );
    foreach ($params as $k => $v) $stmt->bindValue($k, $v);
    $stmt->execute();

    jsonResponse([
        'success' => true,
        'data'    => $stmt->fetchAll(),
        'meta'    => ['total' => $count]
    ]);
}

// ---- GET ----
if ($action === 'get') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) jsonResponse(['success' => false, 'message' => 'ID required'], 400);
    $stmt = $pdo->prepare('SELECT * FROM sliming_treatments WHERE id = :id AND deleted_at IS NULL');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    if (!$row) jsonResponse(['success' => false, 'message' => 'Data tidak ditemukan'], 404);
    jsonResponse(['success' => true, 'data' => $row]);
}

// ---- CREATE ----
if ($action === 'create' && $method === 'POST') {
    $body = getBody();
    $data = pick($body, $ALLOWED_FIELDS);

    if (empty($data['name'])) jsonResponse(['success'=>false,'message'=>'Nama paket wajib diisi'],400);
    if (empty($data['code'])) $data['code'] = 'PKT-' . strtoupper(substr(md5(uniqid()),0,6));

    $uuid = !empty($body['uuid']) ? $body['uuid'] : generateUuid();
    $data['uuid'] = $uuid;

    // Cast numerik & bool
    foreach (['price','duration_minutes','session_count','sort_order'] as $f) {
        if (isset($data[$f])) $data[$f] = (float)$data[$f];
    }
    foreach (['include_injections','include_consultation','is_active'] as $f) {
        if (isset($data[$f])) $data[$f] = (int)$data[$f];
    }
    if (!isset($data['is_active'])) $data['is_active'] = 1;
    if (!isset($data['sort_order'])) $data['sort_order'] = 0;

    $cols   = implode(', ', array_map(fn($k) => "`$k`", array_keys($data)));
    $places = implode(', ', array_map(fn($k) => ":$k", array_keys($data)));
    $stmt   = $pdo->prepare("INSERT INTO `sliming_treatments` ($cols) VALUES ($places)");

    try {
        $stmt->execute($data);
        $newId = (int)$pdo->lastInsertId();
        jsonResponse(['success' => true, 'id' => $newId, 'uuid' => $uuid], 201);
    } catch (PDOException $e) {
        if (str_contains($e->getMessage(), 'Duplicate')) {
            jsonResponse(['success' => false, 'message' => 'Kode treatment sudah ada'], 400);
        }
        jsonResponse(['success' => false, 'message' => 'Gagal: ' . $e->getMessage()], 500);
    }
}

// ---- UPDATE ----
if ($action === 'update' && $method === 'POST') {
    $id   = (int)($_GET['id'] ?? 0);
    $body = getBody();
    $data = pick($body, $ALLOWED_FIELDS);

    if (!$id)       jsonResponse(['success'=>false,'message'=>'ID required'],400);
    if (empty($data)) jsonResponse(['success'=>false,'message'=>'No data'],400);

    foreach (['price','duration_minutes','session_count','sort_order'] as $f) {
        if (isset($data[$f])) $data[$f] = (float)$data[$f];
    }
    foreach (['include_injections','include_consultation','is_active'] as $f) {
        if (isset($data[$f])) $data[$f] = (int)$data[$f];
    }

    $set         = buildSet(array_keys($data));
    $data[':id']  = $id;
    $stmt = $pdo->prepare("UPDATE `sliming_treatments` SET $set, updated_at = NOW() WHERE id = :id");
    $stmt->execute($data);

    jsonResponse(['success' => true, 'updated' => $stmt->rowCount()]);
}

// ---- DELETE (soft) ----
if ($action === 'delete' && $method === 'POST') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) jsonResponse(['success'=>false,'message'=>'ID required'],400);
    $stmt = $pdo->prepare("UPDATE `sliming_treatments` SET deleted_at = NOW() WHERE id = :id");
    $stmt->execute([':id' => $id]);
    jsonResponse(['success' => true]);
}

jsonResponse(['success' => false, 'message' => 'Unknown action'], 400);
