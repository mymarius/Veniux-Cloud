<?php $annual=($_GET['donem']??'yillik')!=='uc-aylik'; $period=$annual?'yillik':'uc-aylik'; $plans=sitePlans();
$need=['depo'=>siteCount($_GET['depo']??null),'kullanici'=>siteCount($_GET['kullanici']??null),'cihaz'=>siteCount($_GET['cihaz']??null)];
$asked=isset($_GET['depo'])||isset($_GET['kullanici'])||isset($_GET['cihaz']);
$complete=!in_array(null,$need,true);
$match=$complete?sitePlanFor($need['depo'],$need['kullanici'],$need['cihaz']):null;
$compare=[
 ['Barkodlu kasa (nakit, kart, parçalı)',1,1,1],['Kampanyalar',1,1,1],['Ürün ve barkod kataloğu, stok ve mal kabul',1,1,1],['Lot ve miat (son kullanma)',1,1,1],
 ['Sipariş önerisi ve tedarikçiye sipariş belgesi',1,1,1],['Kritik stok, miat, sayım farkı ve kayıp şüphesi uyarıları',1,1,1],['Uyarıların e-posta/SMS ile iletimi (SMS için kendi Netgsm hesabınız gerekir)',1,1,1],
 ['Firma ve kullanıcı yetkileri, iki aşamalı doğrulama',1,1,1],['Veresiye ve vade hatırlatması',0,1,1],['Sadakat kartı',0,1,1],
 ['Kâr/zarar, kasiyer ve saatlik raporlar',0,1,1],['İşletme asistanı',0,1,1],['Şube karşılaştırması ve şube bazında erişim',0,1,1],
 ['Öncelikli destek',0,1,1],['Kurulum ve veri aktarımı desteği',0,0,1],
]; ?>
<section class="pr-hero">
  <div class="hx-wrap">
    <h1>Kasanız, stoğunuz ve şubeleriniz için tek fiyat.</h1>
    <p class="hx-lead">Kasa ve depo her pakette. İşletmeniz büyüdükçe şube, veresiye, sadakat ve analiz eklenir. Fiyatlar KDV dahildir; teklifle başlarız, online ödeme yoktur. Gizli kalem yok; neyin dahil olmadığını da aşağıda yazdık.</p>
    <nav class="pr-switch" aria-label="Plan süresi">
      <a href="/fiyatlandirma?donem=uc-aylik#planlar" <?=$annual?'':'aria-current="true"'?>>3 aylık</a>
      <a href="/fiyatlandirma?donem=yillik#planlar" <?=$annual?'aria-current="true"':''?>>Yıllık</a>
    </nav>
  </div>
</section>
<section class="pr-rack" id="planlar" aria-label="<?=$annual?'Yıllık':'3 aylık'?> paketler">
  <div class="pr-rail" aria-hidden="true"></div>
  <div class="hx-wrap pr-tags">
  <?php foreach($plans as $code=>$plan): $amount=$plan[$annual?'annual':'quarter']; $saving=$plan['quarter']===null?0:$plan['quarter']*4-$plan['annual']; ?>
    <article class="pr-tag" <?=$code==='isletme'?'data-featured':''?>>
      <h2><?=e($plan['name'])?></h2>
      <p class="pr-for"><?=e($plan['tag'])?></p>
      <?php if($amount===null):?><div class="pr-price">Yalnız yıllık</div><p class="pr-period">Yıllık <?=siteMoney($plan['annual'])?>’den başlar · KDV dahil</p>
      <?php else:?><div class="pr-price"><?=number_format($amount,0,',','.')?><small> ₺<?=!empty($plan['from'])?'’den':''?></small></div>
      <p class="pr-period">/ <?=$annual?'yıl':'3 ay'?> · KDV dahil · aylık <?=number_format($amount/($annual?12:3),0,',','.')?> ₺<?=!empty($plan['from'])?' · başlayan fiyat':''?></p><?php endif;?>
      <?php if($annual&&$saving>0):?><p class="pr-save"><?=siteMoney($saving)?> daha az</p><?php endif;?>
      <dl class="pr-limits"><div><dd><?=e((string)$plan['warehouses'])?></dd><dt>depo</dt></div><div><dd><?=e((string)$plan['users'])?></dd><dt>kullanıcı</dt></div><div><dd><?=e((string)$plan['devices'])?></dd><dt>cihaz</dt></div></dl>
      <ul><?php foreach($plan['features'] as $feature):?><li><?=e($feature)?></li><?php endforeach;?></ul>
      <a class="hx-btn" href="/?request_type=quote&amp;plan=<?=$code?>%3A<?=$plan['quarter']===null?'yillik':$period?>#iletisim"><?=e($plan['name'])?> için görüşelim</a>
      <?=homeBarcode('paket-'.$code,26)?>
    </article>
  <?php endforeach;?>
  </div>
  <p class="hx-wrap pr-terms"><?=$annual?'Tasarruf, aynı paketin dört adet 3 aylık dönem toplamına göre hesaplanır. ':''?>Online ödeme alınmaz; kapsam, ödeme ve lisans başlangıcı görüşmede netleşir. Bedel sözleşme süresince sabittir; yenilemede en fazla son 12 aylık TÜFE oranında güncellenebilir ve 30 gün önce bildirilir.</p>
