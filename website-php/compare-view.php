<?php declare(strict_types=1);
// Program seçerken sayfası: firma adı vermez. Kategori bazında yaklaşık fiyat aralıkları ve her satıcıya sorulacak sorular;
// Veniux'un cevapları kendi gerçek durumumuzdur (eksikler dahil). Aralıklar, firmaların kendi sitelerinde yazan fiyatlardan derlendi.
$asOf='Kasım 2026';
$plans=sitePlans();
$vPrice=fn(string $k)=>siteMoney($plans[$k]['annual']);
$veniuxRange=sitePricingV2()?(function(){$d=sitePlansV2();$by=[];foreach($d['plans'] as $p)$by[$p['id']]=$p;return 'Pro '.siteMoney((int)$by['pro']['price_try']).' (3 aylık '.siteMoney((int)$by['pro']['quarter_try']).') · İşletme WMS '.siteMoney((int)$by['business_wms']['price_try']).' (3 aylık '.siteMoney((int)$by['business_wms']['quarter_try']).'), yıllık, KDV dahil';})():null;
$ranges=[
 ['Tek ödemeli masaüstü kasa programları','Yaklaşık 16.000 – 58.000 ₺, bir kez','Süresiz lisans; destek ve ek şube çoğunlukla ayrı ücretli. İnternet olmadan da çalışır.'],
 ['Bulut kasa programları (abonelik)','Yaklaşık 6.000 – 7.500 ₺, yıllık, KDV dahil','Tarayıcıdan ya da uygulamadan; bazılarının ücretsiz sınırlı bir sürümü var.'],
 ['Bulut ön muhasebe programları','Yaklaşık 8.000 – 12.000 ₺, yıllık, çoğunda KDV hariç','e-Fatura, cari ve banka odaklı; kasa ve depo derinliği sınırlı olabilir.'],
 ['Veniux Cloud',($veniuxRange??('Başlangıç '.$vPrice('baslangic').' · İşletme '.$vPrice('isletme').' · Kurumsal '.$vPrice('kurumsal').'’den, yıllık, KDV dahil')),'Kasa, depo, lot/miat ve sektör paketleri (hırdavat, züccaciye, restoran) ek.'],
];
$questions=[
 ['İnternet kesilince satış yapılır mı?','Evet, sınırlı: nakit ve kart satışı cihazda saklanır, bağlantı gelince gönderilir. İndirim, iade, veresiye ve sadakat çevrimdışıyken kapalı.'],
 ['Yazarkasa (ÖKC) ile çalışıyor mu?','Hayır, şu an yok; yol haritasında. Yasal fişi yazarkasanızdan kesmeye devam edersiniz.'],
 ['e-Arşiv ve e-Fatura kesiyor mu?','Hayır, şu an yok; yol haritasında.'],
 ['Lot ve son kullanma tarihi takibi var mı?','Evet, her pakette.'],
 ['Raf etiketi basabiliyor mu?','Evet, 100 × 40 mm raf etiketi.'],
 ['Restoran için masa, adisyon, mutfak ve reçeteli stok var mı?','Evet, Pide ve restoran paketinde (ek paket). Stok sipariş anında düşer.'],
 ['Birden çok depo ya da şube yönetilebilir mi?','Evet: İşletme WMS paketinde 3 depo; daha fazlası için teklif alın.'],
 ['Telefon kamerasıyla barkod okunur mu?','Evet, Android uygulamasında.'],
 ['Fiyata neler dahil, neler ayrı?','Fiyatlar KDV dahil ve yıllık sabit. Ek kullanıcı, depo, cihaz ve kasa ayrı; sektör paketleri genel pakete ek.'],
 ['Önce denenebilir mi?','Evet, kendi ürünlerinizle 30 günlük deneme hesabı.'],
];
?>
<article class="cm-page">
<section class="hx-hero"><div class="hx-wrap">
  <h1>Doğru programı seçmek için ne sormalı?</h1>
  <p class="hx-lead">Stok ve kasa programları birbirine benzer görünür, farklar ayrıntıda çıkar. Aşağıda piyasadaki türlerin yaklaşık fiyat aralıklarını ve her satıcıya sormanız gereken soruları, bizim cevaplarımızla birlikte yazdık. Eksiklerimizi de gizlemedik.</p>
  <p class="cm-asof"><b><?=e($asOf)?></b> itibarıyla firmaların kendi sitelerinde yazan fiyatlardan derlenmiş yaklaşık aralıklardır. KDV, dönem ve kapsam programdan programa değişir; karar vermeden önce satıcının güncel fiyatını isteyin.</p>
