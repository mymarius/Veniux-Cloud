<?php
declare(strict_types=1);
// Kartla ödeme altyapısı: PayTR iFrame API ve iyzico Checkout Form.
// Anahtarlar veritabanında AES-256-GCM ile şifreli tutulur; şifreleme anahtarı web kökü dışındaki
// .local/veniux-panel/secret.key dosyasındadır (VENIUX_PANEL_SECRET ortam değişkeni ile de verilebilir).

const VP_PAYTR_TOKEN_URL='https://www.paytr.com/odeme/api/get-token';
const VP_PAYTR_IFRAME_URL='https://www.paytr.com/odeme/guvenli/';
const VP_IYZICO_LIVE='https://api.iyzipay.com';
const VP_IYZICO_SANDBOX='https://sandbox-api.iyzipay.com';

// ---------------------------------------------------------------- gizli ayarlar
function vp_secret_key(): string {
    static $key=null;if($key!==null)return $key;
    $env=getenv('VENIUX_PANEL_SECRET');
    if(is_string($env)&&strlen($env)>=32)return $key=hash('sha256',$env,true);
    $file=vp_data_dir().'/secret.key';
    if(!is_file($file)){
        $fh=@fopen($file,'x');
        if($fh){fwrite($fh,bin2hex(random_bytes(32)));fclose($fh);@chmod($file,0600);}
    }
    $raw=trim((string)@file_get_contents($file));
    if(strlen($raw)!==64||!ctype_xdigit($raw))throw new RuntimeException('Panel secret key unavailable');
    return $key=hex2bin($raw);
}
function vp_encrypt(string $plain): string {
    if($plain==='')return '';
    $iv=random_bytes(12);$tag='';
    $ct=openssl_encrypt($plain,'aes-256-gcm',vp_secret_key(),OPENSSL_RAW_DATA,$iv,$tag);
    if($ct===false)throw new RuntimeException('Encryption failed');
    return 'enc:v1:'.base64_encode($iv.$tag.$ct);
}
function vp_decrypt(string $stored): string {
    if($stored===''||!str_starts_with($stored,'enc:v1:'))return $stored;
    $raw=base64_decode(substr($stored,7),true);
    if($raw===false||strlen($raw)<29)return '';
    $pt=openssl_decrypt(substr($raw,28),'aes-256-gcm',vp_secret_key(),OPENSSL_RAW_DATA,substr($raw,0,12),substr($raw,12,16));
    return $pt===false?'':$pt;
}
function vp_secret_setting(string $key): string { return vp_decrypt(vp_setting($key)); }
function vp_set_secret_setting(string $key,string $value): void { vp_set_setting($key,vp_encrypt($value)); }
function vp_mask(string $secret): string { $l=strlen($secret);return $l===0?'':($l<=6?str_repeat('•',$l):substr($secret,0,3).str_repeat('•',max(4,min(12,$l-6))).substr($secret,-3)); }

// ---------------------------------------------------------------- genel
/** Ödeme sağlayıcılarının geri döneceği herkese açık adres (HTTPS, sonda / yok). */
function vp_public_url(): string {
    $u=rtrim(vp_setting('public_url'),'/');
    if($u!=='')return $u;
    $cfg=$GLOBALS['config']??[];
    return rtrim((string)($cfg['url']??'https://veniux.com'),'/');
}

function vp_gateway_ready(string $g): bool {
    if($g==='paytr')return vp_setting('paytr_enabled')==='1'&&vp_setting('paytr_merchant_id')!==''&&vp_secret_setting('paytr_merchant_key')!==''&&vp_secret_setting('paytr_merchant_salt')!=='';
    if($g==='iyzico')return vp_setting('iyzico_enabled')==='1'&&vp_secret_setting('iyzico_api_key')!==''&&vp_secret_setting('iyzico_secret_key')!=='';
    return false;
}
/** Müşteriye gösterilecek aktif kart ödeme yöntemleri, sıralı. */
function vp_card_gateways(): array {
    $out=[];
    foreach(['iyzico','paytr'] as $g)if(vp_gateway_ready($g))$out[$g]=['label'=>vp_setting($g.'_label')?:($g==='paytr'?'Kredi / banka kartı (PayTR)':'Kredi / banka kartı (iyzico)'),'test'=>vp_gateway_test_mode($g)];
    $first=vp_setting('default_gateway');
    if(isset($out[$first]))$out=[$first=>$out[$first]]+$out;
    return $out;
}
function vp_gateway_test_mode(string $g): bool { return $g==='paytr'?vp_setting('paytr_test_mode','1')==='1':vp_setting('iyzico_sandbox','1')==='1'; }

