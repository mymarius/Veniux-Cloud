<?php
declare(strict_types=1);
// Bulut uygulamasına imzalı istek (HMAC-SHA256). Gizli anahtar özel klasördeki app.json içinde (console_secret) ve bulutta VENIUX_OWNER_CONSOLE_SECRET olarak durur;
// ağ üzerinden hiçbir zaman gönderilmez, her istek anahtarla imzalanır (bkz. backend/src/middlewares/ownerConsoleAuth.js).

function cloudSettings(): ?array {
    $c = privateJson('app.json') ?? [];
    $url = rtrim((string) ($c['cloud_api_url'] ?? ''), '/'); $secret = (string) ($c['console_secret'] ?? '');
    if ($url === '' || strlen($secret) < 32) return null;
    if (!str_starts_with($url, 'https://') && !str_starts_with($url, 'http://127.0.0.1')) return null;
    return ['url' => $url, 'secret' => $secret];
}
function cloudConfigured(): bool { return cloudSettings() !== null; }
function cloudSignature(string $secret, string $method, string $path, int $time, string $nonce, string $body): string {
    return hash_hmac('sha256', implode("\n", [strtoupper($method), $path, (string) $time, $nonce, hash('sha256', $body)]), $secret);
}
// Başarılıysa çözülmüş JSON dizisi; hata durumunda bulutun verdiği iletiyle RuntimeException.
function cloudCall(string $method, string $path, ?array $payload = null, ?int $now = null): array {
    $s = cloudSettings();
    if (!$s) throw new RuntimeException('Bulut bağlantısı (cloud_api_url, console_secret) tanımlı değil.');
    $body = $payload === null ? '' : json_encode($payload, JSON_UNESCAPED_UNICODE);
    $time = $now ?? time(); $nonce = bin2hex(random_bytes(16));
    $headers = ['X-Console-Time: ' . $time, 'X-Console-Nonce: ' . $nonce, 'X-Console-Signature: ' . cloudSignature($s['secret'], $method, $path, $time, $nonce, $body), 'Accept: application/json'];
    if ($body !== '') $headers[] = 'Content-Type: application/json';
    $ctx = stream_context_create(['http' => ['method' => strtoupper($method), 'header' => implode("\r\n", $headers), 'content' => $body, 'timeout' => 15, 'ignore_errors' => true]]);
    $raw = @file_get_contents($s['url'] . $path, false, $ctx);
    if ($raw === false) throw new RuntimeException('Bulut uygulamasına ulaşılamadı.');
    $status = 0; foreach (($http_response_header ?? []) as $h) if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $status = (int) $m[1];
    $json = json_decode($raw, true);
    if ($status < 200 || $status >= 300) throw new RuntimeException(is_array($json) && isset($json['error']) ? (string) $json['error'] : 'Bulut isteği reddetti (' . $status . ').');
    return is_array($json) ? $json : [];
}
// "14.388,00", "14388", "14388.5" gibi girdiyi kuruşa çevirir; geçersizse null.
function parseLira(string $input): ?int {
    $s = trim(str_replace(['₺', ' '], '', $input));
    if ($s === '') return null;
    if (str_contains($s, ',')) $s = str_replace(',', '.', str_replace('.', '', $s));
    elseif (preg_match('/^\d{1,3}(\.\d{3})+$/', $s)) $s = str_replace('.', '', $s);
    if (!preg_match('/^\d+(\.\d{1,2})?$/', $s)) return null;
    return (int) round(((float) $s) * 100);
}
