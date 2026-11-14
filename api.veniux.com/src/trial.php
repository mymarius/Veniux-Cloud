<?php
declare(strict_types=1);
// Kendi kendine açılan deneme: yalnız bulut uygulaması (app.veniux.com) gizli servis anahtarıyla çağırır.
// Anahtarın SHA-256 özeti veri klasöründe trial-service.sha256 dosyasındadır; dosya yoksa uç kapalıdır.
// Yalnız İşletme paketi, 14 gün, 2 cihaz; günde en fazla TRIAL_DAILY, aynı anda en fazla TRIAL_OPEN açık deneme.
const TRIAL_DAILY=20, TRIAL_OPEN=100, TRIAL_DAYS=14, TRIAL_PREFIX='Veniux Demo – ';
// Bulut uygulaması deneme işletmesini bitişten 30 gün sonra siler; merkezdeki anahtarı da aynı anda kalıcı sonlandırılır.
// Yalnız adı "Veniux Demo – " ile başlayan, bitişi en az TRIAL_REVOKE_AFTER_DAYS gün geçmiş ACTIVE/SUSPENDED lisanslar.
const TRIAL_REVOKE_AFTER_DAYS=30;
function revokeExpiredTrials(int $limit=50): int {
    $cutoff=gmdate('Y-m-d H:i:s',time()-TRIAL_REVOKE_AFTER_DAYS*86400);
    $ids=sql("SELECT id FROM licenses WHERE company LIKE ? AND status IN ('ACTIVE','SUSPENDED') AND expires_at<? ORDER BY id LIMIT ".max(1,min($limit,200)),[TRIAL_PREFIX.'%',$cutoff])->fetchAll(PDO::FETCH_COLUMN);
    foreach($ids as $id)setLicenseState((int)$id,'REVOKED',0);
    return count($ids);
}
function trialEnabled(): bool { return is_file(dataDir().'/trial-service.sha256'); }
function issueTrial(array $input): array {
    $expected=trim((string)@file_get_contents(dataDir().'/trial-service.sha256'));
    $given=(string)($input['service_key']??'');
    if(!preg_match('/^[a-f0-9]{64}$/',$expected)||strlen($given)<32||!hash_equals($expected,hash('sha256',$given)))throw new InvalidArgumentException('Servis kimliği doğrulanamadı.');
    $company=trim(preg_replace('/\s+/u',' ',(string)($input['company']??'')));
    if($company===''||mb_strlen($company)>80)throw new InvalidArgumentException('İşletme adı geçersiz.');
    revokeExpiredTrials();
    $today=gmdate('Y-m-d').' 00:00:00';
    if((int)sql("SELECT COUNT(*) FROM audit WHERE action='license.trial' AND created_at>=?",[$today])->fetchColumn()>=TRIAL_DAILY)return ['ok'=>false,'code'=>'DAILY_QUOTA'];
    if((int)sql("SELECT COUNT(*) FROM licenses WHERE company LIKE ? AND status='ACTIVE' AND expires_at>?",[TRIAL_PREFIX.'%',now()])->fetchColumn()>=TRIAL_OPEN)return ['ok'=>false,'code'=>'OPEN_QUOTA'];
    $expires=gmdate('Y-m-d',time()+TRIAL_DAYS*86400);
    $issued=issueLicense(TRIAL_PREFIX.$company,'BUSINESS_ANNUAL',2,$expires,0);
    audit('license.trial',(string)$issued['id']);
    return ['ok'=>true,'license_key'=>$issued['key'],'expires'=>$expires.' 23:59:59','plan'=>'BUSINESS_ANNUAL','seats'=>2];
}
