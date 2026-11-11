<?php
declare(strict_types=1);
// Lisans düzenleme ve şema yükseltmesi kabulü. Yalnız komut satırı, yalnız geçici SQLite dizini (LICENSE_DATA_DIR).
// Kullanım: php edit-acceptance.php a   (kurulum, şema 1 düzenleme, yükseltme)
//           php edit-acceptance.php b   (yeni süreçte: şema 2 düzenleme, terminal sınırı, imzalı yanıt)
if(PHP_SAPI!=='cli'||getenv('LICENSE_ENV')!=='development'||!getenv('LICENSE_DATA_DIR'))exit("Yalnız geçici geliştirme dizininde çalışır.\n");
require dirname(__DIR__).'/src/installation.php';
function check(bool $ok,string $label): void { echo ($ok?'PASS ':'FAIL ').$label."\n"; if(!$ok)exit(1); }
function fails(callable $fn): bool { try{$fn();return false;}catch(InvalidArgumentException){return true;} }
$stage=$argv[1]??'a';$state=dataDir().'/edit-test.json';
$soon=gmdate('Y-m-d',time()+86400*30);$later=gmdate('Y-m-d',time()+86400*400);
if($stage==='a'){
    installAuthority(['email'=>'test@example.test','password'=>str_repeat('x',16)]);
    $license=issueLicense('Deneme Market','STARTER_ANNUAL',3,$soon,1);
    file_put_contents($state,json_encode($license));
    check(schemaVersion()===1&&!hasExtras(),'yeni kurulum şema 1');
    updateLicense($license['id'],['company'=>'Deneme Market A.Ş.','plan'=>'BUSINESS_ANNUAL','seats'=>3,'expires'=>$later,'notes'=>'yazılmamalı','addons'=>['hardware']],1);
    $row=sql('SELECT * FROM licenses WHERE id=?',[$license['id']])->fetch();
    check($row['company']==='Deneme Market A.Ş.'&&$row['plan']==='BUSINESS_ANNUAL'&&str_starts_with($row['expires_at'],$later),'şema 1’de temel alanlar düzenlenir');
    check(!array_key_exists('addons',$row),'şema 1’de ek sütun yok, eklenti yazılmadı');
    check(upgradeAuthority()==='upgraded','yükseltme çalıştı');
    check(columnExists('licenses','addons')&&columnExists('licenses','notes')&&columnExists('licenses','contact_email')&&columnExists('licenses','updated_at'),'dört yeni sütun eklendi');
    check((int)sql('SELECT COUNT(*) FROM licenses')->fetchColumn()===1&&sql('SELECT company FROM licenses')->fetchColumn()==='Deneme Market A.Ş.','mevcut kayıt korundu');
    exit(0);
}
$license=json_decode((string)file_get_contents($state),true);$id=$license['id'];
check(schemaVersion()===2&&hasExtras(),'yeni süreçte şema 2');
check(upgradeAuthority()==='already-current','yükseltme tekrar çalışınca zarar vermez');
updateLicense($id,['company'=>'Deneme Market A.Ş.','plan'=>'BUSINESS_ANNUAL','seats'=>3,'expires'=>$later,'contact_email'=>'sahip@example.test','notes'=>"Not satırı\nikinci satır",'addons'=>['hardware','restaurant']],1);
$row=sql('SELECT * FROM licenses WHERE id=?',[$id])->fetch();
check(licenseAddons($row)===['hardware','restaurant']&&$row['contact_email']==='sahip@example.test'&&str_contains($row['notes'],'ikinci')&&$row['updated_at']!=='','şema 2’de eklenti, e-posta ve not kaydedilir');
check(fails(fn()=>updateLicense($id,['company'=>'X','plan'=>'BUSINESS_ANNUAL','seats'=>3,'expires'=>$later,'addons'=>['bilinmeyen']],1)),'bilinmeyen sektör paketi reddedilir');
check(fails(fn()=>updateLicense($id,['company'=>'X','plan'=>'YOK','seats'=>3,'expires'=>$later],1)),'bilinmeyen paket reddedilir');
check(fails(fn()=>updateLicense($id,['company'=>'X','plan'=>'BUSINESS_ANNUAL','seats'=>3,'expires'=>'2020-01-01'],1)),'geçmiş bitiş günü reddedilir');
check(fails(fn()=>updateLicense($id,['company'=>'X','plan'=>'BUSINESS_ANNUAL','seats'=>3,'expires'=>$later,'contact_email'=>'e-posta-degil'],1)),'geçersiz e-posta reddedilir');
check(fails(fn()=>updateLicense($id,['company'=>'X','plan'=>'BUSINESS_ANNUAL','seats'=>3,'expires'=>$later,'notes'=>str_repeat('a',501)],1)),'501 karakterlik not reddedilir');
// iki terminal etkinleştir; sınır etkin terminalden küçük olamaz
$first=activate(['license_key'=>$license['key'],'device_fingerprint'=>'HW-'.strtoupper(str_repeat('a',32)),'device_name'=>'Kasa 1']);
activate(['license_key'=>$license['key'],'device_fingerprint'=>'HW-'.strtoupper(str_repeat('b',32)),'device_name'=>'Kasa 2']);
check(fails(fn()=>updateLicense($id,['company'=>'X','plan'=>'BUSINESS_ANNUAL','seats'=>1,'expires'=>$later],1)),'terminal sınırı etkin terminalden az olamaz');
updateLicense($id,['company'=>'Deneme Market A.Ş.','plan'=>'BUSINESS_ANNUAL','seats'=>2,'expires'=>$later,'addons'=>['hardware','restaurant']],1);
check((int)sql('SELECT seats FROM licenses WHERE id=?',[$id])->fetchColumn()===2,'sınır etkin terminal sayısına eşitlenebilir');
$signed=verifyDevice(['device_token'=>$first['device_token'],'device_fingerprint'=>'HW-'.strtoupper(str_repeat('a',32)),'nonce'=>bin2hex(random_bytes(16))]);
$payload=json_decode($signed['signed_payload'],true);
check($payload['valid']===true&&$payload['addons']===['hardware','restaurant']&&$payload['plan_id']==='BUSINESS_ANNUAL','imzalı doğrulama yanıtı sektör eklentilerini taşır');
setLicenseState($id,'REVOKED',1);
check(fails(fn()=>updateLicense($id,['company'=>'X','plan'=>'BUSINESS_ANNUAL','seats'=>2,'expires'=>$later],1)),'sonlandırılmış lisans düzenlenemez');
