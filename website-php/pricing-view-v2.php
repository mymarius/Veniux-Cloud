<?php
// Birleşik paket sayfası: Pro, İşletme WMS (yıllık ve 3 aylık) + Pide ve Restoran eklentisi.
// Veri: plans.json (shared/planMatrix.mjs → tools/site/export-plans.mjs). Fiyat yalnız o dosyada değişir.
$data=sitePlansV2(); $plans=$data['plans']; $labels=$data['labels']; $trial=(int)$data['trial_days']; $cloud=$data['cloud_features']??[];
$money=static fn($v)=>number_format((float)$v,0,',','.').' ₺';
$money2=static fn($v)=>number_format((float)$v,2,',','.').' ₺';
$limit=static fn($v)=>$v===null?'Sınırsız':(string)$v;
$base=['lifetime_desktop'=>'pro','business_wms'=>'pro']; $byId=[]; foreach($plans as $p)$byId[$p['id']]=$p;
$pro=$byId['pro']??null; $yearSaving=$pro&&!empty($pro['quarter_try'])?($pro['quarter_try']*4-$pro['price_try']):0;
$sectors=['Market','Bakkal','Kırtasiye','Hırdavat ve nalbur','Züccaciye','Giyim ve butik','Yedek parça','Toptancı','Pide ve restoran','Depo'];
$sectorNotes=['Market'=>'Kalabalık kasa, binlerce ürün, tedarikçi faturaları','Bakkal'=>'Hızlı satış, müşteri veresiyesi','Kırtasiye'=>'Okul sezonunda hızlı kasa','Hırdavat ve nalbur'=>'Ölçü ve raf araması, usta carisi','Züccaciye'=>'Takım ve set takibi, kırılgan raf uyarısı','Giyim ve butik'=>'Beden ve renk tablosu, değişim','Yedek parça'=>'Bir parçaya birden fazla barkod','Toptancı'=>'Cari, vade ve toplu fiyat','Pide ve restoran'=>'Masa planı, garson, mutfak ekranı','Depo'=>'Raf haritası, mal kabul, sayım'];
?>
<div class="pr-page">
<section class="pr-hero">
  <div class="hx-wrap pr-hero-grid">
    <div>
      <p class="pr-eyebrow" data-pr>Fiyatlandırma</p>
      <h1 data-pr>Kasanız, stoğunuz ve deponuz için sade fiyat.</h1>
      <p class="hx-lead" data-pr>Tek bilgisayarlı mağazadan çok depolu işletmeye, ihtiyacınıza göre tek lisans. Hırdavat ve züccaciye özellikleri ayrı paket değil; Pro ve üstünde dahil. Cihaz veya personel başına ek ücret yok.</p>
      <p class="pr-cta-row" data-pr><a class="hx-btn" href="<?=VENIUX_TRIAL_URL?>"><?=$trial?> gün ücretsiz deneyin</a> <a class="hx-textlink" href="#karsilastirma">Paketleri karşılaştırın</a></p>
    </div>
    <ul class="pr-trust" data-pr aria-label="Fiyatlandırma ilkeleri">
      <li><b>KDV dahil</b><span>Yazan tutar, ödeyeceğiniz toplam tutardır.</span></li>
      <li><b><?=$trial?> gün deneme</b><span>Tüm özellikler açık, kredi kartı gerekmez.</span></li>
      <li><b>Gizli kalem yok</b><span>Kurulum, destek ve yeni sürüm güncellemesi ücretsiz.</span></li>
    </ul>
  </div>
</section>

