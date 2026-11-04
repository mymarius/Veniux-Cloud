<?php
declare(strict_types=1);
function rate(string $key,int $limit):void{}
function audit(string $action,string $subject,int $actor=0):void{}
function sql(string $query,array $params=[]):PDOStatement {global $fixture;$s=$fixture->prepare($query);$s->execute($params);return $s;}
require dirname(__DIR__).'/src/ownerIdentity.php';
$fixture=new PDO('sqlite::memory:');$fixture->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);
$fixture->exec('CREATE TABLE admins(id INTEGER PRIMARY KEY,email TEXT UNIQUE,password_hash TEXT,enabled INTEGER)');
sql('INSERT INTO admins VALUES(1,?,?,1)',[ownerEmail(),password_hash('Fixture-owner-password-only',PASSWORD_DEFAULT)]);
if(verifyOwnerIdentity(['email'=>ownerEmail(),'password'=>'Fixture-owner-password-only'])['valid']!==true)throw new RuntimeException('Valid owner rejected');
if(verifyOwnerIdentity(['email'=>ownerEmail(),'password'=>'wrong'])['valid']!==false)throw new RuntimeException('Wrong password accepted');
sql('UPDATE admins SET enabled=0');if(verifyOwnerIdentity(['email'=>ownerEmail(),'password'=>'Fixture-owner-password-only'])['valid']!==false)throw new RuntimeException('Disabled owner accepted');
echo "PASS: owner credentials, wrong-password denial, disabled-owner denial.\n";
