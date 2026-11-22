<?php
declare(strict_types=1);
// Bildirim altyapısı: e-posta (SMTP / PHPMailer) ve WhatsApp (whatsapp-mail-service /api/send).
// Olaylar kuyruğa yazılır; istek bittikten sonra ve zamanlanmış görevde (bin/panel-cron.php) gönderilir.
// Başarısız gönderim 3 kez denenir (5 dk, 30 dk, 2 sa arayla).

require_once VP_SITE_ROOT.'/lib/PHPMailer/Exception.php';
require_once VP_SITE_ROOT.'/lib/PHPMailer/PHPMailer.php';
require_once VP_SITE_ROOT.'/lib/PHPMailer/SMTP.php';

/**
 * Olay kataloğu. who: client | admin. Metinlerdeki değişkenler: {musteri} {yetkili} {fatura_no} {tutar} {son_odeme}
 * {gecikme} {kalan_gun} {lisans} {paket} {bitis} {talep_no} {konu} {gonderen} {yontem} {link} {firma}
 */
function vp_notify_events(): array {
    return [
        'invoice_created'=>['who'=>'client','label'=>'Yeni fatura oluşturuldu','subject'=>'Yeni faturanız: {fatura_no}','cta'=>'Faturayı görüntüle',
            'text'=>"Merhaba {yetkili},\n\n*{fatura_no}* numaralı faturanız oluşturuldu.\nTutar: *{tutar}*\nSon ödeme: {son_odeme}\n\nKartla, havale/EFT ile veya bakiyenizle ödeyebilirsiniz: {link}"],
        'invoice_reminder'=>['who'=>'client','label'=>'Ödeme hatırlatması (vade yaklaşınca)','subject'=>'Hatırlatma: {fatura_no} için son ödeme {son_odeme}','cta'=>'Şimdi öde',
            'text'=>"Merhaba {yetkili},\n\n*{fatura_no}* numaralı faturanızın son ödeme tarihi yaklaşıyor ({kalan_gun} gün kaldı).\nTutar: *{tutar}*\n\nÖdeme: {link}"],
        'invoice_overdue'=>['who'=>'client','label'=>'Vadesi geçen fatura','subject'=>'Ödenmemiş fatura: {fatura_no}','cta'=>'Faturayı öde',
            'text'=>"Merhaba {yetkili},\n\n*{fatura_no}* numaralı faturanızın son ödeme tarihi {gecikme} gün önce geçti.\nTutar: *{tutar}*\n\nLisansınızın kesintisiz çalışması için ödemenizi tamamlayın: {link}"],
        'invoice_paid'=>['who'=>'client','label'=>'Fatura ödendi','subject'=>'Ödemeniz alındı: {fatura_no}','cta'=>'Faturayı görüntüle',
            'text'=>"Merhaba {yetkili},\n\n*{fatura_no}* numaralı faturanızın ödemesi alındı. Teşekkür ederiz.\nTutar: *{tutar}*\nYöntem: {yontem}\n\n{link}"],
        'transfer_received'=>['who'=>'client','label'=>'Havale bildirimi alındı','subject'=>'Havale bildiriminiz alındı: {fatura_no}','cta'=>'Faturayı görüntüle',
            'text'=>"Merhaba {yetkili},\n\n*{fatura_no}* için {tutar} tutarındaki havale bildiriminiz alındı. Ödeme hesabımıza geçtiğinde faturanız onaylanacak.\n\n{link}"],
        'transfer_rejected'=>['who'=>'client','label'=>'Havale bildirimi doğrulanamadı','subject'=>'Havale bildiriminiz doğrulanamadı: {fatura_no}','cta'=>'Tekrar bildir',
            'text'=>"Merhaba {yetkili},\n\n*{fatura_no}* için gönderdiğiniz havale bildirimi hesap hareketlerimizle eşleşmedi. Bilgileri kontrol edip tekrar bildirebilir veya bize yazabilirsiniz.\n\n{link}"],
        'license_activated'=>['who'=>'client','label'=>'Lisans açıldı','subject'=>'Lisansınız hazır: {paket}','cta'=>'Lisansı görüntüle',
            'text'=>"Merhaba {yetkili},\n\n*{paket}* lisansınız etkinleştirildi.\nLisans anahtarı: *{lisans}*\nBitiş: {bitis}\n\nAnahtarı programın lisans ekranına yapıştırın: {link}"],
        'license_expiring'=>['who'=>'client','label'=>'Lisans süresi bitiyor','subject'=>'{paket} lisansınızın süresi {kalan_gun} gün içinde doluyor','cta'=>'Lisansı yenile',
            'text'=>"Merhaba {yetkili},\n\n*{paket}* lisansınızın ({lisans}) süresi {bitis} tarihinde doluyor. {kalan_gun} gün kaldı.\n\nKesinti yaşamamak için yenileyin: {link}"],
        'license_suspended'=>['who'=>'client','label'=>'Lisans askıya alındı / süresi doldu','subject'=>'{paket} lisansınız askıya alındı','cta'=>'Lisansı yenile',
            'text'=>"Merhaba {yetkili},\n\n*{paket}* lisansınızın ({lisans}) süresi doldu ve premium özellikler kapatıldı. Verileriniz silinmez; yenilediğinizde kaldığınız yerden devam edersiniz.\n\n{link}"],
        'ticket_opened'=>['who'=>'client','label'=>'Destek talebi alındı','subject'=>'Talebiniz alındı: #{talep_no} {konu}','cta'=>'Talebi görüntüle',
            'text'=>"Merhaba {yetkili},\n\n*#{talep_no}* numaralı talebiniz alındı: {konu}\nEn kısa sürede yanıtlayacağız.\n\n{link}"],
        'ticket_reply'=>['who'=>'client','label'=>'Destek talebine yanıt','subject'=>'Talebinize yanıt: #{talep_no} {konu}','cta'=>'Yanıtı oku',
            'text'=>"Merhaba {yetkili},\n\n*#{talep_no}* numaralı talebinize Veniux destek ekibi yanıt verdi: {konu}\n\n{link}"],
        'admin_order'=>['who'=>'admin','label'=>'Yönetici · yeni sipariş','subject'=>'Yeni sipariş: {musteri} · {paket}','cta'=>'Siparişi aç',
            'text'=>"Yeni sipariş: *{musteri}*\nPaket: {paket}\nTutar: {tutar}\n{link}"],
        'admin_payment'=>['who'=>'admin','label'=>'Yönetici · ödeme alındı','subject'=>'Ödeme alındı: {fatura_no} · {tutar}','cta'=>'Faturayı aç',
            'text'=>"Ödeme alındı: *{musteri}*\nFatura: {fatura_no}\nTutar: {tutar}\nYöntem: {yontem}\n{link}"],
        'admin_transfer'=>['who'=>'admin','label'=>'Yönetici · havale bildirimi','subject'=>'Havale bildirimi: {gonderen} · {tutar}','cta'=>'Bildirimi incele',
            'text'=>"Havale bildirimi geldi.\nGönderen: *{gonderen}*\nMüşteri: {musteri}\nFatura: {fatura_no}\nTutar: {tutar}\n{link}"],
        'admin_ticket'=>['who'=>'admin','label'=>'Yönetici · yeni talep / müşteri yanıtı','subject'=>'Destek: #{talep_no} {konu}','cta'=>'Talebi aç',
            'text'=>"Destek talebi hareketi: *{musteri}*\n#{talep_no} {konu}\n{link}"],
    ];
}

