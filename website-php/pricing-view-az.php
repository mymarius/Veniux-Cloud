<?php declare(strict_types=1);
// Azərbaycan üçün qiymət səhifəsi. Azərbaycan qiymətləri hələ təsdiqlənməyib: Türkiyə TL qiymətləri və KDV bu səhifədə göstərilmir.
require_once __DIR__.'/lib/i18n.php';
require_once __DIR__.'/whatsapp.php';
?>
<section class="hx-plain hx-rates hx-az-price">
  <div class="hx-wrap">
    <h1>Qiymətlər</h1>
    <p class="hx-lead">Kassanız, stokunuz və anbarınız üçün sadə paketlər.</p>
    <p>Azərbaycan üçün qiymətlər hələ açıqlanmayıb və müraciət əsasında müəyyən edilir. İşinizə, anbar və kassa sayınıza uyğun paketi birlikdə seçək; kapsam, ödəniş və lisansın başlanğıcı danışıqda dəqiqləşir.</p>
    <ul class="hx-list">
      <li>30 gün pulsuz sınaq: bütün imkanlar açıqdır, bank kartı istənmir.</li>
      <li>Mal qəbulu, rəf, sayım, kassa və hesabatlar bir proqramda.</li>
      <li>Əlavə qurğu (barkod oxuyucu, printer, tərəzi) qiymətə daxil deyil.</li>
    </ul>
    <p class="hx-aside">Azərbaycanda satış üçün qanuni kassa (nəzarət-kassa aparatı) tələbləri ayrıca araşdırılır; bu proqram hazırda qanuni kassa qəbzinin yerinə keçmir.</p>
    <p class="hx-cta"><a class="hx-btn" href="<?=VENIUX_TRIAL_URL?>">30 gün pulsuz sınayın</a> <a class="hx-btn hx-btn-wa" href="<?=e(whatsappUrl())?>" target="_blank" rel="noopener noreferrer">WhatsApp-dan yazın</a> <a class="hx-btn hx-btn-ghost" href="<?=e(vxLink('/'))?>#iletisim">Bizə yazın</a></p>
  </div>
</section>
