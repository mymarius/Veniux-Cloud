<?php
declare(strict_types=1);
// Lisans merkezi bağlantı denemesi (yalnız okur). Çıktıda parola yazılmaz.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../panel-core/bootstrap.php';
require __DIR__.'/../panel-core/authority-sync.php';
if(!vp_authority_configured()){echo "authority.json yok ya da geçersiz (JSON bozuk olabilir).\n";exit(1);}
try{
    $db=vp_authority_db();
    $n=(int)$db->query('SELECT COUNT(*) FROM licenses')->fetchColumn();
    $d=(int)$db->query('SELECT COUNT(*) FROM devices')->fetchColumn();
    echo "BAĞLANTI TAMAM: merkezde $n lisans, $d cihaz kaydı.\n";
    try{$db->query('SELECT notes, contact_email, addons FROM licenses LIMIT 1');echo "Şema 2 (not/e-posta/eklenti sütunları) var.\n";}catch(Throwable){echo "Şema 1: not/e-posta sütunları yok (sorun değil).\n";}
}catch(Throwable $t){echo 'BAĞLANTI HATASI: '.preg_replace('/password=\S+/i','password=***',$t->getMessage())."\n";exit(1);}
