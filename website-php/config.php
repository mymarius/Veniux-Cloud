<?php
declare(strict_types=1);
// Set these in the hosting environment; never infer canonical URLs from Host.
$privatePath=dirname(__DIR__).'/.local/website-mail.php';
$notifications=getenv('VENIUX_CONTACT_NOTIFY')!=='0';
$smtp=$notifications&&is_file($privatePath)?require $privatePath:[];
return [
    'url' => rtrim(getenv('VENIUX_SITE_URL') ?: 'https://veniux.com', '/'),
    'app_url' => '/indir',
    'contact_email' => getenv('VENIUX_CONTACT_EMAIL') ?: 'mymarius1@gmail.com',
    'mail_enabled' => $notifications&&getenv('VENIUX_CONTACT_MAIL_ENABLED') === '1',
    'mail_from' => getenv('VENIUX_CONTACT_MAIL_FROM') ?: '',
    'smtp' => is_array($smtp)?$smtp:[],
    'indexable' => getenv('VENIUX_SITE_INDEXABLE') !== '0',
    'request_dir' => getenv('VENIUX_CONTACT_STORAGE') ?: dirname(__DIR__) . '/.local/website-contact-requests',
];

