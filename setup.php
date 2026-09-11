<!DOCTYPE html>
<?php
// ============================================================
// setup.php — Wizard Install Homecare WMS
// Akses sekali via browser setelah upload ke hosting
// Hapus file ini setelah setup selesai!
// ============================================================

// Cegah akses jika sudah ada lock file
$lockFile = __DIR__ . '/logs/setup.lock';
if (file_exists($lockFile)) {
    die('<h2 style="font-family:sans-serif;color:#dc2626;padding:2rem">
         Setup sudah selesai. File setup.php tidak bisa diakses lagi.<br>
         <a href="index.html">← Buka Aplikasi</a></h2>');
}

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/database.php';

$steps   = [];
$errors  = [];
$success = true;

// ── STEP 1: Cek PHP Version ──────────────────────────────────
$phpOk = version_compare(PHP_VERSION, '8.0.0', '>=');
$steps[] = [
    'label'  => 'PHP Version',
    'value'  => PHP_VERSION,
    'ok'     => $phpOk,
    'note'   => $phpOk ? 'OK (min 8.0)' : 'BUTUH PHP 8.0+',
];
if (!$phpOk) $errors[] = 'PHP versi 8.0+ diperlukan.';

// ── STEP 2: Cek Ekstensi PHP ─────────────────────────────────
$required_ext = ['pdo', 'pdo_mysql', 'fileinfo', 'json', 'mbstring'];
foreach ($required_ext as $ext) {
    $loaded = extension_loaded($ext);
    $steps[] = [
        'label' => "Extension: $ext",
        'value' => $loaded ? 'Loaded' : 'Not loaded',
        'ok'    => $loaded,
        'note'  => $loaded ? '' : 'DIPERLUKAN',
    ];
    if (!$loaded) $errors[] = "Ekstensi PHP $ext tidak tersedia.";
}

// ── STEP 3: Cek Koneksi Database ─────────────────────────────
$dbOk = false;
$dbMsg = '';
try {
    $pdo  = Database::getInstance();
    $ver  = $pdo->query('SELECT VERSION()')->fetchColumn();
    $dbOk = true;
    $dbMsg = "Terhubung — MySQL $ver";
} catch (Exception $e) {
    $dbMsg = 'GAGAL: ' . $e->getMessage();
    $errors[] = 'Koneksi database gagal: ' . $e->getMessage();
}
$steps[] = ['label'=>'Database Connection','value'=>MYSQL_DBNAME,'ok'=>$dbOk,'note'=>$dbMsg];

// ── STEP 4: Cek/Buat folder uploads ──────────────────────────
$uploadsDir = __DIR__ . '/uploads/photos';
$uploadsOk  = is_dir($uploadsDir) || @mkdir($uploadsDir, 0755, true);
$writableOk = $uploadsOk && is_writable($uploadsDir);
$steps[] = [
    'label' => 'Folder uploads/photos',
    'value' => $uploadsDir,
    'ok'    => $writableOk,
    'note'  => $writableOk ? 'Ada & writable' : 'TIDAK WRITABLE — chmod 755',
];
if (!$writableOk) $errors[] = 'Folder uploads/ tidak bisa ditulis.';

// ── STEP 5: Cek/Buat folder logs ─────────────────────────────
$logsDir = __DIR__ . '/logs';
$logsOk  = is_dir($logsDir) || @mkdir($logsDir, 0755, true);
$steps[] = [
    'label' => 'Folder logs/',
    'value' => $logsDir,
    'ok'    => $logsOk,
    'note'  => $logsOk ? 'OK' : 'Gagal buat folder',
];

// ── STEP 6: Jalankan Migrasi Database ────────────────────────
$migrationRun    = false;
$migrationResult = '';
if ($dbOk && isset($_POST['run_migration'])) {
    $schemaFile = __DIR__ . '/database/schema.sql';
    if (file_exists($schemaFile)) {
        $sql = file_get_contents($schemaFile);
        // Hapus komentar SQL dan split per statement
        $sql = preg_replace('/--[^\n]*\n/', "\n", $sql);
        $statements = array_filter(
            array_map('trim', explode(';', $sql)),
            fn($s) => strlen(trim($s)) > 5
        );
        $ok = 0; $fail = 0;
        foreach ($statements as $stmt) {
            try {
                $pdo->exec($stmt);
                $ok++;
            } catch (PDOException $e) {
                if (str_contains($e->getMessage(), 'already exists') ||
                    str_contains($e->getMessage(), 'Duplicate')) { $ok++; }
                else { $fail++; }
            }
        }
        // ALTER TABLE untuk kolom baru
        $alters = [
            "ALTER TABLE `patients` ADD COLUMN `registration_status` ENUM('quick','full') NOT NULL DEFAULT 'quick'",
            "ALTER TABLE `patients` ADD COLUMN `last_visit_date` DATE NULL",
            "ALTER TABLE `patients` ADD COLUMN `visit_count` SMALLINT UNSIGNED DEFAULT 0",
        ];
        foreach ($alters as $alt) {
            try { $pdo->exec($alt); }
            catch (PDOException $e) { /* kolom sudah ada */ }
        }
        $migrationRun    = true;
        $migrationResult = "Berhasil: $ok statement. Gagal: $fail.";
        $steps[] = [
            'label' => 'Migrasi Database',
            'value' => 'schema.sql',
            'ok'    => $fail === 0,
            'note'  => $migrationResult,
        ];
        // Tulis lock file
        @mkdir($logsDir, 0755, true);
        file_put_contents($lockFile, date('Y-m-d H:i:s') . ' — setup selesai');
    } else {
        $errors[] = 'File schema.sql tidak ditemukan!';
    }
}

$success = empty($errors);
?>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Setup — Homecare WMS</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#0f172a;color:#e2e8f0;min-height:100vh;padding:2rem 1rem}
    .wrap{max-width:700px;margin:0 auto}
    h1{font-size:1.5rem;font-weight:700;color:#fff;margin-bottom:0.25rem}
    .sub{color:#94a3b8;font-size:0.875rem;margin-bottom:2rem}
    .card{background:#1e293b;border:1px solid #334155;border-radius:1rem;
          padding:1.5rem;margin-bottom:1.5rem}
    .card h2{font-size:0.875rem;font-weight:700;color:#94a3b8;
             text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1rem}
    .step{display:flex;align-items:flex-start;gap:0.75rem;padding:0.5rem 0;
          border-bottom:1px solid #334155}
    .step:last-child{border-bottom:none}
    .icon{width:1.25rem;height:1.25rem;flex-shrink:0;margin-top:2px;font-size:1rem}
    .step-info{flex:1}
    .step-label{font-size:0.8rem;color:#94a3b8}
    .step-value{font-size:0.875rem;color:#e2e8f0;font-weight:500}
    .step-note{font-size:0.75rem;margin-top:0.125rem}
    .ok{color:#10b981}.fail{color:#ef4444}.warn{color:#f59e0b}
    .alert{padding:1rem 1.25rem;border-radius:0.75rem;font-size:0.875rem;margin-bottom:1rem}
    .alert-error{background:#450a0a;border:1px solid #991b1b;color:#fca5a5}
    .alert-success{background:#052e16;border:1px solid #166534;color:#86efac}
    .alert-info{background:#172554;border:1px solid #1e40af;color:#93c5fd}
    .btn{display:inline-flex;align-items:center;gap:0.5rem;padding:0.75rem 1.5rem;
         border-radius:0.75rem;font-size:0.875rem;font-weight:600;cursor:pointer;
         border:none;transition:all .15s}
    .btn-primary{background:#6366f1;color:#fff}.btn-primary:hover{background:#4f46e5}
    .btn-success{background:#059669;color:#fff}.btn-success:hover{background:#047857}
    .btn-danger{background:#dc2626;color:#fff}.btn-danger:hover{background:#b91c1c}
    .warning-box{background:#451a03;border:1px solid #92400e;border-radius:0.75rem;
                 padding:1rem;color:#fcd34d;font-size:0.8rem;line-height:1.6}
    code{background:#0f172a;padding:0.125rem 0.375rem;border-radius:0.375rem;
         font-size:0.8rem;color:#a5f3fc}
  </style>
</head>
<body>
<div class="wrap">

  <h1>🏥 Homecare WMS — Setup</h1>
  <p class="sub">Wizard instalasi awal. Jalankan sekali, lalu hapus file ini.</p>

  <!-- Warning -->
  <div class="warning-box" style="margin-bottom:1.5rem">
    ⚠️ <strong>Keamanan:</strong> Hapus atau rename file <code>setup.php</code> segera setelah
    instalasi selesai. File ini mengandung informasi sensitif.
  </div>

  <!-- Status alert -->
  <?php if (!empty($errors)): ?>
    <div class="alert alert-error">
      <strong>❌ Ada masalah:</strong><br>
      <?= implode('<br>', array_map('htmlspecialchars', $errors)) ?>
    </div>
  <?php elseif ($migrationRun): ?>
    <div class="alert alert-success">
      <strong>✅ Instalasi berhasil!</strong> Database sudah siap.
      File lock telah dibuat — setup.php tidak bisa dijalankan lagi.<br><br>
      <strong>Langkah selanjutnya:</strong><br>
      1. Hapus file <code>setup.php</code> dari server<br>
      2. Ganti <code>API_TOKEN</code> di <code>config/config.php</code><br>
      3. <a href="index.html" style="color:#86efac">Buka Aplikasi →</a>
    </div>
  <?php else: ?>
    <div class="alert alert-info">
      ℹ️ Semua cek berjalan. Klik <strong>Jalankan Migrasi</strong> untuk membuat tabel database.
    </div>
  <?php endif; ?>

  <!-- Requirements Check -->
  <div class="card">
    <h2>📋 System Requirements</h2>
    <?php foreach ($steps as $s): ?>
      <div class="step">
        <span class="icon"><?= $s['ok'] ? '✅' : '❌' ?></span>
        <div class="step-info">
          <div class="step-label"><?= htmlspecialchars($s['label']) ?></div>
          <div class="step-value"><?= htmlspecialchars($s['value']) ?></div>
          <?php if ($s['note']): ?>
            <div class="step-note <?= $s['ok'] ? 'ok' : 'fail' ?>">
              <?= htmlspecialchars($s['note']) ?>
            </div>
          <?php endif; ?>
        </div>
      </div>
    <?php endforeach; ?>
  </div>

  <!-- Database Config Info -->
  <div class="card">
    <h2>🗄️ Konfigurasi Database</h2>
    <div class="step"><span class="icon">🖥️</span>
      <div class="step-info"><div class="step-label">Host</div>
        <div class="step-value"><?= MYSQL_HOST ?>:<?= MYSQL_PORT ?></div></div>
    </div>
    <div class="step"><span class="icon">📦</span>
      <div class="step-info"><div class="step-label">Database</div>
        <div class="step-value"><?= MYSQL_DBNAME ?></div></div>
    </div>
    <div class="step"><span class="icon">👤</span>
      <div class="step-info"><div class="step-label">User</div>
        <div class="step-value"><?= MYSQL_USER ?></div></div>
    </div>
    <div class="step"><span class="icon">🔑</span>
      <div class="step-info"><div class="step-label">Password</div>
        <div class="step-value">••••••••</div></div>
    </div>
  </div>

  <!-- Action -->
  <?php if (!$migrationRun): ?>
  <div class="card">
    <h2>🚀 Jalankan Migrasi</h2>
    <p style="font-size:0.875rem;color:#94a3b8;margin-bottom:1.25rem">
      Ini akan membuat semua tabel database yang diperlukan.
      Aman dijalankan berulang kali (CREATE TABLE IF NOT EXISTS).
    </p>
    <?php if ($dbOk): ?>
      <form method="POST">
        <button type="submit" name="run_migration" value="1" class="btn btn-primary">
          ▶️ Buat Tabel Database Sekarang
        </button>
      </form>
    <?php else: ?>
      <p style="color:#ef4444;font-size:0.875rem">
        ❌ Tidak bisa migrasi — koneksi database gagal. Periksa config.php.
      </p>
    <?php endif; ?>
  </div>
  <?php else: ?>
  <div class="card" style="text-align:center;padding:2rem">
    <p style="font-size:2rem;margin-bottom:0.5rem">🎉</p>
    <p style="font-weight:600;color:#fff;margin-bottom:0.5rem">Instalasi Selesai!</p>
    <p style="color:#94a3b8;font-size:0.875rem;margin-bottom:1.5rem">
      Jangan lupa hapus file setup.php dari server.
    </p>
    <a href="index.html" class="btn btn-success">Buka Aplikasi →</a>
  </div>
  <?php endif; ?>

</div>
</body>
</html>
