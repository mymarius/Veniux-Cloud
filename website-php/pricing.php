<?php
declare(strict_types=1);
// Public quotation catalogue. Existing application licences are managed separately.
function sitePlans(): array {
    return [
        // license: uygulamadaki paket kodu (backend/src/config/productPackages.json). Özellik listesi o paketin gerçekten açtığı işlevlerdir.
        'baslangic'=>['name'=>'Başlangıç','license'=>'UNIFIED_START','tag'=>'Tek mağaza veya depo, küçük ekip.','description'=>'Kasası ve deposu olan tek noktalı işletmeler için.','quarter'=>1188,'annual'=>3588,'warehouses'=>1,'users'=>5,'devices'=>3,'features'=>['Barkodlu kasa: nakit, kart ve parçalı ödeme (1 kasa)','Kampanyalar: X al Y öde, yüzde indirim, tarih aralığı','Ürün ve barkod kataloğu, stok hareketleri ve mal kabul','Lot ve miat görünümü, ürün partileri ve tarih kontrolü','Sipariş önerisi ve tedarikçiye sipariş belgesi (PDF, e-posta, WhatsApp)','Kritik stok, miat, sayım farkı ve kayıp şüphesi uyarıları','Sipariş toplama kayıtları; firma ve kullanıcı yetkileri']],
        'isletme'=>['name'=>'İşletme','license'=>'UNIFIED_BUSINESS','tag'=>'Birkaç şube, geniş ekip.','description'=>'Birden fazla şube veya depo ve daha geniş ekipler için.','quarter'=>2388,'annual'=>7188,'warehouses'=>3,'users'=>15,'devices'=>10,'features'=>['Başlangıç paketindeki her şey (3 kasa)','Veresiye ve cari hesap, vade hatırlatması','Sadakat kartı ve puan','Kâr/zarar, kasiyer bazlı satış ve saatlik yoğunluk raporları','İşletme asistanı','Depolar arası transfer, şube karşılaştırması ve şube bazında erişim kısıtı']],
        'kurumsal'=>['name'=>'Kurumsal','license'=>'UNIFIED_ENTERPRISE','tag'=>'Çok şube, çok kullanıcı.','description'=>'Çok şubeli ve çok depolu operasyonlar için.','quarter'=>4788,'annual'=>14388,'warehouses'=>50,'users'=>250,'devices'=>100,'features'=>['İşletme paketindeki her şey (50 kasa)','Daha yüksek depo, kullanıcı ve cihaz sınırları','Geniş ekiplerle ortak çalışma alanı']],
    ];
}
function sitePlanSelection($value): ?array {
    if (!is_string($value) || !preg_match('/^(baslangic|isletme|kurumsal):(uc-aylik|yillik)$/D',$value,$match)) return null;
    $plan=sitePlans()[$match[1]];
    return ['code'=>$value,'name'=>$plan['name'],'period'=>$match[2]==='yillik'?'Yıllık (12 ay)':'3 aylık','amount_try'=>$plan[$match[2]==='yillik'?'annual':'quarter'],'tax'=>'%20 KDV dahil'];
}
// Depo, kullanıcı ve cihaz ihtiyacının üçünü de karşılayan en küçük paket; hiçbiri yetmezse null.
function sitePlanFor(int $warehouses, int $users, int $devices): ?string {
    foreach (sitePlans() as $code=>$plan) if ($warehouses<=$plan['warehouses'] && $users<=$plan['users'] && $devices<=$plan['devices']) return $code;
    return null;
}
function siteCount($value): ?int {
    if (!is_string($value)) return null;
    $number=filter_var($value,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>100000]]);
    return $number===false?null:$number;
}
function siteMoney(int $amount): string { return number_format($amount,0,',','.').' ₺'; }
