<?php
// Web sitesi hizmeti sayfası. Olmayan referans, ortaklık, ekip veya hazır fiyat yazılmaz.
require_once __DIR__.'/whatsapp.php';
$csUrl = whatsappUrl('Merhaba, web sitesi hizmeti hakkında görüşmek istiyorum.');
?>
<section class="ho-hero">
  <div class="hx-wrap">
    <h1>Küçük işletmeler için web sitesi</h1>
    <p class="hx-lead">Veniux’u geliştirirken kullandığımız araçlarla, küçük işletmelere sınırı belli web siteleri hazırlamayı planlıyoruz.</p>
    <p class="hx-lead"><small>Bu hizmet şu an ön görüşme aşamasındadır. Ücretli çalışmaya şirket kuruluşundan sonra (hedef: Ocak 2027) başlamayı planlıyoruz.</small></p>
    <p class="ho-cta"><a class="hx-btn" href="<?=e($csUrl)?>" target="_blank" rel="noopener noreferrer">WhatsApp’tan yazın</a> <a class="hx-btn hx-btn-ghost" href="/#iletisim">Form ile yazın</a></p>
  </div>
</section>

<section class="pr-rack" id="paketler" aria-label="Paketler">
  <div class="hx-wrap pr-tags pr-two">
<?php foreach([
    ['01','Tanıtım sitesi','İnternette görünmek isteyen işletmeler için.',false,['Tek sayfa','WhatsApp ve iletişim bilgileri','Telefona uyumlu görünüm','1 tur düzeltme']],
    ['02','İşletme sitesi','Hizmetini ve ürününü anlatmak isteyenler için.',true,['En fazla 5 sayfa','İletişim formu','Temel arama motoru ayarları','Telefona uyumlu görünüm','2 tur düzeltme']],
] as [$no,$name,$for,$dark,$items]):?>
    <article class="pr-tag"<?=$dark?' data-featured':''?>>
      <div class="pr-tag-top"><span>VENİUX · WEB <?=$no?></span><span>PAKET</span></div>
      <h2><?=e($name)?></h2>
      <p class="pr-for"><?=e($for)?></p>
      <div class="pr-price"><span>Teklif alın</span></div>
      <ul><?php foreach($items as $item):?><li><?=e($item)?></li><?php endforeach;?></ul>
      <div><a class="hx-btn" href="<?=e(whatsappUrl('Merhaba, '.$name.' paketi için teklif almak istiyorum.'))?>" target="_blank" rel="noopener noreferrer"><?=e($name)?> için yazın</a></div>
    </article>
<?php endforeach;?>
  </div>
  <p class="hx-wrap pr-terms">İki pakette de alan adı ve hosting ücreti ile logo tasarımı dahil değildir. Metin ve fotoğrafları siz verirsiniz. Teslimden sonraki bakım ayrıca konuşulur.</p>
</section>

<section class="ho-steps-sec" id="surec">
  <div class="hx-wrap">
    <h2>Nasıl ilerler</h2>
    <ol class="ho-steps">
      <li><h3>Ön görüşme</h3><p>Ne istediğinizi dinleriz. İş bize uygun değilse bunu baştan söyleriz.</p></li>
      <li><h3>Yazılı teklif</h3><p>Kapsam, teslim tarihi, ödeme aşamaları, değişiklik istekleri ve bakım süresi yazılır. Site dosyalarının ve alan adının kime ait olacağı da teklifte belirtilir.</p></li>
      <li><h3>Ara gösterimler</h3><p>İş bitmeden çalışan hâlini görür, düzeltme istersiniz.</p></li>
      <li><h3>Teslim</h3><p>Teklifte yazılanlar teslim edilir. Kişisel veri işlenecekse sorumluluklar işe başlamadan yazılı olarak belirlenir.</p></li>
    </ol>
  </div>
</section>

<section class="ho-steps-sec" id="almadiklarimiz">
  <div class="hx-wrap">
    <h2>Almadığımız işler</h2>
    <ol class="ho-steps">
      <li><h3>E-ticaret, üyelik sistemi, web ve mobil uygulama</h3><p>Özel yazılım geliştirme işi almıyoruz.</p></li>
      <li><h3>Güvenlik testi ve güvenlik işletimi</h3><p>Sızma testi, güvenlik duvarı ve log izleme hizmeti vermiyoruz.</p></li>
      <li><h3>SAP, Logo, Netsis danışmanlığı veya satışı</h3><p>Bu markaların bayisi ya da iş ortağı değiliz.</p></li>
      <li><h3>Yerinde teknik servis</h3><p>Bilgisayar, yazıcı ve kamera kurulumu veya onarımı yapmıyoruz.</p></li>
    </ol>
  </div>
</section>
