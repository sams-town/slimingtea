<?php
// ============================================================
// API: /api/ocr.php
// POST ?action=extract  — Upload gambar InBody → OCR → JSON
// POST ?action=extract_url — URL gambar → OCR
//
// Priority order:
//   1. Google Vision API  (jika GOOGLE_VISION_KEY diset)
//   2. Tesseract CLI      (jika tesseract terinstall di server)
//   3. PHP GD + heuristic (fallback dasar, akurasi terbatas)
// ============================================================
require_once __DIR__ . '/helpers.php';
setCorsHeaders();
requireAuth();

$action = $_GET['action'] ?? 'extract';
$method = $_SERVER['REQUEST_METHOD'];

// ---- Config ----
define('GOOGLE_VISION_KEY', '');   // isi API key Google Vision jika ada
define('TESSERACT_BIN',     'tesseract'); // path ke binary, mis. '/usr/bin/tesseract'
define('OCR_TEMP_DIR',      sys_get_temp_dir() . '/hcwm_ocr/');

if (!is_dir(OCR_TEMP_DIR)) @mkdir(OCR_TEMP_DIR, 0755, true);

// ============================================================
// EXTRACT dari upload
// ============================================================
if ($action === 'extract' && $method === 'POST') {

    if (empty($_FILES['image'])) {
        jsonResponse(['success' => false, 'message' => 'No image uploaded'], 400);
    }

    $file     = $_FILES['image'];
    $maxBytes = 15 * 1024 * 1024; // 15 MB

    if ($file['size'] > $maxBytes) {
        jsonResponse(['success' => false, 'message' => 'File terlalu besar (maks 15MB)'], 400);
    }

    $allowed = ['image/jpeg','image/png','image/webp','image/heic','image/heif'];
    $mime    = mime_content_type($file['tmp_name']);

    // HEIC → convert ke JPEG jika ada ImageMagick
    $tmpPath = $file['tmp_name'];
    if (in_array($mime, ['image/heic','image/heif'])) {
        $jpgPath = OCR_TEMP_DIR . uniqid('heic_') . '.jpg';
        exec("convert " . escapeshellarg($tmpPath) . " " . escapeshellarg($jpgPath), $out, $code);
        if ($code === 0 && file_exists($jpgPath)) {
            $tmpPath = $jpgPath;
            $mime    = 'image/jpeg';
        }
    }

    if (!in_array($mime, $allowed)) {
        jsonResponse(['success' => false, 'message' => 'Format tidak didukung. Gunakan JPG/PNG/WEBP'], 400);
    }

    // Salin ke temp dir dengan nama stabil
    $workFile = OCR_TEMP_DIR . uniqid('inbody_') . '.jpg';
    if (!copy($tmpPath, $workFile)) {
        jsonResponse(['success' => false, 'message' => 'Gagal memproses file'], 500);
    }

    $result = runOCRPipeline($workFile);
    @unlink($workFile);

    jsonResponse($result);
}

// ============================================================
// EXTRACT dari base64 (dikirim dari JS Tesseract pre-process)
// ============================================================
if ($action === 'extract_base64' && $method === 'POST') {
    $body   = getBody();
    $b64    = $body['image_base64'] ?? '';
    $rawOCR = $body['raw_text']     ?? '';  // teks dari Tesseract.js

    if ($rawOCR) {
        // Client sudah OCR, kita cukup parse
        $parsed = parseInBodyText($rawOCR);
        jsonResponse([
            'success' => true,
            'source'  => 'client_tesseract',
            'raw'     => $rawOCR,
            'data'    => $parsed,
        ]);
    }

    if (!$b64) {
        jsonResponse(['success' => false, 'message' => 'No image data'], 400);
    }

    $imgData  = base64_decode(preg_replace('/^data:image\/\w+;base64,/', '', $b64));
    $workFile = OCR_TEMP_DIR . uniqid('b64_') . '.jpg';
    file_put_contents($workFile, $imgData);

    $result = runOCRPipeline($workFile);
    @unlink($workFile);

    jsonResponse($result);
}

jsonResponse(['success' => false, 'message' => 'Unknown action'], 400);

