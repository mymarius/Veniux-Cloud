<?php
declare(strict_types=1);
// Yönetici hesabı oluşturur veya şifresini sıfırlar.
// Kullanım: php bin/panel-admin.php eposta@alan.com "Ad Soyad" [yonetici|muhasebe|destek]
// Şifre terminalden sorulur (ekrana yazılmaz) veya VENIUX_ADMIN_PASSWORD ortam değişkeninden okunur.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../panel-core/bootstrap.php';
[$_, $email, $name, $role]=array_pad($argv,4,null);
$email=strtolower(trim((string)$email));$role=$role?:'yonetici';
if(!filter_var($email,FILTER_VALIDATE_EMAIL)||!in_array($role,['yonetici','muhasebe','destek'],true)){fwrite(STDERR,"Kullanım: php bin/panel-admin.php eposta \"Ad Soyad\" [yonetici|muhasebe|destek]\n");exit(1);}
$pass=getenv('VENIUX_ADMIN_PASSWORD')?:'';
if($pass===''){
    fwrite(STDOUT,'Şifre (en az 12 karakter): ');
    if(DIRECTORY_SEPARATOR==='/')system('stty -echo');
    $pass=trim((string)fgets(STDIN));
    if(DIRECTORY_SEPARATOR==='/')system('stty echo');
    fwrite(STDOUT,"\n");
}
if(strlen($pass)<12){fwrite(STDERR,"Şifre en az 12 karakter olmalı.\n");exit(1);}
$hash=password_hash($pass,PASSWORD_DEFAULT);
$existing=vp_row('SELECT id FROM admins WHERE email=?',[$email]);
if($existing){vp_update('admins',(int)$existing['id'],['password_hash'=>$hash,'active'=>1,'role'=>$role]+($name?['name'=>$name]:[]));echo "Yönetici güncellendi: $email\n";}
else{vp_insert('admins',['name'=>$name?:$email,'email'=>$email,'password_hash'=>$hash,'role'=>$role,'active'=>1,'created_at'=>vp_now()]);echo "Yönetici oluşturuldu: $email ($role)\n";}
echo "Giriş: /yonetim/giris\n";