function vp_http_post(string $url,string $body,array $headers,int $timeout=20): array {
    $ch=curl_init($url);
    if(!$ch)throw new RuntimeException('HTTP client unavailable');
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$body,CURLOPT_HTTPHEADER=>$headers,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>$timeout,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);
    $res=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);$err=curl_error($ch);curl_close($ch);
    if($res===false)throw new RuntimeException('Bağlantı kurulamadı: '.$err);
    return [$status,(string)$res];
}

function vp_attempt_oid(int $invoiceId): string { return 'VNX'.$invoiceId.'T'.strtoupper(bin2hex(random_bytes(6))); }

function vp_attempt_create(string $gateway,array $inv): array {
    $oid=vp_attempt_oid((int)$inv['id']);$now=vp_now();
    $id=vp_insert('payment_attempts',['gateway'=>$gateway,'invoice_id'=>$inv['id'],'client_id'=>$inv['client_id'],'oid'=>$oid,'amount'=>$inv['total'],'status'=>'bekliyor','test_mode'=>vp_gateway_test_mode($gateway)?1:0,'created_at'=>$now,'updated_at'=>$now]);
    return vp_row('SELECT * FROM payment_attempts WHERE id=?',[$id]);
}

/** Başarılı ödemeyi bir kez uygular (yarış durumlarına karşı satır kilidiyle). */
function vp_attempt_succeed(string $oid,string $reference,int $chargedAmount): bool {
    $pdo=vp_db();$pdo->beginTransaction();
    try{
        $a=vp_row('SELECT * FROM payment_attempts WHERE oid=? FOR UPDATE',[$oid]);
        if(!$a){$pdo->rollBack();return false;}
        if($a['status']==='basarili'){$pdo->commit();return true;}
        vp_update('payment_attempts',(int)$a['id'],['status'=>'basarili','reference'=>mb_substr($reference,0,120),'message'=>'Tahsil edilen: '.vp_money($chargedAmount),'updated_at'=>vp_now()]);
        $pdo->commit();
    }catch(Throwable $t){$pdo->rollBack();throw $t;}
    $inv=vp_row('SELECT * FROM invoices WHERE id=?',[$a['invoice_id']]);
    $label=$a['gateway']==='paytr'?'paytr':'iyzico';
    if($inv&&$inv['status']==='odenmedi'){
        vp_mark_paid((int)$inv['id'],$label,$reference);
    }elseif($inv){
        // Fatura zaten ödenmiş veya iptal edilmişse çift tahsilat bakiyeye alınır ve kayda geçer.
        vp_add_balance((int)$a['client_id'],(int)$a['amount'],'Kartla fazla ödeme · '.$inv['number'].' · '.$reference);
        vp_log('sistem',null,'Ödeme','Fazla kart ödemesi bakiyeye eklendi',$inv['number'].' · '.$label.' · '.$reference,(int)$a['client_id']);
    }
    vp_log('sistem',null,$label==='paytr'?'PayTR':'iyzico','Kartla ödeme alındı',($inv['number']??'').' · '.vp_money((int)$a['amount']).($a['test_mode']?' · test':''),(int)$a['client_id']);
    return true;
}
function vp_attempt_fail(string $oid,string $message,string $status='basarisiz'): void {
    vp_q("UPDATE payment_attempts SET status=?,message=?,updated_at=? WHERE oid=? AND status IN('bekliyor','inceleme')",[$status,mb_substr($message,0,500),vp_now(),$oid]);
}

function vp_buyer(array $c): array {
    $name=trim($c['contact_name']?:$c['company']);$parts=preg_split('/\s+/u',$name)?:[$name];
    $surname=count($parts)>1?array_pop($parts):'-';$first=implode(' ',$parts)?:$name;
    $phone=preg_replace('/\D/','',$c['phone']);
    return ['first'=>mb_substr($first,0,60),'last'=>mb_substr($surname,0,60),'full'=>mb_substr($name,0,60),'phone'=>$phone!==''?$phone:'05000000000','address'=>trim($c['address'].' '.$c['city'])?:'Türkiye','city'=>$c['city']?:'İstanbul','tc'=>strlen($c['tax_no'])===11?$c['tax_no']:'11111111111'];
}

