<?php
// Özel yazılım hizmeti sayfası. Olmayan referans, ortaklık, ekip veya hazır fiyat yazılmaz.
require_once __DIR__.'/whatsapp.php';
$csUrl = whatsappUrl('Merhaba, özel yazılım hakkında görüşmek istiyorum.');
?>
<section class="ho-hero">
  <div class="hx-wrap">
    <h1>Özel yazılım: web sitesi, küçük web ve mobil uygulama</h1>
    <p class="hx-lead">Veniux’u geliştirirken kullandığımız araçlarla, küçük işletmelere sınırı belli işler yapıyoruz. Büyük kurumsal projeler ve 7/24 işletim hizmeti almıyoruz.</p>
    <p class="hx-lead"><small>Bu hizmet şu an ön görüşme aşamasındadır. Ücretli çalışmaya şirket kuruluşundan sonra (hedef: Ocak 2027) başlamayı planlıyoruz.</small></p>
    <p class="ho-cta"><a class="hx-btn" href="<?=e($csUrl)?>" target="_blank" rel="noopener noreferrer">WhatsApp’tan yazın</a> <a class="hx-btn hx-btn-ghost" href="/#iletisim">Form ile yazın</a></p>
  </div>
</section>

<section class="ho-steps-sec" id="isler">
  <div class="hx-wrap">
    <h2>Hangi işler</h2>
    <ol class="ho-steps">
      <li><h3>İşletme web sitesi</h3><p>Tanıtım sayfaları, iletişim formu, telefonda düzgün görünüm.</p></li>
      <li><h3>Küçük web uygulaması</h3><p>Kayıt tutma, takip ve rapor ekranları gibi tek bir işi çözen uygulamalar.</p></li>
      <li><h3>Küçük mobil uygulama</h3><p>Öncelik Android’dir. iPhone isteniyorsa mümkün olup olmadığını görüşmede söyleriz.</p></li>
    </ol>
  </div>
</section>

<section class="ho-steps-sec" id="surec">
  <div class="hx-wrap">
    <h2>Nasıl ilerler</h2>
    <ol class="ho-steps">
      <li><h3>Ön görüşme</h3><p>Ne istediğinizi dinleriz. İş bize uygun değilse bunu baştan söyleriz.</p></li>
      <li><h3>Yazılı teklif</h3><p>Kapsam, teslim tarihi, ödeme aşamaları, değişiklik istekleri ve bakım süresi yazılır. Kaynak kodun ve alan adının kime ait olacağı da teklifte belirtilir.</p></li>
      <li><h3>Ara gösterimler</h3><p>İş bitmeden çalışan hâlini görür, düzeltme istersiniz.</p></li>
      <li><h3>Teslim</h3><p>Teklifte yazılanlar teslim edilir. Kişisel veri işlenecekse sorumluluklar işe başlamadan yazılı olarak belirlenir.</p></li>
    </ol>
  </div>
</section>

<section class="ho-steps-sec" id="almadiklarimiz">
  <div class="hx-wrap">
    <h2>Almadığımız işler</h2>
    <ol class="ho-steps">
      <li><h3>Güvenlik testi ve güvenlik işletimi</h3><p>Sızma testi, güvenlik duvarı ve log izleme hizmeti vermiyoruz.</p></li>
      <li><h3>SAP, Logo, Netsis danışmanlığı veya satışı</h3><p>Bu markaların bayisi ya da iş ortağı değiliz.</p></li>
      <li><h3>Yerinde teknik servis</h3><p>Bilgisayar, yazıcı ve kamera kurulumu veya onarımı yapmıyoruz.</p></li>
    </ol>
  </div>
</section>