function vp_notify_tpl(string $event,string $field): string {
    $custom=vp_setting('ntpl_'.$event.'_'.$field);
    return $custom!==''?$custom:(string)(vp_notify_events()[$event][$field]??'');
}
function vp_notify_on(string $event,string $channel): bool {
    $v=vp_setting('nevt_'.$event.'_'.$channel);
    if($v!=='')return $v==='1';
    return $channel==='mail'?true:!in_array($event,['ticket_opened','transfer_received'],true); // varsayılan
}
function vp_mail_ready(): bool { return vp_setting('mail_enabled')==='1'&&vp_setting('smtp_host')!==''&&filter_var(vp_setting('mail_from'),FILTER_VALIDATE_EMAIL); }
function vp_wa_ready(): bool { return vp_setting('wa_enabled')==='1'&&vp_setting('wa_api_url')!==''&&vp_secret_setting('wa_api_key')!==''; }

function vp_fill(string $tpl,array $vars): string { return strtr($tpl,array_combine(array_map(fn($k)=>'{'.$k.'}',array_keys($vars)),array_map('strval',array_values($vars)))); }
function vp_phone_ok(string $phone): bool { $d=preg_replace('/\D/','',$phone);return strlen($d)>=10&&strlen($d)<=15; }

/** Bir olayı ilgili kanallara kuyruklar. $ctx: client (dizi), vars, link, rows [[etiket,değer]], dedupe (anahtar). */
function vp_notify(string $event,array $ctx): void {
    if(!empty($GLOBALS['vp_notify_off']))return;
    $def=vp_notify_events()[$event]??null;if(!$def)return;
    try{
        $vars=($ctx['vars']??[])+['firma'=>vp_setting('company_name','Veniux'),'link'=>$ctx['link']??vp_public_url()];
        $c=$ctx['client']??null;
        if($c){$vars+=['musteri'=>$c['company'],'yetkili'=>$c['contact_name']?:$c['company']];}
        $vars+=['musteri'=>'','yetkili'=>''];
        $payload=json_encode(['title'=>vp_fill(vp_notify_tpl($event,'subject'),$vars),'cta'=>$def['cta']??'','link'=>$vars['link'],'rows'=>$ctx['rows']??[],'label'=>$def['label'],'tone'=>$ctx['tone']??''],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
        $body=vp_fill(vp_notify_tpl($event,'text'),$vars);$subject=vp_fill(vp_notify_tpl($event,'subject'),$vars);
        $targets=[];
        if($def['who']==='client'&&$c){
            if(vp_notify_on($event,'mail')&&vp_mail_ready()&&(int)($c['notify_email']??1)===1&&filter_var($c['email'],FILTER_VALIDATE_EMAIL))$targets[]=['mail',$c['email']];
            if(vp_notify_on($event,'wa')&&vp_wa_ready()&&(int)($c['notify_whatsapp']??1)===1&&vp_phone_ok((string)$c['phone']))$targets[]=['whatsapp',$c['phone']];
        }elseif($def['who']==='admin'){
            foreach(array_filter(array_map('trim',explode(',',vp_setting('admin_notify_email')))) as $em)if(vp_notify_on($event,'mail')&&vp_mail_ready()&&filter_var($em,FILTER_VALIDATE_EMAIL))$targets[]=['mail',$em];
            foreach(array_filter(array_map('trim',explode(',',vp_setting('admin_notify_phone')))) as $ph)if(vp_notify_on($event,'wa')&&vp_wa_ready()&&vp_phone_ok($ph))$targets[]=['whatsapp',$ph];
        }
        foreach($targets as [$ch,$to]){
            $key=isset($ctx['dedupe'])?mb_substr($ch.':'.$ctx['dedupe'].':'.md5($to),0,120):null;
            vp_q('INSERT IGNORE INTO notifications(channel,event,client_id,recipient,subject,body,payload,status,dedupe_key,next_try,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                [$ch,$event,$c['id']??null,mb_substr($to,0,190),mb_substr($subject,0,200),$body,$payload,'bekliyor',$key,vp_now(),vp_now()]);
            $GLOBALS['vp_notify_pending']=true;
        }
    }catch(Throwable $t){error_log('[veniux-panel] notify '.$event.': '.$t->getMessage());}
}

/** İstek yanıtlandıktan sonra kuyruğu işler (PHP-FPM / LiteSpeed’de kullanıcı beklemez). */
function vp_notify_flush_on_shutdown(): void {
    static $registered=false;if($registered)return;$registered=true;
    register_shutdown_function(function(){
        if(empty($GLOBALS['vp_notify_pending']))return;
        if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
        ignore_user_abort(true);
        if(function_exists('fastcgi_finish_request'))fastcgi_finish_request();
        elseif(function_exists('litespeed_finish_request'))litespeed_finish_request();
        try{vp_notify_process(10);}catch(Throwable $t){error_log('[veniux-panel] notify flush: '.$t->getMessage());}
    });
}

function vp_notify_process(int $limit=25): array {
    $done=['sent'=>0,'failed'=>0];
    $rows=vp_all("SELECT * FROM notifications WHERE status='bekliyor' AND next_try<=? ORDER BY id LIMIT ".max(1,min(200,$limit)),[vp_now()]);
    foreach($rows as $n){
        // Aynı kaydı iki işlemin göndermesini önle
        if(vp_q("UPDATE notifications SET status='gonderiliyor',attempts=attempts+1 WHERE id=? AND status='bekliyor'",[$n['id']])->rowCount()!==1)continue;
        try{
            if($n['channel']==='mail')vp_mail_send($n['recipient'],$n['subject'],$n['body'],json_decode($n['payload'],true)?:[]);
            else vp_wa_send($n['recipient'],$n['body']);
            vp_q("UPDATE notifications SET status='gonderildi',sent_at=?,last_error='' WHERE id=?",[vp_now(),$n['id']]);$done['sent']++;
        }catch(Throwable $t){
            $att=(int)$n['attempts']+1;$wait=[1=>300,2=>1800][$att]??7200;
            vp_q('UPDATE notifications SET status=?,last_error=?,next_try=? WHERE id=?',[$att>=3?'hata':'bekliyor',mb_substr($t->getMessage(),0,500),gmdate('Y-m-d H:i:s',time()+$wait),$n['id']]);
            $done['failed']++;
        }
    }
    return $done;
}

// ---------------------------------------------------------------- WhatsApp (whatsapp-mail-service)
function vp_wa_endpoint(): string {
    $u=rtrim(vp_setting('wa_api_url'),'/');
    return str_ends_with($u,'/api/send')?$u:$u.'/api/send';
}
function vp_wa_send(string $phone,string $message): string {
    if(!vp_wa_ready())throw new RuntimeException('WhatsApp ayarları eksik veya kapalı.');
    $url=vp_wa_endpoint();
    if(!preg_match('#^https?://#i',$url))throw new RuntimeException('WhatsApp servis adresi geçersiz.');
    $ch=curl_init($url);
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode(['key'=>vp_secret_setting('wa_api_key'),'phone'=>$phone,'message'=>$message],JSON_UNESCAPED_UNICODE),CURLOPT_HTTPHEADER=>['Content-Type: application/json','Accept: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>45,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS|CURLPROTO_HTTP]);
    $res=curl_exec($ch);$code=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);$err=curl_error($ch);curl_close($ch);
    if($res===false)throw new RuntimeException('WhatsApp servisine ulaşılamadı: '.$err);
    $r=json_decode((string)$res,true);
    if(!is_array($r))throw new RuntimeException('WhatsApp servisi beklenmeyen yanıt verdi (HTTP '.$code.').');
    if(in_array($r['status']??'',['successful','success'],true))return (string)($r['id']??'');
    throw new RuntimeException('WhatsApp: '.(string)($r['message']??'gönderilemedi').($code===401?' (API anahtarını kontrol edin)':''));
}

// ---------------------------------------------------------------- E-posta
function vp_mailer(): PHPMailer\PHPMailer\PHPMailer {
    if(!vp_mail_ready())throw new RuntimeException('SMTP ayarları eksik veya kapalı.');
    $m=new PHPMailer\PHPMailer\PHPMailer(true);
    $m->isSMTP();$m->SMTPDebug=0;$m->Host=vp_setting('smtp_host');$m->Port=(int)(vp_setting('smtp_port')?:587);
    $sec=vp_setting('smtp_secure','tls');
    if($sec==='ssl')$m->SMTPSecure=PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
    elseif($sec==='tls')$m->SMTPSecure=PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    else{$m->SMTPSecure='';$m->SMTPAutoTLS=false;}
    $user=vp_setting('smtp_user');
    if($user!==''){$m->SMTPAuth=true;$m->Username=$user;$m->Password=vp_secret_setting('smtp_pass');}
    $m->Timeout=15;$m->Timelimit=25;$m->CharSet='UTF-8';$m->Encoding='base64';
    $m->setFrom(vp_setting('mail_from'),vp_setting('mail_from_name')?:vp_setting('company_name','Veniux'));
    if(filter_var(vp_setting('mail_reply_to'),FILTER_VALIDATE_EMAIL))$m->addReplyTo(vp_setting('mail_reply_to'));
    $m->XMailer=' ';
    return $m;
}
function vp_mail_send(string $to,string $subject,string $text,array $payload=[]): void {
    $m=vp_mailer();
    $m->addAddress($to);
    $m->Subject=$subject;
    $m->isHTML(true);
    $m->Body=vp_mail_html($subject,$text,$payload);
    $m->AltBody=str_replace('*','',$text);
    try{$m->send();}catch(PHPMailer\PHPMailer\Exception $e){throw new RuntimeException('SMTP: '.$m->ErrorInfo);}
}

/** Veniux tasarımına uygun, e-posta istemcileriyle uyumlu (tablo + satır içi stil) HTML şablon. */
function vp_mail_html(string $subject,string $text,array $p=[]): string {
    $paper='#f4eee2';$ink='#17263a';$soft='#4d5a6b';$line='#d6c9b2';$orange='#cf4b06';$white='#fffdf8';
    $base=vp_public_url();$company=vp_setting('company_name','Veniux');
    $font="Archivo,'Segoe UI',Helvetica,Arial,sans-serif";
    $link=(string)($p['link']??'');$cta=(string)($p['cta']??'');$label=(string)($p['label']??'Bildirim');
    // Metin: paragraflar, *kalın*, bağlantı satırları butona taşınır
    $paras='';
    foreach(preg_split('/\R{2,}/',trim($text))?:[] as $para){
        $lines=[];
        foreach(preg_split('/\R/',$para)?:[] as $l){
            $had=$link!==''&&str_contains($l,$link);
            if($had){$l=trim(str_replace($link,'',$l));$l=rtrim($l,' :');if(mb_strlen($l,'UTF-8')<12)continue;}
            if(trim($l)!=='')$lines[]=$l;
        }
        if(!$lines)continue;
        $html=implode('<br>',array_map(function($l){$l=e($l);$l=preg_replace('/\*([^*\n]+)\*/u','<strong>$1</strong>',$l)??$l;return preg_replace('~(https?://[^\s<]+)~','<a href="$1" style="color:#b23f04">$1</a>',$l)??$l;},$lines));
        $paras.='<p style="margin:0 0 16px;font:400 16px/1.6 '.$font.';color:'.$ink.'">'.$html.'</p>';
    }
    $rows='';
    foreach(($p['rows']??[]) as $r){if(!is_array($r)||count($r)<2)continue;$rows.='<tr><td style="padding:9px 0;border-top:1px dashed '.$line.';font:600 12px/1.4 '.$font.';letter-spacing:.08em;text-transform:uppercase;color:'.$soft.'">'.e((string)$r[0]).'</td><td align="right" style="padding:9px 0;border-top:1px dashed '.$line.';font:700 15px/1.4 '.$font.';color:'.$ink.'">'.e((string)$r[1]).'</td></tr>';}
    $bars='';$seed=md5($subject);foreach(str_split(substr($seed,0,22)) as $i=>$ch){$w=1+hexdec($ch)%3;$bars.='<td width="'.$w.'" style="width:'.$w.'px;background:'.($i%2?$white:$ink).';font-size:0;line-height:0">&nbsp;</td>';}
    $pre=e(mb_strimwidth(str_replace(['*',"\n"],['',' '],$text),0,110,'…','UTF-8'));
    ob_start();?>
<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title><?=e($subject)?></title></head>
<body style="margin:0;padding:0;background:<?=$paper?>;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0"><?=$pre?></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:<?=$paper?>"><tr><td align="center" style="padding:32px 14px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
    <tr><td style="padding:0 4px 14px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font:800 22px/1 <?=$font?>;letter-spacing:.02em;color:<?=$ink?>"><img src="<?=e($base)?>/assets/logo.png" width="30" height="30" alt="" style="vertical-align:middle;border:0;margin-right:8px">VENIUX</td>
        <td align="right" style="font:700 11px/1 <?=$font?>;letter-spacing:.16em;text-transform:uppercase;color:#b23f04"><?=e($label)?></td>
      </tr></table>
    </td></tr>
    <tr><td style="background:<?=$white?>;border:1px solid <?=$line?>;border-top:5px solid <?=$ink?>;border-radius:4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:30px 32px 6px">
          <div style="width:34px;height:4px;background:<?=$orange?>;margin-bottom:16px;font-size:0;line-height:0">&nbsp;</div>
          <h1 style="margin:0 0 18px;font:800 26px/1.15 <?=$font?>;color:<?=$ink?>"><?=e((string)($p['title']??$subject))?></h1>
          <?=$paras?>
        </td></tr>
        <?php if($rows):?><tr><td style="padding:2px 32px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efe5d3;border:1px dashed #c5b597;border-radius:3px"><tr><td style="padding:6px 18px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><?=preg_replace('/border-top:1px dashed [^;]+;/','',$rows,2)?></table></td></tr></table></td></tr><?php endif;?>
        <?php if($link!==''&&$cta!==''):?><tr><td style="padding:14px 32px 30px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:<?=$orange?>;border-radius:3px"><a href="<?=e($link)?>" style="display:inline-block;padding:13px 26px;font:700 15px/1 <?=$font?>;color:#ffffff;text-decoration:none"><?=e($cta)?> →</a></td></tr></table>
          <p style="margin:14px 0 0;font:400 12px/1.5 <?=$font?>;color:<?=$soft?>">Düğme çalışmazsa: <a href="<?=e($link)?>" style="color:#b23f04;word-break:break-all"><?=e($link)?></a></p></td></tr><?php else:?><tr><td style="padding:0 0 14px"></td></tr><?php endif;?>
      </table>
    </td></tr>
    <tr><td style="padding:18px 6px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font:400 12px/1.6 <?=$font?>;color:<?=$soft?>"><strong style="color:<?=$ink?>"><?=e($company)?></strong><?=vp_setting('company_address')?'<br>'.nl2br(e(vp_setting('company_address'))):''?><br>Bu e-posta Veniux müşteri hesabınızla ilgili bir işlem nedeniyle gönderildi. Bildirim tercihlerinizi <a href="<?=e($base)?>/panel/profil" style="color:#b23f04">müşteri panelinden</a> değiştirebilirsiniz.</td>
        <td align="right" valign="bottom" style="padding-left:16px"><table role="presentation" cellpadding="0" cellspacing="0" height="28" style="height:28px"><tr><?=$bars?></tr></table></td>
      </tr></table>
    </td></tr>
  </table>
</td></tr></table>
</body></html>
<?php return (string)ob_get_clean();
}

// ---------------------------------------------------------------- olay yardımcıları (iş kurallarından çağrılır)
function vp_notify_invoice(string $event,int $invoiceId,array $extra=[]): void {
    $inv=vp_row('SELECT * FROM invoices WHERE id=?',[$invoiceId]);if(!$inv)return;
    $c=vp_row('SELECT * FROM clients WHERE id=?',[$inv['client_id']]);if(!$c)return;
    $desc=(string)vp_val('SELECT description FROM invoice_items WHERE invoice_id=? ORDER BY id LIMIT 1',[$invoiceId]);
    $vars=['fatura_no'=>$inv['number'],'tutar'=>vp_money((int)$inv['total']),'son_odeme'=>vp_date($inv['due_at']),'yontem'=>$inv['payment_method']?vp_notify_method($inv['payment_method']):'—','kalan_gun'=>(string)max(0,(int)vp_days_left($inv['due_at'])),'gecikme'=>(string)max(0,-(int)vp_days_left($inv['due_at']))]+($extra['vars']??[]);
    $rows=[['Fatura',$inv['number']],['Açıklama',mb_strimwidth($desc,0,60,'…','UTF-8')],['Tutar',vp_money((int)$inv['total'])],[$inv['status']==='odendi'?'Ödeme':'Son ödeme',vp_date($inv['status']==='odendi'?$inv['paid_at']:$inv['due_at'])]];
    if($event==='admin_payment'||$event==='admin_transfer'){vp_notify($event,['client'=>$c,'vars'=>$vars,'rows'=>$rows,'link'=>vp_public_url().'/yonetim/faturalar/'.$invoiceId]+$extra);return;}
    vp_notify($event,['client'=>$c,'vars'=>$vars,'rows'=>$rows,'link'=>vp_public_url().'/panel/faturalar/'.$invoiceId]+$extra);
}
function vp_notify_method(string $m): string { return ['havale'=>'Havale / EFT','nakit'=>'Nakit','kredi_karti'=>'Kredi kartı','bakiye'=>'Hesap bakiyesi','paytr'=>'Kredi kartı (PayTR)','iyzico'=>'Kredi kartı (iyzico)','ücretsiz'=>'Ücretsiz'][$m]??$m; }
function vp_notify_license(string $event,int $licenseId,array $extra=[]): void {
    $l=vp_row('SELECT l.*,p.name pname FROM licenses l JOIN products p ON p.id=l.product_id WHERE l.id=?',[$licenseId]);if(!$l)return;
    $c=vp_row('SELECT * FROM clients WHERE id=?',[$l['client_id']]);if(!$c)return;
    $vars=['paket'=>$l['pname'],'lisans'=>$l['license_key'],'bitis'=>$l['expires_at']?vp_date($l['expires_at']):'Süresiz','kalan_gun'=>(string)max(0,(int)vp_days_left($l['expires_at']))];
    vp_notify($event,['client'=>$c,'vars'=>$vars,'rows'=>[['Paket',$l['pname']],['Lisans anahtarı',$l['license_key']],['Bitiş',$vars['bitis']]],'link'=>vp_public_url().'/panel/lisanslar/'.$licenseId]+$extra);
}
function vp_notify_ticket(string $event,int $ticketId,array $extra=[]): void {
    $t=vp_row('SELECT * FROM tickets WHERE id=?',[$ticketId]);if(!$t)return;
    $c=vp_row('SELECT * FROM clients WHERE id=?',[$t['client_id']]);if(!$c)return;
    $vars=['talep_no'=>$t['number'],'konu'=>$t['subject']];
    vp_notify($event,['client'=>$c,'vars'=>$vars,'rows'=>[['Talep','#'.$t['number']],['Konu',mb_strimwidth($t['subject'],0,60,'…','UTF-8')]],'link'=>vp_public_url().($event==='admin_ticket'?'/yonetim/talepler/':'/panel/destek/').$ticketId]+$extra);
}

/** Otomasyon: vade hatırlatmaları, gecikmiş faturalar, lisans bitiş uyarıları (tekrarsız). */
function vp_notify_reminders(): void {
    $days=array_filter(array_map('intval',explode(',',vp_setting('reminder_days','3,1'))),fn($d)=>$d>=0&&$d<=60);
    foreach(vp_all("SELECT id,due_at FROM invoices WHERE status='odenmedi' AND total>0 AND due_at>=? AND due_at<=?",[vp_now(),gmdate('Y-m-d H:i:s',time()+86400*61)]) as $i){
        $left=(int)ceil((strtotime($i['due_at'].' UTC')-time())/86400);
        if(in_array($left,$days,true))vp_notify_invoice('invoice_reminder',(int)$i['id'],['dedupe'=>'rem:'.$i['id'].':'.$left]);
    }
    $late=array_filter(array_map('intval',explode(',',vp_setting('overdue_days','1,3,7'))),fn($d)=>$d>0&&$d<=90);
    foreach(vp_all("SELECT id,due_at FROM invoices WHERE status='odenmedi' AND total>0 AND due_at<? AND due_at>=?",[vp_now(),gmdate('Y-m-d H:i:s',time()-86400*91)]) as $i){
        $over=(int)floor((time()-strtotime($i['due_at'].' UTC'))/86400);
        if(in_array($over,$late,true))vp_notify_invoice('invoice_overdue',(int)$i['id'],['dedupe'=>'over:'.$i['id'].':'.$over]);
    }
    $exp=array_filter(array_map('intval',explode(',',vp_setting('license_notice_days','30,7,1'))),fn($d)=>$d>0&&$d<=90);
    foreach(vp_all("SELECT id,expires_at FROM licenses WHERE status='aktif' AND expires_at IS NOT NULL AND expires_at>=? AND expires_at<=?",[vp_now(),gmdate('Y-m-d H:i:s',time()+86400*91)]) as $l){
        $left=(int)ceil((strtotime($l['expires_at'].' UTC')-time())/86400);
        if(in_array($left,$exp,true))vp_notify_license('license_expiring',(int)$l['id'],['dedupe'=>'lexp:'.$l['id'].':'.$l['expires_at'].':'.$left]);
    }
}
