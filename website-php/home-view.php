<?php declare(strict_types=1);
$steps=[
 ['Mal geldi','Koli kapıda, kim saydı belli.','Mal kabulde ürünü okutur, miktarı girersiniz. Kim, ne zaman, kaç adet aldı; hepsi kayda geçer.','Mal kabul',[['Filtre kahve 250 g','+120 adet'],['Hedef raf','A-02'],['Kabul eden','Depo sorumlusu']],'Stoğa işlendi','good'],
 ['Rafa kondu','Ürün nerede diye aranmaz.','Her ürünün hangi depoda, hangi rafta olduğu görünür. Depolar arası transfer toplam stoğu şişirmez.','Raf A-02',[['Filtre kahve 250 g','120 adet'],['Çay 1 kg','64 adet'],['Kuruyemiş karışık','38 adet']],'Konum güncel','good'],
 ['Kasadan çıktı','Satış olduğu an stoktan düşer.','Barkod okunur, ödeme alınır, stok düşer. Gün sonunu beklemeniz, deftere geçirmeniz gerekmez.','Kasa · satış',[['Filtre kahve 250 g','× 2'],['Ödenen','92,00 TL'],['Kalan stok','118 → 116']],'Stoktan düştü','good'],
 ['Azaldı','Raf boşalmadan haberin olur.','Son 30 günlük çıkışa ve tedarik süresine bakılır, ürünün kaç günde biteceği hesaplanır.','Sipariş önerisi',[['Filtre kahve 250 g','18 adet kaldı'],['Bitmesine','3 gün'],['Önerilen sipariş','80 adet']],'Dikkat: 3 gün','warn'],
 ['Sipariş hazır','Liste hazır, onay sende.','Öneriler tek düğmeyle tedarikçi başına satın alma taslağı olur. Program kimseye kendiliğinden sipariş geçmez.','Satın alma taslağı',[['Tedarikçi','Örnek Gıda Ltd.'],['Kalem','4 ürün'],['Durum','Onay bekliyor']],'Taslak','warn'],
 ['Sayımda eksik çıktı','Eksik mal sessizce kaybolmaz.','Rafı okutun, ürünleri okutun, sayaç artsın. Fark çıkarsa adet ve yaklaşık tutar yöneticinin önüne gelir.','Sayım farkı',[['Bulaşık deterjanı','5 adet eksik'],['Yaklaşık tutar','240 TL'],['Durum','Yönetici onayında']],'Yöneticiye bildirildi','bad'],
];
?>
<section class="hx-hero">
  <div class="hx-wrap hx-hero-grid">
    <div>
      <h1>Raf boşalmadan haberin&nbsp;olsun.</h1>
      <p class="hx-lead">Veniux, market ve depolar için stok programı. Kasadan çıkanı stoktan düşer, biteni bitmeden söyler, sayımda eksik çıkanı önüne getirir.</p>
      <p class="hx-cta"><a class="hx-btn" href="/?request_type=demo#iletisim">Demo isteyin</a><a class="hx-btn hx-btn-ghost" href="/program-indir">Programı indirin</a><a class="hx-textlink" href="#yolculuk">Nasıl çalışır?</a></p>
    </div>
    <div class="hx-shelf" role="img" aria-label="Raf etiketi çizimi: filtre kahve, 46 lira, üzerinde 3 günde bitiyor uyarısı">
      <div class="hx-label">
        <div class="hx-label-top"><span>VENİUX · RAF A-02</span><span>GÖZ 14</span></div>
        <strong class="hx-label-name">Filtre kahve 250 g</strong>
        <div class="hx-label-mid"><?=homeBarcode('filtre-kahve',52)?><div class="hx-price">46<small>,00 ₺</small></div></div>
        <div class="hx-label-bot"><span>8690000010004</span><span>Stok: 18 adet</span></div>
      </div>
      <div class="hx-stamp"><b>3 günde bitiyor</b><span>80 adet sipariş önerisi</span></div>
      <div class="hx-rail" aria-hidden="true"></div>
    </div>
  </div>
</section>

