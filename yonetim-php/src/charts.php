<?php
declare(strict_types=1);
// Sunucuda üretilen SVG grafikler (betik yok; CSP script-src 'none' ile uyumlu). Renkler site paletiyle aynı.
const C_ORANGE = '#cf4b06', C_INK = '#17263a', C_GREEN = '#0d7a57', C_KRAFT = '#e6d9c2', C_RED = '#b92c1c', C_SOFT = '#4d5a6b', C_LINE = '#d6c9b2';

function svgOpen(int $w, int $h, string $label): string {
    return '<svg class="chart" viewBox="0 0 ' . $w . ' ' . $h . '" role="img" aria-label="' . e($label) . '" preserveAspectRatio="xMidYMid meet">';
}
// "1.250" / "12,4 B" gibi kısa eksen yazısı
function shortNum(float $v): string {
    if ($v >= 1000000) return rtrim(rtrim(number_format($v / 1000000, 2, ',', ''), '0'), ',') . ' Mn';
    if ($v >= 1000) return rtrim(rtrim(number_format($v / 1000, 2, ',', ''), '0'), ',') . ' bin';
    return number_format($v, 0, ',', '.');
}
function niceMax(float $max): float {
    if ($max <= 0) return 4;
    $raw = $max / 4; $p = 10 ** floor(log10($raw)); $n = $raw / $p;
    $step = ($n <= 1 ? 1 : ($n <= 2 ? 2 : ($n <= 2.5 ? 2.5 : ($n <= 5 ? 5 : 10)))) * $p;
    return $step * 4;
}

// Yığılmış sütun grafik: her gün için iki parça (kasa, online). $days: [['label'=>'11-04','a'=>..,'b'=>..], ...]
function chartStacked(array $days, string $aName, string $bName, string $label): string {
    $w = 760; $h = 250; $l = 46; $r = 8; $t = 12; $b = 30; $n = max(1, count($days));
    $max = niceMax(max(array_map(fn($d) => $d['a'] + $d['b'], $days) ?: [0]));
    $pw = $w - $l - $r; $ph = $h - $t - $b; $slot = $pw / $n; $bw = max(3, $slot * 0.68);
    $o = svgOpen($w, $h, $label);
    for ($i = 0; $i <= 4; $i++) {
        $y = $t + $ph - $ph * $i / 4; $val = $max * $i / 4;
        $o .= '<line x1="' . $l . '" x2="' . ($w - $r) . '" y1="' . $y . '" y2="' . $y . '" stroke="' . C_LINE . '" stroke-dasharray="' . ($i ? '3 4' : '0') . '"/><text x="' . ($l - 6) . '" y="' . ($y + 4) . '" text-anchor="end" class="ax">' . e(shortNum($val)) . '</text>';
    }
    foreach ($days as $i => $d) {
        $x = $l + $i * $slot + ($slot - $bw) / 2; $ha = $ph * $d['a'] / $max; $hb = $ph * $d['b'] / $max;
        $tip = $d['label'] . ' · ' . $aName . ': ' . money($d['a']) . ' · ' . $bName . ': ' . money($d['b']);
        $o .= '<g><title>' . e($tip) . '</title>';
        if ($hb > 0) $o .= '<rect x="' . round($x, 1) . '" y="' . round($t + $ph - $ha - $hb, 1) . '" width="' . round($bw, 1) . '" height="' . round($hb, 1) . '" fill="' . C_INK . '"/>';
        $o .= '<rect x="' . round($x, 1) . '" y="' . round($t + $ph - $ha, 1) . '" width="' . round($bw, 1) . '" height="' . round(max($ha, 0.0), 1) . '" fill="' . C_ORANGE . '"/>';
        if ($ha + $hb == 0) $o .= '<rect x="' . round($x, 1) . '" y="' . ($t + $ph - 1.5) . '" width="' . round($bw, 1) . '" height="1.5" fill="' . C_LINE . '"/>';
        $o .= '</g>';
        if ($i % max(1, (int) ceil($n / 8)) === 0) $o .= '<text x="' . round($x + $bw / 2, 1) . '" y="' . ($h - 10) . '" text-anchor="middle" class="ax">' . e($d['label']) . '</text>';
    }
    return $o . '</svg><p class="legend"><span>' . swatch(C_ORANGE) . e($aName) . '</span><span>' . swatch(C_INK) . e($bName) . '</span></p>';
}

