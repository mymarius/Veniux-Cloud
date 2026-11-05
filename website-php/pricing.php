<?php
declare(strict_types=1);
// Public quotation catalogue. Existing application licences are managed separately.
function sitePlans(): array {
    return [
        'baslangic'=>['name'=>'Başlangıç','tag'=>'Tek depo, küçük ekip.','description'=>'Tek depolu işletmelerin ürün ve stok akışı için.','quarter'=>1188,'annual'=>3588,'warehouses'=>1,'users'=>5,'devices'=>3,'features'=>['Ürün ve barkod kataloğu','Stok hareketleri ve mal kabul','Sipariş toplama kayıtları','Firma ve kullanıcı yetkileri']],
        'isletme'=>['name'=>'İşletme','tag'=>'Birkaç depo, geniş ekip.','description'=>'Birden fazla depo ve daha geniş ekipler için.','quarter'=>2388,'annual'=>7188,'warehouses'=>3,'users'=>15,'devices'=>10,'features'=>['Başlangıç paketindeki özellikler','Depolar arası operasyon takibi','Lot ve miat görünümü','Ürün partileri ve tarih kontrolü']],
        'kurumsal'=>['name'=>'Kurumsal','tag'=>'Çok depo, çok kullanıcı.','description'=>'Çok depolu operasyonlar ve geniş ekipler için.','quarter'=>4788,'annual'=>14388,'warehouses'=>50,'users'=>250,'devices'=>100,'features'=>['İşletme paketindeki özellikler','Daha yüksek depo ve kullanıcı sınırları','Firma ve depo bazında erişim','Geniş ekiplerle ortak çalışma alanı']],
    ];
}
function sitePlanSelection($value): ?array {
    if (!is_string($value) || !preg_match('/^(baslangic|isletme|kurumsal):(uc-aylik|yillik)$/D',$value,$match)) return null;
    $plan=sitePlans()[$match[1]];
    return ['code'=>$value,'name'=>$plan['name'],'period'=>$match[2]==='yillik'?'Yıllık (12 ay)':'3 aylık','amount_try'=>$plan[$match[2]==='yillik'?'annual':'quarter'],'tax'=>'%20 KDV dahil'];
}
function siteMoney(int $amount): string { return number_format($amount,0,',','.').' ₺'; }
