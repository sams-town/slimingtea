<?php
// ============================================================
// API: /api/photos.php
// GET    ?action=list&patient_id=
// POST   ?action=upload   (multipart/form-data)
// POST   ?action=delete&id=
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
        'SELECT * FROM patient_photos WHERE patient_id = :pid ORDER BY week_number, created_at'
    );
    $stmt->execute([':pid' => $pid]);
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
}

// ---- UPLOAD ----
if ($action === 'upload' && $method === 'POST') {
    $pid      = (int)($_POST['patient_id'] ?? 0);
    $week     = (int)($_POST['week_number'] ?? 0);
    $type     = in_array($_POST['photo_type'] ?? '', ['front','side','back','other'])
                ? $_POST['photo_type'] : 'front';
    $date     = $_POST['visit_date'] ?? date('Y-m-d');
    $uuid     = $_POST['uuid'] ?? generateUuid();

    if (!$pid) jsonResponse(['success' => false, 'message' => 'patient_id required'], 400);

    if (empty($_FILES['photo'])) {
        jsonResponse(['success' => false, 'message' => 'No file uploaded'], 400);
    }

    $file     = $_FILES['photo'];
    $maxBytes = MAX_UPLOAD_MB * 1024 * 1024;

    if ($file['size'] > $maxBytes) {
        jsonResponse(['success' => false, 'message' => 'File too large (max ' . MAX_UPLOAD_MB . 'MB)'], 400);
    }

    $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    $mime    = mime_content_type($file['tmp_name']);
    if (!in_array($mime, $allowed)) {
        jsonResponse(['success' => false, 'message' => 'Invalid file type'], 400);
    }

    // Simpan ke folder pasien
    $dir = UPLOAD_DIR . $pid . '/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $ext      = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
    $filename = sprintf('p%d_w%d_%s_%s.%s', $pid, $week, $type, date('YmdHis'), $ext);
    $dest     = $dir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        jsonResponse(['success' => false, 'message' => 'File upload failed'], 500);
    }

    $relPath = UPLOAD_URL_PATH . $pid . '/' . $filename;

    $stmt = $pdo->prepare(
        'INSERT INTO patient_photos (uuid, patient_id, week_number, visit_date, photo_path, photo_type, file_size)
         VALUES (:uuid, :pid, :week, :date, :path, :type, :size)'
    );
    $stmt->execute([
        ':uuid' => $uuid, ':pid' => $pid, ':week' => $week,
        ':date' => $date, ':path' => $relPath, ':type' => $type,
        ':size' => $file['size']
    ]);

    jsonResponse([
        'success'    => true,
        'id'         => (int)$pdo->lastInsertId(),
        'photo_path' => $relPath,
        'uuid'       => $uuid
    ], 201);
}

// ---- DELETE ----
if ($action === 'delete' && $method === 'POST') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) jsonResponse(['success' => false, 'message' => 'ID required'], 400);

    $stmt = $pdo->prepare('SELECT photo_path FROM patient_photos WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();

    if ($row) {
        $fullPath = __DIR__ . '/../' . $row['photo_path'];
        if (file_exists($fullPath)) @unlink($fullPath);
    }

    $del = $pdo->prepare('DELETE FROM patient_photos WHERE id = :id');
    $del->execute([':id' => $id]);

    jsonResponse(['success' => true]);
}

jsonResponse(['success' => false, 'message' => 'Unknown action'], 400);