// ============================================================
// PIPELINE UTAMA
// ============================================================
function runOCRPipeline(string $imagePath): array {
    // Try 1: Google Vision
    if (GOOGLE_VISION_KEY) {
        $result = ocrGoogleVision($imagePath);
        if ($result['success']) return $result;
    }

    // Try 2: Tesseract CLI
    if (isTesseractAvailable()) {
        $result = ocrTesseract($imagePath);
        if ($result['success']) return $result;
    }

    // Try 3: Fallback heuristic (GD pixel sampling)
    return [
        'success' => false,
        'source'  => 'none',
        'message' => 'OCR tidak tersedia di server. Gunakan browser-side OCR (Tesseract.js).',
        'data'    => [],
        'fallback_hint' => 'client_ocr',
    ];
}

// ============================================================
// OCR via Google Vision API
// ============================================================
function ocrGoogleVision(string $imagePath): array {
    $imageData = base64_encode(file_get_contents($imagePath));
    $payload   = json_encode([
        'requests' => [[
            'image'    => ['content' => $imageData],
            'features' => [['type' => 'TEXT_DETECTION', 'maxResults' => 1]],
        ]]
    ]);

    $ch = curl_init('https://vision.googleapis.com/v1/images:annotate?key=' . GOOGLE_VISION_KEY);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 15,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        return ['success' => false, 'source' => 'google_vision', 'message' => 'Vision API error'];
    }

    $json = json_decode($response, true);
    $text = $json['responses'][0]['fullTextAnnotation']['text'] ?? '';

    if (!$text) {
        return ['success' => false, 'source' => 'google_vision', 'message' => 'Tidak ada teks terdeteksi'];
    }

    $parsed = parseInBodyText($text);
    return [
        'success' => true,
        'source'  => 'google_vision',
        'raw'     => $text,
        'data'    => $parsed,
    ];
}

// ============================================================
// OCR via Tesseract CLI
// ============================================================
function isTesseractAvailable(): bool {
    exec(TESSERACT_BIN . ' --version 2>&1', $out, $code);
    return $code === 0;
}

function ocrTesseract(string $imagePath): array {
    // Preprocess: enhance contrast dengan GD jika tersedia
    $processedPath = preprocessImage($imagePath);

    $outBase = OCR_TEMP_DIR . uniqid('tess_out_');
    $cmd     = sprintf(
        '%s %s %s -l eng --psm 6 --oem 1 2>/dev/null',
        escapeshellcmd(TESSERACT_BIN),
        escapeshellarg($processedPath),
        escapeshellarg($outBase)
    );
    exec($cmd, $lines, $code);

    $txtFile = $outBase . '.txt';
    if ($code !== 0 || !file_exists($txtFile)) {
        if ($processedPath !== $imagePath) @unlink($processedPath);
        return ['success' => false, 'source' => 'tesseract', 'message' => 'Tesseract gagal'];
    }

    $text = file_get_contents($txtFile);
    @unlink($txtFile);
    if ($processedPath !== $imagePath) @unlink($processedPath);

    $parsed = parseInBodyText($text);
    return [
        'success' => true,
        'source'  => 'tesseract',
        'raw'     => $text,
        'data'    => $parsed,
    ];
}

// ============================================================
// Image preprocessing (GD) — tingkatkan akurasi OCR
// ============================================================
function preprocessImage(string $src): string {
    if (!extension_loaded('gd')) return $src;

    $img = null;
    $mime = mime_content_type($src);
    try {
        if ($mime === 'image/jpeg') $img = imagecreatefromjpeg($src);
        elseif ($mime === 'image/png') $img = imagecreatefrompng($src);
        elseif ($mime === 'image/webp') $img = imagecreatefromwebp($src);
    } catch (\Throwable $e) { return $src; }

    if (!$img) return $src;

    $w = imagesx($img);
    $h = imagesy($img);

    // Scale up kecil-kecil → OCR lebih akurat
    if ($w < 1200) {
        $scale  = 1200 / $w;
        $newW   = (int)($w * $scale);
        $newH   = (int)($h * $scale);
        $scaled = imagecreatetruecolor($newW, $newH);
        imagecopyresampled($scaled, $img, 0, 0, 0, 0, $newW, $newH, $w, $h);
        imagedestroy($img);
        $img = $scaled;
    }

    // Convert ke grayscale
    imagefilter($img, IMG_FILTER_GRAYSCALE);
    // Brightness & contrast
    imagefilter($img, IMG_FILTER_BRIGHTNESS, 10);
    imagefilter($img, IMG_FILTER_CONTRAST,   -25);
    // Sharpen
    $sharpen = [[0,-1,0],[-1,5,-1],[0,-1,0]];
    imageconvolution($img, $sharpen, 1, 0);

    $dst = OCR_TEMP_DIR . uniqid('pre_') . '.png';
    imagepng($img, $dst);
    imagedestroy($img);

    return $dst;
}

