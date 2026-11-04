<?php
declare(strict_types=1);
$fixture=new PDO('sqlite::memory:');$fixture->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);
function db():PDO{global $fixture;return $fixture;}
function now():string{return gmdate('Y-m-d H:i:s');}
function audit(string $a,string $s):void{}
function sql(string $q,array $p=[]):PDOStatement{$s=db()->prepare($q);$s->execute($p);return $s;}
function atomic(callable $a){db()->beginTransaction();try{$r=$a();db()->commit();return $r;}catch(Throwable $e){db()->rollBack();throw $e;}}
require dirname(__DIR__).'/src/companion.php';
db()->exec('CREATE TABLE licenses(id INTEGER PRIMARY KEY,status TEXT,expires_at TEXT,seats INTEGER);CREATE TABLE devices(id INTEGER PRIMARY KEY,license_id INTEGER,fingerprint TEXT,credential_hash TEXT,enabled INTEGER,reported_name TEXT,alias TEXT,os_info TEXT,last_seen TEXT,created_at TEXT,UNIQUE(license_id,fingerprint))');
sql('INSERT INTO licenses VALUES(1,?,?,2)',['ACTIVE','2030-01-01 00:00:00']);sql('INSERT INTO devices(id,license_id,fingerprint,credential_hash,enabled) VALUES(1,1,?,?,1)',['HW-'.str_repeat('A',32),hash('sha256',str_repeat('a',64))]);
$input=['parent_device_token'=>str_repeat('a',64),'parent_device_fingerprint'=>'HW-'.str_repeat('A',32),'device_fingerprint'=>'HW-'.str_repeat('B',32)];
if(!activateCompanion($input)['success'])throw new RuntimeException('Enrolment failed');
$child=activateCompanion($input);if((int)sql('SELECT COUNT(*) FROM devices')->fetchColumn()!==2)throw new RuntimeException('Repeat enrolment duplicated a seat');
$full=$input;$full['device_fingerprint']='HW-'.str_repeat('C',32);try{activateCompanion($full);throw new RuntimeException('Seat limit bypassed');}catch(InvalidArgumentException $expected){}
sql('UPDATE licenses SET seats=10');$cascade=['parent_device_token'=>$child['device_token'],'parent_device_fingerprint'=>$input['device_fingerprint'],'device_fingerprint'=>'HW-'.str_repeat('D',32)];try{activateCompanion($cascade);throw new RuntimeException('Mobile child enrolled another terminal');}catch(InvalidArgumentException $expected){}
sql('UPDATE devices SET enabled=0 WHERE id=1');try{activateCompanion($input);throw new RuntimeException('Disabled parent accepted');}catch(InvalidArgumentException $expected){}
echo "PASS: companion enrolment, repeat-device reuse, seat limit and disabled-parent rejection.\n";