// Çizgi + alan grafik (birikimli müşteri sayısı vb.). $pts: [['label'=>..,'v'=>..]]
function chartLine(array $pts, string $label): string {
    $w = 520; $h = 220; $l = 38; $r = 10; $t = 14; $b = 28; $n = count($pts);
    if ($n < 2) return '<p class="muted">Yeterli veri yok.</p>';
    $max = niceMax((float) max(array_column($pts, 'v'))); $pw = $w - $l - $r; $ph = $h - $t - $b;
    $o = svgOpen($w, $h, $label); $path = ''; $dots = '';
    for ($i = 0; $i <= 3; $i++) { $y = $t + $ph - $ph * $i / 3; $o .= '<line x1="' . $l . '" x2="' . ($w - $r) . '" y1="' . $y . '" y2="' . $y . '" stroke="' . C_LINE . '" stroke-dasharray="3 4"/><text x="' . ($l - 6) . '" y="' . ($y + 4) . '" text-anchor="end" class="ax">' . e(shortNum($max * $i / 3)) . '</text>'; }
    foreach ($pts as $i => $p) {
        $x = $l + $pw * $i / ($n - 1); $y = $t + $ph - $ph * $p['v'] / $max;
        $path .= ($i ? 'L' : 'M') . round($x, 1) . ' ' . round($y, 1) . ' ';
        $dots .= '<g><title>' . e($p['label'] . ': ' . $p['v']) . '</title><circle cx="' . round($x, 1) . '" cy="' . round($y, 1) . '" r="4" fill="' . C_ORANGE . '"/></g>';
        if ($i % max(1, (int) ceil($n / 6)) === 0) $o .= '<text x="' . round($x, 1) . '" y="' . ($h - 8) . '" text-anchor="middle" class="ax">' . e($p['label']) . '</text>';
    }
    $area = $path . 'L' . ($l + $pw) . ' ' . ($t + $ph) . ' L' . $l . ' ' . ($t + $ph) . ' Z';
    return $o . '<path d="' . $area . '" fill="' . C_KRAFT . '" opacity=".7"/><path d="' . trim($path) . '" fill="none" stroke="' . C_INK . '" stroke-width="2.5"/>' . $dots . '</svg>';
}

// Halka grafik + açıklama. $parts: [['label','value','color']]
function chartDonut(array $parts, string $label, string $centerNote = ''): string {
    $total = array_sum(array_column($parts, 'value'));
    if ($total <= 0) return '<p class="muted">Veri yok.</p>';
    $r = 62; $c = 2 * M_PI * $r; $off = 0.0; $o = svgOpen(180, 180, $label) . '<circle cx="90" cy="90" r="' . $r . '" fill="none" stroke="' . C_KRAFT . '" stroke-width="26"/>';
    foreach ($parts as $p) {
        if ($p['value'] <= 0) continue;
        $len = $c * $p['value'] / $total;
        $o .= '<circle cx="90" cy="90" r="' . $r . '" fill="none" stroke="' . $p['color'] . '" stroke-width="26" stroke-dasharray="' . round($len, 2) . ' ' . round($c - $len, 2) . '" stroke-dashoffset="' . round(-$off, 2) . '" transform="rotate(-90 90 90)"><title>' . e($p['label'] . ': ' . $p['value']) . '</title></circle>';
        $off += $len;
    }
    $o .= '<text x="90" y="88" text-anchor="middle" class="big">' . (int) $total . '</text><text x="90" y="108" text-anchor="middle" class="ax">' . e($centerNote) . '</text></svg><ul class="legend col">';
    foreach ($parts as $p) $o .= '<li>' . swatch($p['color']) . e($p['label']) . ' <b>' . (int) $p['value'] . '</b></li>';
    return '<div class="donut">' . $o . '</ul></div>';
}

// Yatay çubuklar: $rows [['label','value','note'?]]
function chartHBars(array $rows, string $fmt = 'num'): string {
    if (!$rows) return '<p class="muted">Veri yok.</p>';
    $max = max(array_column($rows, 'value')) ?: 1; $o = '<ul class="hbars">';
    foreach ($rows as $r) {
        $pct = max(1.5, 100 * $r['value'] / $max); $val = $fmt === 'money' ? money($r['value']) : num($r['value']);
        $o .= '<li><span class="hl">' . ($r['href'] ?? false ? '<a href="' . e($r['href']) . '">' . e($r['label']) . '</a>' : e($r['label'])) . '</span><span class="hb"><svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width="' . round($pct, 1) . '" height="10" fill="' . C_ORANGE . '"/></svg></span><b>' . $val . '</b></li>';
    }
    return $o . '</ul>';
}

// Sitedeki barkod süsü (homeBarcode ile aynı mantık).
function barcodeSvg(string $seed, int $height = 28): string {
    $x = 0; $bars = ''; $hash = hash('crc32b', $seed) . hash('md5', $seed);
    foreach (str_split($hash) as $i => $c) { $v = hexdec($c); $w = 1 + $v % 3; if ($i % 2 === 0) $bars .= '<rect x="' . $x . '" y="0" width="' . $w . '" height="' . $height . '"/>'; $x += $w + ($v % 2); }
    return '<svg class="barcode" viewBox="0 0 ' . $x . ' ' . $height . '" preserveAspectRatio="none" aria-hidden="true">' . $bars . '</svg>';
}

// Küçük renk karesi (SVG özniteliği; satır içi stil kullanılmaz, katı CSP ile uyumlu).
function swatch(string $color): string { return '<svg class="sw" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect width="12" height="12" fill="' . e($color) . '"/></svg>'; }