<section class="pr-rack" id="planlar" aria-label="Paketler">
  <div class="hx-wrap pr-tags">
  <?php foreach($plans as $n=>$plan): $free=$plan['price_try']===0; $once=$plan['period']==='once'; $id=$plan['id']; ?>
    <article class="pr-tag" data-pr data-i="<?=$n?>" <?=$id==='pro'?'data-featured':''?>>
      <?php if($id==='pro'):?><span class="pr-ribbon">En çok tercih edilen</span><?php endif;?>
      <div class="pr-tag-top"><span>VENİUX · PAKET 0<?=$n+1?></span><span><?=$free?'ÜCRETSİZ':($once?'TEK ÖDEME':'YILLIK')?></span></div>
      <h2><?=e($plan['name'])?></h2>
      <p class="pr-for"><?=e($plan['tagline'])?></p>
      <div class="pr-price"><span><?=number_format((float)$plan['price_try'],0,',','.')?></span><small> ₺</small></div>
      <p class="pr-period"><?php if($free):?>Süresiz · ücret yok<?php elseif($once):?>tek ödeme · KDV dahil · ilk <?=(int)$plan['bundled_cloud_years']?> yıl web ve mobil hediye<?php else:?>/ yıl · KDV dahil · aylık eşdeğeri <?=$money2($plan['price_try']/12)?><?php endif;?></p>
      <?php if(!empty($plan['quarter_try'])):?><p class="pr-save">Yıllık ödeyince 3 aylık ödemeye göre <?=$money($plan['quarter_try']*4-$plan['price_try'])?> daha az</p><p class="pr-period">3 aylık ödeme: <?=$money($plan['quarter_try'])?> / 3 ay · KDV dahil</p><?php endif;?>
      <dl class="pr-limits">
        <div><dd><?=e($limit($plan['limits']['warehouses']))?></dd><dt>depo</dt></div>
        <div><dd><?=$plan['limits']['staff']===0?'1':'Sınırsız'?></dd><dt><?=$plan['limits']['staff']===0?'yönetici':'personel'?></dt></div>
        <div><dd><?=e($limit($plan['limits']['desktop']))?></dd><dt>masaüstü</dt></div>
      </dl>
      <?php $ref=$base[$id]??null; $own=$ref?array_values(array_diff($plan['features'],$byId[$ref]['features'])):$plan['features']; ?>
      <ul><?php if($ref):?><li><b><?=e($byId[$ref]['name'])?>’taki her şey</b></li><?php endif;?><?php foreach($own as $key):?><li><?=e($labels[$key]??$key)?></li><?php endforeach;?></ul>
      <?php if($id==='lite'):?><p class="pr-why">Kâr ve maliyet raporu, geçmiş raporlar, Excel, personel, alış faturası ve stok analizi ücretli paketlerde açılır.</p><?php endif;?>
      <?php if($id==='lifetime_desktop'):?><p class="pr-why">İlk yıl web ve mobil erişim hediyedir. Sonrasında bulut, mobil ve yapay zekâ için yıllık abonelik gerekir; masaüstü özellikleri çalışmaya devam eder.</p><?php endif;?>
      <a class="hx-btn" href="<?=$free?'/#iletisim':'/?request_type=quote&amp;plan='.e($id).'#iletisim'?>"><?=$free?'Lite için görüşelim':e($plan['name']).' için görüşelim'?></a>
      <?php if(!$free):?><a class="hx-textlink" href="<?=VENIUX_TRIAL_URL?>"><?=$trial?> gün ücretsiz deneyin</a><?php endif;?>
    </article>
  <?php endforeach;?>
  </div>
  <p class="hx-wrap pr-terms" data-pr>Online ödeme alınmaz; kapsam, ödeme ve lisans başlangıcı görüşmede netleşir. Fiyatlar KDV dahildir. Yıllık fiyat sözleşme süresince sabittir; yenilemede en fazla son 12 aylık TÜFE oranında güncellenebilir ve en az 30 gün önce bildirilir.</p>
</section>

<section class="pr-sector" id="restoran" aria-label="Pide ve restoran eklentisi"><div class="hx-wrap">
  <div class="pr-sector-head" data-pr>
    <p class="pr-eyebrow">Eklenti</p>
    <h2>Pide ve restoran modülü</h2>
    <p class="pr-sector-lead">Pro veya İşletme paketine eklenir. Garson siparişi telefondan girer, mutfak anında öter, stok o an düşer.</p>
  </div>
  <article class="pr-pack" data-pr>
    <div class="pr-tag-top"><span>RESTORAN</span><span>EKLENTİ</span></div>
    <ul><?php foreach($data['addon_features'] as $key):?><li><?=e($labels[$key]??$key)?></li><?php endforeach;?></ul>
    <div class="pr-pack-foot">
      <span class="pr-sector-badge">Pro veya İşletme ile</span>
      <div class="pr-pack-price"><span>Teklifle</span></div>
      <em>İşletmenizin masa ve cihaz sayısına göre netleşir</em>
      <a class="hx-btn" href="/?request_type=quote&amp;plan=restaurant_addon#iletisim">Restoran modülü için görüşelim</a>
    </div>
  </article>