// ---------------------------------------------------------------- PayTR
function vp_paytr_creds(): array { return [vp_setting('paytr_merchant_id'),vp_secret_setting('paytr_merchant_key'),vp_secret_setting('paytr_merchant_salt')]; }

/** PayTR iFrame token ister. Dönen: [true, token] veya [false, hata] */
function vp_paytr_token(array $attempt,array $inv,array $c,string $ip): array {
    [$mid,$key,$salt]=vp_paytr_creds();
    $test=vp_gateway_test_mode('paytr')?'1':'0';
    $amount=(string)(int)$attempt['amount'];                 // kuruş = tutar × 100
    $basket=base64_encode(json_encode([[ 'Veniux fatura '.$inv['number'], number_format((int)$attempt['amount']/100,2,'.',''), 1 ]],JSON_UNESCAPED_UNICODE));
    $max=max(0,min(12,(int)vp_setting('paytr_max_installment','0')));$noInst=$max===1?'1':'0';
    $email=$c['email'];$oid=$attempt['oid'];$currency='TL';
    $hash=base64_encode(hash_hmac('sha256',$mid.$ip.$oid.$email.$amount.$basket.$noInst.$max.$currency.$test.$salt,$key,true));
    $b=vp_buyer($c);$base=vp_public_url();
    $fields=['merchant_id'=>$mid,'user_ip'=>$ip,'merchant_oid'=>$oid,'email'=>$email,'payment_amount'=>$amount,'paytr_token'=>$hash,'user_basket'=>$basket,'debug_on'=>$test,'no_installment'=>$noInst,'max_installment'=>(string)$max,
        'user_name'=>$b['full'],'user_address'=>mb_substr($b['address'],0,400),'user_phone'=>$b['phone'],'merchant_ok_url'=>$base.'/odeme/sonuc?oid='.$oid,'merchant_fail_url'=>$base.'/odeme/sonuc?oid='.$oid.'&hata=1','timeout_limit'=>'30','currency'=>$currency,'test_mode'=>$test,'lang'=>'tr'];
    try{[$status,$body]=vp_http_post(VP_PAYTR_TOKEN_URL,http_build_query($fields),['Content-Type: application/x-www-form-urlencoded']);}
    catch(Throwable $t){return [false,$t->getMessage()];}
    $r=json_decode($body,true);
    if(is_array($r)&&($r['status']??'')==='success'&&is_string($r['token']??null))return [true,$r['token']];
    return [false,is_array($r)?(string)($r['reason']??'PayTR isteği reddetti.'):'PayTR yanıtı okunamadı (HTTP '.$status.').'];
}

/** PayTR Bildirim URL (sunucudan sunucuya). Yanıt düz metin "OK" olmalı. */
function vp_paytr_callback(): void {
    header('Content-Type: text/plain; charset=utf-8');header('Cache-Control: no-store');
    [, $key,$salt]=vp_paytr_creds();
    $oid=(string)($_POST['merchant_oid']??'');$status=(string)($_POST['status']??'');$total=(string)($_POST['total_amount']??'');$hash=(string)($_POST['hash']??'');
    if($key===''||$salt===''||$oid===''||!preg_match('/^[A-Za-z0-9]{1,64}$/',$oid)){http_response_code(400);echo 'PAYTR notification failed: bad request';return;}
    $expected=base64_encode(hash_hmac('sha256',$oid.$salt.$status.$total,$key,true));
    if(!hash_equals($expected,$hash)){http_response_code(400);vp_log('sistem',null,'PayTR','Geçersiz imzalı bildirim reddedildi',$oid.' · '.vp_ip());echo 'PAYTR notification failed: bad hash';return;}
    $a=vp_row('SELECT * FROM payment_attempts WHERE oid=? AND gateway=\'paytr\'',[$oid]);
    if(!$a){echo 'OK';return;}                          // bilinmeyen sipariş: tekrar gönderilmesin
    if($status==='success'){
        $paid=(int)($_POST['payment_amount']??0);
        if($paid!==(int)$a['amount']){vp_attempt_fail($oid,'Tutar uyuşmuyor: '.$paid.' ≠ '.$a['amount'],'inceleme');vp_log('sistem',null,'PayTR','Tutarı uyuşmayan ödeme incelemeye alındı',$oid,(int)$a['client_id']);}
        else vp_attempt_succeed($oid,'PayTR '.$oid,(int)$total);
    }else{
        vp_attempt_fail($oid,trim((string)($_POST['failed_reason_code']??'').' '.(string)($_POST['failed_reason_msg']??'Ödeme başarısız')));
    }
    echo 'OK';
}

