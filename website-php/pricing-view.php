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
<div class="pr-page">
<section class="pr-hero">
  <div class="hx-wrap pr-hero-grid">
    <div>
      <p class="pr-eyebrow" data-pr>Fiyatlandırma</p>
      <h1 data-pr>Kasanız, stoğunuz ve şubeleriniz için tek fiyat.</h1>
      <p class="hx-lead" data-pr>Kasa ve depo her pakette. İşletmeniz büyüdükçe şube, veresiye, sadakat ve analiz eklenir. Gizli kalem yok; neyin dahil olmadığını da aşağıda yazdık.</p>
      <nav class="pr-switch" aria-label="Plan süresi" data-pr>
        <a href="/fiyatlandirma?donem=uc-aylik#planlar" <?=$annual?'':'aria-current="true"'?>>3 aylık</a>
        <a href="/fiyatlandirma?donem=yillik#planlar" <?=$annual?'aria-current="true"':''?>>Yıllık <span>%20 avantaj</span></a>
      </nav>
    </div>
    <ul class="pr-trust" data-pr aria-label="Fiyatlandırma ilkeleri">
      <li><b>KDV dahil</b><span>Ödeyeceğiniz toplam tutar yazar.</span></li>
      <li><b>Online ödeme yok</b><span>Teklifle başlarız, kendiliğinden abonelik olmaz.</span></li>
      <li><b>Sabit bedel</b><span>Sözleşme süresince fiyat değişmez.</span></li>
    </ul>
  </div>
</section>

<section class="pr-rack" id="planlar" aria-label="<?=$annual?'Yıllık':'3 aylık'?> paketler">
  <div class="hx-wrap pr-tags">
  <?php $n=0; foreach($plans as $code=>$plan): $amount=$plan[$annual?'annual':'quarter']; $saving=$plan['quarter']===null?0:$plan['quarter']*4-$plan['annual']; ?>
    <article class="pr-tag" data-pr data-i="<?=$n++?>" <?=$code==='isletme'?'data-featured':''?>>
      <?php if($code==='isletme'):?><span class="pr-ribbon">En çok tercih edilen</span><?php endif;?>
      <div class="pr-tag-top"><span>VENİUX · PAKET 0<?=$n?></span><span><?=$annual?'YILLIK':'3 AYLIK'?></span></div>
      <h2><?=e($plan['name'])?></h2>
      <p class="pr-for"><?=e($plan['tag'])?></p>
      <?php if($amount===null):?><div class="pr-price pr-price-text">Yalnız yıllık</div><p class="pr-period">Yıllık <?=siteMoney($plan['annual'])?>’den başlar · KDV dahil</p>
      <?php else:?><div class="pr-price"><span data-count="<?=$amount?>"><?=number_format($amount,0,',','.')?></span><small> ₺<?=!empty($plan['from'])?'’den':''?></small></div>
      <p class="pr-period">/ <?=$annual?'yıl':'3 ay'?> · KDV dahil · aylık <?=number_format($amount/($annual?12:3),0,',','.')?> ₺<?=!empty($plan['from'])?' · başlayan fiyat':''?></p><?php endif;?>
      <?php if($annual&&$saving>0):?><p class="pr-save"><?=siteMoney($saving)?> daha az</p><?php endif;?>
      <dl class="pr-limits"><div><dd><?=e((string)$plan['warehouses'])?></dd><dt>depo</dt></div><div><dd><?=e((string)$plan['users'])?></dd><dt>kullanıcı</dt></div><div><dd><?=e((string)$plan['devices'])?></dd><dt>cihaz</dt></div></dl>
      <ul><?php foreach($plan['features'] as $feature):?><li><?=e($feature)?></li><?php endforeach;?></ul>
      <?php if(!empty($plan['from'])&&isset($plans['isletme'])&&$plan['warehouses']>0&&$plan['users']>0):
        $perWh=(int)round($plan['annual']/$plan['warehouses']);$perUser=(int)round($plan['annual']/$plan['users']);
        $baseWh=(int)round($plans['isletme']['annual']/$plans['isletme']['warehouses']);$baseUser=(int)round($plans['isletme']['annual']/$plans['isletme']['users']); ?>
      <p class="pr-why"><strong>Neden bu fiyat?</strong> <?=e((string)$plan['warehouses'])?> depo ve <?=e((string)$plan['users'])?> kullanıcıya yayılınca birim maliyet düşer: depo başına yaklaşık <?=siteMoney($perWh)?>, kullanıcı başına yaklaşık <?=siteMoney($perUser)?> / yıl (İşletme paketinde <?=siteMoney($baseWh)?> ve <?=siteMoney($baseUser)?>). Kurulum ve veri aktarımı desteği fiyata dahildir; kapsam büyüdükçe teklifle netleşir.</p>
      <?php endif;?>
      <a class="hx-btn" href="/?request_type=quote&amp;plan=<?=$code?>%3A<?=$plan['quarter']===null?'yillik':$period?>#iletisim"><?=e($plan['name'])?> için görüşelim</a>
      <?=homeBarcode('paket-'.$code,26)?>
    </article>
  <?php endforeach;?>
  </div>
  <p class="hx-wrap pr-terms" data-pr><?=$annual?'Tasarruf, aynı paketin dört adet 3 aylık dönem toplamına göre hesaplanır. ':''?>Online ödeme alınmaz; kapsam, ödeme ve lisans başlangıcı görüşmede netleşir. Bedel sözleşme süresince sabittir; yenilemede en fazla son 12 aylık TÜFE oranında güncellenebilir ve 30 gün önce bildirilir. Mevcut müşterilerimiz ilk yenilemede eski fiyattan devam eder.</p>
