<?php
declare(strict_types=1);
// Requests are queued outside the web root. No unconfigured mail transport is used.
// The session cooldown is client-controlled; this limit is per address and kept on the server.
function contactRateAllowed(array $config): bool {
    $dir=(string)($config['request_dir']??'');
    if($dir===''||(!is_dir($dir)&&!@mkdir($dir,0700,true)))return true;
    $file=$dir.DIRECTORY_SEPARATOR.'rate-'.hash('sha256',($_SERVER['REMOTE_ADDR']??'unknown').'|'.(string)intdiv(time(),900));
    $handle=@fopen($file,'c+');
    if(!$handle||!flock($handle,LOCK_EX))return false;
    try{
        $count=(int)stream_get_contents($handle)+1;
        rewind($handle);ftruncate($handle,0);fwrite($handle,(string)$count);fflush($handle);
        return $count<=5;
    }finally{flock($handle,LOCK_UN);fclose($handle);}
}
function contactSubmit(array $config): array {
    foreach(['plan','token','website','name','email','company','interest','consent','form_type','partner_type'] as $field){
        if(isset($_POST[$field])&&!is_string($_POST[$field])){
            http_response_code(422);return [false,'Form alanlarının biçimini kontrol edin.'];
        }
    }
    require_once __DIR__.'/pricing.php';
    $selectedPlan=sitePlanSelection($_POST['plan']??null);
    $formType=$_POST['form_type']??($selectedPlan?'quote':'contact');
    $partnerType=$_POST['partner_type']??'';
    if(!in_array($formType,['demo','quote','contact','partnership'],true)||($formType==='partnership'&&!in_array($partnerType,['hardware','barcode','erp','reseller','technology','referral'],true))){http_response_code(422);return [false,'Talep ve ortaklık türünü kontrol edin.'];}
    if (isset($_POST['plan']) && !$selectedPlan) { http_response_code(422); return [false,'Paket seçimini kontrol edip tekrar deneyin.']; }
    if (!hash_equals($_SESSION['contact_token'], (string)($_POST['token'] ?? ''))) { http_response_code(403); return [false,'Formun süresi doldu. Sayfayı yenileyip tekrar deneyin.']; }
    if (!empty($_POST['website'])) { http_response_code(400); return [false,'İstek doğrulanamadı.']; }
    if (time() - (int)($_SESSION['last_contact_at'] ?? 0) < 60) { http_response_code(429); return [false,'Yeni bir talep için bir dakika bekleyin.']; }
    if (!contactRateAllowed($config)) { http_response_code(429); return [false,'Çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin.']; }
    $name=trim((string)($_POST['name']??'')); $email=trim((string)($_POST['email']??'')); $company=trim((string)($_POST['company']??'')); $interest=(string)($_POST['interest']??'');
    if (strlen($name)<2 || strlen($name)>100 || strlen($company)>160 || strlen($email)>254 || !filter_var($email,FILTER_VALIDATE_EMAIL) || !in_array($interest,['stok','depo','lot'],true) || ($_POST['consent']??'')!=='1') { http_response_code(422); return [false,'Ad, geçerli e-posta, çözüm seçimi ve iletişim iznini kontrol edin.']; }
    $directory=$config['request_dir'];
    if (!is_dir($directory) && !@mkdir($directory,0700,true)) { http_response_code(503); return [false,'Talep şu anda kaydedilemiyor. Daha sonra tekrar deneyin.']; }
    $root=realpath(__DIR__); $resolved=realpath($directory);
    if (!$resolved || str_starts_with(strtolower($resolved.DIRECTORY_SEPARATOR),strtolower($root.DIRECTORY_SEPARATOR))) { http_response_code(503); return [false,'Talep şu anda kaydedilemiyor.']; }
    $record=['id'=>bin2hex(random_bytes(16)),'created_at'=>gmdate('c'),'name'=>$name,'email'=>$email,'company'=>$company,'interest'=>$interest,'form_type'=>$formType,'consent_version'=>'2026-10-11','privacy_notice_version'=>'2026-10-13','status'=>'pending'];
    if($formType==='partnership')$record['partner_type']=$partnerType;
    if ($selectedPlan) $record['plan']=$selectedPlan;
    $file=$resolved.DIRECTORY_SEPARATOR.$record['id'].'.json'; $handle=@fopen($file,'x');
    if (!$handle) { http_response_code(503); return [false,'Talep kaydedilemedi. Daha sonra tekrar deneyin.']; }
    $payload=json_encode($record,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR); $written=fwrite($handle,$payload); fclose($handle); @chmod($file,0600);
    if ($written!==strlen($payload)) { @unlink($file); http_response_code(503); return [false,'Talep kaydedilemedi. Daha sonra tekrar deneyin.']; }
    $_SESSION['last_contact_at']=time(); $_SESSION['contact_token']=bin2hex(random_bytes(32));
    require_once __DIR__.'/conversion.php';siteConversionSuccess($formType);
    if (!empty($config['smtp']['enabled']) && !empty($config['smtp']['password'])) {
        require_once __DIR__.'/smtp.php';
        $accepted=siteSendNotification($config['smtp'],$record,$config['contact_email']);
        $record['notification_status']=$accepted?'transport_accepted':'failed';
        $record['notification_attempted_at']=gmdate('c');
        $temporary=$file.'.tmp';
        if (@file_put_contents($temporary,json_encode($record,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),LOCK_EX)!==false) { @chmod($temporary,0600); if (!@rename($temporary,$file)) @unlink($temporary); }
        return [true,$accepted?'Görüşme talebiniz kaydedildi. Bildirim e-posta hizmetine iletildi.':'Görüşme talebiniz kaydedildi. E-posta bildirimi şu anda gönderilemiyor; talebiniz korunuyor.'];
    }
    if ($config['mail_enabled'] && filter_var($config['contact_email'],FILTER_VALIDATE_EMAIL) && filter_var($config['mail_from'],FILTER_VALIDATE_EMAIL) && !preg_match('/[\r\n]/',$config['contact_email'].$config['mail_from'].$email)) {
        $subject='=?UTF-8?B?'.base64_encode('Veniux — Yeni görüşme talebi').'?=';
        $body="Yeni görüşme talebi\n\nAd: {$name}\nE-posta: {$email}\nİşletme: {$company}\nÇözüm: {$interest}\nTalep: {$record['id']}\n";
        if ($selectedPlan) $body.="Paket: {$selectedPlan['name']} / {$selectedPlan['period']} / {$selectedPlan['amount_try']} TRY + KDV\n";
        $accepted=@mail($config['contact_email'],$subject,$body,['From'=>$config['mail_from'],'Reply-To'=>$email,'MIME-Version'=>'1.0','Content-Type'=>'text/plain; charset=UTF-8']);
        $record['notification_status']=$accepted?'transport_accepted':'failed';
        $record['notification_attempted_at']=gmdate('c');
        // Keep the original durable request even if mail or the status update fails.
        $temporary=$file.'.tmp';
        if (@file_put_contents($temporary,json_encode($record,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),LOCK_EX)!==false) { @chmod($temporary,0600); if (!@rename($temporary,$file)) @unlink($temporary); }
        return [true,$accepted?'Görüşme talebiniz kaydedildi. Bildirim e-posta hizmetine iletildi.':'Görüşme talebiniz kaydedildi. E-posta bildirimi şu anda gönderilemiyor; talebiniz korunuyor.'];
    }
    return [true,'Görüşme talebiniz kaydedildi. E-posta bildirimi henüz etkin değil; bu kayıt talep kuyruğunda bekliyor.'];
}
