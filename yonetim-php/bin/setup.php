<?php
declare(strict_types=1);
// Yönetim sitesi ilk kurulum (YALNIZ KENDİ BİLGİSAYARINDA çalıştır): sahip hesabı, parola özeti ve TOTP anahtarı üretir.
// Kullanım:  php yonetim-php/bin/setup.php <özel-klasör-yolu>
// Parola ve anahtar yalnızca bu bilgisayardaki özel klasöre yazılır; sonra klasör içindeki owner.json dosyasını sunucudaki
// özel klasöre (web kökü dışı) yüklersin. Parolayı kimseyle paylaşma.
if (PHP_SAPI !== 'cli') exit("Yalnızca komut satırında çalışır.\n");
require_once dirname(__DIR__) . '/src/security.php';

$dir = $argv[1] ?? '';
if ($dir === '') exit("Kullanım: php setup.php <özel-klasör-yolu>\n");
putenv('YONETIM_PRIVATE_DIR=' . $dir);
if (is_file(privateDir() . '/owner.json')) exit("Bu klasörde owner.json zaten var. Üzerine yazmamak için durdum.\n");

fwrite(STDOUT, 'Sahip e-posta adresi: '); $email = trim((string) fgets(STDIN));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) exit("Geçersiz e-posta.\n");
fwrite(STDOUT, "Parola (en az 14 karakter; yazdıkların ekranda görünür, işin bitince terminali kapat): "); $password = rtrim((string) fgets(STDIN), "\r\n");
if (strlen($password) < 14) exit("Parola en az 14 karakter olmalı.\n");
$secret = base32Encode(random_bytes(20));
privateWrite('owner.json', ['email' => $email, 'password_hash' => password_hash($password, PASSWORD_ARGON2ID), 'totp_secret' => $secret, 'allowed_ips' => []]);
$uri = 'otpauth://totp/' . rawurlencode('Veniux Yönetim:' . $email) . '?secret=' . $secret . '&issuer=' . rawurlencode('Veniux Yönetim') . '&algorithm=SHA1&digits=6&period=30';
echo "\nTamam. Dosya: " . privateDir() . "/owner.json\n";
echo "Doğrulayıcı uygulamana (Google Authenticator, Microsoft Authenticator, Aegis vb.) şu anahtarı elle ekle:\n  $secret\n(Ya da bu adresi QR'a çevirip tara: $uri)\n";
echo "Bu anahtarı bir kez gördün; kaydetmek istersen güvenli bir yere yaz. Sonraki adım: owner.json'ı sunucudaki özel klasöre yükle.\n";
