<?php
declare(strict_types=1);
// Set these in the hosting environment; never infer canonical URLs from Host.
$privatePath=dirname(__DIR__).'/.local/website-mail.php';
$notifications=getenv('VENIUX_CONTACT_NOTIFY')!=='0';
$smtp=$notifications&&is_file($privatePath)?require $privatePath:[];
// Sırsız ayarlar (hosting ortam değişkeni yoksa): .local/website-mail-settings.json {"mail_enabled":true,"mail_from":"no-reply@veniux.com","contact_email":"..."}
$mailFile=dirname(__DIR__).'/.local/website-mail-settings.json';
$mailSettings=is_file($mailFile)?json_decode((string)@file_get_contents($mailFile),true):null;
$mailSettings=is_array($mailSettings)?$mailSettings:[];
$settingEmail=static fn($value)=>is_string($value)&&filter_var($value,FILTER_VALIDATE_EMAIL)&&!preg_match('/[
]/',$value)?$value:'';
return [
    'url' => rtrim(getenv('VENIUX_SITE_URL') ?: 'https://veniux.com', '/'),
    'app_url' => '/indir',
    'contact_email' => getenv('VENIUX_CONTACT_EMAIL') ?: ($settingEmail($mailSettings['contact_email']??'') ?: 'mymarius1@gmail.com'),
    'mail_enabled' => $notifications&&(getenv('VENIUX_CONTACT_MAIL_ENABLED') === '1'||(getenv('VENIUX_CONTACT_MAIL_ENABLED')===false&&($mailSettings['mail_enabled']??false)===true)),
    'mail_from' => getenv('VENIUX_CONTACT_MAIL_FROM') ?: $settingEmail($mailSettings['mail_from']??''),
    'smtp' => is_array($smtp)?$smtp:[],
    'indexable' => getenv('VENIUX_SITE_INDEXABLE') !== '0',
    'request_dir' => getenv('VENIUX_CONTACT_STORAGE') ?: dirname(__DIR__) . '/.local/website-contact-requests',
];

