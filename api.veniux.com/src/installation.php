<?php
declare(strict_types=1);
require_once __DIR__.'/core.php';
function installAuthority(array $account): void {
    if(!filter_var($account['email']??'',FILTER_VALIDATE_EMAIL)||strlen($account['password']??'')<14||strlen($account['password'])>72)throw new RuntimeException('Strong admin credentials required');
    if(!is_dir(dataDir()))mkdir(dataDir(),0700,true);
    $sqlite=db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite';
    if(!$sqlite && db()->query('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()')->fetchColumn())throw new RuntimeException('Empty dedicated database required');
    if($sqlite && sql("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='schema_versions'")->fetchColumn())throw new RuntimeException('Already initialized');
    $id=$sqlite?'INTEGER PRIMARY KEY AUTOINCREMENT':'BIGINT PRIMARY KEY AUTO_INCREMENT';$integer=$sqlite?'INTEGER':'BIGINT';
    $tables=[
      "CREATE TABLE schema_versions(version INTEGER PRIMARY KEY,applied_at VARCHAR(20) NOT NULL)",
      "CREATE TABLE admins(id $id,email VARCHAR(190) NOT NULL UNIQUE,password_hash VARCHAR(255) NOT NULL,enabled INTEGER NOT NULL DEFAULT 1)",
      "CREATE TABLE licenses(id $id,company VARCHAR(120) NOT NULL,plan VARCHAR(40) NOT NULL,key_hash VARCHAR(64) NOT NULL UNIQUE,key_suffix VARCHAR(6) NOT NULL,status VARCHAR(20) NOT NULL,seats INTEGER NOT NULL,expires_at VARCHAR(20) NOT NULL,created_at VARCHAR(20) NOT NULL)",
      "CREATE TABLE devices(id $id,license_id $integer NOT NULL,fingerprint VARCHAR(40) NOT NULL,reported_name VARCHAR(64) NOT NULL,alias VARCHAR(64) NOT NULL,credential_hash VARCHAR(64) NOT NULL UNIQUE,enabled INTEGER NOT NULL,os_info VARCHAR(100) NOT NULL,last_seen VARCHAR(20) NOT NULL,created_at VARCHAR(20) NOT NULL,UNIQUE(license_id,fingerprint),FOREIGN KEY(license_id) REFERENCES licenses(id))",
      "CREATE TABLE audit(id $id,actor $integer NOT NULL,action VARCHAR(40) NOT NULL,subject VARCHAR(80) NOT NULL,created_at VARCHAR(20) NOT NULL)",
      "CREATE TABLE rate_limits(bucket VARCHAR(64) PRIMARY KEY,hits INTEGER NOT NULL,created_at VARCHAR(20) NOT NULL)",
      "CREATE INDEX idx_device_license ON devices(license_id,enabled)",
      "CREATE INDEX idx_license_status ON licenses(status,expires_at)",
      "CREATE INDEX idx_rate_created ON rate_limits(created_at)"
    ];
    foreach($tables as $ddl)db()->exec($ddl.($sqlite||!str_starts_with($ddl,'CREATE TABLE')?'':' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin'));
    sql('INSERT INTO admins(email,password_hash) VALUES(?,?)',[strtolower($account['email']),password_hash($account['password'],PASSWORD_DEFAULT)]);
    if(file_exists(dataDir().'/signing-private.pem'))throw new RuntimeException('Signing key already exists; preserve it');
    $options=['private_key_bits'=>3072,'private_key_type'=>OPENSSL_KEYTYPE_RSA];
    $config=getenv('OPENSSL_CONF') ?: (is_file('C:/xampp/apache/conf/openssl.cnf')?'C:/xampp/apache/conf/openssl.cnf':null);
    if($config)$options['config']=$config;
    $key=openssl_pkey_new($options);
    if(!$key||!openssl_pkey_export($key,$private,null,$config?['config'=>$config]:[]))throw new RuntimeException('Signing key setup failed');
    file_put_contents(dataDir().'/signing-private.pem',$private);chmod(dataDir().'/signing-private.pem',0600);
    file_put_contents(dataDir().'/signing-public.pem',openssl_pkey_get_details($key)['key']);
    sql('INSERT INTO schema_versions(version,applied_at) VALUES(1,?)',[now()]);
}