</div></section>

<section class="pr-value" id="sektorler" data-pr><div class="hx-wrap">
  <h2>İşletmeniz hangisi?</h2>
  <p>Her işletmenin kasası başka türlü işler. Aynı çekirdek; ihtiyacınız olan özellikler paketle birlikte gelir.</p>
  <ul class="pr-sector-chips">
  <?php foreach($sectors as $s):?><li><b><?=e($s)?></b><small><?=e($sectorNotes[$s])?></small></li><?php endforeach;?>
  </ul>
</div></section>

<section class="pr-ledger" id="karsilastirma">
  <div class="hx-wrap">
    <h2>Paketler neleri kapsıyor?</h2>
    <p>Hangi özelliğin hangi pakette yer aldığını tek tabloda karşılaştırın.</p>
    <div class="hx-table-scroll" tabindex="0" role="region" aria-label="Paket karşılaştırması, yatay kaydırılabilir"><table class="hx-table pr-table"><caption class="sr-only">Paket kapsamları</caption>
      <thead><tr><th scope="col">Özellik</th><?php foreach($plans as $plan):?><th scope="col"><?=e($plan['name'])?></th><?php endforeach;?></tr></thead>
      <tbody>
      <tr><th scope="rowgroup" colspan="<?=count($plans)+1?>">Fiyat ve sınırlar</th></tr>
      <tr><th scope="row">Fiyat (KDV dahil)</th><?php foreach($plans as $plan):?><td><?=$plan['price_try']===0?'Ücretsiz':$money($plan['price_try']).($plan['period']==='once'?' tek ödeme':' / yıl')?></td><?php endforeach;?></tr>
      <tr><th scope="row">Depo veya şube</th><?php foreach($plans as $plan):?><td><?=e($limit($plan['limits']['warehouses']))?></td><?php endforeach;?></tr>
      <tr><th scope="row">Personel</th><?php foreach($plans as $plan):?><td><?=$plan['limits']['staff']===0?'Yalnız yönetici':'Sınırsız'?></td><?php endforeach;?></tr>
      <tr><th scope="row">Masaüstü cihaz</th><?php foreach($plans as $plan):?><td><?=e($limit($plan['limits']['desktop']))?></td><?php endforeach;?></tr>
      <tr><th scope="row">Yapay zekâ kotası (aylık)</th><?php foreach($plans as $plan):?><td><?=$plan['limits']['ai_monthly']===0?'<span class="pr-no">—</span>':e($limit($plan['limits']['ai_monthly']))?></td><?php endforeach;?></tr>
      <?php foreach($data['groups'] as $group):?>
        <tr><th scope="rowgroup" colspan="<?=count($plans)+1?>"><?=e($group['name'])?></th></tr>
        <?php foreach($group['keys'] as $key):?>
        <tr><th scope="row"><?=e($labels[$key]??$key)?></th><?php foreach($plans as $plan): $has=in_array($key,$plan['features'],true); ?><td><?php if(!$has):?><span class="pr-no">—</span><?php elseif($plan['id']==='lifetime_desktop'&&in_array($key,$cloud,true)):?>İlk 1 yıl<?php else:?>Dahil<?php endif;?></td><?php endforeach;?></tr>
        <?php endforeach;?>
      <?php endforeach;?>
      <tr><th scope="rowgroup" colspan="<?=count($plans)+1?>">Veri ve destek</th></tr>
      <tr><th scope="row">Günlük yedekleme</th><?php foreach($plans as $plan):?><td>Dahil</td><?php endforeach;?></tr>
      <tr><th scope="row">WhatsApp ve e-posta desteği</th><?php foreach($plans as $plan):?><td>Dahil</td><?php endforeach;?></tr>
      <tr><th scope="row">Kurulum, uzak bağlantı ve yeni sürüm ücreti</th><?php foreach($plans as $plan):?><td>Yok</td><?php endforeach;?></tr>
      </tbody></table></div>
    <aside class="pr-excluded">
      <b>Fiyata dahil değil</b>
      <ul><li>Donanım (barkod okuyucu, yazıcı, terazi, el terminali, yazarkasa cihazı)</li><li>Özel veri aktarımı ve yerinde eğitim</li></ul>
      <p>Cihaz uyumluluğu kullanılan donanımda doğrulanır.</p>
    </aside>
  </div>