<section class="hx-journey" id="yolculuk">
  <div class="hx-wrap">
    <h2>Bir ürünün yolculuğu, altı durak.</h2>
    <div class="hx-journey-grid">
      <ol class="hx-steps">
        <?php foreach($steps as $i=>[$tag,$title,$text]):?>
        <li class="hx-step" data-step="<?=$i?>"><span class="hx-step-tag"><?=str_pad((string)($i+1),2,'0',STR_PAD_LEFT)?> · <?=e($tag)?></span><h3><?=e($title)?></h3><p><?=e($text)?></p>
          <?php [, , , $head,$rows,$state,$tone]=$steps[$i]; ?>
          <div class="hx-card hx-card-inline" aria-hidden="true"><div class="hx-card-head"><?=e($head)?></div><?php foreach($rows as [$a,$b]):?><div class="hx-card-row"><span><?=e($a)?></span><b><?=e($b)?></b></div><?php endforeach;?><div class="hx-card-state" data-tone="<?=$tone?>"><?=e($state)?></div></div>
        </li>
        <?php endforeach;?>
      </ol>
      <div class="hx-stage" aria-hidden="true">
        <div class="hx-stage-sticky">
          <?php foreach($steps as $i=>[, , ,$head,$rows,$state,$tone]):?>
          <div class="hx-card" data-card="<?=$i?>" <?=$i===0?'data-on':''?>><div class="hx-card-head"><?=e($head)?></div><?php foreach($rows as [$a,$b]):?><div class="hx-card-row"><span><?=e($a)?></span><b><?=e($b)?></b></div><?php endforeach;?><div class="hx-card-state" data-tone="<?=$tone?>"><?=e($state)?></div></div>
          <?php endforeach;?>
          <p class="hx-stage-note">Örnek veriler.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<?php require __DIR__.'/home-film.php'; ?>

<section class="hx-till" id="kasa">
  <div class="hx-wrap hx-till-grid">
    <div>
      <h2>Kasada böyle çalışır.</h2>
      <p>Barkodu okutun, F6 ile arayın, F8 ile ödemeyi alın. Nakit, kart, ikisi birden ya da veresiye. Vardiya, gün sonu ve iade de aynı ekranda. İndirim yönetici onayı ister.</p>
      <button type="button" class="hx-btn" id="hx-play">Oynat</button>
      <p class="hx-till-link"><a href="/market-pos">Kasa hakkında daha fazlası</a></p>
    </div>
    <div class="hx-pos" id="hx-pos" data-frame="3" aria-label="Kasa canlandırması: üç ürün okutulur, toplam oluşur, ödeme alınır, stok düşer">
      <div class="hx-pos-lines">
        <div class="hx-pos-line" data-at="1"><span>Filtre kahve 250 g</span><b>46,00</b></div>
        <div class="hx-pos-line" data-at="2"><span>Tuzlu kraker</span><b>68,00</b></div>
        <div class="hx-pos-line" data-at="3"><span>Yüzey temizleyici</span><b>90,00</b></div>
      </div>
      <div class="hx-pos-side">
        <span>Ödenecek toplam</span>
        <strong id="hx-total">204,00 ₺</strong>
        <em id="hx-paybtn">Ödeme al · F8</em>
      </div>
      <div class="hx-pos-foot" id="hx-foot">Satış tamamlanınca stok anında düşer.</div>
    </div>
  </div>
</section>

<section class="hx-receipt-sec">
  <div class="hx-wrap hx-receipt-grid">
    <div class="hx-receipt" role="img" aria-label="Sayım fişi çizimi: bulaşık deterjanı 5 adet eksik">
      <b>SAYIM FİŞİ</b><span>Raf B-07</span>
      <hr><div><span>Bulaşık deterjanı</span><span>Sistem 30</span></div><div><span></span><span>Sayılan 25</span></div>
      <hr><div class="hx-receipt-diff"><span>FARK</span><span>−5 adet</span></div><div><span>Yaklaşık</span><span>240 TL</span></div>
      <?=homeBarcode('sayim',26)?>
    </div>
    <div>
      <h2>Ay sonunu beklemeyin.</h2>
      <p>Elle yapılan büyük stok düşüşlerine de bakarız: açıklama yazılmamışsa, gece yapılmışsa ya da ürünün normal hızının çok üstündeyse uyarı gelir.</p>
      <p class="hx-aside">Dürüst olalım: Bu uyarı hırsızlığı kanıtlamaz, nereye bakacağınızı söyler. Hiç kaydedilmemiş bir kayıp ancak sayımda ortaya çıkar.</p>
    </div>
  </div>
</section>

