<?php
// Birleşik paket sayfası (Lite, Pro, Ömür Boyu, İşletme WMS + Restoran eklentisi). Veri: plans.json (shared/planMatrix.mjs'ten üretilir).
// Varsayılan KAPALI: VENIUX_PRICING_V2=1 olmadıkça yayınlanan sayfa değişmez. Açmadan önce: Lite, ömür boyu lisans, kartsız 30 gün deneme
// ve çevrimiçi ödeme uygulamada gerçekten çalışıyor olmalı (docs/PLAN-PAKET-VE-4-ADIM.md).
$data=sitePlansV2(); $plans=$data['plans']; $labels=$data['labels']; $trial=(int)$data['trial_days'];
$money=static fn($v)=>number_format((float)$v,0,',','.').' ₺';
$limit=static fn($v)=>$v===null?'Sınırsız':(string)$v;
// Kartlarda her paket yalnız bir önceki basamağın üstüne eklediklerini listeler (karşılaştırma tablosu tam listeyi verir).
$base=['pro'=>'lite','lifetime_desktop'=>'pro','business_wms'=>'pro']; $byId=[]; foreach($plans as $p)$byId[$p['id']]=$p;
?>
<div class="pr-page">
<section class="pr-hero">
  <div class="hx-wrap pr-hero-grid">
    <div>
      <p class="pr-eyebrow" data-pr>Fiyatlandırma</p>
      <h1 data-pr>Kasanız, stoğunuz ve deponuz için sade fiyat.</h1>
      <p class="hx-lead" data-pr>Küçük işletme için ücretsiz başlangıç, büyüyen işletme için tek lisans. Hırdavat ve züccaciye özellikleri ayrı paket değil; Pro ve üstünde zaten dahil. Cihaz veya personel başına ek ücret yok.</p>
    </div>
    <ul class="pr-trust" data-pr aria-label="Fiyatlandırma ilkeleri">
      <li><b>KDV dahil</b><span>Ödeyeceğiniz toplam tutar yazar.</span></li>
      <li><b><?=$trial?> gün deneme</b><span>Tüm özellikler açık, kredi kartı gerekmez.</span></li>
      <li><b>Verileriniz sizin</b><span>Süre bitince veri silinmez, Lite’a döner.</span></li>
    </ul>
  </div>
</section>

<section class="pr-rack" id="planlar" aria-label="Paketler">
  <div class="hx-wrap pr-tags">
  <?php foreach($plans as $n=>$plan): $free=$plan['price_try']===0; $once=$plan['period']==='once'; ?>
    <article class="pr-tag" data-pr data-i="<?=$n?>" <?=$plan['id']==='pro'?'data-featured':''?>>
      <?php if($plan['id']==='pro'):?><span class="pr-ribbon">En çok tercih edilen</span><?php endif;?>
      <div class="pr-tag-top"><span>VENİUX · PAKET 0<?=$n+1?></span><span><?=$free?'ÜCRETSİZ':($once?'TEK ÖDEME':'YILLIK')?></span></div>
      <h2><?=e($plan['name'])?></h2>
      <p class="pr-for"><?=e($plan['tagline'])?></p>
      <div class="pr-price"><span><?=number_format((float)$plan['price_try'],0,',','.')?></span><small> ₺</small></div>
      <p class="pr-period"><?php if($free):?>Süresiz · ücret yok<?php elseif($once):?>tek ödeme · KDV dahil · ilk <?=(int)$plan['bundled_cloud_years']?> yıl web ve mobil hediye<?php else:?>/ yıl · KDV dahil<?=$plan['monthly_try']?' · veya aylık '.$money($plan['monthly_try']):''?><?php endif;?></p>
      <dl class="pr-limits">
        <div><dd><?=e($limit($plan['limits']['warehouses']))?></dd><dt>depo</dt></div>
        <div><dd><?=$plan['limits']['staff']===0?'1':'Sınırsız'?></dd><dt><?=$plan['limits']['staff']===0?'yönetici':'personel'?></dt></div>
        <div><dd><?=e($limit($plan['limits']['desktop']))?></dd><dt>masaüstü</dt></div>
      </dl>
      <?php $ref=$base[$plan['id']]??null; $own=$ref?array_values(array_diff($plan['features'],$byId[$ref]['features'])):$plan['features']; ?>
      <ul><?php if($ref):?><li><b><?=e($byId[$ref]['name'])?>’taki her şey</b></li><?php endif;?><?php foreach($own as $key):?><li><?=e($labels[$key]??$key)?></li><?php endforeach;?></ul>
      <a class="hx-btn" href="<?=$free?'/deneme':'/?request_type=quote&amp;plan='.e($plan['id']).'#iletisim'?>"><?=$free?'Ücretsiz başla':e($plan['name']).' için görüşelim'?></a>
    </article>
  <?php endforeach;?>
  </div>
  <p class="hx-wrap pr-terms" data-pr>Pide ve restoran modülü (masa planı, garson, mutfak ekranı, kurye ve reçeteli stok) Pro, Ömür Boyu veya İşletme paketine eklenen ayrı bir eklentidir; fiyatı teklifle netleşir. Fiyatlar KDV dahildir.</p>
