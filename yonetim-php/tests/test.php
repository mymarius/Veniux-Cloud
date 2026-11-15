<?php
declare(strict_types=1);
// Çalıştır: php yonetim-php/tests/test.php
require_once dirname(__DIR__) . '/src/security.php';
require_once dirname(__DIR__) . '/src/views.php';
$fail = 0;
function check(string $name, bool $ok): void { global $fail; echo ($ok ? 'OK   ' : 'HATA ') . $name . "\n"; if (!$ok) $fail++; }
// RFC 6238 test vektörü (SHA-1, anahtar "12345678901234567890", t=59 -> 94287082; 6 hane: 287082)
$secret = base32Encode('12345678901234567890');
check('base32 gidiş-dönüş', base32Decode($secret) === '12345678901234567890' && $secret === 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
check('TOTP RFC vektörü', totpAt($secret, intdiv(59, 30)) === '287082');
check('TOTP doğru kod kabul', totpVerify($secret, '287082', 0, 59) === 1);
check('TOTP aynı adım ikinci kez reddedilir', totpVerify($secret, '287082', 1, 59) === null);
check('TOTP yanlış ve biçimsiz kod reddedilir', totpVerify($secret, '000000', 0, 59) === null && totpVerify($secret, 'abc123', 0, 59) === null);
check('TOTP bir adım sapma kabul, iki adım değil', totpVerify($secret, totpAt($secret, 10), 0, 10 * 30 + 31) === 10 && totpVerify($secret, totpAt($secret, 10), 0, 10 * 30 + 95) === null);
// Oturum
$_SESSION = ['owner_ok' => true, 'born' => 1000, 'seen' => 1000];
check('oturum süresi içinde geçerli', isLoggedIn(1000 + 600) === true);
check('boşta 30 dakika sonra düşer', isLoggedIn(1000 + 600 + 1900) === false);
$_SESSION = ['owner_ok' => true, 'born' => 1000, 'seen' => 30000];
check('8 saat sonra mutlaka düşer', isLoggedIn(1000 + 8 * 3600 + 10) === false);
// Giriş denemesi sınırı
$tmp = sys_get_temp_dir() . '/yonetim-test-' . bin2hex(random_bytes(4)); putenv('YONETIM_PRIVATE_DIR=' . $tmp);
$_SERVER['REMOTE_ADDR'] = '203.0.113.9';
check('başlangıçta engel yok', throttleBlocked(5000) === false);
for ($i = 0; $i < 5; $i++) throttleFail(5000 + $i);
check('5 hatadan sonra engellenir', throttleBlocked(5100) === true);
check('15 dakika sonra engel kalkar', throttleBlocked(5000 + 901 + 5) === false);
$_SERVER['REMOTE_ADDR'] = '203.0.113.10';
check('başka IP etkilenmez', throttleBlocked(5100) === false);
// Giriş
privateWrite('owner.json', ['email' => 'Sahip@Example.com', 'password_hash' => password_hash('uzun-ve-guclu-parola-1', PASSWORD_ARGON2ID), 'totp_secret' => $secret, 'allowed_ips' => []]);
$step = intdiv(time(), 30);
check('yanlış parola reddedilir', attemptLogin('sahip@example.com', 'yanlis-parola-123456', totpAt($secret, $step)) === false);
check('doğru bilgilerle giriş', attemptLogin('sahip@example.com', 'uzun-ve-guclu-parola-1', totpAt($secret, $step)) === true);
check('aynı TOTP kodu tekrar kullanılamaz', attemptLogin('sahip@example.com', 'uzun-ve-guclu-parola-1', totpAt($secret, $step)) === false);
check('yanlış e-posta reddedilir', attemptLogin('baska@example.com', 'uzun-ve-guclu-parola-1', totpAt($secret, $step + 1)) === false);
check('sahip dosyası yoksa giriş yok', (function () { putenv('YONETIM_PRIVATE_DIR=' . sys_get_temp_dir() . '/yok-' . bin2hex(random_bytes(4))); return attemptLogin('a@b.c', 'x', '000000'); })() === false);
// Görünüm yardımcıları
check('HTML kaçışı', e('<b>"x"</b>') === '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
check('para biçimi', money('1234.5') === '1.234,50 ₺');
check('lisans durumu', licenseState('ACTIVE', '2999-01-01 00:00:00')[0] === 'Aktif' && licenseState('ACTIVE', '2000-01-01 00:00:00')[0] === 'Süresi doldu' && licenseState(null, null)[0] === 'Lisans yok');

// ---------- Lisans merkezi işlemleri (SQLite sahte veritabanı) ----------
require_once dirname(__DIR__) . '/src/authority.php';
$sqlite = sys_get_temp_dir() . '/yonetim-auth-' . bin2hex(random_bytes(4)) . '.sqlite';
$pdo = new PDO('sqlite:' . $sqlite);
$pdo->exec("CREATE TABLE licenses(id INTEGER PRIMARY KEY AUTOINCREMENT,company TEXT,plan TEXT,key_hash TEXT UNIQUE,key_suffix TEXT,status TEXT,seats INTEGER,expires_at TEXT,created_at TEXT,notes TEXT NOT NULL DEFAULT '',contact_email TEXT NOT NULL DEFAULT '',addons TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT '');
CREATE TABLE devices(id INTEGER PRIMARY KEY AUTOINCREMENT,license_id INTEGER,fingerprint TEXT,reported_name TEXT,alias TEXT,credential_hash TEXT,enabled INTEGER,os_info TEXT,last_seen TEXT,created_at TEXT);
CREATE TABLE audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor INTEGER,action TEXT,subject TEXT,created_at TEXT);");
$tmp2 = sys_get_temp_dir() . '/yonetim-test2-' . bin2hex(random_bytes(4)); putenv('YONETIM_PRIVATE_DIR=' . $tmp2);
privateWrite('authority.json', ['dsn' => 'sqlite:' . $sqlite]);
$good = ['company' => 'Deneme Market', 'plan' => 'BUSINESS_ANNUAL', 'seats' => 3, 'expires' => gmdate('Y-m-d', time() + 200 * 86400), 'contact_email' => 'a@example.com', 'notes' => "not\x07", 'addons' => ['hardware', 'online_store']];
$thrown = function (callable $f): ?string { try { $f(); return null; } catch (InvalidArgumentException $e) { return $e->getMessage(); } };
check('geçersiz paket reddedilir', $thrown(fn() => issueAuthorityLicense(['plan' => 'X'] + $good)) !== null);
check('geçmiş tarih reddedilir', $thrown(fn() => issueAuthorityLicense(['expires' => '2020-01-01'] + $good)) !== null);
check('geçersiz terminal sayısı reddedilir', $thrown(fn() => issueAuthorityLicense(['seats' => 0] + $good)) !== null && $thrown(fn() => issueAuthorityLicense(['seats' => 1001] + $good)) !== null);
check('geçersiz eklenti reddedilir', $thrown(fn() => issueAuthorityLicense(['addons' => ['xxx']] + $good)) !== null);
check('geçersiz e-posta reddedilir', $thrown(fn() => issueAuthorityLicense(['contact_email' => 'bozuk'] + $good)) !== null);
$issued = issueAuthorityLicense($good);
$row = aOne('SELECT * FROM licenses WHERE id=?', [$issued['id']]);
check('anahtar biçimi ve yalnız özeti saklanır', preg_match('/^VNX-[A-F0-9]{48}$/', $issued['key']) === 1 && $row['key_hash'] === hash('sha256', $issued['key']) && !str_contains(json_encode($row), $issued['key']));
check('yeni lisans etkin, eklentiler kayıtlı, kontrol karakteri temizlendi', $row['status'] === 'ACTIVE' && $row['addons'] === 'hardware,online_store' && $row['notes'] === 'not');
$id = (int) $issued['id'];
foreach ([['A1', 1], ['A2', 1], ['A3', 0]] as [$alias, $on]) $pdo->prepare('INSERT INTO devices(license_id,fingerprint,reported_name,alias,credential_hash,enabled,os_info,last_seen,created_at) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$id, 'HW-' . $alias, $alias, $alias, $alias, $on, 'Win', '2026-01-01 00:00:00', '2026-01-01 00:00:00']);
check('gerekçe olmadan işlem yapılmaz', $thrown(fn() => setAuthorityState($id, 'SUSPENDED', 'kısa')) !== null);
check('terminal sınırı etkin terminalden az olamaz', $thrown(fn() => updateAuthorityLicense($id, ['seats' => 1] + $good, 'sınırı düşürme denemesi')) !== null);
updateAuthorityLicense($id, ['seats' => 5, 'plan' => 'ENTERPRISE_ANNUAL', 'addons' => []] + $good, 'paket yükseltme');
$row = aOne('SELECT * FROM licenses WHERE id=?', [$id]);
check('düzenleme paket, sınır ve eklentiyi günceller', $row['plan'] === 'ENTERPRISE_ANNUAL' && (int) $row['seats'] === 5 && $row['addons'] === '');
$before = $row['expires_at'];
$to = extendAuthorityLicense($id, 90, 'yıllık yenileme');
check('uzatma mevcut bitişten ileri sayar', $to === gmdate('Y-m-d', strtotime($before . ' UTC') + 90 * 86400) . ' 23:59:59');
$pdo->prepare("UPDATE licenses SET expires_at='2020-01-01 23:59:59' WHERE id=?")->execute([$id]);
$to2 = extendAuthorityLicense($id, 30, 'süresi dolmuştu, yeniden açıldı', 1800000000);
check('süresi geçmiş lisans bugünden itibaren uzar', $to2 === gmdate('Y-m-d', 1800000000 + 30 * 86400) . ' 23:59:59');
check('geçersiz uzatma süresi reddedilir', $thrown(fn() => extendAuthorityLicense($id, 7, 'geçersiz süre')) !== null);
setAuthorityState($id, 'SUSPENDED', 'ödeme gecikti');
check('askıya alma', aOne('SELECT status FROM licenses WHERE id=?', [$id])['status'] === 'SUSPENDED');
setAuthorityState($id, 'ACTIVE', 'ödeme alındı');
check('yeniden etkinleştirme', aOne('SELECT status FROM licenses WHERE id=?', [$id])['status'] === 'ACTIVE');
$devs = array_column(aRows('SELECT id, alias FROM devices WHERE license_id=?', [$id]), 'id', 'alias');
setAuthorityDevice($id, (int) $devs['A3'], true, 'terminal açıldı');
check('terminal açılır', (int) aOne('SELECT enabled FROM devices WHERE id=?', [$devs['A3']])['enabled'] === 1);
setAuthorityDevice($id, (int) $devs['A3'], false, 'terminal kapatıldı');
updateAuthorityLicense($id, ['seats' => 2, 'plan' => 'BUSINESS_ANNUAL', 'expires' => gmdate('Y-m-d', time() + 100 * 86400)] + $good, 'sınırı 2 yap');
check('sınır doluyken yeni terminal açılamaz', $thrown(fn() => setAuthorityDevice($id, (int) $devs['A3'], true, 'sınır testi')) !== null);
check('başka lisansın terminali değiştirilemez', $thrown(fn() => setAuthorityDevice($id + 99, (int) $devs['A1'], false, 'yanlış lisans')) !== null);
setAuthorityState($id, 'REVOKED', 'sözleşme sona erdi');
check('sonlandırılmış lisans değişmez', $thrown(fn() => setAuthorityState($id, 'ACTIVE', 'geri açma denemesi')) !== null && $thrown(fn() => updateAuthorityLicense($id, $good, 'düzenleme denemesi')) !== null && $thrown(fn() => extendAuthorityLicense($id, 30, 'uzatma denemesi')) !== null);
check('işlemler denetim tablosuna yazıldı', (int) aOne('SELECT COUNT(*) AS n FROM audit WHERE subject=?', [(string) $id])['n'] >= 8);
check('gerekçeler özel günlüğe yazıldı', str_contains((string) @file_get_contents(privateDir() . '/console-audit.log'), 'neden=sözleşme sona erdi'));
check('liste ve ayrıntı okunur', count(authorityLicenses()) === 1 && count(authorityLicense($id)['devices']) === 3);
@unlink($sqlite);
echo $fail ? "\n$fail test başarısız\n" : "\nTüm testler geçti\n"; exit($fail ? 1 : 0);
