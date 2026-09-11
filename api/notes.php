<?php
// ============================================================
// API: /api/notes.php
// GET  ?action=list&patient_id=
// POST ?action=save    (create / update)
// POST ?action=delete&id=
// ============================================================
require_once __DIR__ . '/helpers.php';
setCorsHeaders();
requireAuth();

$pdo    = Database::getInstance();
$action = $_GET['action'] ?? 'list';
$method = $_SERVER['REQUEST_METHOD'];

// ---- LIST ----
if ($action === 'list') {
    $pid = (int)($_GET['patient_id'] ?? 0);
    if (!$pid) jsonResponse(['success' => false, 'message' => 'patient_id required'], 400);

    $stmt = $pdo->prepare(
        'SELECT * FROM doctor_notes WHERE patient_id = :pid ORDER BY week_number, created_at DESC'
    );
    $stmt->execute([':pid' => $pid]);
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
}

// ---- SAVE (upsert by uuid) ----
if ($action === 'save' && $method === 'POST') {
    $body = getBody();
    $pid  = (int)($body['patient_id'] ?? 0);
    if (!$pid) jsonResponse(['success' => false, 'message' => 'patient_id required'], 400);
    if (empty($body['note'])) jsonResponse(['success' => false, 'message' => 'note required'], 400);

    $uuid  = $body['uuid'] ?? generateUuid();
    $week  = isset($body['week_number']) ? (int)$body['week_number'] : null;
    $date  = $body['visit_date'] ?? date('Y-m-d');
    $auth  = $body['author'] ?? 'Doctor';
    $note  = $body['note'];

    // Cek apakah sudah ada berdasarkan uuid
    $check = $pdo->prepare('SELECT id FROM doctor_notes WHERE uuid = :uuid');
    $check->execute([':uuid' => $uuid]);
    $existId = $check->fetchColumn();

    if ($existId) {
        $stmt = $pdo->prepare(
            "UPDATE doctor_notes SET note=:note, author=:auth, updated_at=datetime('now') WHERE id=:id"
        );
        $stmt->execute([':note' => $note, ':auth' => $auth, ':id' => $existId]);
        jsonResponse(['success' => true, 'id' => (int)$existId, 'uuid' => $uuid, 'action' => 'updated']);
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO doctor_notes (uuid, patient_id, week_number, visit_date, note, author)
             VALUES (:uuid, :pid, :week, :date, :note, :auth)'
        );
        $stmt->execute([
            ':uuid' => $uuid, ':pid'  => $pid,  ':week' => $week,
            ':date' => $date, ':note' => $note, ':auth' => $auth
        ]);
        jsonResponse(['success' => true, 'id' => (int)$pdo->lastInsertId(), 'uuid' => $uuid, 'action' => 'created'], 201);
    }
}

// ---- DELETE ----
if ($action === 'delete' && $method === 'POST') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) jsonResponse(['success' => false, 'message' => 'ID required'], 400);
    $pdo->prepare('DELETE FROM doctor_notes WHERE id = :id')->execute([':id' => $id]);
    jsonResponse(['success' => true]);
}

jsonResponse(['success' => false, 'message' => 'Unknown action'], 400);
