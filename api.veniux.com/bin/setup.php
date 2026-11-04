<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require dirname(__DIR__).'/src/installation.php';
try { installAuthority(json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR)); echo "Lisans merkezi ve yönetici hesabı hazır. Sırlar çıktıya yazılmadı.\n"; }
catch(Throwable $e){fwrite(STDERR,"Kurulum tamamlanamadı; mevcut hedef silinmedi.\n");exit(1);}