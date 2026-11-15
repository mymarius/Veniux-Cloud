<?php
declare(strict_types=1);
// Yönetim sitesi güvenliği: tek sahip hesabı, parola + TOTP, oturum, CSRF, giriş denemesi sınırı. Sır içeren dosyalar web kökü dışındaki özel klasördedir.

function privateDir(): string {
    $dir = getenv('YONETIM_PRIVATE_DIR') ?: dirname(__DIR__, 2) . '/yonetim-private';
    return rtrim(str_replace('\\', '/', $dir), '/');
}
function privateJson(string $name): ?array {
    $file = privateDir() . '/' . $name;
    if (!is_file($file)) return null;
    $data = json_decode((string) file_get_contents($file), true);
    return is_array($data) ? $data : null;
}
function privateWrite(string $name, array $data): void {
    $dir = privateDir();
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) throw new RuntimeException('Özel klasör oluşturulamadı.');
    $file = $dir . '/' . $name;
    file_put_contents($file . '.tmp', json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    @chmod($file . '.tmp', 0600);
    rename($file . '.tmp', $file);
}

// ---------- TOTP (RFC 6238, SHA-1, 6 hane, 30 sn) ----------
function base32Decode(string $s): string {
    $map = array_flip(str_split('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'));
    $s = strtoupper(preg_replace('/[^A-Za-z2-7]/', '', $s));
    $bits = '';
    foreach (str_split($s) as $c) $bits .= str_pad(decbin($map[$c]), 5, '0', STR_PAD_LEFT);
    $out = '';
    foreach (str_split($bits, 8) as $byte) if (strlen($byte) === 8) $out .= chr((int) bindec($byte));
    return $out;
}
function base32Encode(string $raw): string {
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; $bits = '';
    foreach (str_split($raw) as $c) $bits .= str_pad(decbin(ord($c)), 8, '0', STR_PAD_LEFT);
    $out = '';
    foreach (str_split($bits, 5) as $chunk) $out .= $alphabet[(int) bindec(str_pad($chunk, 5, '0'))];
    return $out;
}
function totpAt(string $secretBase32, int $step): string {
    $key = base32Decode($secretBase32);
    $hash = hash_hmac('sha1', pack('N*', 0, $step), $key, true);
    $offset = ord($hash[19]) & 0x0F;
    $code = ((ord($hash[$offset]) & 0x7F) << 24) | (ord($hash[$offset + 1]) << 16) | (ord($hash[$offset + 2]) << 8) | ord($hash[$offset + 3]);
    return str_pad((string) ($code % 1000000), 6, '0', STR_PAD_LEFT);
}
// Doğru kod, en yakın ±1 adım (saat sapması) içinde aranır; aynı adım ikinci kez kabul edilmez. Dönüş: kullanılan adım ya da null.
function totpVerify(string $secretBase32, string $code, int $lastUsedStep = 0, ?int $now = null): ?int {
    if (!preg_match('/^\d{6}$/', $code)) return null;
    $current = intdiv($now ?? time(), 30);
    foreach ([0, -1, 1] as $drift) {
        $step = $current + $drift;
        if ($step <= $lastUsedStep) continue;
        if (hash_equals(totpAt($secretBase32, $step), $code)) return $step;
    }
    return null;
}

// ---------- Giriş denemesi sınırı (IP başına 15 dakikada 5 hata) ----------
function clientIp(): string { return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'); }
function throttleFile(): string { return privateDir() . '/login-attempts.json'; }
function throttleLoad(): array { $d = is_file(throttleFile()) ? json_decode((string) file_get_contents(throttleFile()), true) : []; return is_array($d) ? $d : []; }
function throttleBlocked(?int $now = null): bool {
    $now ??= time(); $d = throttleLoad(); $ip = hash('sha256', clientIp());
    $recent = array_filter($d[$ip] ?? [], fn($t) => $t > $now - 900);
    return count($recent) >= 5;
}
function throttleFail(?int $now = null): void {
    $now ??= time(); $d = throttleLoad(); $ip = hash('sha256', clientIp());
    $d[$ip] = array_values(array_filter($d[$ip] ?? [], fn($t) => $t > $now - 900)); $d[$ip][] = $now;
    foreach ($d as $k => $v) if (!array_filter($v, fn($t) => $t > $now - 900)) unset($d[$k]);
    try { privateWrite('login-attempts.json', $d); } catch (Throwable) { /* yazılamıyorsa sınır uygulanamaz; giriş yine de TOTP ile korunur */ }
}
function throttleClear(): void { $d = throttleLoad(); unset($d[hash('sha256', clientIp())]); try { privateWrite('login-attempts.json', $d); } catch (Throwable) {} }
function auditLine(string $event): void {
    $line = gmdate('c') . ' ' . $event . ' ip=' . hash('sha256', clientIp()) . "\n";
    @file_put_contents(privateDir() . '/console-audit.log', $line, FILE_APPEND | LOCK_EX);
}

// ---------- Oturum ----------
function startSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = (($_SERVER['HTTPS'] ?? '') === 'on') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('veniux_yonetim');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
    ini_set('session.use_strict_mode', '1');
    $dir = privateDir() . '/sessions';
    if (is_dir($dir) || @mkdir($dir, 0700, true)) session_save_path($dir);
    session_start();
}
function isLoggedIn(?int $now = null): bool {
    $now ??= time();
    if (empty($_SESSION['owner_ok']) || ($_SESSION['seen'] ?? 0) < $now - 1800 || ($_SESSION['born'] ?? 0) < $now - 28800) return false;
    $_SESSION['seen'] = $now; return true;
}
function csrfToken(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(24)); }
function csrfCheck(): void {
    $sent = (string) ($_POST['csrf'] ?? '');
    if ($sent === '' || !hash_equals($_SESSION['csrf'] ?? '', $sent)) { http_response_code(400); exit('Geçersiz istek (oturum süresi dolmuş olabilir). Sayfayı yenileyin.'); }
}
function securityHeaders(): void {
    header('X-Content-Type-Options: nosniff'); header('X-Frame-Options: DENY'); header('Referrer-Policy: no-referrer');
    header('X-Robots-Tag: noindex, nofollow, noarchive'); header('Cache-Control: no-store');
    header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    if ((($_SERVER['HTTPS'] ?? '') === 'on') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')) header('Strict-Transport-Security: max-age=31536000');
}
// Parola + TOTP. Hata iletisi hangisinin yanlış olduğunu söylemez.
function attemptLogin(string $email, string $password, string $code): bool {
    $owner = privateJson('owner.json');
    if (!$owner) return false;
    $emailOk = hash_equals(strtolower((string) ($owner['email'] ?? '')), strtolower(trim($email)));
    $passOk = password_verify($password, (string) ($owner['password_hash'] ?? '$argon2id$v=19$m=65536,t=4,p=1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'));
    $state = privateJson('totp-state.json') ?? [];
    $step = totpVerify((string) ($owner['totp_secret'] ?? ''), $code, (int) ($state['last_step'] ?? 0));
    if (!$emailOk || !$passOk || $step === null) return false;
    try { privateWrite('totp-state.json', ['last_step' => $step]); } catch (Throwable) { return false; }
    return true;
}
function ipAllowed(): bool {
    $owner = privateJson('owner.json'); $list = $owner['allowed_ips'] ?? [];
    return !is_array($list) || !$list || in_array(clientIp(), $list, true);
}
