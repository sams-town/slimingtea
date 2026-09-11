<?php
// ============================================================
// API: /api/assessments.php
// GET  ?action=get&patient_id=
// POST ?action=save   (create or update by patient_id)
// ============================================================
require_once __DIR__ . '/helpers.php';
setCorsHeaders();
requireAuth();

$pdo    = Database::getInstance();
$action = $_GET['action'] ?? 'get';
$method = $_SERVER['REQUEST_METHOD'];

$ALLOWED = [
    'uuid','patient_id',
    'gds','total_cholesterol','ldl','hdl','triglycerides','uric_acid',
    'hba1c','creatinine','sgot','sgpt',
    'initial_weight','initial_height','initial_bmi',
    'target_weight','target_waist','main_goal',
    'medication','medication_other','starting_dose','date_started',
    'meal_plan','exercise_plan','additional_notes'
];

// ---- GET ----
if ($action === 'get') {
    $pid = (int)($_GET['patient_id'] ?? 0);
    if (!$pid) jsonResponse(['success' => false, 'message' => 'patient_id required'], 400);

    $stmt = $pdo->prepare('SELECT * FROM initial_assessments WHERE patient_id = :pid ORDER BY id DESC LIMIT 1');
    $stmt->execute([':pid' => $pid]);
    $row = $stmt->fetch();

    jsonResponse(['success' => true, 'data' => $row ?: null]);
}

// ---- SAVE (upsert) ----
if ($action === 'save' && $method === 'POST') {
    $body = getBody();
    $data = pick($body, $ALLOWED);

    $pid = (int)($data['patient_id'] ?? 0);
    if (!$pid) jsonResponse(['success' => false, 'message' => 'patient_id required'], 400);

    // Auto-calc BMI jika ada berat & tinggi
    if (!empty($data['initial_weight']) && !empty($data['initial_height']) && empty($data['initial_bmi'])) {
        $h = $data['initial_height'] / 100;
        $data['initial_bmi'] = round($data['initial_weight'] / ($h * $h), 2);
    }

    // Cek apakah sudah ada
    $check = $pdo->prepare('SELECT id, uuid FROM initial_assessments WHERE patient_id = :pid');
    $check->execute([':pid' => $pid]);
    $existing = $check->fetch();

    if ($existing) {
        // UPDATE
        unset($data['patient_id'], $data['uuid']);
        if (empty($data)) jsonResponse(['success' => false, 'message' => 'No data to update'], 400);

        $set  = buildSet(array_keys($data));
        $data[':id'] = $existing['id'];

        $stmt = $pdo->prepare("UPDATE initial_assessments SET $set, updated_at = NOW() WHERE id = :id");
        $stmt->execute($data);

        jsonResponse(['success' => true, 'id' => $existing['id'], 'uuid' => $existing['uuid'], 'action' => 'updated']);
    } else {
        // INSERT
        if (empty($data['uuid'])) $data['uuid'] = $body['uuid'] ?? generateUuid();

        $cols   = implode(', ', array_map(fn($k) => "`$k`", array_keys($data)));
        $places = implode(', ', array_map(fn($k) => ":$k", array_keys($data)));
        $stmt   = $pdo->prepare("INSERT INTO initial_assessments ($cols) VALUES ($places)");
        $stmt->execute($data);

        $newId = (int)$pdo->lastInsertId();
        jsonResponse(['success' => true, 'id' => $newId, 'uuid' => $data['uuid'], 'action' => 'created'], 201);
    }
}

jsonResponse(['success' => false, 'message' => 'Unknown action'], 400);
