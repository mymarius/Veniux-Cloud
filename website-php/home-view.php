<?php declare(strict_types=1); ?>
<section class="vs-intro vs-wrap">
  <h1>Market ve depolar için stok programı.</h1>
  <p class="vs-lead">Veniux; ürünlerinizi, depolarınızı ve kasanızı aynı kayıtta tutar. Kasadan çıkan ürün stoktan düşer, sayımda eksik çıkan ürün yöneticinin önüne gelir, biten ürün bitmeden sipariş listesine girer.</p>
  <p class="vs-cta"><a class="vs-btn" href="/?request_type=demo#iletisim">Demo isteyin</a> <a href="/program-indir">Windows ve Android için indirin</a></p>
</section>
<figure class="vs-shot vs-shot-wide vs-wrap">
  <img src="/assets/shot-overview.jpg" width="1500" height="900" alt="Veniux genel bakış ekranı: stok değeri, kritik ürünler ve stok sağlığı" fetchpriority="high">
  <figcaption>Programın kendi ekranı. İşletme ve ürünler örnek veridir.</figcaption>
</figure>

<section class="vs-feature vs-wrap" id="ozellikler">
  <div>
    <h2>Hangi ürün ne zaman biter?</h2>
    <p>Veniux son 30 gündeki çıkışa ve tedarikçinin teslim süresine bakar, ürünün kaç günde biteceğini hesaplar. Bir düğmeyle bunlar tedarikçi başına satın alma taslağına dönüşür. Siparişi yine siz onaylarsınız, program kimseye kendiliğinden sipariş geçmez.</p>
    <p class="vs-note">Satış geçmişi az olan üründe hesap kaba kalır. Ekranda bunu ayrıca belirtiyoruz.</p>
  </div>
  <figure class="vs-shot"><img src="/assets/shot-products.jpg" width="1500" height="900" loading="lazy" alt="Ürün listesi: her ürünün stok miktarı, kritik uyarısı, barkodu ve fiyatı"></figure>
</section>

<section class="vs-feature vs-feature-flip vs-wrap">
  <div>
    <h2>Eksik çıkan mal sessizce kaybolmasın.</h2>
    <p>Sayımda fark çıkarsa ürün, adet ve yaklaşık tutar yöneticiye bildirilir. Rafı okutup ürünleri tek tek okuttukça sayaç artar; sayım kâğıtla dolaşmaz.</p>
    <p>Sayım dışında da elle yapılan büyük düşüşlere bakarız: açıklama yazılmamışsa, gece yapılmışsa ya da ürünün normal hızının çok üstündeyse uyarı gelir.</p>
    <p class="vs-note">Bu uyarı hırsızlığı kanıtlamaz, nereye bakacağınızı söyler. Hiç kaydedilmemiş bir kayıp ancak sayımda ortaya çıkar.</p>
  </div>
  <figure class="vs-shot"><img src="/assets/shot-movements.jpg" width="1500" height="900" loading="lazy" alt="Stok hareketleri: tarih, işlem türü, ürün, depo, miktar ve kaynak"></figure>
</section>

<section class="vs-feature vs-wrap" id="kasa">
  <div>
    <h2>Kasada elinizi klavyeden kaldırmayın.</h2>
    <p>Barkodu okutun, F6 ile ürün arayın, F8 ile ödemeyi alın. Nakit, kart, ikisi birden veya veresiye. Vardiya, gün sonu, iade, bekleyen satış ve fiyat sorgulama da aynı ekranda. İndirim ve fiyat değişikliği yönetici onayı ister.</p>
    <p><a href="/market-pos">Kasa hakkında daha fazlası</a></p>
  </div>
  <figure class="vs-shot"><img src="/assets/shot-pos.jpg" width="1500" height="900" loading="lazy" alt="Kasa ekranı: sepette üç ürün, ödenecek toplam ve ödeme düğmesi"></figure>
</section>

