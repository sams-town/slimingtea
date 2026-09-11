<?php
// ============================================================
// API: /api/monitorings.php
// GET  ?action=list&patient_id=
// GET  ?action=get&patient_id=&week=
// POST ?action=save  (upsert by patient_id + week_number)
// ============================================================
require_once __DIR__ . '/helpers.php';
setCorsHeaders();
requireAuth();

$pdo    = Database::getInstance();
$action = $_GET['action'] ?? 'list';
$method = $_SERVER['REQUEST_METHOD'];

$ALLOWED_MON = [
    'uuid','patient_id','week_number','visit_date',
    'weight_kg','bmi','body_fat_pct','body_fat_kg','visceral_fat',
    'muscle_mass_kg','body_age','waist_cm','abdomen_cm','hip_cm',
    'bp_systolic','bp_diastolic','heart_rate','fasting_glucose','notes'
];

$ALLOWED_CIRC = [
    'uuid','patient_id','week_number','visit_date',
    'arm_right_cm','arm_left_cm','chest_cm','waist_cm',
    'abdomen_cm','hip_cm','thigh_right_cm','thigh_left_cm'
];

// ---- LIST semua minggu untuk pasien ----
if ($action === 'list') {
    $pid = (int)($_GET['patient_id'] ?? 0);
    if (!$pid) jsonResponse(['success' => false, 'message' => 'patient_id required'], 400);

    $monStmt = $pdo->prepare('SELECT * FROM weekly_monitorings WHERE patient_id = :pid ORDER BY week_number');
    $monStmt->execute([':pid' => $pid]);
    $monitorings = $monStmt->fetchAll();

    $circStmt = $pdo->prepare('SELECT * FROM body_circumferences WHERE patient_id = :pid ORDER BY week_number');
    $circStmt->execute([':pid' => $pid]);
    $circumferences = $circStmt->fetchAll();

    jsonResponse([
        'success'        => true,
        'monitorings'    => $monitorings,
        'circumferences' => $circumferences
    ]);
}

// ---- GET satu minggu ----
if ($action === 'get') {
    $pid  = (int)($_GET['patient_id'] ?? 0);
    $week = (int)($_GET['week'] ?? 0);
    if (!$pid) jsonResponse(['success' => false, 'message' => 'patient_id required'], 400);

    $monStmt = $pdo->prepare('SELECT * FROM weekly_monitorings WHERE patient_id = :pid AND week_number = :w');
    $monStmt->execute([':pid' => $pid, ':w' => $week]);

    $circStmt = $pdo->prepare('SELECT * FROM body_circumferences WHERE patient_id = :pid AND week_number = :w');
    $circStmt->execute([':pid' => $pid, ':w' => $week]);

    jsonResponse([
        'success'       => true,
        'monitoring'    => $monStmt->fetch() ?: null,
        'circumference' => $circStmt->fetch() ?: null
    ]);
}

// ---- SAVE monitoring (upsert) ----
if ($action === 'save' && $method === 'POST') {
    $body = getBody();
    $pid  = (int)($body['patient_id'] ?? 0);
    $week = (int)($body['week_number'] ?? 0);

    if (!$pid) jsonResponse(['success' => false, 'message' => 'patient_id required'], 400);

    $results = [];

    // --- Weekly Monitoring upsert ---
    if (!empty($body['monitoring'])) {
        $mData = pick($body['monitoring'], $ALLOWED_MON);
        $mData['patient_id']  = $pid;
        $mData['week_number'] = $week;

        if (empty($mData['visit_date'])) $mData['visit_date'] = date('Y-m-d');

        // Auto-calc BMI
        if (!empty($mData['weight_kg']) && !empty($body['height_cm']) && empty($mData['bmi'])) {
            $h = $body['height_cm'] / 100;
            $mData['bmi'] = round($mData['weight_kg'] / ($h * $h), 2);
        }

        $check = $pdo->prepare('SELECT id FROM weekly_monitorings WHERE patient_id=:p AND week_number=:w');
        $check->execute([':p' => $pid, ':w' => $week]);
        $existing = $check->fetchColumn();

        if ($existing) {
            $id = (int)$existing;
            $upd = pick($mData, array_diff($ALLOWED_MON, ['uuid','patient_id','week_number']));
            if ($upd) {
                $set  = buildSet(array_keys($upd));
                $upd[':id'] = $id;
                $pdo->prepare("UPDATE weekly_monitorings SET $set, updated_at=datetime('now') WHERE id=:id")->execute($upd);
            }
            $results['monitoring'] = ['action' => 'updated', 'id' => $id];
        } else {
            if (empty($mData['uuid'])) $mData['uuid'] = generateUuid();
            $cols   = implode(',', array_map(fn($k) => "`$k`", array_keys($mData)));
            $places = implode(',', array_map(fn($k) => ":$k", array_keys($mData)));
            $pdo->prepare("INSERT INTO weekly_monitorings ($cols) VALUES ($places)")->execute($mData);
            $results['monitoring'] = ['action' => 'created', 'id' => (int)$pdo->lastInsertId()];
        }
    }

    // --- Body Circumferences upsert ---
    if (!empty($body['circumference'])) {
        $cData = pick($body['circumference'], $ALLOWED_CIRC);
        $cData['patient_id']  = $pid;
        $cData['week_number'] = $week;
        if (empty($cData['visit_date'])) $cData['visit_date'] = date('Y-m-d');

        $check = $pdo->prepare('SELECT id FROM body_circumferences WHERE patient_id=:p AND week_number=:w');
        $check->execute([':p' => $pid, ':w' => $week]);
        $existing = $check->fetchColumn();

        if ($existing) {
            $id  = (int)$existing;
            $upd = pick($cData, array_diff($ALLOWED_CIRC, ['uuid','patient_id','week_number']));
            if ($upd) {
                $set  = buildSet(array_keys($upd));
                $upd[':id'] = $id;
                $pdo->prepare("UPDATE body_circumferences SET $set, updated_at=datetime('now') WHERE id=:id")->execute($upd);
            }
            $results['circumference'] = ['action' => 'updated', 'id' => $id];
        } else {
            if (empty($cData['uuid'])) $cData['uuid'] = generateUuid();
            $cols   = implode(',', array_map(fn($k) => "`$k`", array_keys($cData)));
            $places = implode(',', array_map(fn($k) => ":$k", array_keys($cData)));
            $pdo->prepare("INSERT INTO body_circumferences ($cols) VALUES ($places)")->execute($cData);
            $results['circumference'] = ['action' => 'created', 'id' => (int)$pdo->lastInsertId()];
        }
    }

    jsonResponse(['success' => true, 'results' => $results]);
}

jsonResponse(['success' => false, 'message' => 'Unknown action'], 400);