</div></section>

<section class="hx-plain"><div class="hx-wrap">
  <h2>Piyasada neler var, yaklaşık ne kadar?</h2>
  <div class="cm-scroll" tabindex="0" role="region" aria-label="Program türleri ve yaklaşık fiyatları">
  <table class="cm-table">
    <thead><tr><th scope="col">Tür</th><th scope="col">Yaklaşık fiyat</th><th scope="col">Kısaca</th></tr></thead>
    <tbody><?php foreach($ranges as $i=>$r):?><tr<?=$i===count($ranges)-1?' class="cm-us"':''?>><th scope="row"><?=e($r[0])?></th><td><?=e($r[1])?></td><td><?=e($r[2])?></td></tr><?php endforeach;?></tbody>
  </table></div>
  <p class="cm-foot">Fiyatları yalnızca sayısal olarak yan yana koymak yanıltıcı olabilir. Tek ödemeli masaüstü lisansla yıllık bulut aboneliği aynı şey değildir; hangisinin işinize uyduğu, kaç şubeniz olduğuna ve internete ne kadar güvendiğinize bağlıdır.</p>
</div></section>

<section class="hx-plain"><div class="hx-wrap">
  <h2>Her satıcıya sorun, biz de cevaplayalım</h2>
  <div class="cm-scroll" tabindex="0" role="region" aria-label="Sorular ve Veniux cevapları">
  <table class="cm-table cm-feat">
    <thead><tr><th scope="col">Soru</th><th scope="col" class="cm-us">Veniux’un cevabı</th></tr></thead>
    <tbody><?php foreach($questions as $q):?><tr><th scope="row"><?=e($q[0])?></th><td class="cm-us"><?=e($q[1])?></td></tr><?php endforeach;?></tbody>
  </table></div>
</div></section>

<section class="hx-plain"><div class="hx-wrap">
  <h2>Veniux kime uyar, kime uymaz?</h2>
  <div class="hx-qa hx-qacards">
    <div><p><b>Uyabilir:</b> depo, raf, lot ve son kullanma tarihini kasayla aynı yerde tutmak istiyorsanız; hırdavat, züccaciye ya da pide/restoran gibi bir sektörün ayrıntısı (koli ve birim, takım ve set, masa ve reçete) önemliyse; birden çok şube ya da depo varsa.</p></div>
    <div><p><b>Şimdilik uymayabilir:</b> yazarkasa (ÖKC) ya da e-Arşiv ve e-Fatura işlemlerini aynı programdan yapmanız gerekiyorsa. Bunlar yol haritasında. Yalnızca ücretsiz ya da tek ödemeli basit bir masaüstü kasa arıyorsanız da başka seçenekler daha ucuz olabilir.</p></div>
    <div><p><b>Birlikte de kullanılır:</b> yasal fişinizi yazarkasanızdan kesmeye devam edip adisyon, mutfak ve stok için Veniux’u kullanabilirsiniz. Yükümlülüğünüzü mali müşavirinizle netleştirin.</p></div>
    <div><p><b>Önce deneyin:</b> kendi ürünlerinizle 30 günlük deneme hesabı açın, kasayı ve stoku birlikte görün.</p></div>
  </div>
  <p class="hx-cta"><a class="hx-btn" href="<?=VENIUX_TRIAL_URL?>">30 gün deneyin</a><a class="hx-textlink" href="/fiyatlandirma#hesapla">Toplam maliyeti hesaplayın</a></p>
</div></section>
</article>
