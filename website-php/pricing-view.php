<?php $annual=($_GET['donem']??'yillik')!=='uc-aylik'; $period=$annual?'yillik':'uc-aylik'; $plans=sitePlans(); ?>
<section class="pricing-intro wrap">
 <p class="eyebrow"><span class="status-dot"></span> DAHA NET BİR BÜTÇE</p>
 <h1>Depo sayınıza göre fiyat.</h1>
 <p>İhtiyacınız kadar alan seçin. Üç aylık başlayın veya yıllık planla kullanım maliyetinizi azaltın.</p>
 <div class="billing-switch" aria-label="Plan süresi">
  <a href="/fiyatlandirma?donem=uc-aylik#planlar" <?=$annual?'':'aria-current="true"'?>>3 aylık</a>
  <a href="/fiyatlandirma?donem=yillik#planlar" <?=$annual?'aria-current="true"':''?>>Yıllık <span>Daha avantajlı</span></a>
 </div>
 <p class="billing-caption">Aşağıdaki tutarlar <?=$annual?'12 aylık':'3 aylık'?> toplam kullanım bedelidir. %20 KDV dahildir.</p>
</section>
<section class="wrap pricing-section" id="planlar" aria-label="<?=$annual?'Yıllık':'3 aylık'?> paketler">
 <div class="pricing-grid">
 <?php foreach($plans as $code=>$plan): $amount=$plan[$annual?'annual':'quarter']; $saving=$plan['quarter']*4-$plan['annual']; ?>
 <article class="price-card <?=$code==='isletme'?'price-featured':''?>">
  <div class="price-card-top"><span class="eyebrow"><?=e($plan['name'])?></span><span class="plan-number"><?=$code==='baslangic'?'01':($code==='isletme'?'02':'03')?></span></div>
  <h2><?=e($plan['tag'])?></h2><p class="plan-description"><?=e($plan['description'])?></p>
  <div class="price-amount"><?=siteMoney($amount)?><span>/ <?=$annual?'yıl':'3 ay'?></span></div>
  <p class="price-equivalent">Aylık karşılığı <?=number_format($amount/($annual?12:3),2,',','.')?> ₺ (KDV dahil)</p>
  <p class="price-saving"><?=$annual?siteMoney($saving).' yıllık tasarruf':'Daha kısa süreyle başlayın'?></p>
  <a class="button <?=$code==='isletme'?'light':'primary'?>" href="/fiyatlandirma?donem=<?=$period?>&plan=<?=$code?>%3A<?=$period?>#iletisim"><?=e($plan['name'])?> için görüşelim <span aria-hidden="true">↗</span></a>
  <div class="plan-limits"><span><strong><?=$plan['warehouses']?></strong> depo</span><span><strong><?=$plan['users']?></strong> kullanıcı</span><span><strong><?=$plan['devices']?></strong> cihaz</span></div>
  <ul class="plan-features"><?php foreach($plan['features'] as $feature):?><li><span aria-hidden="true">✓</span><?=e($feature)?></li><?php endforeach;?></ul>
 </article>
 <?php endforeach;?>
 </div>
 <p class="pricing-terms">Yıllık tasarruf, aynı paketin dört adet 3 aylık dönem toplamına göre hesaplanır. Online ödeme alınmaz; kapsam, ödeme ve lisans başlangıcı görüşmede netleştirilir. Yenileme için yeniden teklif verilir.</p>
</section>
<section class="wrap pricing-compare section">
 <div class="section-top"><p class="eyebrow">İHTİYACINIZI KARŞILAŞTIRIN</p><h2>Paketler yan yana</h2></div>
 <div class="comparison-scroll" tabindex="0" role="region" aria-label="Paket karşılaştırması, yatay kaydırılabilir"><table class="pricing-table"><caption>Paket kapsamları</caption><thead><tr><th scope="col">Kapsam</th><?php foreach($plans as $plan):?><th scope="col"><?=e($plan['name'])?></th><?php endforeach;?></tr></thead><tbody>
 <?php foreach(['warehouses'=>'Depo sayısı','users'=>'Kullanıcı sayısı','devices'=>'Cihaz sayısı'] as $key=>$label):?><tr><th scope="row"><?=$label?></th><?php foreach($plans as $plan):?><td><?=$plan[$key]?></td><?php endforeach;?></tr><?php endforeach;?>
 <tr><th scope="row">Ürün, stok ve mal kabul</th><td>Dahil</td><td>Dahil</td><td>Dahil</td></tr><tr><th scope="row">Android bağlantısı</th><td>3 cihaz sınırı içinde</td><td>10 cihaz sınırı içinde</td><td>100 cihaz sınırı içinde</td></tr>
 </tbody></table></div>
 <p class="pricing-terms">Cihaz uyumluluğu kullanılan donanımda doğrulanır. Donanım, barındırma ve özel veri aktarımı bu fiyatlara dahil değildir.</p>
</section>
<?php require __DIR__."/guide-view.php"; ?><section class="section wrap faq pricing-faq"><div><p class="eyebrow">PLANLAR HAKKINDA</p><h2>Sık sorulanlar</h2></div><div class="faq-list">
 <details><summary>3 aylık ve yıllık plan arasında ne fark var?<span>+</span></summary><p>Aynı paket için özellikler ve sınırlar aynıdır. Kullanım süresi ve toplam bedel değişir. Yıllık planın avantajı dört adet 3 aylık dönem toplamıyla karşılaştırılır.</p></details>
 <details><summary>Buradan ödeme yapabilir miyim?<span>+</span></summary><p>Şu anda bu sayfadan ödeme alınmaz. Paket seçiminiz görüşme talebine eklenir. Lisans ve ödeme koşulları birlikte netleştirilir; kendiliğinden abonelik başlatılmaz.</p></details>
 <details><summary>Fiyatlara hangi hizmetler dahil değildir?<span>+</span></summary><p>Bu fiyatlar belirtilen süre ve sınırlar için yazılım kullanımını kapsar. Donanım, barındırma ve özel veri aktarımı ayrıca değerlendirilir.</p></details>
 <details><summary>İhtiyacım değişirse ne olur?<span>+</span></summary><p>Depo ve kullanıcı ihtiyacınızı görüşerek uygun paketi yeniden belirleyebiliriz. Geçiş tarihi, süre ve ücret farkı yeni teklifte açıkça belirtilir.</p></details>
</div></section>
