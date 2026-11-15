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
echo $fail ? "\n$fail test başarısız\n" : "\nTüm testler geçti\n"; exit($fail ? 1 : 0);
