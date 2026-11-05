<section class="ho-hero">
  <div class="hx-wrap">
    <h1>Veniux nerede çalışacak?</h1>
    <p class="hx-lead">Yeni Windows kurulumunda otomatik yerel kurulum ile ayrı sunucu bağlantısı arasından seçim yapın.</p>
    <div class="ho-fork">
      <article class="ho-road">
        <span class="ho-sign">Yol A</span>
        <h2>Otomatik kurulumla devam et</h2>
        <p>Veniux gerekli yerel veritabanı bileşenlerini bilgisayarınızda hazırlar. İlk kurulumda indirme için internet gerekir. Yerel kullanımda bilgisayar açık kalmalıdır; telefon bağlantısı aynı ağdaki bilgisayar üzerinden çalışır.</p>
        <p class="ho-fit"><b>Şunun için:</b> Sunucu yönetmek istemiyorsanız.</p>
      </article>
      <article class="ho-road ho-road-ink">
        <span class="ho-sign">Yol B</span>
        <h2>Ayrı sunucu kullanacağım</h2>
        <p>Bu seçenekte istemci bilgisayarda yerel XAMPP/veritabanı kurulumu başlatılmaz. Veniux API’sinin önceden hazırlanmış olduğu sunucunuzun HTTPS adresi ilk açılışta sorulur. Sunucu hizmeti satın almak, Veniux’un kurulumunu otomatik tamamlamaz.</p>
        <p class="ho-fit"><b>Şunun için:</b> Hazır ve yönetebildiğiniz bir Veniux sunucunuz varsa.</p>
      </article>
    </div>
  </div>
</section>
<section class="ho-steps-sec">
  <div class="hx-wrap">
    <h2>Yol B'yi seçtiyseniz dört adım</h2>
    <ol class="ho-steps">
      <li><h3>Uyumlu sunucuyu seçin.</h3><p>Node.js 24 ve Veniux veritabanı gereksinimlerini karşılayan VDS/VPS veya bunları destekleyen bir hizmet kullanın. Her standart web hosting paketi uygun değildir; paketi almadan önce sağlayıcıdan uyumluluğu doğrulayın.</p></li>
      <li><h3>Sunucuyu hazırlayın.</h3><p>Veniux sunucu bileşenlerini kurun; veritabanı, alan adı ve geçerli HTTPS sertifikasını yapılandırın. Özel ayarları ve anahtarları herkese açık web klasörüne koymayın. Sunucu kurulumu ve işletme yöneticisi hesabı ayrıca tamamlanmalıdır.</p></li>
      <li><h3>Programı bağlayın.</h3><p>Windows kurulumunda “Ayrı sunucu kullanacağım” seçeneğini işaretleyin. İlk açılışta <code>https://isletmeniz.example/api</code> biçimindeki adresi girin. Bağlantı doğrulandıktan sonra geçerli Veniux lisansı ve sunucudaki işletme hesabınızla devam edin.</p></li>
      <li><h3>Mevcut kayıtları koruyun.</h3><p>Sunucu seçmek kayıtları kendiliğinden taşımaz. Mevcut işletmeniz için önce yedek ve kontrollü aktarım hazırlayın. Güncellemeler kayıtlı sunucu seçiminizi otomatik değiştirmez.</p></li>
    </ol>
    <aside class="pg-notice ho-note" aria-label="Mobil bağlantı ve bulut notu">
      <b>Telefon ve bulut</b>
      <p>Mevcut Veniux bulut kullanıcılarının bağlantısı güncellemede korunur. Android’de mevcut Veniux bulut bağlantısı veya bilgisayarınızla QR eşleştirmesi kullanılır. Ayrı sunucu seçimi bu Windows kurulum adımına aittir; sadece sunucu satın almak mobil bağlantıyı kendiliğinden yapılandırmaz.</p>
    </aside>
    <p class="ho-cta"><a class="hx-btn" href="/indir">Veniux’u indir</a></p>
  </div>
</section>
