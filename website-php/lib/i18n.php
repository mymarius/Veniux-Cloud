<?php
declare(strict_types=1);
// Site dil sistemi. Kaynak dil Türkçe: vxT('Türkçe metin') çağrısında Türkçe metin anahtardır; seçili dilde karşılığı yoksa Türkçe döner.
// Dil, adres ön ekiyle seçilir: /az/... Azerbaycanca, ön eksiz adresler Türkçe. Yalnız VX_AZ_PAGES listesindeki sayfalar Azerbaycancadır;
// diğer /az/... adresleri aynı sayfanın Türkçe sürümüne yönlendirilir (çevrilmemiş içerik Azerbaycanca adreste yayımlanmaz).
const VX_LANGS = ['tr', 'az'];
const VX_AZ_PAGES = ['/', '/fiyatlandirma'];

function vxLang(): string { return $GLOBALS['vx_lang'] ?? 'tr'; }
function vxAz(): bool { return vxLang() === 'az'; }
function vxCur(): string { return vxAz() ? '₼' : '₺'; }

// URL yolundan dil ön ekini ayırır. Dönüş: [dil, ön eksiz yol]. "/az" ve "/az/" ana sayfadır.
function vxSplitPath(string $path): array {
    if ($path === '/az' || $path === '/az/') return ['az', '/'];
    if (str_starts_with($path, '/az/')) return ['az', substr($path, 3)];
    return ['tr', $path];
}

function vxDict(string $lang): array {
    static $cache = [];
    if (!isset($cache[$lang])) {
        $file = __DIR__ . '/i18n/' . $lang . '.php';
        $cache[$lang] = ($lang !== 'tr' && is_file($file)) ? (require $file) : [];
    }
    return $cache[$lang];
}

function vxT(string $text, string ...$args): string {
    $dict = vxDict(vxLang());
    $out = $dict[$text] ?? $text;
    foreach ($args as $i => $value) $out = str_replace('{' . $i . '}', $value, $out);
    return $out;
}

// Dahili bağlantı: Azerbaycanca modda, çevrilmiş sayfalara /az ön ekiyle gider; diğerleri Türkçe sayfaya.
function vxLink(string $url): string {
    if (!vxAz() || $url === '' || $url[0] !== '/' || str_starts_with($url, '//')) return $url;
    $path = parse_url($url, PHP_URL_PATH) ?: '/';
    if (!in_array($path, VX_AZ_PAGES, true)) return $url;
    return '/az' . ($url === '/' ? '/' : $url);
}

// Sayfanın diğer dil adresi (dil seçici ve hreflang için). Çevrilmemiş sayfada Azerbaycanca karşılık yoktur.
function vxAlternates(string $path): array {
    $alt = ['tr' => $path];
    if (in_array($path, VX_AZ_PAGES, true)) $alt['az'] = '/az' . ($path === '/' ? '/' : $path);
    return $alt;
}

function vxHreflang(array $config, string $path): string {
    $alt = vxAlternates($path);
    if (count($alt) < 2) return '';
    $base = rtrim($config['url'], '/');
    $html = '';
    foreach ($alt as $lang => $href) $html .= '<link rel="alternate" hreflang="' . $lang . '" href="' . htmlspecialchars($base . $href, ENT_QUOTES, 'UTF-8') . '">';
    return $html . '<link rel="alternate" hreflang="x-default" href="' . htmlspecialchars($base . $alt['tr'], ENT_QUOTES, 'UTF-8') . '">';
}
