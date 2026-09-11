<?php
// ============================================================
// Script helper: generate PNG icons dari SVG
// Jalankan sekali: php assets/icons/generate-icons.php
// Butuh ext GD atau Imagick
// ============================================================

$sizes = [72, 96, 128, 144, 152, 192, 384, 512];
$outputDir = __DIR__;

$svgTemplate = <<<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">
  <rect width="{SIZE}" height="{SIZE}" rx="{RADIUS}" fill="#4f46e5"/>
  <text x="{HALF}" y="{Y}" font-family="Arial,sans-serif" font-size="{FS}"
    font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">HW</text>
</svg>
SVG;

foreach ($sizes as $size) {
    $radius = round($size * 0.22);
    $half   = $size / 2;
    $y      = round($size * 0.55);
    $fs     = round($size * 0.35);

    $svg = str_replace(
        ['{SIZE}', '{RADIUS}', '{HALF}', '{Y}', '{FS}'],
        [$size, $radius, $half, $y, $fs],
        $svgTemplate
    );

    $svgFile = "$outputDir/icon-{$size}.svg";
    file_put_contents($svgFile, $svg);

    // Jika ada Imagick, convert ke PNG
    if (class_exists('Imagick')) {
        try {
            $img = new Imagick();
            $img->setResolution(300, 300);
            $img->readImageBlob($svg);
            $img->resizeImage($size, $size, Imagick::FILTER_LANCZOS, 1);
            $img->setFormat('png');
            $img->writeImage("$outputDir/icon-{$size}.png");
            $img->clear();
            echo "Generated: icon-{$size}.png\n";
        } catch (Exception $e) {
            echo "Imagick error for {$size}: " . $e->getMessage() . "\n";
        }
    } else {
        // Fallback: simpan SVG sebagai placeholder
        copy($svgFile, "$outputDir/icon-{$size}.png");
        echo "Saved SVG placeholder: icon-{$size}.png (install Imagick for real PNG)\n";
    }
}

echo "\nDone! Icons saved to: $outputDir\n";
