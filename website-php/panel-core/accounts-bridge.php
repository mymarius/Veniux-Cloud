<?php
declare(strict_types=1);
// Site hesapları (accounts.php, .local/website-accounts/accounts.json) ile panel arasındaki köprü.
require_once VP_SITE_ROOT.'/accounts.php';

function vp_site_accounts_dir(): string {
    if(PHP_SAPI==='cli'&&empty($_SERVER['DOCUMENT_ROOT']))$_SERVER['DOCUMENT_ROOT']=realpath(VP_SITE_ROOT);
    return accountDirectory($GLOBALS['config']??[]);
}

/** Yeni site hesabı açar. Hesap id'si döner; e-posta kayıtlıysa false. */
function vp_site_account_create(string $email,string $company,string $password){
    $email=strtolower(trim($email));$key=hash('sha256',$email);$hash=password_hash($password,PASSWORD_DEFAULT);
    return accountTransaction(vp_site_accounts_dir(),function(array &$accounts)use($key,$email,$company,$hash){
        if(isset($accounts[$key]))return false;
        $id=bin2hex(random_bytes(16));
        $accounts[$key]=['id'=>$id,'email'=>$email,'company'=>$company,'plan'=>'isletme','license_key'=>'VNX-'.strtoupper(bin2hex(random_bytes(6))).'-'.strtoupper(bin2hex(random_bytes(4))),'password_hash'=>$hash,'created_at'=>gmdate('c')];
        return $id;
    });
}

function vp_site_account_password(string $email,string $password,?string $current=null): bool {
    $key=hash('sha256',strtolower(trim($email)));$hash=password_hash($password,PASSWORD_DEFAULT);
    return (bool)accountTransaction(vp_site_accounts_dir(),function(array &$accounts)use($key,$hash,$current){
        if(!isset($accounts[$key]))return false;
        if($current!==null&&!password_verify($current,(string)($accounts[$key]['password_hash']??'')))return false;
        $accounts[$key]['password_hash']=$hash;return true;
    });
}

function vp_site_account_company(string $email,string $company): void {
    $key=hash('sha256',strtolower(trim($email)));
    accountTransaction(vp_site_accounts_dir(),function(array &$accounts)use($key,$company){if(isset($accounts[$key]))$accounts[$key]['company']=$company;return true;});
}