</section>

<section class="pr-guide" aria-label="Kısa yönlendirme"><div class="hx-wrap">
  <h2>Hangi paket bana uygun?</h2>
  <ul>
    <li><b>Başlangıç:</b> Tek kasa, tek depo; barkodlu satış, stok, lot ve miat, kayıp uyarıları yeter.</li>
    <li><b>İşletme:</b> İki-üç şube, veresiye defteri, sadakat kartı veya kâr ve kasiyer raporu istiyorsanız.</li>
    <li><b>Kurumsal:</b> Çok şube, çok kullanıcı; kurulum ve veri aktarımında destek istiyorsanız.</li>
  </ul>
  <p class="pr-note">Mevcut müşterilerimiz ilk yenilemede eski fiyattan devam eder.</p>
</div></section>

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
      <p><?=$found['warehouses']?> depo, <?=$found['users']?> kullanıcı, <?=$found['devices']?> cihaza kadar. <?=sitePrice($found,$annual)?><?=$found[$annual?'annual':'quarter']===null?'':' / '.($annual?'yıl':'3 ay')?>, KDV dahil.</p>
      <a class="hx-btn" href="/?request_type=quote&amp;plan=<?=$match?>%3A<?=$found['quarter']===null?'yillik':$period?>#iletisim"><?=e($found['name'])?> için görüşelim</a>
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

<section class="pr-value"><div class="hx-wrap"><h2>Kaybolan stok da bir maliyettir</h2><p>Rafta görünüp sistemde olmayan, sistemde görünüp rafta olmayan her ürün ya kaçan bir satış ya da bağlanmış bir paradır. Son kullanma tarihi geçen ürün çöpe gider; sayılmayan fark ay sonunda “nereye gitti” sorusuna dönüşür. Veniux bu farkları ay sonunda değil, oluştuğu gün gösterir: kritik stok, yaklaşan miat, sayım farkı ve kayıp şüphesi uyarısı her pakette vardır. Kaybın ne kadar azalacağı işletmenize bağlıdır; biz ölçebileceğiniz bir yer veriyoruz.</p></div></section>

