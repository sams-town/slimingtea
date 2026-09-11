<?php
// ============================================================
// API: /api/patients.php  —  MySQL/MariaDB compatible
// ============================================================
require_once __DIR__ . '/helpers.php';
setCorsHeaders();
requireAuth();

$pdo    = Database::getInstance();
$action = $_GET['action'] ?? 'list';
$method = $_SERVER['REQUEST_METHOD'];

$ALLOWED_FIELDS = [
    'uuid','name','dob','age','sex','phone','address','registration_date',
    'registration_status','last_visit_date','visit_count',
    'diabetes','hypertension','dyslipidemia','hyperuricemia','heart_disease',
    'other_conditions','allergies','sleep_hours','sleep_quality',
    'activity_level','activity_detail','diet_pattern','diet_detail'
];

// ---- LIST ----
if ($action === 'list') {
    $pg     = getPagination();
    $q      = trim($_GET['q'] ?? '');
    $where  = 'WHERE deleted_at IS NULL';
    $params = [];

    if ($q !== '') {
        $where       .= ' AND (name LIKE :q OR phone LIKE :q2)';
        $params[':q']  = "%$q%";
        $params[':q2'] = "%$q%";
    }

    $total = $pdo->prepare("SELECT COUNT(*) FROM patients $where");
    $total->execute($params);
    $count = (int)$total->fetchColumn();

    $stmt = $pdo->prepare(
        "SELECT * FROM patients $where ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    );
    foreach ($params as $k => $v) $stmt->bindValue($k, $v);
    $stmt->bindValue(':limit',  $pg['limit'],  PDO::PARAM_INT);
    $stmt->bindValue(':offset', $pg['offset'], PDO::PARAM_INT);
    $stmt->execute();

    jsonResponse([
        'success' => true,
        'data'    => $stmt->fetchAll(),
        'meta'    => ['total' => $count, 'page' => $pg['page'], 'limit' => $pg['limit']]
    ]);
}

// ---- GET ----
if ($action === 'get') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) jsonResponse(['success' => false, 'message' => 'ID required'], 400);

    $stmt = $pdo->prepare('SELECT * FROM patients WHERE id = :id AND deleted_at IS NULL');
    $stmt->execute([':id' => $id]);
    $patient = $stmt->fetch();

    if (!$patient) jsonResponse(['success' => false, 'message' => 'Patient not found'], 404);
    jsonResponse(['success' => true, 'data' => $patient]);
}

// ---- CREATE ----
if ($action === 'create' && $method === 'POST') {
    $body = getBody();
    $data = pick($body, $ALLOWED_FIELDS);

    // Validasi wajib
    if (empty($data['name'])) {
        jsonResponse(['success' => false, 'message' => 'Nama pasien wajib diisi'], 400);
    }
    if (empty($data['sex'])) {
        jsonResponse(['success' => false, 'message' => 'Jenis kelamin wajib diisi'], 400);
    }
    // Pastikan sex valid untuk MySQL ENUM
    if (!in_array($data['sex'], ['male', 'female'])) {
        jsonResponse(['success' => false, 'message' => 'Jenis kelamin tidak valid'], 400);
    }

    // UUID dari client (offline-first) atau generate baru
    $uuid         = !empty($body['uuid']) ? $body['uuid'] : generateUuid();
    $data['uuid'] = $uuid;

    // Default values
    if (empty($data['registration_date'])) {
        $data['registration_date'] = date('Y-m-d');
    }
    if (empty($data['registration_status'])) {
        $data['registration_status'] = 'quick';
    }
    if (!isset($data['visit_count'])) {
        $data['visit_count'] = 0;
    }

    // Cast boolean fields ke integer
    foreach (['diabetes','hypertension','dyslipidemia','hyperuricemia','heart_disease'] as $f) {
        if (isset($data[$f])) $data[$f] = (int)$data[$f];
    }

    $cols   = implode(', ', array_map(fn($k) => "`$k`", array_keys($data)));
    $places = implode(', ', array_map(fn($k) => ":$k", array_keys($data)));
    $stmt   = $pdo->prepare("INSERT INTO `patients` ($cols) VALUES ($places)");

    try {
        $stmt->execute($data);
        $newId = (int)$pdo->lastInsertId();
        markSynced($pdo, 'patients', $uuid);
        jsonResponse(['success' => true, 'id' => $newId, 'uuid' => $uuid], 201);

    } catch (PDOException $e) {
        // Duplicate UUID → idempoten (untuk offline sync)
        if (str_contains($e->getMessage(), 'Duplicate') ||
            str_contains($e->getMessage(), 'UNIQUE')) {
            $existId = getPatientIdByUuid($pdo, $uuid);
            jsonResponse(['success' => true, 'id' => $existId, 'uuid' => $uuid, 'note' => 'already_exists']);
        }
        jsonResponse(['success' => false, 'message' => 'Gagal menyimpan: ' . $e->getMessage()], 500);
    }
}

// ---- UPDATE ----
if ($action === 'update' && $method === 'POST') {
    $id   = (int)($_GET['id'] ?? 0);
    $body = getBody();
    $data = pick($body, $ALLOWED_FIELDS);

    if (!$id)       jsonResponse(['success' => false, 'message' => 'ID required'], 400);
    if (empty($data)) jsonResponse(['success' => false, 'message' => 'No data'], 400);

    // Cast boolean fields
    foreach (['diabetes','hypertension','dyslipidemia','hyperuricemia','heart_disease'] as $f) {
        if (isset($data[$f])) $data[$f] = (int)$data[$f];
    }

    $set         = buildSet(array_keys($data));
    $data[':id'] = $id;

    // FIX: gunakan NOW() bukan NOW() — MySQL/MariaDB syntax
    $stmt = $pdo->prepare("UPDATE `patients` SET $set, updated_at = NOW() WHERE id = :id");
    $stmt->execute($data);

    jsonResponse(['success' => true, 'updated' => $stmt->rowCount()]);
}

// ---- DELETE (soft delete) ----
if ($action === 'delete' && $method === 'POST') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) jsonResponse(['success' => false, 'message' => 'ID required'], 400);

    // FIX: gunakan NOW() bukan NOW()
    $stmt = $pdo->prepare("UPDATE `patients` SET deleted_at = NOW() WHERE id = :id");
    $stmt->execute([':id' => $id]);

    jsonResponse(['success' => true]);
}

jsonResponse(['success' => false, 'message' => 'Unknown action'], 400);

// ── Local helpers ─────────────────────────────────────────────
function getPatientIdByUuid(PDO $pdo, string $uuid): int {
    $s = $pdo->prepare('SELECT id FROM `patients` WHERE uuid = :uuid');
    $s->execute([':uuid' => $uuid]);
    return (int)$s->fetchColumn();
}

function markSynced(PDO $pdo, string $table, string $uuid): void {
    try {
        $s = $pdo->prepare(
            "UPDATE `sync_queue` SET status='synced' WHERE table_name=:t AND record_uuid=:u"
        );
        $s->execute([':t' => $table, ':u' => $uuid]);
    } catch (Exception $e) { /* non-critical */ }
}
