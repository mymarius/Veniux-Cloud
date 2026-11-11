<?php
declare(strict_types=1);
// Lisans merkezi şemasını 2. sürüme yükseltir (lisanslara not, iletişim e-postası, sektör eklentileri sütunları ekler).
// Yalnız komut satırında çalışır; mevcut kayıtları değiştirmez ve yeniden çalıştırılabilir.
if(PHP_SAPI!=='cli')exit(1);
require dirname(__DIR__).'/src/core.php';
try { echo upgradeAuthority(), ' (şema ', columnExists('licenses','addons') ? '2' : '1', ")\n"; }
catch(Throwable $e){fwrite(STDERR,"Yükseltme tamamlanamadı; veriler korundu.\n");exit(1);}