<section class="hx-more" id="moduller">
  <div class="hx-wrap">
    <h2>Rafta başka neler var?</h2>
    <div class="hx-tags">
      <a href="/depo-yonetimi"><b>Depo</b><span>Mal kabul, raf, toplama, sevkiyat, transfer</span></a>
      <a href="/lot-miat-takibi"><b>Lot ve miat</b><span>Parti takibi, yaklaşan son kullanma tarihleri</span></a>
      <a href="/barkodlu-stok-takibi"><b>Barkod ve etiket</b><span>Barkodla bulma, raf etiketi yazdırma</span></a>
      <a href="/el-terminali-depo-yonetimi"><b>El terminali</b><span>Android telefon veya terminalle depoda işlem</span></a>
      <a href="/stok-yonetimi"><b>Stok</b><span>Ürün kartı, hareket geçmişi, Excel'den aktarım</span></a>
      <a href="/yapay-zeka"><b>Asistan</b><span>Kayıtlarınıza Türkçe soru sorun, işlem onayınızı bekler</span></a>
    </div>
  </div>
</section>

<section class="hx-plain hx-rates">
  <div class="hx-wrap hx-plain-grid">
    <div id="fiyatlandirma" class="hx-ratecard">
      <div class="hx-rate-top"><span>VENİUX · FİYAT ETİKETİ</span><span>KDV DAHİL</span></div>
      <h2>Fiyat etiketi</h2>
      <div class="hx-table-scroll"><table class="hx-table hx-ratetable">
        <thead><tr><th scope="col">Paket</th><th scope="col">Yıllık</th><th scope="col">3 aylık</th><th scope="col">Depo</th><th scope="col">Kullanıcı</th></tr></thead>
        <tbody><?php foreach(sitePlans() as $plan):?><tr><th scope="row"><?=e($plan['name'])?></th><td><?=e(sitePrice($plan,true))?></td><td><?=e(sitePrice($plan,false))?></td><td><?=e((string)$plan['warehouses'])?></td><td><?=e((string)$plan['users'])?></td></tr><?php endforeach;?></tbody>
        <tbody class="hx-ratepacks"><tr><th scope="rowgroup" colspan="5">Sektör paketleri · genel pakete ek, yıllık</th></tr>
        <?php foreach(['hirdavat'=>'Hırdavat','zuccaciye'=>'Züccaciye','pide'=>'Pide ve restoran'] as $key=>$label):?><tr><th scope="row"><?=e($label)?></th><td colspan="4"><?=e(siteMoney(siteSectorPrices()[$key]))?> <small>· aylık <?=number_format(siteSectorPrices()[$key]/12,0,',','.')?> ₺</small></td></tr><?php endforeach;?></tbody>
      </table></div>
      <p class="hx-aside">%20 KDV dahil. <a href="/fiyatlandirma">Paketlerin farkları ve sektör paketleri</a></p>
      <?=homeBarcode('fiyat-etiketi',26)?>
    </div>
    <div class="hx-limits">
      <h2>Size uygun olmayabilir</h2>
      <p class="hx-limits-lead">Satın almadan önce bilmeniz gerekenleri açıkça yazdık.</p>
      <ul class="hx-list hx-notices">
        <li><span class="hx-notice-no">01</span><div><b>Pazaryeri entegrasyonu şart mı?</b> Trendyol üzerinde çalışıyoruz, henüz gerçek mağazada denenmedi.</div></li>
        <li><span class="hx-notice-no">02</span><div><b>Muhasebe mi arıyorsunuz?</b> Veniux stok, depo ve kasa programıdır; muhasebe programının yerine geçmez.</div></li>
        <li><span class="hx-notice-no">03</span><div><b>iPhone mu kullanıyorsunuz?</b> Şimdilik Windows ve Android var.</div></li>
      </ul>
    </div>
  </div>
</section>