// ============================================================
// PARSER — Ekstrak nilai dari teks InBody
// ============================================================
function parseInBodyText(string $text): array {
    $data       = [];
    $confidence = [];

    // Normalisasi: hilangkan karakter aneh OCR
    $text = preg_replace('/[^\x20-\x7E\n]/', ' ', $text);
    $text = preg_replace('/\s+/', ' ', $text);

    // ---- Tanggal: DD.MM.YYYY atau DD/MM/YYYY atau MM/DD/YYYY ----
    if (preg_match('/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/', $text, $m)) {
        // Format InBody: DD.MM.YYYY
        $day   = str_pad($m[1], 2, '0', STR_PAD_LEFT);
        $month = str_pad($m[2], 2, '0', STR_PAD_LEFT);
        $year  = $m[3];
        // Validasi bulan
        if ((int)$m[2] <= 12) {
            $data['visit_date'] = "$year-$month-$day";
            $confidence['visit_date'] = 0.95;
        }
    }

    // ---- Jam (untuk informasi saja) ----
    if (preg_match('/(\d{1,2}):(\d{2})/', $text, $m)) {
        $data['visit_time'] = $m[0];
    }

    // ---- Nama pasien (baris setelah tanggal/jam di InBody) ----
    // InBody: nama muncul setelah baris jam, satu baris kata
    if (preg_match('/\d{1,2}:\d{2}\s+([A-Za-z][A-Za-z\s\-\.]{1,40}?)(?:\s+(?:Weight|Skeletal|Body|BMI|Points|\d))/i', $text, $m)) {
        $name = trim($m[1]);
        if (strlen($name) >= 2 && strlen($name) <= 40) {
            $data['patient_name'] = $name;
            $confidence['patient_name'] = 0.80;
        }
    }

    // ---- Weight (kg) ----
    // Pattern: "Weight" lalu angka desimal
    if (preg_match('/Weight\s*[\r\n\s]*(\d{2,3}(?:[.,]\d)?)\s*kg/i', $text, $m)) {
        $data['weight_kg'] = floatval(str_replace(',', '.', $m[1]));
        $confidence['weight_kg'] = 0.95;
    } elseif (preg_match('/(\d{2,3}[.,]\d)\s*kg.*?(?:Weight|Berat)/i', $text, $m)) {
        $data['weight_kg'] = floatval(str_replace(',', '.', $m[1]));
        $confidence['weight_kg'] = 0.80;
    }

    // ---- Skeletal Muscle Mass (kg) ----
    if (preg_match('/Skeletal\s*Muscle\s*Mass\s*[\r\n\s]*(\d{1,3}(?:[.,]\d)?)\s*kg/i', $text, $m)) {
        $data['muscle_mass_kg'] = floatval(str_replace(',', '.', $m[1]));
        $confidence['muscle_mass_kg'] = 0.92;
    } elseif (preg_match('/SMM\s*[\r\n\s]*(\d{1,3}(?:[.,]\d)?)\s*kg/i', $text, $m)) {
        $data['muscle_mass_kg'] = floatval(str_replace(',', '.', $m[1]));
        $confidence['muscle_mass_kg'] = 0.85;
    }

    // ---- Body Fat Mass (kg) ----
    if (preg_match('/Body\s*Fat\s*Mass\s*[\r\n\s]*(\d{1,3}(?:[.,]\d)?)\s*kg/i', $text, $m)) {
        $data['body_fat_kg'] = floatval(str_replace(',', '.', $m[1]));
        $confidence['body_fat_kg'] = 0.92;
    }

    // ---- BMI ----
    if (preg_match('/BMI\s*[\r\n\s]*(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:kg\/m|kg.m)/i', $text, $m)) {
        $data['bmi'] = floatval(str_replace(',', '.', $m[1]));
        $confidence['bmi'] = 0.93;
    } elseif (preg_match('/BMI\s*[\r\n\s]+(\d{1,2}[.,]\d)/i', $text, $m)) {
        $data['bmi'] = floatval(str_replace(',', '.', $m[1]));
        $confidence['bmi'] = 0.85;
    }

    // ---- Percent Body Fat (%) ----
    if (preg_match('/Percent\s*Body\s*Fat\s*[\r\n\s]*(\d{1,2}(?:[.,]\d)?)\s*%/i', $text, $m)) {
        $data['body_fat_pct'] = floatval(str_replace(',', '.', $m[1]));
        $confidence['body_fat_pct'] = 0.92;
    } elseif (preg_match('/PBF\s*[\r\n\s]*(\d{1,2}(?:[.,]\d)?)\s*%/i', $text, $m)) {
        $data['body_fat_pct'] = floatval(str_replace(',', '.', $m[1]));
        $confidence['body_fat_pct'] = 0.85;
    }

    // ---- InBody Score / Points ----
    if (preg_match('/(\d{2,3})\s*Points/i', $text, $m)) {
        $data['inbody_score'] = (int)$m[1];
        $confidence['inbody_score'] = 0.90;
    }

    // ---- Top % ----
    if (preg_match('/Top\s*(\d{1,3}(?:[.,]\d+)?)\s*%/i', $text, $m)) {
        $data['inbody_top_pct'] = floatval(str_replace(',', '.', $m[1]));
        $confidence['inbody_top_pct'] = 0.88;
    }

    // ---- Visceral Fat Level ----
    if (preg_match('/Visceral\s*Fat\s*(?:Level|Area)?\s*[\r\n\s]*(\d{1,3}(?:[.,]\d)?)/i', $text, $m)) {
        $data['visceral_fat'] = floatval(str_replace(',', '.', $m[1]));
        $confidence['visceral_fat'] = 0.85;
    }

    // ---- Basal Metabolic Rate ----
    if (preg_match('/(?:BMR|Basal\s*Metabolic\s*Rate)\s*[\r\n\s]*(\d{3,5})\s*(?:kcal|kJ)?/i', $text, $m)) {
        $data['bmr_kcal'] = (int)$m[1];
        $confidence['bmr_kcal'] = 0.82;
    }

    // ---- Body Water ----
    if (preg_match('/(?:Total\s*Body\s*Water|TBW)\s*[\r\n\s]*(\d{1,3}(?:[.,]\d)?)\s*L/i', $text, $m)) {
        $data['body_water_l'] = floatval(str_replace(',', '.', $m[1]));
        $confidence['body_water_l'] = 0.80;
    }

    // ---- Change indicators (+/- delta values) ----
    // Cari delta weight: "+0.8" atau "-0.8" dekat "Weight"
    if (preg_match('/Weight.*?([+\-]\d+(?:[.,]\d+)?)/i', $text, $m)) {
        $data['weight_change'] = floatval(str_replace(',', '.', $m[1]));
    }

    // ---- Auto-calc body_fat_pct jika belum ada (dari body_fat_kg / weight) ----
    if (!isset($data['body_fat_pct']) && isset($data['body_fat_kg']) && isset($data['weight_kg']) && $data['weight_kg'] > 0) {
        $data['body_fat_pct'] = round($data['body_fat_kg'] / $data['weight_kg'] * 100, 1);
        $confidence['body_fat_pct'] = 0.70; // derived
    }

    // ---- Hitung total confidence score ----
    $avgConf = count($confidence) > 0 ? array_sum($confidence) / count($confidence) : 0;
    $fieldsFound = count(array_filter($data, fn($v) => $v !== null));

    return [
        'fields'          => $data,
        'confidence'      => $confidence,
        'avg_confidence'  => round($avgConf, 2),
        'fields_found'    => $fieldsFound,
        'raw_confidence'  => $avgConf >= 0.85 ? 'high' : ($avgConf >= 0.65 ? 'medium' : 'low'),
    ];
}
