<?php
declare(strict_types=1);
// Panel otomasyonu: yenileme faturaları, süresi dolan ve askıya alınan lisanslar.
// Zamanlanmış görev örneği (saatte bir): 0 * * * * php /yol/bin/panel-cron.php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../panel-core/bootstrap.php';
require __DIR__.'/../panel-core/payments.php';
require __DIR__.'/../panel-core/notify.php';
$r=vp_automation(true);
echo 'Yenileme faturası: '.$r['renewals'].', süresi dolan: '.$r['expired'].', askıya alınan: '.$r['suspended']."\n";
$n=vp_notify_process(100);
echo 'Bildirim: '.$n['sent'].' gönderildi, '.$n['failed']." başarısız\n";
