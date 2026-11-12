<?php
declare(strict_types=1);
// Public quotation catalogue. Existing application licences are managed separately.
function sitePlans(): array {
    return [
        // license: uygulamadaki paket kodu (backend/src/config/productPackages.json). Özellik listesi o paketin gerçekten açtığı işlevlerdir.
        'baslangic'=>['name'=>'Başlangıç','license'=>'UNIFIED_START','tag'=>'Tek mağaza veya depo, küçük ekip.','description'=>'Kasası ve deposu olan tek noktalı işletmeler için.','quarter'=>2628,'annual'=>8388,'warehouses'=>1,'users'=>5,'devices'=>3,'features'=>['Barkodlu kasa: nakit, kart ve parçalı ödeme (1 kasa)','Kampanyalar: X al Y öde, yüzde indirim, tarih aralığı','Ürün ve barkod kataloğu, stok hareketleri ve mal kabul','Lot ve miat görünümü, ürün partileri ve tarih kontrolü','Sipariş önerisi ve tedarikçiye sipariş belgesi (PDF, e-posta, WhatsApp)','Kritik stok, miat, sayım farkı ve kayıp şüphesi uyarıları','Sipariş toplama kayıtları; firma ve kullanıcı yetkileri']],
        'isletme'=>['name'=>'İşletme','license'=>'UNIFIED_BUSINESS','tag'=>'Birkaç şube, geniş ekip.','description'=>'Şubesi olan, veresiye çalışan veya müşteri sadakatine önem veren işletmeler için.','quarter'=>6744,'annual'=>21588,'warehouses'=>3,'users'=>15,'devices'=>10,'features'=>['Başlangıç paketindeki her şey (3 kasa)','Öncelikli destek: acil kasa sorununda 2 saat içinde ilk yanıt','Veresiye ve cari hesap, vade hatırlatması','Sadakat kartı ve puan','Kâr/zarar, kasiyer bazlı satış ve saatlik yoğunluk raporları','İşletme asistanı','Depolar arası transfer, şube karşılaştırması ve şube bazında erişim kısıtı']],
        'kurumsal'=>['name'=>'Kurumsal','license'=>'UNIFIED_ENTERPRISE','tag'=>'Çok şube, çok kullanıcı.','description'=>'Çok şubeli ve çok depolu operasyonlar için.','quarter'=>null,'from'=>true,'annual'=>53988,'warehouses'=>50,'users'=>250,'devices'=>100,'features'=>['İşletme paketindeki her şey (50 kasa)','Kurulum ve veri aktarımı desteği','Kapsam büyüdükçe fiyat teklifle netleşir','Daha yüksek depo, kullanıcı ve cihaz sınırları','Geniş ekiplerle ortak çalışma alanı']],
    ];
}
function sitePlanSelection($value): ?array {
    if (is_string($value) && preg_match('/^(hirdavat|zuccaciye|pide):yillik$/D',$value,$pack)) {
        $names=['hirdavat'=>'Hırdavat paketi (ek)','zuccaciye'=>'Züccaciye paketi (ek)','pide'=>'Pide ve restoran paketi (ek)'];
        return ['code'=>$value,'name'=>$names[$pack[1]],'period'=>'Yıllık (12 ay)','amount_try'=>siteSectorPrices()[$pack[1]],'tax'=>'%20 KDV dahil'];
    }
    if (!is_string($value) || !preg_match('/^(baslangic|isletme|kurumsal):(uc-aylik|yillik)$/D',$value,$match)) return null;
    $plan=sitePlans()[$match[1]];
    // 3 aylık seçeneği olmayan paket (Kurumsal) yıllık teklif olarak alınır.
    if ($plan['quarter']===null) { $match[2]='yillik'; $value=$match[1].':yillik'; }
    return ['code'=>$value,'name'=>$plan['name'],'period'=>$match[2]==='yillik'?'Yıllık (12 ay)':'3 aylık','amount_try'=>$plan[$match[2]==='yillik'?'annual':'quarter'],'tax'=>'%20 KDV dahil'.(!empty($plan['from'])?' · başlayan fiyat':'')];
}
// Sektör paketleri: genel pakete ek, yıllık, KDV dahil. Uygulamadaki paket kodu: backend/src/config/productPackages.json.
// Fiyatın tek doğru kaynağı bulut paket kataloğudur (API Yönetim Merkezi). Katalogda sektör paketi fiyatı girilmişse site onu gösterir;
// katalog boşsa ya da ulaşılamıyorsa aşağıdaki varsayılanlar kullanılır. Son başarılı yanıt dosyada saklanır.
function siteCloudPrices(): ?array {
    static $result=false;
    if($result!==false)return $result;
    $result=null;
    $url=getenv('VENIUX_PRICES_URL')?:'https://app.veniux.com/api/public/prices';
    if($url==='off'||getenv('VENIUX_SITE_ENV')==='development')return $result;
    $file=getenv('VENIUX_PRICES_CACHE')?:dirname(__DIR__).'/.local/website-prices.json';
    $cached=is_file($file)?json_decode((string)@file_get_contents($file),true):null;
    if(is_array($cached)&&time()-(int)@filemtime($file)<900)return $result=$cached;
    $context=stream_context_create(['http'=>['timeout'=>3,'ignore_errors'=>true,'header'=>"Accept: application/json
User-Agent: veniux-site
"]]);
    $raw=@file_get_contents($url,false,$context);
    $data=$raw===false?null:json_decode($raw,true);
    if(is_array($data)&&is_array($data['sector']??null)){
        if(is_dir(dirname($file))||@mkdir(dirname($file),0700,true)){@file_put_contents($file,json_encode($data),LOCK_EX);@chmod($file,0600);}
        return $result=$data;
    }
    if(is_file($file))@touch($file);
    return $result=is_array($cached)?$cached:null;
}
function siteSectorPrices(): array {
    $prices=['hirdavat'=>21456,'zuccaciye'=>21456,'pide'=>35856];
    $keys=['hardware'=>'hirdavat','tableware'=>'zuccaciye','restaurant'=>'pide'];
    foreach((siteCloudPrices()['sector']??[]) as $item){
        $key=$keys[$item['pack']??'']??null;$cents=$item['annual_cents']??null;
        if($key&&is_int($cents)&&$cents>0&&$cents<=100000000)$prices[$key]=intdiv($cents,100);
    }
    return $prices;
}
// Ek kullanım (yıllık, KDV dahil). Kodda otomatik değil; teklifte lisans sınırı yükseltilir.
function siteAddOns(): array {
    return [['Ek kullanıcı (İşletme)',468],['Ek depo veya şube (İşletme)',2388],['Ek cihaz',348],['Ek kasa',1188]];
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
function sitePrice(array $plan, bool $annual): string { $amount=$plan[$annual?'annual':'quarter']; if ($amount===null) return 'Yalnız yıllık'; return siteMoney($amount).(!empty($plan['from'])?'’den':''); }
function siteMoney(int $amount): string { return number_format($amount,0,',','.').' ₺'; }