</section>

<div class="pr-band" aria-hidden="true"><div><span>Hırdavat ·</span><span>Züccaciye ·</span><span>Pide ve restoran ·</span><span>Hırdavat ·</span><span>Züccaciye ·</span><span>Pide ve restoran ·</span><span>Hırdavat ·</span><span>Züccaciye ·</span><span>Pide ve restoran ·</span></div></div>
<section class="pr-sector" id="sektor-paketleri" aria-label="Sektör paketleri"><div class="hx-wrap">
  <div class="pr-sector-head" data-pr>
    <p class="pr-eyebrow">Sektör paketleri</p>
    <h2>Sektörünüze özel eklentiler</h2>
    <p class="pr-sector-lead">Genel paketinize eklenir, ayrı satın alınır ve kendi fiyatı vardır. İhtiyacınız olmayan özellik için ödeme yapmazsınız.</p>
  </div>
  <div class="pr-sector-grid">
<?php $sec=[
 ['hirdavat','Hırdavat','Telefonla ürün arama: “3 numara vida var mı?” sorusuna koridor, raf ve kutu sayısıyla saniyede cevap.',['Ölçü ve kategori filtresiyle binlerce ürün arasında hızlı arama','Telefon kamerasıyla barkod okuma','Raf, koridor ve kat bilgisi','Kritik stok uyarısı ve toptancıya WhatsApp ile tek dokunuşla yazma'],'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3 17.7 6.3 21l6.3-6.3a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'],
 ['zuccaciye','Züccaciye','Takım ve set ürünlerde eksik parçayı raftan önce siz öğrenin.',['Takım eşleme: “6 kişilik setin 2 bıçağı eksik” uyarısı','Kırılgan bölge, vitrin, üst raf gibi hassas raf etiketleri ve yanlış yerleştirme uyarısı','Fiyat güncelleyince raf etiketini yazıcıya gönderme'],'<path d="M6 3h12l-1.5 8a4.5 4.5 0 0 1-9 0zM12 15.5V21M8 21h8"/>'],
 ['pide','Pide ve restoran','Garson siparişi telefondan girer, mutfak anında öter, stok o an düşer.',['Garson modu, masa ve paket/motor siparişi','Mutfak ekranı ve sesli uyarı','Reçeteye göre malzeme stoğu (pide başına hamur, kaşar)','Esnaf paneli: gün sonunda kaç pide, kaç motor gitti; sipariş geldiğinde telefona uyarı'],'<path d="M5 3v8a2 2 0 0 0 2 2v8M9 3v6M7 3v6M19 21V3c-2.5 1-4 4-4 8h4"/>'],
]; $tops=['hirdavat'=>'HIRDAVAT','zuccaciye'=>'ZÜCCACİYE','pide'=>'RESTORAN']; foreach($sec as $k=>[$key,$name,$lead,$items,$icon]): $price=siteSectorPrices()[$key]; ?>
    <article class="pr-pack" data-pr data-i="<?=$k?>">
      <div class="pr-tag-top"><span>RAF · <?=$tops[$key]?></span><span>EK PAKET</span></div>
      <span class="pr-pack-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><?=$icon?></svg></span>
      <h3><?=e($name)?></h3>
      <p class="pr-pack-lead"><?=e($lead)?></p>
      <ul><?php foreach($items as $item):?><li><?=e($item)?></li><?php endforeach;?></ul>
      <div class="pr-pack-foot">
        <span class="pr-sector-badge">Genel pakete ek</span>
        <div class="pr-pack-price"><span data-count="<?=$price?>"><?=number_format($price,0,',','.')?></span><small> ₺ / yıl</small></div>
        <em>KDV dahil · aylık <?=number_format($price/12,0,',','.')?> ₺</em>
        <a class="hx-btn" href="/?request_type=quote&amp;plan=<?=$key?>%3Ayillik#iletisim"><?=e($name)?> paketini isteyin</a>
      </div>
      <?=homeBarcode('sektor-'.$key,26)?>
    </article>
