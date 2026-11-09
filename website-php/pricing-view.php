<?php $annual=($_GET['donem']??'yillik')!=='uc-aylik'; $period=$annual?'yillik':'uc-aylik'; $plans=sitePlans();
$need=['depo'=>siteCount($_GET['depo']??null),'kullanici'=>siteCount($_GET['kullanici']??null),'cihaz'=>siteCount($_GET['cihaz']??null)];
$asked=isset($_GET['depo'])||isset($_GET['kullanici'])||isset($_GET['cihaz']);
$complete=!in_array(null,$need,true);
$match=$complete?sitePlanFor($need['depo'],$need['kullanici'],$need['cihaz']):null;
$compare=[
 ['Ürün ve barkod kataloğu',1,1,1],['Stok hareketleri ve mal kabul',1,1,1],['Sipariş toplama kayıtları',1,1,1],['Firma ve kullanıcı yetkileri',1,1,1],
 ['Lot ve miat görünümü',1,1,1],['Ürün partileri ve tarih kontrolü',1,1,1],['Depolar arası operasyon takibi',0,1,1],
 ['Firma ve depo bazında erişim',0,0,1],['Geniş ekiplerle ortak çalışma alanı',0,0,1],
]; ?>
<section class="pr-hero">
  <div class="hx-wrap">
    <h1>Fiyat etiketleri ortada.</h1>
    <p class="hx-lead">Kasa ve depo her pakette. Paketler depo, kullanıcı ve cihaz sınırıyla ve İşletme’den itibaren gelen veresiye, sadakat, gelişmiş raporlar ve asistanla ayrışır. Gizli kalem yok; neyin dahil olmadığını da aşağıda yazdık.</p>
    <nav class="pr-switch" aria-label="Plan süresi">
      <a href="/fiyatlandirma?donem=uc-aylik#planlar" <?=$annual?'':'aria-current="true"'?>>3 aylık</a>
      <a href="/fiyatlandirma?donem=yillik#planlar" <?=$annual?'aria-current="true"':''?>>Yıllık</a>
    </nav>
  </div>
</section>
<section class="pr-rack" id="planlar" aria-label="<?=$annual?'Yıllık':'3 aylık'?> paketler">
  <div class="pr-rail" aria-hidden="true"></div>
  <div class="hx-wrap pr-tags">
  <?php foreach($plans as $code=>$plan): $amount=$plan[$annual?'annual':'quarter']; $saving=$plan['quarter']*4-$plan['annual']; ?>
    <article class="pr-tag" <?=$code==='isletme'?'data-featured':''?>>
      <h2><?=e($plan['name'])?></h2>
      <p class="pr-for"><?=e($plan['tag'])?></p>
      <div class="pr-price"><?=number_format($amount,0,',','.')?><small> ₺</small></div>
      <p class="pr-period">/ <?=$annual?'yıl':'3 ay'?> · KDV dahil · aylık <?=number_format($amount/($annual?12:3),0,',','.')?> ₺</p>
      <?php if($annual):?><p class="pr-save"><?=siteMoney($saving)?> daha az</p><?php endif;?>
      <dl class="pr-limits"><div><dd><?=e((string)$plan['warehouses'])?></dd><dt>depo</dt></div><div><dd><?=e((string)$plan['users'])?></dd><dt>kullanıcı</dt></div><div><dd><?=e((string)$plan['devices'])?></dd><dt>cihaz</dt></div></dl>
      <ul><?php foreach($plan['features'] as $feature):?><li><?=e($feature)?></li><?php endforeach;?></ul>
      <a class="hx-btn" href="/?request_type=quote&amp;plan=<?=$code?>%3A<?=$period?>#iletisim"><?=e($plan['name'])?> için görüşelim</a>
      <?=homeBarcode('paket-'.$code,26)?>
    </article>
  <?php endforeach;?>
  </div>
  <p class="hx-wrap pr-terms"><?=$annual?'Tasarruf, aynı paketin dört adet 3 aylık dönem toplamına göre hesaplanır. ':''?>Online ödeme alınmaz; kapsam, ödeme ve lisans başlangıcı görüşmede netleşir. Yenileme için yeniden teklif verilir.</p>
</section>

