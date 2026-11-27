<?php
// Ana sayfa: 50 saniyelik dikey tanıtım filmi ve adım adım görseller.
// Ekranlar Veniux'un gerçek arayüzünden; işletme ve ürünler kurgusal örnek kayıtlardır.
$filmSteps = [
  ['Kasa', 'Barkodla satış; “3 al 2 öde” kampanyası kendiliğinden uygulanır.'],
  ['Ödeme', 'Nakit, kart, parçalı ya da veresiye; tek dokunuşla kayıt.'],
  ['Mal kabul', 'İrsaliyeyle karşılaştırılır, ürünler rafa yerleştirilir.'],
  ['Etiket', '100 × 40 mm raf etiketi, barkoduyla birlikte yazıcıya.'],
  ['Sayım', 'Eksik çıkarsa kayıtlı kalır, yönetici onayını bekler.'],
  ['Sipariş önerisi', 'Biten ürün için öneri hazır; siparişi siz onaylarsınız.'],
  ['Gün sonu', 'Satış, indirim, nakit ve kart tek raporda.'],
];
// [düğme adı, görsel, genişlik, yükseklik, başlık, açıklama, alternatif metin]
$tourShots = [
  ['Genel bakış', 'shot-overview.jpg', 1500, 900, 'Güne tek ekrandan bakın.', 'Stok değeri, dönem giriş ve çıkışı, kritik seviyedeki ürünler ve açık uyarılar.', 'Veniux genel bakış ekranı: stok değeri, uyarılar ve stok sağlığı'],
  ['Ürünler', 'shot-products.jpg', 1500, 900, 'Ürün listeniz derli toplu.', 'Stok miktarı, barkod, kategori ve fiyat aynı satırda. Excel ve CSV ile aktarılır.', 'Veniux ürün kataloğu ekranı: stok, barkod ve fiyat sütunları'],
  ['Kasa', 'shot-pos.jpg', 1500, 900, 'Barkodu okutun, ödemeyi alın.', 'Satılan ürün stoktan düşer. Bekletme, fiyat sorgulama ve iade aynı ekranda.', 'Veniux satış kasası ekranı: satış sepeti ve ödeme düğmesi'],
  ['Depo', 'product-warehouse-v4.jpg', 1914, 860, 'Her deponun stoğu ayrı.', 'Depoları ve içlerindeki ürünleri miktar ve maliyetiyle görün.', 'Veniux depo ekranı: iki depo ve depo envanteri'],
  ['Lot ve miat', 'product-lot-v4.jpg', 1914, 860, 'Tarihi yaklaşanı önceden görün.', 'Düşük stok, tükenen, tarihi yaklaşan ve tarihi geçmiş kayıtlar tek panelde.', 'Veniux stok ve lot takibi paneli'],
  ['Stok hareketleri', 'shot-movements.jpg', 1500, 900, 'Neyin ne zaman değiştiği kayıtlı.', 'Giriş, çıkış ve transferler tarih sırasıyla listelenir.', 'Veniux stok hareketleri ekranı'],
  ['Sayım', 'product-count-v1.jpg', 1366, 768, 'Barkod okutarak sayın.', 'Rafı veya ürünü okutun, sayılan miktarı girin, farkı inceleyin.', 'Veniux stok sayımı ekranı'],
];
?>
<section class="hx-film" id="tanitim" aria-labelledby="film-title">
  <div class="hx-wrap hx-film-grid">
    <div class="hx-film-copy">
      <p class="hx-film-eyebrow">50 SANİYEDE VENIUX</p>
      <h2 id="film-title">Bir marketin günü, <em>tek ekranda.</em></h2>
      <p class="hx-film-lead">Kasadan gün sonuna yedi adım. Ekranlar Veniux’un gerçek arayüzünden; işletme ve ürünler kurgusal örnek kayıtlardır.</p>
      <ol class="hx-film-steps">
        <?php foreach ($filmSteps as $i => [$name, $text]): ?>
        <li><span><?= str_pad((string)($i + 1), 2, '0', STR_PAD_LEFT) ?></span><div><b><?= e($name) ?></b><p><?= e($text) ?></p></div></li>
        <?php endforeach; ?>
      </ol>
      <p class="hx-cta"><a class="hx-btn" href="/?request_type=demo#iletisim">Demo isteyin</a></p>
    </div>
    <div class="hx-film-phone">
      <video controls playsinline preload="none" width="720" height="1280" poster="/assets/veniux-tanitim-poster-v1.webp" aria-describedby="film-title">
        <source src="/assets/veniux-tanitim-v1.mp4" type="video/mp4">
        <track kind="captions" srclang="tr" label="Türkçe" src="/assets/veniux-tanitim-v1.tr.vtt" default>
        Tarayıcınız video oynatmayı desteklemiyor. <a href="/assets/veniux-tanitim-v1.mp4">Videoyu indirin</a>.
      </video>
      <p class="hx-film-note">Türkçe seslendirme ve altyazı · Örnek veri</p>
    </div>
  </div>
  <div class="hx-wrap">
    <h3 class="hx-film-gal-title">Ekranlara yakından bakın</h3>
    <p class="hx-tour-note">Ekranlar Veniux arayüzünden; işletme ve ürünler örnek kayıtlardır. Büyütmek için görsele dokunun.</p>
    <div class="hx-tour" role="group" aria-label="Ekran turu">
      <?php foreach ($tourShots as $i => $shot): ?><input type="radio" name="hx-tour" id="hx-tour-<?= $i ?>"<?= $i === 0 ? ' checked' : '' ?>><?php endforeach; ?>
      <div class="hx-tour-tabs">
        <?php foreach ($tourShots as $i => $shot): ?><label for="hx-tour-<?= $i ?>"><?= e($shot[0]) ?></label><?php endforeach; ?>
      </div>
      <div class="hx-tour-panels">
        <?php foreach ($tourShots as $i => [$tab, $file, $w, $h, $title, $text, $alt]): ?>
        <figure>
          <a href="/assets/<?= e($file) ?>" target="_blank" rel="noopener"><img src="/assets/<?= e($file) ?>" width="<?= $w ?>" height="<?= $h ?>" loading="lazy" decoding="async" alt="<?= e($alt) ?>"></a>
          <figcaption><b><?= e($title) ?></b><span><?= e($text) ?></span></figcaption>
        </figure>
        <?php endforeach; ?>
      </div>
    </div>
  </div>
</section>
