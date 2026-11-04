<?php
declare(strict_types=1);
function activateCompanion(array $input):array {
 $credential=(string)($input['parent_device_token']??'');$parentFp=(string)($input['parent_device_fingerprint']??'');$fp=(string)($input['device_fingerprint']??'');
 if(!preg_match('/^[a-f0-9]{64}$/D',$credential)||!preg_match('/^HW-[A-F0-9]{32}$/D',$parentFp)||!preg_match('/^HW-[A-F0-9]{32}$/D',$fp)||$fp===$parentFp)throw new InvalidArgumentException('Terminal bilgileri geçersiz.');
 return atomic(function()use($credential,$parentFp,$fp){
  $lock=db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'?' FOR UPDATE':'';
  $parent=sql('SELECT * FROM devices WHERE credential_hash=?',[hash('sha256',$credential)])->fetch();
  if(!$parent||!hash_equals($parent['fingerprint'],$parentFp)||(string)($parent['os_info']??'')==='Veniux Android uygulaması')throw new InvalidArgumentException('Bilgisayar terminali doğrulanamadı.');
  $license=sql('SELECT * FROM licenses WHERE id=?'.$lock,[$parent['license_id']])->fetch();
  $parent=sql('SELECT * FROM devices WHERE id=?'.$lock,[$parent['id']])->fetch();
  if(!$license||!$parent||!hash_equals($parent['credential_hash'],hash('sha256',$credential))||!(int)$parent['enabled']||$license['status']!=='ACTIVE'||$license['expires_at']<=now())throw new InvalidArgumentException('Bilgisayar lisansı etkin değil.');
  $device=sql('SELECT * FROM devices WHERE license_id=? AND fingerprint=?',[$license['id'],$fp])->fetch();
  if($device&&!(int)$device['enabled'])throw new InvalidArgumentException('Mobil terminal merkezden kapatılmış.');
  $count=(int)sql('SELECT COUNT(*) FROM devices WHERE license_id=? AND enabled=1',[$license['id']])->fetchColumn();
  if(!$device&&$count>=(int)$license['seats'])throw new InvalidArgumentException('Terminal sınırına ulaşıldı.');
  $token=bin2hex(random_bytes(32));$name='Android telefon/tablet';$os='Veniux Android uygulaması';
  if($device)sql('UPDATE devices SET credential_hash=?,reported_name=?,os_info=?,last_seen=? WHERE id=?',[hash('sha256',$token),$name,$os,now(),$device['id']]);
  else sql('INSERT INTO devices(license_id,fingerprint,reported_name,alias,credential_hash,enabled,os_info,last_seen,created_at) VALUES(?,?,?,?,?,1,?,?,?)',[$license['id'],$fp,$name,$name,hash('sha256',$token),$os,now(),now()]);
  audit('device.companion.activated',(string)$license['id']);return ['success'=>true,'device_token'=>$token];
 });
}
