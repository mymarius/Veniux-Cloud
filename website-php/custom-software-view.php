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

<section class="ho-steps-sec" id="paketler">
  <div class="hx-wrap">
    <h2>Paketler</h2>
    <ol class="ho-steps">
      <li><h3>Tanıtım sitesi</h3><p>Tek sayfa. WhatsApp ve iletişim bilgileri, telefona uyumlu görünüm. 1 tur düzeltme. <b>Fiyat için teklif alın.</b></p></li>
      <li><h3>İşletme sitesi</h3><p>En fazla 5 sayfa. İletişim formu, temel arama motoru ayarları, telefona uyumlu görünüm. 2 tur düzeltme. <b>Fiyat için teklif alın.</b></p></li>
    </ol>
    <p>İki pakette de alan adı ve hosting ücreti ile logo tasarımı dahil değildir. Metin ve fotoğrafları siz verirsiniz. Teslimden sonraki bakım ayrıca konuşulur.</p>
  </div>
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
