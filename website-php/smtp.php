<?php
declare(strict_types=1);
require_once __DIR__.'/lib/PHPMailer/Exception.php';
require_once __DIR__.'/lib/PHPMailer/PHPMailer.php';
require_once __DIR__.'/lib/PHPMailer/SMTP.php';
function siteMailer(array $settings): PHPMailer\PHPMailer\PHPMailer {
    $password=preg_replace('/\s+/','',(string)($settings['password']??''));
    if (!($settings['enabled']??false) || !$password || !filter_var($settings['username']??'',FILTER_VALIDATE_EMAIL)) throw new RuntimeException('SMTP_NOT_CONFIGURED');
    $mail=new PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP(); $mail->SMTPDebug=0; $mail->Host='smtp.gmail.com'; $mail->Port=587;
    $mail->SMTPAuth=true; $mail->SMTPSecure=PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Username=$settings['username']; $mail->Password=$password;
    $mail->Timeout=15; $mail->Timelimit=20; $mail->CharSet='UTF-8';
    $mail->setFrom($settings['username'],'Veniux');
    return $mail;
}
function siteSendNotification(array $settings,array $record,string $recipient): bool {
    try {
        $mail=siteMailer($settings); $mail->addAddress($recipient); $mail->addReplyTo($record['email'],$record['name']);
        $mail->Subject='Veniux — Yeni görüşme talebi';
        $mail->Body="Yeni görüşme talebi\n\nAd: {$record['name']}\nE-posta: {$record['email']}\nİşletme: {$record['company']}\nÇözüm: {$record['interest']}\nTalep: {$record['id']}\n";
        if (isset($record['plan'])) { $plan=$record['plan']; $mail->Body.="Paket: {$plan['name']} / {$plan['period']} / {$plan['amount_try']} TRY + KDV\n"; }
        return $mail->send();
    } catch (Throwable $error) { return false; } // Never expose SMTP errors or credentials.
}