<section class="hx-plain hx-trust" id="guven">
  <div class="hx-wrap hx-plain-grid">
    <div>
      <h2>Verileriniz nerede?</h2>
      <ul class="hx-list hx-datacards">
        <li><span class="hx-tagtop">BİLGİSAYARA KURULAN</span><b>Kendi bilgisayarınızda</b>Ürün, stok ve satış kayıtlarınız o bilgisayarda tutulur; internet kesilse de satış sürer. Günlük yedek kendiliğinden alınır, dilerseniz ikinci bir konuma ve şifreli dış yedeğe de kopyalanır.</li>
        <li><span class="hx-tagtop">BULUT SÜRÜMÜ</span><b>Firmanıza ayrılmış alanda</b>Kayıtlarınız Veniux sunucusunda, firmanıza ayrılmış alanda tutulur; başka firma göremez.</li>
        <li><span class="hx-tagtop">ERİŞİM</span><b>Kim görebilir?</b>Çalışanlarınız yalnız rolünün izin verdiği ekranları görür. Kim neyi ne zaman değiştirdi, işlem kaydında durur. Ayrıntısı <a href="/kvkk-aydinlatma">KVKK metninde</a>.</li>
      </ul>
    </div>
    <div class="hx-support">
      <h2>Destek</h2>
      <div class="hx-supportcard">
        <div class="hx-rate-top"><span>VENİUX · DESTEK FİŞİ</span><span>E-POSTA</span></div>
        <dl>
          <div><dt>Nereden?</dt><dd><strong>WhatsApp: <?=e(VENIUX_WHATSAPP_DISPLAY)?></strong><span>ya da aşağıdaki iletişim formundan yazın; size e-postayla dönelim.</span></dd></div>
          <div><dt>Ne zaman?</dt><dd><strong>Hafta içi 09:00–18:00</strong><span>Cumartesi 10:00–14:00</span></dd></div>
          <div><dt>Ne kadar sürede?</dt><dd><strong>Kasa satış yapamıyorsa 2 saat</strong><span>Diğer sorularda 1 iş günü içinde ilk yanıt.</span></dd></div>
        </dl>
        <a class="hx-btn hx-support-btn" href="/#iletisim">Bize yazın</a> <a class="hx-btn hx-btn-ghost hx-support-btn wa-inline" href="<?=e(whatsappUrl())?>" target="_blank" rel="noopener noreferrer">WhatsApp'tan yazın</a>
      </div>
    </div>
  </div>
</section>

<section class="hx-plain hx-roadmap" id="yol-haritasi">
  <div class="hx-wrap">
    <h2>Yol haritası</h2>
    <p class="hx-road-lead">Aşağıdakilerin bir kısmı henüz hazır değil; üzerinde çalışıyoruz veya planlıyoruz. Tarih vermiyoruz, hazır olduğunda burada yazacak.</p>
    <ol class="hx-road">
      <li data-s="build"><span class="hx-chip">Yapım aşamasında</span><div>Mağaza ile bulutun kendiliğinden eşitlenmesi.</div></li>
      <li data-s="limited"><span class="hx-chip">Bugün var, sınırlı</span><div>Bulut kasası internet kesilince nakit ve kart satışa devam eder, bağlantı gelince satışlar kendiliğinden gönderilir. Kasa sayfasının önceden internetle açılmış olması gerekir; Chrome’da denendi. İndirim, iade, veresiye ve sadakat çevrimdışıyken kapalıdır.</div></li>
      <li data-s="plan"><span class="hx-chip">Planlanıyor</span><div>Yazarkasa (yeni nesil ÖKC) entegrasyonu.</div></li>
      <li data-s="plan"><span class="hx-chip">Planlanıyor</span><div>e-Fatura, e-Arşiv ve e-İrsaliye.</div></li>
      <li data-s="plan"><span class="hx-chip">Planlanıyor</span><div>Logo, Mikro ve Paraşüt’e doğrudan aktarım (CSV aktarımı bugün var).</div></li>
      <li data-s="plan"><span class="hx-chip">Planlanıyor</span><div>Teraziye kablolu bağlantı (terazi etiketindeki barkod bugün okunuyor).</div></li>
      <li data-s="untested"><span class="hx-chip">Denenmedi</span><div>Trendyol entegrasyonu gerçek mağazada denenmedi; Hepsiburada ve N11 planlanıyor.</div></li>
      <li data-s="no"><span class="hx-chip">Yok</span><div>iPhone uygulaması.</div></li>
    </ol>
  </div>
</section>

<section class="hx-faq" id="sorular">
  <div class="hx-wrap">
    <h2>Sık sorulanlar</h2>
    <div class="hx-qa hx-qacards">
      <div><h3>Ürünleri tek tek mi gireceğim?</h3><p>Hayır. Excel veya CSV dosyanızı yükler, sütunları eşleştirir, önizlemeden sonra aktarırsınız.</p></div>
      <div><h3>Verilerim nerede duruyor?</h3><p>Windows kurulumunda kendi bilgisayarınızda veya ayrı bir sunucuda tutabilirsiniz. <a href="/sunucu-kurulumu">Kurulum seçenekleri</a></p></div>
      <div><h3>Tahmini yapay zekâ mı yapıyor?</h3><p>Hayır, satış hızı ve teslim süresinden yapılan düz bir hesap. Yapay zekâ asistanda ve ürün ile fatura fotoğrafını okumada kullanılır; fotoğraftan okunan hiçbir şey siz onaylamadan stoğa işlenmez.</p></div>
      <div><h3>Hangi barkod okuyucu çalışır?</h3><p>Klavye gibi yazan okuyucular ve telefon kamerası kullanılabilir. Özel bir cihazınız varsa önce bize sorun.</p></div>
    </div>
  </div>
</section>
