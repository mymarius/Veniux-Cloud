<?php
declare(strict_types=1);
// Sistemler sayfası: diğer Veniux hizmetlerinin durumunu yalnız okur; hiçbir şeyi değiştirmez.
function systemsFetch(string $url): ?array {
    if(!production())return null;
    $context=stream_context_create(['http'=>['timeout'=>4,'ignore_errors'=>true,'header'=>"Accept: application/json\r\nUser-Agent: veniux-kontrol\r\n"]]);
    $raw=@file_get_contents($url,false,$context);
    $data=$raw===false?null:json_decode($raw,true);
    return is_array($data)?$data:null;
}
function systemsOverview(): array {
    return [
        'cloud'=>systemsFetch('https://app.veniux.com/health'),
        'chat'=>systemsFetch('https://veniux.com/api/destek/durum'),
        'sectors'=>[
            ['hardware','Hırdavat','RETAIL_HIRDAVAT','Telefonla ürün arama, raf ve koridor, kritik stok uyarısı',1788],
            ['tableware','Züccaciye','RETAIL_ZUCCACIYE','Takım eşleme, hassas raf etiketi, etiket yazdırma',1788],
            ['restaurant','Pide ve restoran','RETAIL_PIDE','Garson modu, mutfak ekranı, reçeteli stok, esnaf paneli',2988],
        ],
        'plans'=>[
            'Perakende'=>['Retail Start','Retail Pro','Retail Business'],
            'Depo'=>['Warehouse Start','Warehouse Pro','Warehouse Enterprise'],
            'Birleşik'=>['Unified','Başlangıç','İşletme','Kurumsal'],
            'Sektör'=>['Hırdavat','Züccaciye','Pide ve Restoran'],
        ],
    ];
}
