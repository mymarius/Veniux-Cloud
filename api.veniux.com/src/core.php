<?php
declare(strict_types=1);
date_default_timezone_set('UTC');
require_once __DIR__.'/configuration.php';
function production(): bool { return (setting('LICENSE_ENV') ?: 'production') === 'production'; }
function dataDir(): string {
    $directory=setting('LICENSE_DATA_DIR');
    if (!$directory && production()) throw new RuntimeException('Private storage configuration required');
    $directory=$directory ?: dirname(__DIR__,2).'/.local/license-authority';
    if(production()) {
        $resolved=realpath($directory);$public=realpath(dirname(__DIR__).'/public');
        $documentRoot=!empty($_SERVER['DOCUMENT_ROOT']) ? (realpath($_SERVER['DOCUMENT_ROOT']) ?: $public) : $public;
        foreach([$public,$documentRoot] as $webRoot) if($resolved && $webRoot && ($resolved===$webRoot || str_starts_with($resolved,$webRoot.DIRECTORY_SEPARATOR))) throw new RuntimeException('Private storage is inside document root');
        if(!$resolved || !is_writable($resolved)) throw new RuntimeException('Private storage unavailable');
    }
    return $directory;
}
function db(): PDO {
    static $db;
    if ($db) return $db;
    if(production()) dataDir();
    $dsn=setting('LICENSE_DB_DSN') ?: 'sqlite:'.dataDir().'/authority.sqlite';
    if (production() && (!str_starts_with($dsn,'mysql:') || !setting('LICENSE_DB_USER') || strtolower(setting('LICENSE_DB_USER'))==='root' || !setting('LICENSE_DB_PASSWORD'))) throw new RuntimeException('Production database settings required');
    $db=new PDO($dsn,setting('LICENSE_DB_USER')?:null,setting('LICENSE_DB_PASSWORD')?:null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    if ($db->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite') { $db->exec('PRAGMA foreign_keys=ON'); $db->exec('PRAGMA busy_timeout=5000'); }
    else $db->setAttribute(PDO::ATTR_EMULATE_PREPARES,false);
    return $db;
}
function sql(string $query,array $values=[]): PDOStatement { $s=db()->prepare($query);$s->execute($values);return $s; }
function atomic(callable $action) {
    $sqlite=db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite';
    $sqlite?db()->exec('BEGIN IMMEDIATE'):db()->beginTransaction();
    try { $result=$action();$sqlite?db()->exec('COMMIT'):db()->commit();return $result; }
    catch(Throwable $e){$sqlite?db()->exec('ROLLBACK'):db()->rollBack();throw $e;}
}
function now(): string {return gmdate('Y-m-d H:i:s');}
function audit(string $action,string $subject,int $actor=0): void {sql('INSERT INTO audit(actor,action,subject,created_at) VALUES(?,?,?,?)',[$actor,$action,$subject,now()]);}
function issueLicense(string $company,string $plan,int $seats,string $expires,int $actor): array {
    $company=trim($company);
    if(!$company||mb_strlen($company)>120||!in_array($plan,['STARTER_ANNUAL','BUSINESS_ANNUAL','ENTERPRISE_ANNUAL'],true)||$seats<1||$seats>1000)throw new InvalidArgumentException('Firma, paket veya terminal sınırı geçersiz.');
    $date=DateTimeImmutable::createFromFormat('!Y-m-d',$expires);
    if(!$date||$date->format('Y-m-d')!==$expires||$date->setTime(23,59,59)<=new DateTimeImmutable())throw new InvalidArgumentException('Gelecekteki geçerli bir bitiş günü seçin.');
    $key='VNX-'.strtoupper(bin2hex(random_bytes(24)));
    return atomic(function()use($company,$plan,$seats,$date,$key,$actor){
        sql('INSERT INTO licenses(company,plan,key_hash,key_suffix,status,seats,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?)',[$company,$plan,hash('sha256',$key),substr($key,-6),'ACTIVE',$seats,$date->format('Y-m-d').' 23:59:59',now()]);
        $id=(int)db()->lastInsertId();audit('license.created',(string)$id,$actor);return ['id'=>$id,'key'=>$key];
    });
}
function setLicenseState(int $id,string $state,int $actor):void {
    if(!in_array($state,['ACTIVE','SUSPENDED','REVOKED'],true))throw new InvalidArgumentException('Durum geçersiz.');
    atomic(function()use($id,$state,$actor){$row=sql('SELECT status FROM licenses WHERE id=?'.(db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'?' FOR UPDATE':''),[$id])->fetch();
        if(!$row)throw new InvalidArgumentException('Lisans bulunamadı.');
        if($row['status']==='REVOKED')throw new InvalidArgumentException('Sonlandırılmış lisans yeniden açılamaz; yeni lisans düzenleyin.');
        sql('UPDATE licenses SET status=? WHERE id=?',[$state,$id]);audit('license.'.strtolower($state),(string)$id,$actor);
    });
}
function rate(string $scope,int $limit): void {
    $key=hash('sha256',$scope.'|'.($_SERVER['REMOTE_ADDR']??'cli').'|'.gmdate('YmdHi'));
    $count=atomic(function()use($key){
        if(db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'){
            sql('INSERT INTO rate_limits(bucket,hits,created_at) VALUES(?,1,?) ON DUPLICATE KEY UPDATE hits=hits+1',[$key,now()]);
        }else{
            sql('INSERT INTO rate_limits(bucket,hits,created_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1',[$key,now()]);
        }
        return (int)sql('SELECT hits FROM rate_limits WHERE bucket=?',[$key])->fetchColumn();
    });
    if(random_int(1,100)===1)sql('DELETE FROM rate_limits WHERE created_at<?',[gmdate('Y-m-d H:i:s',time()-3600)]);
    if($count>$limit)throw new RuntimeException('RATE_LIMIT');
}
function activate(array $input): array {
    $key=(string)($input['license_key']??'');$fp=(string)($input['device_fingerprint']??'');$name=trim((string)($input['device_name']??''));
    if(str_starts_with($key,'HW-'))throw new InvalidArgumentException('Bu kod cihaz kimliğidir, lisans anahtarı değildir. Her kurulumda lisans merkezinden verilen geçerli VNX- anahtarını kullanın.');
    if(!preg_match('/^VNX-[A-F0-9]{48}$/D',$key)||!preg_match('/^HW-[A-F0-9]{32}$/D',$fp)||!$name||mb_strlen($name)>64)throw new InvalidArgumentException('Lisans veya terminal bilgileri geçersiz.');
    return atomic(function()use($key,$fp,$name,$input){
        $license=sql('SELECT * FROM licenses WHERE key_hash=?'.(db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'?' FOR UPDATE':''),[hash('sha256',$key)])->fetch();
        if(!$license||$license['status']!=='ACTIVE'||$license['expires_at']<=now())throw new InvalidArgumentException('Lisans etkin değil veya süresi dolmuş.');
        $device=sql('SELECT * FROM devices WHERE license_id=? AND fingerprint=?',[$license['id'],$fp])->fetch();
        if($device && !(int)$device['enabled'])throw new InvalidArgumentException('Terminal merkezden kapatılmış.');
        $count=(int)sql('SELECT COUNT(*) FROM devices WHERE license_id=? AND enabled=1',[$license['id']])->fetchColumn();
        if(!$device && $count>=(int)$license['seats'])throw new InvalidArgumentException('Terminal sınırına ulaşıldı.');
        $credential=bin2hex(random_bytes(32));$os=mb_substr((string)($input['os_info']??''),0,100);
        if($device)sql('UPDATE devices SET credential_hash=?,reported_name=?,os_info=?,last_seen=? WHERE id=?',[hash('sha256',$credential),$name,$os,now(),$device['id']]);
        else sql('INSERT INTO devices(license_id,fingerprint,reported_name,alias,credential_hash,enabled,os_info,last_seen,created_at) VALUES(?,?,?,?,?,1,?,?,?)',[$license['id'],$fp,$name,$name,hash('sha256',$credential),$os,now(),now()]);
        audit('device.activated',(string)$license['id']);return ['success'=>true,'device_token'=>$credential];
    });
}
function verifyDevice(array $input): array {
    $credential=(string)($input['device_token']??'');$fp=(string)($input['device_fingerprint']??'');$nonce=(string)($input['nonce']??'');
    if(!preg_match('/^[a-f0-9]{64}$/D',$credential)||!preg_match('/^HW-[A-F0-9]{32}$/D',$fp)||!preg_match('/^[a-f0-9]{32}$/D',$nonce))throw new InvalidArgumentException('Doğrulama bilgileri geçersiz.');
    $r=sql('SELECT d.id,d.fingerprint,d.alias,d.enabled,l.id AS license_id,l.status,l.expires_at,l.company,l.plan,l.seats FROM devices d JOIN licenses l ON l.id=d.license_id WHERE d.credential_hash=?',[hash('sha256',$credential)])->fetch();
    $valid=$r && hash_equals($r['fingerprint'],$fp) && (int)$r['enabled']===1 && $r['status']==='ACTIVE' && $r['expires_at']>now();
    $payload=['valid'=>(bool)$valid,'nonce'=>$nonce,'device_fingerprint'=>$fp,'issued_at'=>time(),'valid_until'=>time()+30,'status'=>$valid?'ACTIVE':($r?(!(int)$r['enabled']?'DEVICE_DISABLED':($r['expires_at']<=now()?'EXPIRED':$r['status'])):'INVALID')];
    if($valid){$payload+=['license_id'=>(int)$r['license_id'],'device_id'=>(int)$r['id'],'max_devices'=>(int)$r['seats'],'tenant_name'=>$r['company'],'terminal_name'=>$r['alias'],'plan_id'=>$r['plan'],'expires_at'=>str_replace(' ','T',$r['expires_at']).'Z'];sql('UPDATE devices SET last_seen=? WHERE id=?',[now(),$r['id']]);}
    $signed=json_encode($payload,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    if(!openssl_sign($signed,$signature,file_get_contents(dataDir().'/signing-private.pem'),OPENSSL_ALGO_SHA256))throw new RuntimeException('Signing unavailable');
    return ['signed_payload'=>$signed,'signature'=>base64_encode($signature)];
}
function e($s): string {return htmlspecialchars((string)$s,ENT_QUOTES,'UTF-8');}
