<?php
// ============================================================
// API: /api/sync.php
// POST ?action=push  — client kirim array record offline ke server
// GET  ?action=pull  — client minta data terbaru dari server
// GET  ?action=ping  — cek koneksi
// ============================================================
require_once __DIR__ . '/helpers.php';
setCorsHeaders();
requireAuth();

$pdo    = Database::getInstance();
$action = $_GET['action'] ?? 'ping';
$method = $_SERVER['REQUEST_METHOD'];

// ---- PING ----
if ($action === 'ping') {
    jsonResponse(['success' => true, 'message' => 'pong', 'server_time' => date('c')]);
}

// ---- PUSH: client → server ----
// Payload: { "records": [ { "table": "patients", "operation": "insert|update", "uuid": "...", "data": {...} } ] }
if ($action === 'push' && $method === 'POST') {
    $body    = getBody();
    $records = $body['records'] ?? [];

    if (empty($records)) jsonResponse(['success' => false, 'message' => 'No records'], 400);

    $results = [];
    $pdo->beginTransaction();

    try {
        foreach ($records as $rec) {
            $table = $rec['table']     ?? '';
            $op    = $rec['operation'] ?? 'insert';
            $uuid  = $rec['uuid']      ?? '';
            $data  = $rec['data']      ?? [];

            if (!$table || !$uuid) {
                $results[] = ['uuid' => $uuid, 'status' => 'skipped', 'reason' => 'missing table or uuid'];
                continue;
            }

            // Whitelist tabel yang boleh di-sync
            $allowedTables = ['patients','initial_assessments','weekly_monitorings','body_circumferences','doctor_notes'];
            if (!in_array($table, $allowedTables)) {
                $results[] = ['uuid' => $uuid, 'status' => 'skipped', 'reason' => 'table not allowed'];
                continue;
            }

            try {
                $check = $pdo->prepare("SELECT id FROM `$table` WHERE uuid = :uuid");
                $check->execute([':uuid' => $uuid]);
                $existId = $check->fetchColumn();

                if ($existId && $op !== 'delete') {
                    // UPDATE: hapus kolom yang tidak boleh diubah
                    unset($data['id'], $data['uuid'], $data['created_at']);
                    $data['synced'] = 1;
                    if (!empty($data)) {
                        $set = buildSet(array_keys($data));
                        $data[':id'] = $existId;
                        $pdo->prepare("UPDATE `$table` SET $set, updated_at=NOW() WHERE id=:id")->execute($data);
                    }
                    $results[] = ['uuid' => $uuid, 'status' => 'updated', 'id' => (int)$existId];

                } elseif (!$existId && $op !== 'delete') {
                    // INSERT
                    $data['uuid']   = $uuid;
                    $data['synced'] = 1;
                    unset($data['id'], $data['created_at']);
                    $cols   = implode(',', array_map(fn($k) => "`$k`", array_keys($data)));
                    $places = implode(',', array_map(fn($k) => ":$k", array_keys($data)));
                    $pdo->prepare("INSERT INTO `$table` ($cols) VALUES ($places)")->execute($data);
                    $results[] = ['uuid' => $uuid, 'status' => 'inserted', 'id' => (int)$pdo->lastInsertId()];

                } elseif ($op === 'delete' && $existId) {
                    if ($table === 'patients') {
                        $pdo->prepare("UPDATE patients SET deleted_at=NOW() WHERE id=:id")
                            ->execute([':id' => $existId]);
                    } else {
                        $pdo->prepare("DELETE FROM `$table` WHERE id=:id")->execute([':id' => $existId]);
                    }
                    $results[] = ['uuid' => $uuid, 'status' => 'deleted'];
                } else {
                    $results[] = ['uuid' => $uuid, 'status' => 'skipped', 'reason' => 'not found for delete'];
                }

            } catch (PDOException $e) {
                $results[] = ['uuid' => $uuid, 'status' => 'error', 'reason' => $e->getMessage()];
            }
        }

        $pdo->commit();
        jsonResponse(['success' => true, 'results' => $results, 'synced_at' => date('c')]);

    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}

// ---- PULL: server → client (data yang berubah sejak last_sync) ----
if ($action === 'pull') {
    $since = $_GET['since'] ?? '1970-01-01 00:00:00';
    $pid   = isset($_GET['patient_id']) ? (int)$_GET['patient_id'] : null;

    $pidWhere = $pid ? ' AND patient_id = :pid' : '';
    $params   = [':since' => $since];
    if ($pid) $params[':pid'] = $pid;

    $patients = [];
    if (!$pid) {
        $s = $pdo->prepare("SELECT * FROM patients WHERE updated_at > :since AND deleted_at IS NULL");
        $s->execute([':since' => $since]);
        $patients = $s->fetchAll();
    }

    $s = $pdo->prepare("SELECT * FROM initial_assessments WHERE updated_at > :since $pidWhere");
    $s->execute($params);
    $assessments = $s->fetchAll();

    $s = $pdo->prepare("SELECT * FROM weekly_monitorings WHERE updated_at > :since $pidWhere ORDER BY week_number");
    $s->execute($params);
    $monitorings = $s->fetchAll();

    $s = $pdo->prepare("SELECT * FROM body_circumferences WHERE updated_at > :since $pidWhere ORDER BY week_number");
    $s->execute($params);
    $circumferences = $s->fetchAll();

    $s = $pdo->prepare("SELECT * FROM doctor_notes WHERE updated_at > :since $pidWhere ORDER BY created_at DESC");
    $s->execute($params);
    $notes = $s->fetchAll();

    $s = $pdo->prepare("SELECT * FROM patient_photos WHERE created_at > :since $pidWhere ORDER BY created_at");
    $s->execute($params);
    $photos = $s->fetchAll();

    jsonResponse([
        'success'        => true,
        'pulled_at'      => date('c'),
        'patients'       => $patients,
        'assessments'    => $assessments,
        'monitorings'    => $monitorings,
        'circumferences' => $circumferences,
        'notes'          => $notes,
        'photos'         => $photos,
    ]);
}

jsonResponse(['success' => false, 'message' => 'Unknown action'], 400);
