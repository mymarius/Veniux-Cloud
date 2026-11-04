<?php
$examples = [
 '/stok-yonetimi' => ['Stok ve ürün takibi', 'Girişten kalan miktara kadar aynı ürünü izleyin.', [
  ['Ürün kaydını hazırlayın', 'Barkod, ürün adı ve birim bilgisini kontrol edin. Örnekte başlangıç stoku sıfır olan bir ürün kullanılıyor.'],
  ['Girişi ve çıkışı kaydedin', '24 adet mal kabulü ve 3 adet satış kaydı sonrasında, başka hareket yoksa kalan miktar 21 adettir. Ürün hareketlerini inceleyerek bu miktarın hangi kayıtlardan oluştuğunu görün.'],
  ['Envanteri karşılaştırın', 'Fiziksel sayımınız 20 adet gösteriyorsa fark 1 adettir. Hareket geçmişini ve sayım kayıtlarını inceleyin; farkın nedenini araştırmadan stok miktarını doğru kabul etmeyin.'],
 ], ['24 adet giriş', '3 adet çıkış', '21 adet kayıtlı stok'], 'Depo bazında envanter yönetimi, ürünün toplam miktarı kadar nerede bulunduğunu da anlamanıza yardımcı olur.'],
 '/depo-yonetimi' => ['Depolar arası ürün hareketi', 'Transferi, rafı ve sayımı birlikte değerlendirin.', [
  ['Mal kabulü kaydedin', 'Örnek üründen 40 adedi ana depoya kabul edin. Ürün ve miktarı kontrol edip raf veya lokasyon bilgisini kaydedin.'],
  ['Transferi takip edin', '12 adedi ikinci depoya transfer ettiğinizde kaynak ve hedef depo kayıtlarını inceleyin. Başka hareket yoksa ana depoda 28, ikinci depoda 12 adet bulunur.'],
  ['Depo miktarlarını doğrulayın', 'Transfer toplam envanteri artırmaz: iki depodaki toplam hâlâ 40 adettir. Sayımda farklı miktar görürseniz ilgili depo ve hareket kayıtlarını karşılaştırın.'],
 ], ['40 adet kabul', '12 adet transfer', '28 + 12 adet stok'], 'Depo ve raf kayıtları ürünün konumunu; hareket geçmişi ise miktarın nasıl değiştiğini gösterir.'],
 '/lot-miat-takibi' => ['Ürünlerde lot ve miat kontrolü', 'Aynı ürünün iki partisini ayrı ayrı inceleyin.', [
  ['Lotları ayrı kaydedin', 'Örnek ürünün A lotunda 12 kutu, B lotunda 18 kutu olduğunu düşünün. Her lotun miktarını ve ambalajdaki son kullanma tarihini kendi kaydında kontrol edin.'],
  ['Miat bilgisini karşılaştırın', 'A lotunun miadı B lotundan önceyse toplam 30 kutuya bakmak yeterli değildir. Lot bazında miktarı ve yaklaşan tarihleri inceleyerek kontrol edilecek partiyi belirleyin.'],
  ['Aktarım önizlemesini inceleyin', 'Excel veya CSV aktarımında ürün, barkod, miktar ve tarih sütunlarını eşleştirin. Önizlemede 12 ve 18 kutunun doğru lotlara bağlandığını kontrol edin; ay/yıl tarihleri için gösterilen dönüşüm kuralını onaylayın.'],
 ], ['A lotu · 12 kutu', 'B lotu · 18 kutu', 'Toplam · 30 kutu'], 'Lot ve miat görünümü stok kontrolünü destekler. Bu örnek genel ürün stoklarını anlatır; miktar ve tarihleri kendi kabul kayıtlarınızla kontrol edin.'],
];
$selectedExamples = $path === '/' ? $examples : (isset($examples[$path]) ? [$path => $examples[$path]] : []);
?>
<section class="section wrap use-cases" aria-labelledby="use-cases-title">
 <div class="section-top"><p class="eyebrow">PRATİK KULLANIM ÖRNEKLERİ</p><h2 id="use-cases-title">Bir iş günü.<br><em>Adım adım kayıtlar.</em></h2><p>Ürün takibi, envanter yönetimi ve lot kontrolünün günlük işlerde nasıl kullanılabileceğini inceleyin. Aşağıdaki miktarlar temsili örneklerdir; müşteri sonucu veya canlı program ekranı değildir.</p></div>
 <div class="use-case-grid">
 <?php foreach ($selectedExamples as $examplePath => [$title, $intro, $steps, $flow, $benefit]): ?>
  <article class="use-case-card">
   <h3><?=e($title)?></h3><p><?=e($intro)?></p>
   <figure class="use-case-flow"><figcaption>Örnek kayıt akışı</figcaption><ol><?php foreach($flow as $item):?><li><?=e($item)?></li><?php endforeach;?></ol></figure>
   <ol class="use-case-steps"><?php foreach($steps as [$stepTitle,$body]):?><li><h4><?=e($stepTitle)?></h4><p><?=e($body)?></p></li><?php endforeach;?></ol>
   <p class="use-case-benefit"><strong>Size ne sağlar?</strong> <?=e($benefit)?></p>
   <?php if($path==='/'):?><a class="text-link" href="<?=e($examplePath)?>">Çözümü ayrıntılı incele →</a><?php endif;?>
  </article>
 <?php endforeach;?>
 </div>
 <p class="guide-note">Kullanılabilir işlemler lisans ve kullanıcı yetkilerine bağlıdır. İşletmenizin dosyaları ve cihazlarıyla uygunluğu kurulum öncesinde değerlendirin.</p>
</section>
