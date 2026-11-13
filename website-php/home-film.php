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
$filmImages = [
  1 => 'Ürünler: Excel ve CSV ile ürün aktarımı, Veniux ürün kataloğu ekranı',
  2 => 'Mal kabul: IRS-2026-0142 irsaliyesi 36 / 36 tamamlandı, ürünler rafa yerleşti',
  3 => 'Etiket: 100 × 40 mm raf etiketi önizlemesi, filtre kahve 46,00 TL',
  4 => 'Kasa: barkodla satış sepeti, stok anında düşer',
  5 => 'Kampanya: 3 al 2 öde kampanyası 46 TL indirim uyguladı',
  6 => 'Ödeme: kartla 257,00 TL ödeme kaydı',
  7 => 'Sayım: sistemde 24, sayılan 19, yönetici onayı bekliyor',
  8 => 'Sipariş önerisi: düşük stoklu ürünler için önerilen miktarlar',
  9 => 'Gün sonu: net satış 3.260 TL, net nakit 3.003 TL, net kart 257 TL',
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
    <h3 class="hx-film-gal-title">Adım adım görseller</h3>
    <ul class="hx-film-gallery" tabindex="0" aria-label="Adım adım görseller, yatay kaydırılır">
      <?php foreach ($filmImages as $n => $alt): ?>
      <li><img src="/assets/tanitim-adim-<?= $n ?>-v1.webp" width="540" height="675" loading="lazy" decoding="async" alt="<?= e($alt) ?>"></li>
      <?php endforeach; ?>
    </ul>
  </div>
</section>