<section class="vs-wrap vs-block" id="moduller">
  <h2>İçinde başka neler var</h2>
  <dl class="vs-defs">
    <dt><a href="/depo-yonetimi">Depo</a></dt><dd>Mal kabul, raf yerleşimi, toplama, sevkiyat, depolar arası transfer.</dd>
    <dt><a href="/lot-miat-takibi">Lot ve miat</a></dt><dd>Aynı ürünün partilerini ayrı izleme, yaklaşan son kullanma tarihleri.</dd>
    <dt><a href="/barkodlu-stok-takibi">Barkod ve etiket</a></dt><dd>Barkodla ürün bulma, raf ve ürün etiketi yazdırma.</dd>
    <dt><a href="/el-terminali-depo-yonetimi">El terminali</a></dt><dd>Android telefon veya terminalle depoda işlem.</dd>
    <dt>Müşteri ve ekip</dt><dd>Fırsatlar, şirketler, kişiler, görevler ve personel kayıtları.</dd>
    <dt><a href="/yapay-zeka">Asistan</a></dt><dd>Kayıtlarınız hakkında Türkçe soru sorarsınız. İşlem önerirse onayınızı bekler.</dd>
  </dl>
</section>

<section class="vs-wrap vs-block">
  <h2>Veniux size uygun olmayabilir</h2>
  <p class="vs-measure">Şunları arıyorsanız bugün başka bir program daha doğru olur, başlamadan söyleyelim:</p>
  <ul class="vs-plain">
    <li>Trendyol, Hepsiburada gibi pazaryerleriyle hazır çalışan bir entegrasyon. Trendyol üzerinde çalışıyoruz, henüz gerçek mağazada denenmedi.</li>
    <li>Tam muhasebe ve bordro. Veniux stok, depo ve kasa programıdır; muhasebe programının yerine geçmez.</li>
    <li>iPhone uygulaması. Şimdilik Windows ve Android var.</li>
  </ul>
</section>

<section class="vs-wrap vs-block" id="fiyatlandirma">
  <h2>Fiyat</h2>
  <div class="vs-table-scroll"><table class="vs-table">
    <thead><tr><th scope="col">Paket</th><th scope="col">Yıllık</th><th scope="col">3 aylık</th><th scope="col">Depo</th><th scope="col">Kullanıcı</th><th scope="col">Cihaz</th></tr></thead>
    <tbody><?php foreach(sitePlans() as $plan):?><tr><th scope="row"><?=e($plan['name'])?></th><td><?=number_format($plan['annual'],0,',','.')?> ₺</td><td><?=number_format($plan['quarter'],0,',','.')?> ₺</td><td><?=e((string)$plan['warehouses'])?></td><td><?=e((string)$plan['users'])?></td><td><?=e((string)$plan['devices'])?></td></tr><?php endforeach;?></tbody>
  </table></div>
  <p class="vs-note">Fiyatlara %20 KDV dahildir. <a href="/fiyatlandirma">Paketlerin farkları</a></p>
</section>

<section class="vs-wrap vs-block" id="sorular">
  <h2>Sık sorulanlar</h2>
  <div class="vs-qa">
    <h3>Mevcut ürünlerimi girmem gerekir mi?</h3><p>Hayır. Excel veya CSV dosyanızı yüklersiniz, sütunları eşleştirir ve önizlemeden sonra aktarırsınız.</p>
    <h3>Verilerim nerede duruyor?</h3><p>Windows kurulumunda kendi bilgisayarınızda veya ayrı bir sunucuda tutabilirsiniz. Seçenekler <a href="/sunucu-kurulumu">kurulum sayfasında</a>.</p>
    <h3>Tahminleri yapay zekâ mı yapıyor?</h3><p>Hayır, stok tahmini satış hızı ve teslim süresinden yapılan düz bir hesaptır. Yapay zekâ yalnızca asistanda kullanılır.</p>
    <h3>Hangi barkod okuyucu çalışır?</h3><p>Klavye gibi yazan okuyucular ve telefon kamerası kullanılabilir. Özel bir cihazınız varsa satın almadan önce bize sorun.</p>
  </div>
</section>
