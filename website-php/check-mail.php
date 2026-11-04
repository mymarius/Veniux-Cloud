<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }
require __DIR__.'/smtp.php';
$config=require __DIR__.'/config.php';
if (empty($config['smtp']['password'])) { echo "Uygulama şifresi henüz girilmedi.\n"; exit(2); }
try { $mail=siteMailer($config['smtp']); $mail->smtpConnect(); $mail->smtpClose(); echo "Gmail SMTP bağlantısı ve kimlik doğrulaması başarılı. E-posta gönderilmedi.\n"; }
catch (Throwable $error) {
    $details=strtolower($error->getMessage().' '.(isset($mail)?$mail->ErrorInfo:''));
    if (strpos($details,'authenticate')!==false) $reason='Gmail kimlik doğrulamasını reddetti. Hesap ve yeni uygulama şifresini kontrol edin.';
    elseif (strpos($details,'certificate')!==false || strpos($details,'crypto')!==false) $reason='TLS sertifika doğrulaması başarısız.';
    elseif (strpos($details,'smtp_not_configured')!==false) $reason='SMTP ayarları eksik veya geçersiz.';
    elseif (strpos($details,'connect')!==false) $reason='Gmail sunucusuna bağlantı kurulamadı.';
    else $reason='SMTP kontrolü tamamlanamadı.';
    echo $reason." E-posta gönderilmedi.\n"; exit(1);
}