</section>

<section class="hx-faq hx-faq-top"><div class="hx-wrap"><h2>Sık sorulanlar</h2><div class="hx-qa hx-qaacc">
  <details><summary>Kaç farklı paket var?</summary><p>İki ücretli paket: Pro ve çok depolu işletmeler için İşletme WMS. İkisi de yıllık ya da 3 aylık alınır. Pide ve restoran modülü bunlara eklenen ayrı bir eklentidir.</p></details>
  <details><summary>Ne kadar süre ücretsiz deneyebilirim?</summary><p><?=$trial?> gün boyunca tüm özellikler açıktır; kredi kartı gerekmez. Deneme hesabını <a href="<?=VENIUX_TRIAL_URL?>">/deneme</a> sayfasından e-posta adresinizle açarsınız.</p></details>
  <details><summary>Hırdavat ve züccaciye için ayrı paket almam gerekir mi?</summary><p>Hayır. Ölçü ve raf araması, takım ve set takibi, beden ve renk gibi özellikler Pro ve üstündeki paketlere dahildir.</p></details>
  <details><summary>Yıllık ile 3 aylık arasındaki fark nedir?</summary><p>Özellikler aynıdır. Pro’yu yıllık ödemek <?=$yearSaving>0?$money($yearSaving).' ':''?>daha avantajlıdır. 3 aylık seçenek, önce kısa süreli denemek isteyenler içindir.</p></details>
  <details><summary>İnternet kesilince ne olur?</summary><p>Masaüstü uygulama satışı önce bilgisayara kaydeder. Bağlantı geldiğinde bulutla kendiliğinden eşitlenir.</p></details>
  <details><summary>Destek, kurulum ve güncelleme için ek ücret öder miyim?</summary><p>Hayır. WhatsApp ve e-posta desteği, uzak kurulum yardımı ve yeni sürüm güncellemeleri paket fiyatına dahildir. Özel veri aktarımı ve yerinde eğitim ayrıca teklif edilir.</p></details>
  <details><summary>Lisans satın aldığımda verilerim silinir mi?</summary><p>Hayır. Deneme hesabınızdaki ürünler, müşteriler ve satışlar lisans yükseltmesinde aynen kalır.</p></details>
  <details><summary>Paketler arasında geçiş yapabilir miyim?</summary><p>Evet. İhtiyacınız değiştiğinde yeni paket belirlenir; geçiş tarihi, süre ve ücret farkı yeni teklifte yazılır.</p></details>
  <details><summary>Yazarkasa ve e-Fatura ile çalışır mı?</summary><p>Veniux kasası yasal fişin yerine geçmez; yasal fiş yazarkasanızdan ayrıca kesilir. Yazarkasa köprüsü ve e-Fatura entegrasyonu hazırlık aşamasındadır; canlıya açıldığında duyuracağız.</p></details>
  <details><summary>Fiyatlara KDV dahil mi, fatura kesiyor musunuz?</summary><p>Evet, yazan tutar KDV dahildir ve her ödeme için fatura düzenlenir.</p></details>
  <details><summary>Nasıl lisans satın alabilirim?</summary><p>Buradan çevrimiçi ödeme alınmaz. Görüşme formundan paketinizi seçin; kapsam, ödeme ve lisans başlangıcı birlikte netleşir. Siteye kayıt olmak ücretli lisansı kendiliğinden açmaz.</p></details>
</div></div></section>

<section class="pr-value" data-pr><div class="hx-wrap">
  <h2>Hangi paketin uygun olduğundan emin değil misiniz?</h2>
  <p><?=$trial?> gün boyunca tüm özellikleri kendi ürünlerinizle ücretsiz deneyin.</p>
  <p class="pr-cta-row"><a class="hx-btn" href="<?=VENIUX_TRIAL_URL?>"><?=$trial?> gün ücretsiz deneyin</a> <a class="hx-textlink" href="/#iletisim">Bize yazın</a></p>
</div></section>
</div>
