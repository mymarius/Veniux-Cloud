<?php
// Randevu paketi (berber ve güzellik salonu). Ürün HENÜZ YOK: her yerde "hazırlanıyor" ve "planlanan" yazılır;
// satın alma, deneme ya da kesin tarih sunulmaz. Fiyat ön fiyattır.
require_once __DIR__.'/whatsapp.php';
$bkAsk = static fn(string $plan) => whatsappUrl('Merhaba, randevu paketi için ön kayıt istiyorum ('.$plan.'). Personel sayımız: ');
?>
<div class="pr-page">
<section class="ho-hero">
  <div class="hx-wrap">
    <h1 data-pr>Berber ve güzellik salonları için randevu paketi</h1>
    <p class="hx-lead" data-pr><b>Hazırlanıyor.</b> Bu paket henüz kullanıma açık değil. 2027’de birkaç salonla pilot yapmayı hedefliyoruz. İhtiyacınızı şimdiden yazın, paketi ona göre şekillendirelim.</p>
    <p class="ho-cta" data-pr><a class="hx-btn" href="<?=e($bkAsk('henüz seçmedim'))?>" target="_blank" rel="noopener noreferrer">WhatsApp’tan ön kayıt</a></p>
  </div>
</section>

<section class="pr-rack" id="paketler" aria-label="Planlanan paket">
  <div class="hx-wrap pr-tags pr-one">
    <article class="pr-tag" data-pr data-i="1" data-featured>
      <div class="pr-tag-top"><span>VENİUX · RANDEVU PAKETİ</span><span>HAZIRLANIYOR</span></div>
      <h2>Randevu</h2>
      <p class="pr-for">Berber ve güzellik salonları için tek paket. Tek şube, 10 personele kadar.</p>
      <div class="pr-price"><span>9.990</span><small> ₺</small></div>
      <p class="pr-period">/ yıl · KDV dahil · planlanan ön fiyat</p>
      <ul>
        <li>10 personele kadar takvim</li>
        <li>Hizmet, süre ve fiyat tanımı</li>
        <li>Elle randevu; çakışan saate izin vermeme</li>
        <li>Müşteri kaydı ve randevu geçmişi</li>
        <li>Salona özel ana panel</li>
        <li>Online randevu bağlantısı (ikinci aşama)</li>
      </ul>
      <div><a class="hx-btn" href="<?=e($bkAsk('Randevu'))?>" target="_blank" rel="noopener noreferrer">Ücretsiz ön kayıt</a></div>
    </article>
  </div>
  <p class="hx-wrap pr-terms" data-pr>Listelenen özelliklerin tamamı planlanmıştır ve değişebilir. Fiyat, paket kullanıma açılırken kesinleşir. Ön kayıt ücretsizdir, sizi bağlamaz; şu an ödeme alınmaz.</p>
</section>

<section class="ho-steps-sec" id="sonra">
  <div class="hx-wrap">
    <h2 data-pr>İlk sürümde olmayacaklar</h2>
    <ol class="ho-steps">
      <li data-pr data-i="0"><h3>WhatsApp mesajları ve sohbet botu</h3><p>Onay ve hatırlatma mesajlarını pilottan sonra ele alacağız. Resmî WhatsApp hizmetinin onay şartları ve mesaj ücretleri ayrıca vardır.</p></li>
      <li data-pr data-i="1"><h3>Kapora ve online ödeme</h3><p>Talebe göre sonra değerlendirilecek.</p></li>
      <li data-pr data-i="2"><h3>Bekleme listesi ve kampanya mesajları</h3><p>Talebe göre sonra değerlendirilecek.</p></li>
      <li data-pr data-i="3"><h3>Birden fazla şube</h3><p>İlk pakette tek şube hedefleniyor.</p></li>
    </ol>
  </div>
</section>
</div>