// ---------------------------------------------------------------- iyzico
function vp_iyzico_base(): string { return vp_gateway_test_mode('iyzico')?VP_IYZICO_SANDBOX:VP_IYZICO_LIVE; }
function vp_iyzico_price(int $kurus): string { $s=number_format($kurus/100,2,'.','');$s=rtrim(rtrim($s,'0'),'.');return str_contains($s,'.')?$s:$s.'.0'; }

/** IYZWSv2 imzalı istek. */
function vp_iyzico_request(string $path,array $body): array {
    $apiKey=vp_secret_setting('iyzico_api_key');$secret=vp_secret_setting('iyzico_secret_key');
    $json=json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    $rnd=(string)(int)(microtime(true)*1000).bin2hex(random_bytes(4));
    $sig=hash_hmac('sha256',$rnd.$path.$json,$secret);
    $auth='IYZWSv2 '.base64_encode('apiKey:'.$apiKey.'&randomKey:'.$rnd.'&signature:'.$sig);
    [$status,$res]=vp_http_post(vp_iyzico_base().$path,$json,['Authorization: '.$auth,'x-iyzi-rnd: '.$rnd,'Content-Type: application/json','Accept: application/json']);
    $r=json_decode($res,true);
    if(!is_array($r))throw new RuntimeException('iyzico yanıtı okunamadı (HTTP '.$status.').');
    return $r;
}

/** Checkout Form başlatır. Dönen: [true, ödeme sayfası URL] veya [false, hata] */
function vp_iyzico_init(array $attempt,array $inv,array $c,string $ip): array {
    $b=vp_buyer($c);$price=vp_iyzico_price((int)$attempt['amount']);
    $inst=array_values(array_filter(array_map('intval',explode(',',vp_setting('iyzico_installments','1,2,3,6,9'))),fn($n)=>in_array($n,[1,2,3,6,9,12],true)))?:[1];
    $addr=['contactName'=>$b['full'],'city'=>$b['city'],'country'=>'Turkey','address'=>mb_substr($b['address'],0,250)];
    $body=['locale'=>'tr','conversationId'=>$attempt['oid'],'price'=>$price,'paidPrice'=>$price,'currency'=>'TRY','basketId'=>$attempt['oid'],'paymentGroup'=>'PRODUCT',
        'callbackUrl'=>vp_public_url().'/odeme/iyzico/donus','enabledInstallments'=>$inst,
        'buyer'=>['id'=>'C'.$c['id'],'name'=>$b['first'],'surname'=>$b['last'],'gsmNumber'=>'+90'.substr($b['phone'],-10),'email'=>$c['email'],'identityNumber'=>$b['tc'],'registrationAddress'=>$addr['address'],'ip'=>$ip,'city'=>$b['city'],'country'=>'Turkey','registrationDate'=>$c['created_at'],'lastLoginDate'=>$c['last_login']?:vp_now()],
        'shippingAddress'=>$addr,'billingAddress'=>$addr,
        'basketItems'=>[['id'=>'INV'.$inv['id'],'name'=>'Veniux fatura '.$inv['number'],'category1'=>'Yazılım lisansı','itemType'=>'VIRTUAL','price'=>$price]]];
    try{$r=vp_iyzico_request('/payment/iyzipos/checkoutform/initialize/auth/ecom',$body);}
    catch(Throwable $t){return [false,$t->getMessage()];}
    if(($r['status']??'')==='success'&&is_string($r['token']??null)&&is_string($r['paymentPageUrl']??null)&&str_starts_with($r['paymentPageUrl'],'https://')){
        vp_update('payment_attempts',(int)$attempt['id'],['token'=>$r['token'],'updated_at'=>vp_now()]);
        return [true,$r['paymentPageUrl']];
    }
    return [false,(string)($r['errorMessage']??'iyzico isteği reddetti.')];
}