</section>

<section class="pr-ledger">
  <div class="hx-wrap">
    <h2>Paketler neleri kapsıyor?</h2>
    <div class="hx-table-scroll" tabindex="0" role="region" aria-label="Paket karşılaştırması, yatay kaydırılabilir"><table class="hx-table pr-table"><caption class="sr-only">Paket kapsamları</caption>
      <thead><tr><th scope="col">Özellik</th><?php foreach($plans as $plan):?><th scope="col"><?=e($plan['name'])?></th><?php endforeach;?></tr></thead>
      <tbody>
      <?php foreach($data['groups'] as $group):?>
        <tr><th scope="rowgroup" colspan="<?=count($plans)+1?>"><?=e($group['name'])?></th></tr>
        <?php foreach($group['keys'] as $key):?>
        <tr><th scope="row"><?=e($labels[$key]??$key)?></th><?php foreach($plans as $plan):?><td><?=in_array($key,$plan['features'],true)?'Dahil':'<span class="pr-no">—</span>'?></td><?php endforeach;?></tr>
        <?php endforeach;?>
      <?php endforeach;?>
      </tbody></table></div>
  </div>
</section>

<section class="hx-faq hx-faq-top"><div class="hx-wrap"><h2>Sık sorulanlar</h2><div class="hx-qa hx-qaacc">
  <details><summary>Kaç farklı paket var?</summary><p>Dört: ücretsiz Lite, yıllık veya aylık Pro, tek ödemeli Ömür Boyu Masaüstü ve çok depolu işletmeler için İşletme WMS. Restoran modülü bunlara eklenen ayrı bir eklentidir.</p></details>
  <details><summary>Hırdavat ve züccaciye için ayrı paket almam gerekir mi?</summary><p>Hayır. Ölçü ve raf araması, takım ve set takibi, beden ve renk gibi özellikler Pro ve üstündeki paketlere dahildir.</p></details>
  <details><summary>Deneme süresi bitince ne olur?</summary><p><?=$trial?> gün boyunca tüm özellikler açıktır. Süre bitince verileriniz silinmez; hesabınız Lite paketine döner ya da isterseniz lisans alırsınız.</p></details>
  <details><summary>Ömür boyu paket neyi kapsar?</summary><p>Tek bilgisayarda masaüstü uygulamanın süresiz kullanımı. İlk yıl web ve mobil erişim hediyedir; sonrasında bulut ve yapay zekâ özellikleri için yıllık abonelik gerekir, masaüstü özellikleri çalışmaya devam eder.</p></details>
  <details><summary>İnternet kesilince ne olur?</summary><p>Masaüstü uygulama satışı önce bilgisayara kaydeder. Bağlantı gelince bulutla kendiliğinden eşitlenir.</p></details>
  <details><summary>Fiyatlara KDV dahil mi?</summary><p>Evet, yazan tutar ödeyeceğiniz toplam tutardır.</p></details>
  <details><summary>Donanım fiyata dahil mi?</summary><p>Hayır. Barkod okuyucu, yazıcı, terazi ve yazarkasa cihazı ayrıca alınır; uyumluluk kullanılan donanımda doğrulanır.</p></details>
</div></div></section>
</div>