<section class="pr-finder" id="uygun-paket">
  <div class="hx-wrap pr-finder-grid">
    <div>
      <h2>Hangi paket bana uygun?</h2>
      <p>Üç sayıyı yazın, ihtiyacınızı karşılayan en küçük paketi söyleyelim.</p>
      <form method="get" action="/fiyatlandirma#uygun-paket" class="pr-finder-form">
        <input type="hidden" name="donem" value="<?=$period?>">
        <?php foreach(['depo'=>'Depo veya şube','kullanici'=>'Kullanıcı','cihaz'=>'Cihaz'] as $name=>$label):?>
        <label><?=$label?><input type="number" name="<?=$name?>" min="1" max="100000" step="1" inputmode="numeric" required value="<?=$need[$name]??''?>"></label>
        <?php endforeach;?>
        <button class="hx-btn" type="submit">Paketi bul</button>
      </form>
    </div>
    <div class="pr-finder-result" role="status">
    <?php if($asked&&!$complete):?>
      <b>Sayıları kontrol edin</b><p>Üç alana da 1 veya daha büyük bir tam sayı yazın.</p>
    <?php elseif($match):$found=$plans[$match];?>
      <small>Size uygun paket</small><b><?=e($found['name'])?></b>
      <p><?=$found['warehouses']?> depo, <?=$found['users']?> kullanıcı, <?=$found['devices']?> cihaza kadar. <?=siteMoney($found[$annual?'annual':'quarter'])?> / <?=$annual?'yıl':'3 ay'?>, KDV dahil.</p>
      <a class="hx-btn" href="/?request_type=quote&amp;plan=<?=$match?>%3A<?=$period?>#iletisim"><?=e($found['name'])?> için görüşelim</a>
    <?php elseif($complete):?>
      <small>Standart paketlerin üstünde</small><b>Size özel teklif</b>
      <p>Bu ihtiyaç Kurumsal paketin sınırlarını aşıyor. Kapsamı birlikte netleştirelim.</p>
      <a class="hx-btn" href="/?request_type=quote&amp;plan=kurumsal%3A<?=$period?>#iletisim">Görüşelim</a>
    <?php else:?>
      <small>Sonuç</small><b>Sayıları bekliyor</b><p>Emin değilseniz bugünkü ihtiyacınızı yazın; sonra paket değiştirebilirsiniz.</p>
    <?php endif;?>
    </div>
  </div>
</section>

<section class="pr-ledger">
  <div class="hx-wrap pr-ledger-grid">
    <div>
      <h2>Paketler yan yana</h2>
      <div class="hx-table-scroll" tabindex="0" role="region" aria-label="Paket karşılaştırması, yatay kaydırılabilir"><table class="hx-table pr-table"><caption class="sr-only">Paket kapsamları</caption><thead><tr><th scope="col">Kapsam</th><?php foreach($plans as $plan):?><th scope="col"><?=e($plan['name'])?></th><?php endforeach;?></tr></thead><tbody>
      <tr><th scope="row">Yıllık (KDV dahil)</th><?php foreach($plans as $plan):?><td><?=siteMoney($plan['annual'])?></td><?php endforeach;?></tr>
      <tr><th scope="row">3 aylık (KDV dahil)</th><?php foreach($plans as $plan):?><td><?=siteMoney($plan['quarter'])?></td><?php endforeach;?></tr>
      <?php foreach(['warehouses'=>'Depo','users'=>'Kullanıcı','devices'=>'Cihaz'] as $key=>$label):?><tr><th scope="row"><?=$label?></th><?php foreach($plans as $plan):?><td><?=$plan[$key]?></td><?php endforeach;?></tr><?php endforeach;?>
      <?php foreach($compare as $row):?><tr><th scope="row"><?=e($row[0])?></th><?php foreach([1,2,3] as $i):?><td><?=$row[$i]?'Dahil':'<span class="pr-no">Yok</span>'?></td><?php endforeach;?></tr><?php endforeach;?>
      <tr><th scope="row">Android bağlantısı</th><td>Cihaz sınırı içinde</td><td>Cihaz sınırı içinde</td><td>Cihaz sınırı içinde</td></tr>
      </tbody></table></div>
    </div>
    <aside class="pr-excluded">
      <b>Fiyata dahil değil</b>
      <ul><li>Donanım</li><li>Barındırma</li><li>Özel veri aktarımı</li></ul>
      <p>Cihaz uyumluluğu kullanılan donanımda doğrulanır.</p>
    </aside>
  </div>
</section>

<section class="hx-faq hx-faq-top"><div class="hx-wrap"><h2>Sık sorulanlar</h2><div class="hx-qa">
  <div><h3>3 aylık ile yıllık arasında ne fark var?</h3><p>Özellikler ve sınırlar aynıdır, yalnız süre ve toplam bedel değişir.</p></div>
  <div><h3>Buradan ödeme yapabilir miyim?</h3><p>Hayır. Paket seçiminiz görüşme talebine eklenir, ödeme birlikte netleşir. Kendiliğinden abonelik başlamaz.</p></div>
  <div><h3>İhtiyacım değişirse ne olur?</h3><p>Uygun paketi yeniden belirleriz. Geçiş tarihi, süre ve ücret farkı yeni teklifte yazılır.</p></div>
  <div><h3>Lisans ne zaman açılır?</h3><p>Kapsam ve ödeme netleştikten sonra. Siteye kayıt olmak ücretli lisansı kendiliğinden açmaz.</p></div>
</div></div></section>
<?php require __DIR__."/guide-view.php"; ?>