/** iyzico dönüşü: token ile sonucu sunucudan sorgular, faturayı uygular. Dönen: fatura id. */
function vp_iyzico_return(): ?int {
    $token=(string)($_POST['token']??$_GET['token']??'');
    if($token===''||strlen($token)>255||!preg_match('/^[A-Za-z0-9-]+$/',$token))return null;
    $a=vp_row("SELECT * FROM payment_attempts WHERE token=? AND gateway='iyzico'",[$token]);
    if(!$a)return null;
    if($a['status']!=='bekliyor')return (int)$a['invoice_id'];
    try{$r=vp_iyzico_request('/payment/iyzipos/checkoutform/auth/ecom/detail',['locale'=>'tr','conversationId'=>$a['oid'],'token'=>$token]);}
    catch(Throwable $t){vp_attempt_fail($a['oid'],'Sonuç sorgulanamadı: '.$t->getMessage(),'bekliyor');return (int)$a['invoice_id'];}
    $ok=($r['status']??'')==='success'&&($r['paymentStatus']??'')==='SUCCESS';
    if($ok&&($r['basketId']??'')===$a['oid']){
        $paid=(int)round(((float)($r['paidPrice']??0))*100);
        $fraud=(int)($r['fraudStatus']??1);
        if($paid<(int)$a['amount'])vp_attempt_fail($a['oid'],'Tutar eksik: '.$paid,'inceleme');
        elseif($fraud!==1)vp_attempt_fail($a['oid'],'iyzico dolandırıcılık incelemesinde (fraudStatus '.$fraud.')','inceleme');
        else vp_attempt_succeed($a['oid'],'iyzico '.(string)($r['paymentId']??''),$paid);
    }else{
        vp_attempt_fail($a['oid'],(string)($r['errorMessage']??($r['paymentStatus']??'Ödeme tamamlanmadı')));
    }
    return (int)$a['invoice_id'];
}

// ---------------------------------------------------------------- bağlantı testleri (yönetim)
function vp_paytr_test(): array {
    [$mid,$key,$salt]=vp_paytr_creds();
    if($mid===''||$key===''||$salt==='')return [false,'Mağaza no, Merchant Key ve Merchant Salt girin.'];
    $c=['id'=>0,'email'=>'test@veniux.test','contact_name'=>'Veniux Test','company'=>'Veniux','phone'=>'05000000000','address'=>'Test','city'=>'İstanbul','tax_no'=>'','created_at'=>vp_now(),'last_login'=>null];
    $fake=['oid'=>'VNXTEST'.strtoupper(bin2hex(random_bytes(5))),'amount'=>100];
    $ip=filter_var(vp_ip(),FILTER_VALIDATE_IP,FILTER_FLAG_NO_PRIV_RANGE|FILTER_FLAG_NO_RES_RANGE)?vp_ip():'85.105.0.1';
    [$ok,$msg]=vp_paytr_token($fake,['number'=>'TEST'],$c,$ip);
    return $ok?[true,'PayTR bağlantısı başarılı; token alındı ('.(vp_gateway_test_mode('paytr')?'test modu':'canlı mod').'). Bu test tahsilat yapmaz.']:[false,'PayTR: '.$msg];
}
function vp_iyzico_test(): array {
    if(vp_secret_setting('iyzico_api_key')===''||vp_secret_setting('iyzico_secret_key')==='')return [false,'API Key ve Secret Key girin.'];
    try{$r=vp_iyzico_request('/payment/iyzipos/installment',['locale'=>'tr','conversationId'=>'test','binNumber'=>'552879','price'=>'100.0']);}
    catch(Throwable $t){return [false,'iyzico: '.$t->getMessage()];}
    return ($r['status']??'')==='success'?[true,'iyzico bağlantısı başarılı ('.(vp_gateway_test_mode('iyzico')?'sandbox':'canlı').'). Anahtarlar doğrulandı.']:[false,'iyzico: '.(string)($r['errorMessage']??'Anahtarlar doğrulanamadı.')];
}