<section class="pr-ledger">
  <div class="hx-wrap pr-ledger-grid">
    <div>
      <h2>Paketler yan yana</h2>
      <div class="hx-table-scroll" tabindex="0" role="region" aria-label="Paket karşılaştırması, yatay kaydırılabilir"><table class="hx-table pr-table"><caption class="sr-only">Paket kapsamları</caption><thead><tr><th scope="col">Kapsam</th><?php foreach($plans as $plan):?><th scope="col"><?=e($plan['name'])?></th><?php endforeach;?></tr></thead><tbody>
      <tr><th scope="row">Yıllık (KDV dahil)</th><?php foreach($plans as $plan):?><td><?=sitePrice($plan,true)?></td><?php endforeach;?></tr>
      <tr><th scope="row">3 aylık (KDV dahil)</th><?php foreach($plans as $plan):?><td><?=sitePrice($plan,false)?></td><?php endforeach;?></tr>
      <tr><th scope="row">Kasa</th><td>1</td><td>3</td><td>50</td></tr>
      <?php foreach(['warehouses'=>'Depo','users'=>'Kullanıcı','devices'=>'Cihaz'] as $key=>$label):?><tr><th scope="row"><?=$label?></th><?php foreach($plans as $plan):?><td><?=$plan[$key]?></td><?php endforeach;?></tr><?php endforeach;?>
      <?php foreach($compare as $row):?><tr><th scope="row"><?=e($row[0])?></th><?php foreach([1,2,3] as $i):?><td><?=$row[$i]?'Dahil':'<span class="pr-no">Yok</span>'?></td><?php endforeach;?></tr><?php endforeach;?>
      <tr><th scope="row">Android bağlantısı</th><td>Cihaz sınırı içinde</td><td>Cihaz sınırı içinde</td><td>Cihaz sınırı içinde</td></tr>
      </tbody></table></div>
    </div>
    <aside class="pr-excluded">
      <b>Fiyata dahil değil</b>
      <ul><li>Donanım (barkod okuyucu, yazıcı, terazi, el terminali)</li><li>Barındırma</li><li>Özel veri aktarımı</li><li>Yazarkasa (ÖKC) cihazı</li></ul>
      <p>Cihaz uyumluluğu kullanılan donanımda doğrulanır.</p>
      <b>Ek kullanım (yıllık, KDV dahil)</b>
      <ul><?php foreach(siteAddOns() as [$label,$amount]):?><li><?=e($label)?>: <?=siteMoney($amount)?></li><?php endforeach;?></ul>
      <p>Başlangıç’ta ek kullanıcı ve depo yerine İşletme’ye geçiş önerilir.</p>
    </aside>
  </div>
</section>

<section class="hx-faq hx-faq-top"><div class="hx-wrap"><h2>Sık sorulanlar</h2><div class="hx-qa">
  <div><h3>Deneme sürümü var mı?</h3><p>Kendiliğinden açılan bir deneme lisansı yok. Bunun yerine programı sizin ürünlerinizle ve iş akışınızla görüşmede birlikte deniyoruz; demo talebinizi aşağıdaki formdan bırakabilirsiniz.</p></div>
  <div><h3>Yazarkasa (ÖKC) ile çalışır mı?</h3><p>Henüz hayır. Veniux kasası yasal fişin yerine geçmez; yasal fiş yazarkasanızdan ayrıca kesilir. Yazarkasa entegrasyonu planlanıyor; yükümlülüğünüzü mali müşavirinizle netleştirin.</p></div>
  <div><h3>Fiyatlar neden KDV dahil yazılı?</h3><p>Ödeyeceğiniz toplam tutarı ilk bakışta görün diye. KDV hariç tutar teklifte ayrıca yazılır.</p></div>
  <div><h3>Hangi paket bana uygun?</h3><p>Tek kasa ve tek depoysanız Başlangıç. Şubeniz, veresiyeniz veya sadakat kartınız varsa İşletme. Çok şubeli ve büyük depolar için Kurumsal.</p></div>
  <div><h3>3 aylık ile yıllık arasında ne fark var?</h3><p>Özellikler ve sınırlar aynıdır. Yıllık ödeme yaklaşık %20 daha avantajlıdır. Kurumsal paket yalnız yıllık sunulur.</p></div>
  <div><h3>Fiyat yenilemede artar mı?</h3><p>Sözleşme süresince sabittir. Yenilemede en fazla son 12 aylık TÜFE oranında güncellenebilir ve en az 30 gün önce bildirilir.</p></div>
  <div><h3>İnternet kesilince ne olur?</h3><p>Bilgisayara kurulan (yerel) sürümde satış devam eder. Bulut sürümde internet gerekir.</p></div>
  <div><h3>e-Fatura ve iPhone uygulaması var mı?</h3><p>e-Fatura entegrasyonu hazırlık aşamasında; canlıya açıldığında duyuracağız. Şu an Windows ve Android var; iPhone sürümü yok.</p></div>
  <div><h3>Buradan ödeme yapabilir miyim?</h3><p>Hayır. Paket seçiminiz görüşme talebine eklenir, ödeme birlikte netleşir. Kendiliğinden abonelik başlamaz.</p></div>
  <div><h3>İhtiyacım değişirse ne olur?</h3><p>Uygun paketi yeniden belirleriz. Geçiş tarihi, süre ve ücret farkı yeni teklifte yazılır.</p></div>
  <div><h3>Lisans ne zaman açılır?</h3><p>Kapsam ve ödeme netleştikten sonra. Siteye kayıt olmak ücretli lisansı kendiliğinden açmaz.</p></div>
</div></div></section>
<?php require __DIR__."/guide-view.php"; ?>
