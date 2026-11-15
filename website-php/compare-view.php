<?php declare(strict_types=1);
// Karşılaştırma sayfası: yalnız rakiplerin kendi sitelerinde yazanı aktarır. Tarihli, kaynaklı, iddiasız.
// "—" sayfada belirtilmemiş demektir; özelliğin olmadığı anlamına gelmez. Veniux sütunu kendi gerçek durumumuzdur.
$asOf='15 Kasım 2026';
$plans=sitePlans();
$vPrice=fn(string $k)=>siteMoney($plans[$k]['annual']);
$prices=[
 ['Veniux Cloud','Başlangıç '.$vPrice('baslangic').' · İşletme '.$vPrice('isletme').' · Kurumsal '.$vPrice('kurumsal').'’den','Yıllık (3 aylık seçenek var)','KDV dahil','Sektör paketleri (hırdavat, züccaciye, restoran) genel pakete ek.'],
 ['BenimPOS','Ücretsiz Lite · 5.949,90 ₺ yıllık · 11.749,90 ₺ ömür boyu masaüstü','Yıllık, aylık (749,90 ₺) ya da tek ödeme','KDV dahil yazıyor','Sayfada ayrıca KDV muafiyetinden söz ediliyor.'],
 ['AysimaPOS','7.500 ₺','Yıllık','KDV dahil','30 gün deneme yazıyor.'],
 ['BarkodSis','Eko 16.500 · Standart 32.000 · Pro 58.000 ₺','Tek ödeme, süresiz lisans (masaüstü)','KDV dahil','Teknik destek ayrı satılıyor.'],
 ['Hesapbilir','Ofis 10.000 · Ofis Pos 65.000 ₺','Yıllık','KDV hariç','15 gün deneme yazıyor. Ön muhasebe ağırlıklı.'],
 ['Bizim Hesap','Temel Ticaret 8.352 · Tam Ticaret 10.560 ₺','Yıllık (yeni abone kampanyası)','KDV hariç','Normal fiyat 10.440 ve 13.200 ₺ + KDV. Ön muhasebe ağırlıklı.'],
 ['KolayBi Ofis','Standart 10.800 · PLUS 12.000 ₺','Yıllık (aylık seçenek de var)','KDV dahil','Ön muhasebe ağırlıklı.'],
 ['Paraşüt','9.024 ₺','Yıllık, ilk yıl kampanyası (31.12.2026’ya kadar)','KDV hariç','Ön muhasebe ağırlıklı.'],
];
$cols=['Veniux','BenimPOS','AysimaPOS','BarkodSis','Hesapbilir'];
$rows=[
 ['Çevrimdışı satış',                    ['Var, sınırlı','Var (masaüstü)','Yok (geçici sepet)','—','—']],
 ['Yazarkasa (ÖKC) entegrasyonu',        ['Yok (planlanıyor)','Var','Yok','Var','Var']],
 ['e-Arşiv / e-Fatura',                  ['Yok (planlanıyor)','e-Fatura var','Var','e-Fatura var','Var']],
 ['Lot / son kullanma tarihi takibi',    ['Var','SKT takibi var','—','Pro ve Plus’ta SKT','—']],
 ['Raf etiketi basımı',                  ['Var','Var','—','Var','—']],
 ['Restoran: masa ve adisyon',           ['Var (ek paket)','—','—','—','Var']],
 ['Birden çok depo veya şube',           ['Var','Şube yönetimi var','Çoklu şube var','Opsiyonel','—']],
 ['Telefon kamerasıyla barkod',          ['Var (Android)','Var','—','—','—']],
];
$sources=[
 ['BenimPOS','https://www.benimpos.com/fiyatlandirma/'],['AysimaPOS','https://aysimapos.com/'],['BarkodSis','https://www.barkodsis.com/paketler'],
 ['Hesapbilir','https://www.hesapbilir.com/fiyatlar'],['Bizim Hesap','https://bizimhesap.com/fiyatlar'],['KolayBi','https://www.kolaybi.com/fiyatlar'],['Paraşüt','https://www.parasut.com/on-muhasebe-fiyatlari'],
];
?>
<article class="cm-page">
<section class="hx-hero"><div class="hx-wrap">
  <h1>Stok ve kasa programlarını yan yana görün.</h1>
  <p class="hx-lead">Hangi programın size uyduğu işinize bağlı. Bu sayfada rakiplerin kendi sitelerinde yazan fiyat ve özellikleri, kaynağıyla ve tarihiyle topladık; kendi eksiklerimizi de gizlemedik.</p>
  <p class="cm-asof"><b><?=e($asOf)?></b> tarihinde okunan bilgilerdir. Fiyatlar ve özellikler değişebilir; karar vermeden önce ilgili sitelere bakın.</p>
