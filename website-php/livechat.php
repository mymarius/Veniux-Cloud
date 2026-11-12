<?php
declare(strict_types=1);
// Canlı destek: ziyaretçi sohbeti ve yönetim ekranı.
// Kayıtlar web kökü dışında, konuşma başına bir JSON dosyasında tutulur. Dış hizmet kullanılmaz.
// Yönetim ekranı VENIUX_CHAT_ADMIN_KEY (en az 16 karakter) tanımlıysa açılır; tanımsızsa kapalıdır.

const CHAT_MAX_TEXT = 1000;
const CHAT_MAX_MESSAGES = 300;
const CHAT_RETENTION_DAYS = 90;

function chatDir(array $config): ?string {
    $dir = dirname($config['request_dir']) . '/website-chat';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) return null;
    $root = realpath(__DIR__);
    $resolved = realpath($dir);
    if (!$resolved || ($root && str_starts_with(strtolower($resolved . DIRECTORY_SEPARATOR), strtolower($root . DIRECTORY_SEPARATOR)))) return null;
    return $resolved;
}

function chatReply(int $status, array $data): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function chatBody(): array {
    $raw = file_get_contents('php://input', false, null, 0, 16385);
    if ($raw === false || strlen($raw) > 16384) chatReply(413, ['error' => 'İstek çok büyük.']);
    $data = json_decode($raw === '' ? '{}' : $raw, true);
    if (!is_array($data)) chatReply(400, ['error' => 'İstek okunamadı.']);
    return $data;
}

function chatSameOrigin(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $host = parse_url($origin, PHP_URL_HOST) . (($port = parse_url($origin, PHP_URL_PORT)) ? ':' . $port : '');
        if (!hash_equals(strtolower((string)($_SERVER['HTTP_HOST'] ?? '')), strtolower($host))) chatReply(403, ['error' => 'İstek doğrulanamadı.']);
    }
}

// Aynı anahtar için pencere başına sayaç; sınır aşılırsa false.
function chatRate(string $dir, string $key, int $limit, int $window): bool {
    $file = $dir . '/rate-' . hash('sha256', $key . '|' . intdiv(time(), $window));
    $handle = @fopen($file, 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) return false;
    try {
        $count = (int)stream_get_contents($handle) + 1;
        rewind($handle); ftruncate($handle, 0); fwrite($handle, (string)$count); fflush($handle);
        return $count <= $limit;
    } finally { flock($handle, LOCK_UN); fclose($handle); }
}

function chatValidId($id): bool { return is_string($id) && preg_match('/^[a-f0-9]{32}$/D', $id) === 1; }

function chatFile(string $dir, string $id): string { return $dir . '/c-' . $id . '.json'; }

