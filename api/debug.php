<?php
// ============================================================
// debug.php — Diagnostic tool (HAPUS setelah selesai debug!)
// Akses: https://samstown.xyz/slimingtea/api/debug.php
// ============================================================

// Cegah cache
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Matikan output buffer
while (ob_get_level()) ob_end_clean();

$result = [];

// 1. PHP Info
$result['php_version']   = PHP_VERSION;
$result['php_ok']        = version_compare(PHP_VERSION, '8.0', '>=');

// 2. Extensions
$exts = ['pdo', 'pdo_mysql', 'json', 'mbstring', 'fileinfo'];
foreach ($exts as $e) {
    $result['ext'][$e] = extension_loaded($e);
}

// 3. Config file
$configPath = __DIR__ . '/../config/config.php';
$result['config_exists'] = file_exists($configPath);

if ($result['config_exists']) {
    require_once $configPath;
    $result['db_driver']  = DB_DRIVER;
    $result['db_host']    = MYSQL_HOST;
    $result['db_name']    = MYSQL_DBNAME;
    $result['db_user']    = MYSQL_USER;
    $result['api_token']  = API_TOKEN;
    $result['upload_dir_exists']   = is_dir(UPLOAD_DIR);
    $result['upload_dir_writable'] = is_writable(UPLOAD_DIR);
}

// 4. Database connection
$result['db_connect'] = false;
$result['db_error']   = null;
if ($result['config_exists']) {
    try {
        require_once __DIR__ . '/../config/database.php';
        $pdo = Database::getInstance();
        $result['db_connect'] = true;
        $result['db_version'] = $pdo->query('SELECT VERSION()')->fetchColumn();

        // 5. Cek tabel
        $tables = ['patients','initial_assessments','weekly_monitorings',
                   'body_circumferences','patient_photos','doctor_notes','sync_queue'];
        foreach ($tables as $t) {
            try {
                $n = $pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
                $result['tables'][$t] = "OK ($n rows)";
            } catch (Exception $e) {
                $result['tables'][$t] = 'MISSING: ' . $e->getMessage();
            }
        }

        // 6. Test INSERT pasien dummy
        $testUuid = 'debug-test-' . time();
        try {
            $pdo->prepare("INSERT INTO `patients`
                (uuid, name, sex, phone, registration_date, registration_status)
                VALUES (:uuid, :name, :sex, :phone, :reg, :status)")
            ->execute([
                ':uuid'   => $testUuid,
                ':name'   => 'DEBUG TEST - DELETE ME',
                ':sex'    => 'male',
                ':phone'  => '000',
                ':reg'    => date('Y-m-d'),
                ':status' => 'quick',
            ]);
            $newId = $pdo->lastInsertId();
            $result['test_insert'] = "SUCCESS - id=$newId";

            // Hapus langsung
            $pdo->prepare("DELETE FROM `patients` WHERE uuid = :uuid")
                ->execute([':uuid' => $testUuid]);
            $result['test_cleanup'] = 'cleaned up';

        } catch (Exception $e) {
            $result['test_insert'] = 'FAILED: ' . $e->getMessage();
        }

    } catch (Exception $e) {
        $result['db_error'] = $e->getMessage();
    }
}

// 7. Cek kolom patients
if ($result['db_connect']) {
    try {
        $cols = $pdo->query("SHOW COLUMNS FROM `patients`")
                    ->fetchAll(PDO::FETCH_COLUMN);
        $result['patients_columns'] = $cols;

        // Kolom yang wajib ada
        $required = ['registration_status','last_visit_date','visit_count'];
        foreach ($required as $c) {
            $result['column_check'][$c] = in_array($c, $cols) ? 'OK' : 'MISSING!';
        }
    } catch (Exception $e) {
        $result['columns_error'] = $e->getMessage();
    }
}

// 8. Test API token dari header
$sentToken = $_SERVER['HTTP_X_API_TOKEN']
    ?? $_SERVER['HTTP_AUTHORIZATION']
    ?? ($_GET['token'] ?? 'none sent');
$result['token_received'] = $sentToken;
$result['token_match']    = (defined('API_TOKEN') && str_replace('Bearer ', '', $sentToken) === API_TOKEN);

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