</div></section>

<section class="hx-plain"><div class="hx-wrap">
  <h2>Fiyat ve model</h2>
  <div class="cm-scroll" tabindex="0" role="region" aria-label="Fiyat karşılaştırma tablosu">
  <table class="cm-table">
    <thead><tr><th scope="col">Program</th><th scope="col">Fiyat (₺)</th><th scope="col">Model</th><th scope="col">KDV</th><th scope="col">Not</th></tr></thead>
    <tbody><?php foreach($prices as $i=>$r):?><tr<?=$i===0?' class="cm-us"':''?>><th scope="row"><?=e($r[0])?></th><td><?=e($r[1])?></td><td><?=e($r[2])?></td><td><?=e($r[3])?></td><td><?=e($r[4])?></td></tr><?php endforeach;?></tbody>
  </table></div>
  <p class="cm-foot">Fiyatları yalnızca sayısal olarak yan yana koymak yanıltıcı olabilir: KDV, dönem ve pakete neyin dahil olduğu programdan programa değişiyor. Tek ödemeli masaüstü lisansla yıllık bulut aboneliği aynı şey değildir.</p>
</div></section>

<section class="hx-plain"><div class="hx-wrap">
  <h2>Özellikler</h2>
  <p class="hx-lead">Her hücre, o programın fiyat ya da paket sayfasında yazana göre doldurulmuştur. <b>—</b>, sayfada belirtilmemiş demektir; özelliğin olmadığını göstermez. Ön muhasebe ağırlıklı programlar (Bizim Hesap, KolayBi, Paraşüt) kasa ve depo odağında olmadığı için bu tabloya alınmadı.</p>
  <div class="cm-scroll" tabindex="0" role="region" aria-label="Özellik karşılaştırma tablosu">
  <table class="cm-table cm-feat">
    <thead><tr><th scope="col">Özellik</th><?php foreach($cols as $k=>$c):?><th scope="col"<?=$k===0?' class="cm-us"':''?>><?=e($c)?></th><?php endforeach;?></tr></thead>
    <tbody><?php foreach($rows as $r):?><tr><th scope="row"><?=e($r[0])?></th><?php foreach($r[1] as $k=>$v):?><td<?=$k===0?' class="cm-us"':''?>><?=e($v)?></td><?php endforeach;?></tr><?php endforeach;?></tbody>
  </table></div>
</div></section>

<section class="hx-plain"><div class="hx-wrap">
  <h2>Kim için hangisi?</h2>
  <div class="hx-qa hx-qacards">
    <div><p><b>Veniux size uyabilir:</b> depo, raf, lot ve son kullanma tarihini kasayla aynı yerde tutmak istiyorsanız; hırdavat, züccaciye ya da pide/restoran gibi bir sektörün ayrıntısı (koli ve birim, takım ve set, masa ve reçete) önemliyse; birden çok şube ya da depo varsa.</p></div>
    <div><p><b>Başka bir program daha uygun olabilir:</b> yazarkasa (ÖKC) ya da e-Arşiv ve e-Fatura işlemlerini aynı programdan yapmanız gerekiyorsa. Veniux’ta bunlar şu an yok, yol haritasında. Yalnızca ücretsiz ya da tek ödemeli bir masaüstü kasa arıyorsanız da bazı rakipler orada daha ucuz.</p></div>
    <div><p><b>Birlikte de kullanılır:</b> yasal fişinizi yazarkasanızdan kesmeye devam edip adisyon, mutfak ve stok için Veniux’u kullanabilirsiniz. Yükümlülüğünüzü mali müşavirinizle netleştirin.</p></div>
    <div><p><b>Denemek ücretsiz:</b> kendi ürünlerinizle 14 günlük deneme hesabı açın, kasayı ve stoku birlikte görün.</p></div>
  </div>
  <p class="hx-cta"><a class="hx-btn" href="/deneme">14 gün deneyin</a><a class="hx-textlink" href="/fiyatlandirma#hesapla">Toplam maliyeti hesaplayın</a></p>
</div></section>

<section class="hx-plain"><div class="hx-wrap">
  <h2>Kaynaklar</h2>
  <p class="cm-foot">Bilgiler <?=e($asOf)?> tarihinde aşağıdaki sayfalardan okundu. Yanlış ya da eski bir bilgi görürseniz <a href="/#iletisim">bize yazın</a>, düzeltelim.</p>
  <ul class="cm-sources"><?php foreach($sources as $s):?><li><a href="<?=e($s[1])?>" rel="noopener nofollow" target="_blank"><?=e($s[0])?></a></li><?php endforeach;?></ul>
</div></section>
</article>