// Konuşma dosyasını kilitleyip $change ile değiştirir; dosya yoksa null döner.
function chatEdit(string $dir, string $id, callable $change): ?array {
    if (!chatValidId($id) || !is_file(chatFile($dir, $id))) return null;
    $handle = @fopen(chatFile($dir, $id), 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) return null;
    try {
        $conversation = json_decode((string)stream_get_contents($handle, 2097153), true);
        if (!is_array($conversation)) return null;
        $change($conversation);
        $payload = json_encode($conversation, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        rewind($handle); ftruncate($handle, 0); fwrite($handle, (string)$payload); fflush($handle);
        return $conversation;
    } finally { flock($handle, LOCK_UN); fclose($handle); }
}

function chatRead(string $dir, string $id): ?array {
    if (!chatValidId($id) || !is_file(chatFile($dir, $id))) return null;
    $data = json_decode((string)@file_get_contents(chatFile($dir, $id)), true);
    return is_array($data) ? $data : null;
}

function chatClean(string $text): string {
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? '';
    $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? '';
    return trim($text);
}

function chatPush(array &$conversation, string $from, string $text, string $by = ''): void {
    $next = count($conversation['messages']) + 1;
    $message = ['n' => $next, 'from' => $from, 't' => gmdate('c'), 'text' => $text];
    if ($from === 'o' && $by !== '') { $message['by'] = $by; $conversation['agent'] = $by; }
    $conversation['messages'][] = $message;
    $conversation['updated'] = gmdate('c');
    if ($from === 'v') $conversation['unread'] = (int)($conversation['unread'] ?? 0) + 1;
    else $conversation['unread'] = 0;
}

function chatPublic(array $conversation, int $after): array {
    $out = [];
    foreach ($conversation['messages'] as $message) if ($message['n'] > $after) $out[] = ['n' => $message['n'], 'from' => $message['from'], 't' => $message['t'], 'text' => $message['text'], 'by' => (string)($message['by'] ?? '')];
    return $out;
}

function chatOperatorOnline(string $dir): bool {
    $file = $dir . '/operator-seen';
    return is_file($file) && time() - (int)@filemtime($file) < 75;
}

function chatClientIp(): string { return (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'); }

function chatNotify(array $config, array $conversation, string $text): void {
    if (!$config['mail_enabled'] || !filter_var($config['contact_email'], FILTER_VALIDATE_EMAIL) || !filter_var($config['mail_from'], FILTER_VALIDATE_EMAIL)) return;
    $subject = '=?UTF-8?B?' . base64_encode('Veniux — Canlı destek mesajı') . '?=';
    $body = "Canlı destek mesajı\n\nAd: {$conversation['name']}\n" . ($conversation['email'] !== '' ? "E-posta: {$conversation['email']}\n" : '') . "\n" . mb_substr($text, 0, 500) . "\n\nYanıt: {$config['url']}/destek-yonetim\n";
    @mail($config['contact_email'], $subject, $body, ['From' => $config['mail_from'], 'MIME-Version' => '1.0', 'Content-Type' => 'text/plain; charset=UTF-8']);
}

function chatPurge(string $dir): void {
    $limit = time() - CHAT_RETENTION_DAYS * 86400;
    foreach (glob($dir . '/c-*.json') ?: [] as $file) if (@filemtime($file) < $limit) @unlink($file);
    foreach (glob($dir . '/rate-*') ?: [] as $file) if (@filemtime($file) < time() - 7200) @unlink($file);
}

function chatAdminKey(): string {
    // Önce ortam değişkeni, yoksa web kökü dışındaki özel dosya (.local/website-chat-key.txt). En az 16 karakter.
    $key = (string)getenv('VENIUX_CHAT_ADMIN_KEY');
    if ($key === '') { $file = dirname(__DIR__) . '/.local/website-chat-key.txt'; $key = is_file($file) ? trim((string)@file_get_contents($file)) : ''; }
    return strlen($key) >= 16 ? $key : '';
}

function chatAdminAllowed(): bool { return !empty($_SESSION['chat_admin']); }

// ---- Ekip: her çalışanın kendi anahtarı olur; yönetici (sahip) anahtarı ekibi yönetir. Anahtarın yalnız özeti saklanır.
const CHAT_MAX_AGENTS = 20;

function chatAgents(string $dir): array {
    $file = $dir . '/agents.json';
    $data = is_file($file) ? json_decode((string)@file_get_contents($file), true) : [];
    return is_array($data) ? $data : [];
}

function chatAgentsEdit(string $dir, callable $change): ?array {
    $handle = @fopen($dir . '/agents.json', 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) return null;
    try {
        $list = json_decode((string)stream_get_contents($handle, 262145), true);
        if (!is_array($list)) $list = [];
        $result = $change($list);
        if ($result === false) return null;
        rewind($handle); ftruncate($handle, 0); fwrite($handle, (string)json_encode($list, JSON_UNESCAPED_UNICODE)); fflush($handle);
        @chmod($dir . '/agents.json', 0600);
        return $list;
    } finally { flock($handle, LOCK_UN); fclose($handle); }
}

// Verilen anahtara göre kimlik: sahip ya da etkin bir çalışan; eşleşme yoksa null.
function chatIdentify(string $dir, string $given): ?array {
    $hash = hash('sha256', $given);
    $owner = chatAdminKey();
    if ($owner !== '' && hash_equals(hash('sha256', $owner), $hash)) return ['role' => 'owner', 'name' => 'Yönetici', 'id' => 'owner'];
    foreach (chatAgents($dir) as $agent) {
        if (!empty($agent['active']) && hash_equals((string)$agent['hash'], $hash)) return ['role' => 'agent', 'name' => (string)$agent['name'], 'id' => (string)$agent['id']];
    }
    return null;
}

function chatSessionStillValid(string $dir): bool {
    if (($_SESSION['chat_role'] ?? '') === 'owner') return chatAdminKey() !== '';
    foreach (chatAgents($dir) as $agent) if (($agent['id'] ?? '') === ($_SESSION['chat_agent'] ?? '') && !empty($agent['active'])) return true;
    return false;
}

function chatAdminPage(string $nonce): void {
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: no-store');
    $enabled = chatAdminKey() !== '';
    ?><!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Canlı destek yönetimi | Veniux</title>
<link rel="icon" type="image/webp" href="/assets/logo-40-v1.webp">
<link rel="stylesheet" href="/assets/home.css?v=20261113e">
</head>
<body class="ch-admin-body">
<main class="ch-admin" id="ch-admin" data-enabled="<?= $enabled ? '1' : '0' ?>" data-auth="<?= chatAdminAllowed() ? '1' : '0' ?>" data-name="<?= htmlspecialchars((string)($_SESSION['chat_name'] ?? ''), ENT_QUOTES, 'UTF-8') ?>" data-role="<?= htmlspecialchars((string)($_SESSION['chat_role'] ?? ''), ENT_QUOTES, 'UTF-8') ?>" data-csrf="<?= htmlspecialchars((string)($_SESSION['chat_csrf'] ?? ''), ENT_QUOTES, 'UTF-8') ?>">
  <noscript>Bu ekran için JavaScript gerekir.</noscript>
</main>
<script src="/assets/chat-admin.js?v=20261113e" defer></script>
</body>
</html><?php
    exit;
}

function chatRoutes(string $path, array $config): bool {
    if ($path === '/destek-yonetim') {
        $_SESSION['chat_csrf'] = $_SESSION['chat_csrf'] ?? bin2hex(random_bytes(24));
        chatAdminPage((string)($GLOBALS['nonce'] ?? ''));
        return true;
    }
    if (!str_starts_with($path, '/api/destek/')) return false;
    $action = substr($path, strlen('/api/destek/'));
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $dir = chatDir($config);
    if ($dir === null) chatReply(503, ['error' => 'Canlı destek şu anda kullanılamıyor.']);
    if ($method === 'POST') chatSameOrigin();

    // ---- Ziyaretçi ----
    if ($action === 'durum' && $method === 'GET') chatReply(200, ['enabled' => chatAdminKey() !== '', 'online' => chatOperatorOnline($dir)]);
    if ($action === 'baslat' && $method === 'POST') {
        $data = chatBody();
        if (!empty($data['website'])) chatReply(400, ['error' => 'İstek doğrulanamadı.']);
        if (empty($data['consent'])) chatReply(422, ['error' => 'Devam etmek için aydınlatma metnini onaylayın.']);
        $name = chatClean((string)($data['name'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $text = chatClean((string)($data['message'] ?? ''));
        if (mb_strlen($name) < 2 || mb_strlen($name) > 80) chatReply(422, ['error' => 'Adınızı 2-80 karakter arasında yazın.']);
        if ($email !== '' && (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL))) chatReply(422, ['error' => 'E-posta adresini kontrol edin.']);
        if ($text === '' || mb_strlen($text) > CHAT_MAX_TEXT) chatReply(422, ['error' => 'Mesaj 1-' . CHAT_MAX_TEXT . ' karakter olmalı.']);
        if (!chatRate($dir, 'start|' . chatClientIp(), 4, 900)) chatReply(429, ['error' => 'Çok fazla sohbet başlatıldı. Biraz sonra tekrar deneyin.']);
        $id = bin2hex(random_bytes(16));
        $secret = bin2hex(random_bytes(24));
        $conversation = ['id' => $id, 'secret' => hash('sha256', $secret), 'name' => $name, 'email' => $email, 'created' => gmdate('c'), 'updated' => gmdate('c'), 'status' => 'open', 'unread' => 0, 'messages' => []];
        chatPush($conversation, 'v', $text);
        $file = chatFile($dir, $id);
        if (@file_put_contents($file, json_encode($conversation, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) === false) chatReply(503, ['error' => 'Mesaj kaydedilemedi.']);
        @chmod($file, 0600);
        chatNotify($config, $conversation, $text);
        chatReply(200, ['id' => $id, 'secret' => $secret, 'online' => chatOperatorOnline($dir)]);
    }
    if (($action === 'gonder' && $method === 'POST') || ($action === 'mesajlar' && $method === 'GET')) {
        $data = $method === 'POST' ? chatBody() : $_GET;
        $id = $data['id'] ?? '';
        $secret = (string)($data['secret'] ?? '');
        $conversation = chatValidId($id) ? chatRead($dir, $id) : null;
        if (!$conversation || !hash_equals((string)$conversation['secret'], hash('sha256', $secret))) chatReply(404, ['error' => 'Sohbet bulunamadı.']);
        if ($action === 'mesajlar') {
            $after = max(0, (int)($_GET['after'] ?? 0));
            chatReply(200, ['messages' => chatPublic($conversation, $after), 'online' => chatOperatorOnline($dir), 'status' => $conversation['status']]);
        }
        $text = chatClean((string)($data['text'] ?? ''));
        if ($text === '' || mb_strlen($text) > CHAT_MAX_TEXT) chatReply(422, ['error' => 'Mesaj 1-' . CHAT_MAX_TEXT . ' karakter olmalı.']);
        if (count($conversation['messages']) >= CHAT_MAX_MESSAGES) chatReply(429, ['error' => 'Bu sohbet dolu. Yeni bir sohbet başlatın.']);
        if (!chatRate($dir, 'send|' . $id, 30, 300)) chatReply(429, ['error' => 'Çok hızlı yazıyorsunuz. Biraz bekleyin.']);
        $notify = false;
        $updated = chatEdit($dir, $id, function (array &$c) use ($text, &$notify) {
            $c['status'] = 'open';
            $last = end($c['messages']);
            $notify = !$last || $last['from'] === 'o' || (time() - strtotime($last['t'])) > 600;
            chatPush($c, 'v', $text);
        });
        if (!$updated) chatReply(404, ['error' => 'Sohbet bulunamadı.']);
        if ($notify) chatNotify($config, $updated, $text);
        chatReply(200, ['ok' => true]);
    }

    // ---- Yönetim ----
    if (!str_starts_with($action, 'yonetim/')) chatReply(404, ['error' => 'Bulunamadı.']);
    $admin = substr($action, strlen('yonetim/'));
    if ($admin === 'giris' && $method === 'POST') {
        if (chatAdminKey() === '') chatReply(503, ['error' => 'Yönetim anahtarı tanımlı değil.']);
        if (!chatRate($dir, 'login|' . chatClientIp(), 6, 900)) chatReply(429, ['error' => 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.']);
        $data = chatBody();
        usleep(300000);
        $who = chatIdentify($dir, (string)($data['key'] ?? ''));
        if (!$who) chatReply(403, ['error' => 'Anahtar yanlış.']);
        session_regenerate_id(true);
        $_SESSION['chat_admin'] = true;
        $_SESSION['chat_role'] = $who['role'];
        $_SESSION['chat_name'] = $who['name'];
        $_SESSION['chat_agent'] = $who['id'];
        $_SESSION['chat_csrf'] = bin2hex(random_bytes(24));
        chatReply(200, ['csrf' => $_SESSION['chat_csrf'], 'name' => $who['name'], 'role' => $who['role']]);
    }
    if (!chatAdminAllowed() || !chatSessionStillValid($dir)) { unset($_SESSION['chat_admin']); chatReply(401, ['error' => 'Giriş gerekli.']); }
    if ($method === 'POST') {
        $token = (string)($_SERVER['HTTP_X_CHAT_CSRF'] ?? '');
        if (!hash_equals((string)($_SESSION['chat_csrf'] ?? ''), $token)) chatReply(403, ['error' => 'Oturum doğrulanamadı. Sayfayı yenileyin.']);
    }
    @touch($dir . '/operator-seen');
    if ($admin === 'cikis' && $method === 'POST') { unset($_SESSION['chat_admin']); chatReply(200, ['ok' => true]); }
    if ($admin === 'ben' && $method === 'GET') chatReply(200, ['name' => (string)($_SESSION['chat_name'] ?? ''), 'role' => (string)($_SESSION['chat_role'] ?? '')]);
    if (str_starts_with($admin, 'ekip')) {
        if (($_SESSION['chat_role'] ?? '') !== 'owner') chatReply(403, ['error' => 'Bu işlem yalnız yönetici içindir.']);
        $publicAgents = static fn(array $list) => array_map(static fn($a) => ['id' => $a['id'], 'name' => $a['name'], 'active' => !empty($a['active']), 'created' => $a['created']], $list);
        if ($admin === 'ekip' && $method === 'GET') chatReply(200, ['agents' => $publicAgents(chatAgents($dir))]);
        if ($admin === 'ekip-ekle' && $method === 'POST') {
            $data = chatBody();
            $name = chatClean((string)($data['name'] ?? ''));
            if (mb_strlen($name) < 2 || mb_strlen($name) > 40 || $name === 'Yönetici') chatReply(422, ['error' => 'Ad 2-40 karakter olmalı.']);
            $key = rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
            $added = null;
            $list = chatAgentsEdit($dir, function (array &$list) use ($name, $key, &$added) {
                if (count($list) >= CHAT_MAX_AGENTS) return false;
                foreach ($list as $agent) if (mb_strtolower($agent['name']) === mb_strtolower($name)) return false;
                $added = ['id' => bin2hex(random_bytes(8)), 'name' => $name, 'hash' => hash('sha256', $key), 'active' => true, 'created' => gmdate('c')];
                $list[] = $added;
                return true;
            });
            if ($list === null || !$added) chatReply(422, ['error' => 'Ekip kişisi eklenemedi: ad kullanımda ya da en fazla ' . CHAT_MAX_AGENTS . ' kişi.']);
            chatReply(200, ['key' => $key, 'agents' => $publicAgents($list)]);
        }
        if ($admin === 'ekip-durum' && $method === 'POST') {
            $data = chatBody();
            $id = (string)($data['id'] ?? '');
            $active = !empty($data['active']);
            $found = false;
            $list = chatAgentsEdit($dir, function (array &$list) use ($id, $active, &$found) { foreach ($list as &$agent) if ($agent['id'] === $id) { $agent['active'] = $active; $found = true; } });
            if ($list === null || !$found) chatReply(404, ['error' => 'Kişi bulunamadı.']);
            chatReply(200, ['agents' => $publicAgents($list)]);
        }
        chatReply(404, ['error' => 'Bulunamadı.']);
    }
    if ($admin === 'liste' && $method === 'GET') {
        chatPurge($dir);
        $rows = [];
        foreach (glob($dir . '/c-*.json') ?: [] as $file) {
            $c = json_decode((string)@file_get_contents($file), true);
            if (!is_array($c)) continue;
            $last = end($c['messages']);
            $rows[] = ['id' => $c['id'], 'name' => $c['name'], 'email' => $c['email'], 'status' => $c['status'], 'unread' => (int)($c['unread'] ?? 0), 'agent' => (string)($c['agent'] ?? ''), 'updated' => $c['updated'], 'last' => $last ? mb_substr((string)$last['text'], 0, 90) : '', 'count' => count($c['messages'])];
        }
        usort($rows, static fn($a, $b) => strcmp($b['updated'], $a['updated']));
        chatReply(200, ['conversations' => array_slice($rows, 0, 200)]);
    }
    if ($admin === 'konu' && $method === 'GET') {
        $c = chatRead($dir, (string)($_GET['id'] ?? ''));
        if (!$c) chatReply(404, ['error' => 'Sohbet bulunamadı.']);
        $after = max(0, (int)($_GET['after'] ?? 0));
        if (!empty($_GET['read'])) chatEdit($dir, $c['id'], function (array &$x) { $x['unread'] = 0; });
        chatReply(200, ['name' => $c['name'], 'email' => $c['email'], 'status' => $c['status'], 'messages' => chatPublic($c, $after)]);
    }
    if (in_array($admin, ['yanit', 'kapat'], true) && $method === 'POST') {
        $data = chatBody();
        $id = (string)($data['id'] ?? '');
        if ($admin === 'kapat') {
            $ok = chatEdit($dir, $id, function (array &$c) { $c['status'] = 'closed'; });
            chatReply($ok ? 200 : 404, $ok ? ['ok' => true] : ['error' => 'Sohbet bulunamadı.']);
        }
        $text = chatClean((string)($data['text'] ?? ''));
        if ($text === '' || mb_strlen($text) > CHAT_MAX_TEXT) chatReply(422, ['error' => 'Yanıt 1-' . CHAT_MAX_TEXT . ' karakter olmalı.']);
        $ok = chatEdit($dir, $id, function (array &$c) use ($text) { $c['status'] = 'open'; chatPush($c, 'o', $text, (string)($_SESSION['chat_name'] ?? '')); });
        chatReply($ok ? 200 : 404, $ok ? ['ok' => true] : ['error' => 'Sohbet bulunamadı.']);
    }
    chatReply(404, ['error' => 'Bulunamadı.']);
}
