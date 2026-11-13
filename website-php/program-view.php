<section class="pg-hero">
  <div class="hx-wrap">
    <h1>Bilgisayara kurun, cebinize alın.</h1>
    <p class="hx-lead">Windows programı ve Android uygulaması aynı kayıtlarla çalışır. Kasada satılan ürün, depodaki telefonda da düşmüş görünür.</p>
    <div class="pg-tickets">
      <article class="pg-ticket">
        <div class="pg-ticket-main">
          <span class="pg-ticket-tag">Kasa ve ofis</span>
          <h2>Windows</h2>
          <p>Ürün, barkod, stok hareketi, depo, lot ve miat kayıtları. Ekranlar lisans ve kullanıcı yetkisine göre açılır.</p>
          <dl><div><dt>Sistem</dt><dd>Windows 10/11, 64 bit</dd></div></dl>
        </div>
        <a class="pg-stub" href="/indir"><?=homeBarcode('windows-indir',60)?><b>İndir</b><span>Kurulum dosyası</span></a>
      </article>
      <article class="pg-ticket pg-ticket-orange">
        <div class="pg-ticket-main">
          <span class="pg-ticket-tag">Depo ve raf arası</span>
          <h2>Android</h2>
          <p>Telefon, tablet ve el terminali. Bilgisayardaki aynı ürün ve stok kayıtlarını kullanırsınız.</p>
          <dl><div><dt>Sistem</dt><dd>Android 8 ve üzeri</dd></div></dl>
        </div>
        <a class="pg-stub" href="/indir"><?=homeBarcode('android-indir',60)?><b>İndir</b><span>Uygulama dosyası</span></a>
      </article>
    </div>
    <aside class="pg-notice" aria-label="Windows kurulum uyarısı">
      <b>Önceden söyleyelim</b>
      <p>Windows kurulum dosyasında henüz doğrulanmış yayıncı imzası yok; SmartScreen uyarısı çıkabilir. Kod imzalama çalışması tamamlanmadı.</p>
    </aside>
    <section class="pg-steps" aria-labelledby="kurulum-adimlari">
      <h2 id="kurulum-adimlari">3 adımda kurulum</h2>
      <ol>
        <li><span class="pg-step-no" aria-hidden="true">1</span><div><b>Kurulum dosyasını indirin</b><p>Yukarıdan Windows’u seçin ve dosyayı çalıştırın. Kurulum Windows’un standart ekranlarıyla ilerler; klasörü seçip İleri’ye basmanız yeter.</p></div></li>
        <li><span class="pg-step-no" aria-hidden="true">2</span><div><b>Windows uyarı gösterirse</b><p>“Windows bilgisayarınızı korudu” ekranı çıkarsa <b>Ek bilgi</b>’ye, ardından <b>Yine de çalıştır</b>’a basın. Bu uyarı, kurulum dosyasında henüz doğrulanmış yayıncı imzası olmadığı içindir. Dosyayı yalnızca bu sayfadan veya Veniux’tan aldığınızdan emin olun.</p></div></li>
        <li><span class="pg-step-no" aria-hidden="true">3</span><div><b>Açın ve bağlanın</b><p>İlk açılışta bu bilgisayarı sunucu olarak kullanmayı veya mevcut bir sunucuya bağlanmayı seçin. Telefon için bilgisayardaki QR kodu Android uygulamasıyla okutun; telefon ve bilgisayar aynı ağda, bilgisayar açık olmalıdır.</p></div></li>
      </ol>
    </section>
    <p class="pg-link"><a href="/guncelleme-notlari">Son sürümde neler değişti?</a></p>
  </div>
</section>

<section class="pg-where">
  <div class="hx-wrap">
    <h2>Kayıtlarınız nerede dursun?</h2>
    <div class="pg-where-grid">
      <article>
        <span class="pg-where-tag">Bulut</span>
        <h3>Bilgisayar kapansa da çalışır.</h3>
        <p>Kayıtlar işletme sunucusunda durur. Bilgisayar ve Android internet üzerinden erişir.</p>
        <p>Android'de “Veniux buluta bağlan” seçeneğini açıp aynı hesapla giriş yapın.</p>
      </article>
      <article>
        <span class="pg-where-tag">Yerel</span>
        <h3>Kayıtlar kendi bilgisayarınızda.</h3>
        <p>Telefon aynı Wi-Fi üzerinden bağlanır, bilgisayar açık kalmalıdır. Bağlantı için aşağıdaki QR adımlarını izleyin.</p>
        <p><a href="/sunucu-kurulumu">Kurulum seçenekleri</a></p>
      </article>
    </div>
    <p class="pg-small">Mevcut yerel işletmeler için kontrollü aktarım gerekir. Siteye kayıt olmak ücretli lisansı kendiliğinden açmaz; <a href="/fiyatlandirma">paketler ve lisans koşulları</a> ayrıdır. Web çalışma ekranı sunulmaz.</p>
  </div>
</section>

<div class="pg-guide"><div class="hx-wrap"><?php require __DIR__.'/terminal-guide.php'; ?></div></div>
