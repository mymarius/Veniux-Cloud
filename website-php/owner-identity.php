<?php
declare(strict_types=1);
function siteOwnerEmail():string {return 'mymarius1@gmail.com';}
function siteOwnerIdentity(string $email,string $password):?array {
    if($email!==siteOwnerEmail())return null;
    $url='https://api.veniux.com/v1/owner/login';
    $curl=curl_init($url);if(!$curl)throw new RuntimeException('Owner identity unavailable');
    curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode(['email'=>$email,'password'=>$password],JSON_THROW_ON_ERROR),CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>8,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2]);
    try{$reply=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);if($status===401)return null;if($status!==200||!is_string($reply)||strlen($reply)>4096)throw new RuntimeException('Owner identity unavailable');$identity=json_decode($reply,true,8,JSON_THROW_ON_ERROR);if(($identity['valid']??false)!==true||($identity['email']??'')!==$email)return null;return ['id'=>'authority-'.(string)$identity['id'],'email'=>$email,'company'=>'Veniux · Sahip / Yönetici','is_owner'=>true];}finally{curl_close($curl);}
}