<?php endforeach;?>
  </div>
  <p class="pr-sector-cta" data-pr>Birden fazla sektör paketi alırsanız birlikte teklif hazırlarız. <a href="/#iletisim">Bize yazın</a>.</p>
</div></section>

<section class="pr-finder" id="uygun-paket" data-pr>
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
<section class="pr-value" data-pr><div class="hx-wrap"><h2>Kaybolan stok da bir maliyettir</h2><p>Rafta görünüp sistemde olmayan, sistemde görünüp rafta olmayan her ürün ya kaçan bir satış ya da bağlanmış bir paradır. Son kullanma tarihi geçen ürün çöpe gider; sayılmayan fark ay sonunda “nereye gitti” sorusuna dönüşür. Veniux bu farkları ay sonunda değil, oluştuğu gün gösterir: kritik stok, yaklaşan miat, sayım farkı ve kayıp şüphesi uyarısı her pakette vardır. Kaybın ne kadar azalacağı işletmenize bağlıdır; biz ölçebileceğiniz bir yer veriyoruz.</p></div></section>

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

<section class="hx-faq hx-faq-top"><div class="hx-wrap"><h2>Sık sorulanlar</h2><div class="hx-qa hx-qaacc">
  <details><summary>Deneme sürümü var mı?</summary><p>Kendiliğinden açılan bir deneme lisansı yok. Bunun yerine programı sizin ürünlerinizle ve iş akışınızla görüşmede birlikte deniyoruz; demo talebinizi aşağıdaki formdan bırakabilirsiniz.</p></details>
  <details><summary>Yazarkasa (ÖKC) ile çalışır mı?</summary><p>Henüz hayır. Veniux kasası yasal fişin yerine geçmez; yasal fiş yazarkasanızdan ayrıca kesilir. Yazarkasa entegrasyonu planlanıyor; yükümlülüğünüzü mali müşavirinizle netleştirin.</p></details>
  <details><summary>Fiyatlar neden KDV dahil yazılı?</summary><p>Ödeyeceğiniz toplam tutarı ilk bakışta görün diye. KDV hariç tutar teklifte ayrıca yazılır.</p></details>
  <details><summary>Hangi paket bana uygun?</summary><p>Tek kasa ve tek depoysanız Başlangıç. Şubeniz, veresiyeniz veya sadakat kartınız varsa İşletme. Çok şubeli ve büyük depolar için Kurumsal.</p></details>
  <details><summary>3 aylık ile yıllık arasında ne fark var?</summary><p>Özellikler ve sınırlar aynıdır. Yıllık ödeme yaklaşık %20 daha avantajlıdır. Kurumsal paket yalnız yıllık sunulur.</p></details>
  <details><summary>Fiyat yenilemede artar mı?</summary><p>Sözleşme süresince sabittir. Yenilemede en fazla son 12 aylık TÜFE oranında güncellenebilir ve en az 30 gün önce bildirilir.</p></details>
  <details><summary>İnternet kesilince ne olur?</summary><p>Bilgisayara kurulan (yerel) sürümde satış devam eder. Bulut sürümde kasa sayfası önceden internetle açılmışsa nakit ve kart satış devam eder, bağlantı gelince gönderilir; indirim, iade ve veresiye çevrimdışıyken kapalıdır. Bu özellik Chrome’da denendi.</p></details>
  <details><summary>e-Fatura ve iPhone uygulaması var mı?</summary><p>e-Fatura entegrasyonu hazırlık aşamasında; canlıya açıldığında duyuracağız. Şu an Windows ve Android var; iPhone sürümü yok.</p></details>
  <details><summary>Buradan ödeme yapabilir miyim?</summary><p>Hayır. Paket seçiminiz görüşme talebine eklenir, ödeme birlikte netleşir. Kendiliğinden abonelik başlamaz.</p></details>
  <details><summary>İhtiyacım değişirse ne olur?</summary><p>Uygun paketi yeniden belirleriz. Geçiş tarihi, süre ve ücret farkı yeni teklifte yazılır.</p></details>
  <details><summary>Lisans ne zaman açılır?</summary><p>Kapsam ve ödeme netleştikten sonra. Siteye kayıt olmak ücretli lisansı kendiliğinden açmaz.</p></details>
</div></div></section>
<?php require __DIR__."/guide-view.php"; ?>
</div>
