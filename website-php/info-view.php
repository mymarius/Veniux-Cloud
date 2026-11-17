<?php
// Bilgilendirme sayfası: Veniux'un bugün ne yaptığı, neyi yapmadığı ve nasıl çalıştığı. Her kalemin durumu açıkça yazılır.
// Hazır olmayan hiçbir özellik hazırmış gibi gösterilmez; durum etiketleri yol haritasıyla aynı sözlüğü kullanır.
$infoUpdated = '17 Kasım 2026';
$have = [
    ['yes', 'Stok takibi', 'Ürün, barkod, birim ve fiyat kaydı; giriş-çıkış geçmişi; kritik seviye uyarısı; satış hızına göre sipariş önerisi (düz hesap, tahmin değil).'],
    ['yes', 'Depo', 'Mal kabul, raf ve lokasyon yerleşimi, depolar arası transfer, barkodlu hızlı sayım ve sayım farkı.'],
    ['yes', 'Lot ve son kullanma tarihi', 'Ürünü parti ve miatla takip etme, yaklaşan tarihleri görme.'],
    ['yes', 'Market kasası', 'Barkodlu satış, nakit, kart ve parçalı ödeme, vardiya, gün sonu, iade, bekleyen satış, fiş numarası. Gün sonu ve kâr raporu CSV ve Excel olarak indirilir.'],
    ['yes', 'Excel ve CSV ile ürün aktarımı', 'Dosyanızı yükler, sütunları eşleştirir, önizlemeyi görüp aktarırsınız.'],
    ['yes', 'Müşteri ve satış takibi (CRM)', 'Aday, fırsat, görev, şirket ve kişi kayıtları.'],
    ['yes', 'Sektör paketleri', 'Restoran (masa, garson, mutfak), hırdavat, züccaciye ve benzeri işletmeler için ek ekranlar. Hangisinin açık olacağı paketinize bağlıdır.'],
    ['yes', 'Android uygulaması', 'Telefon kamerasıyla barkod okuma, fiyat ve stok görme, sayım.'],
    ['yes', 'Yapay zekâ asistanı', 'Stok ve satış verileriniz hakkında Türkçe soru sorarsınız. Değişiklik gerektiren her işlem önce size gösterilir, siz onaylamadan uygulanmaz.'],
    ['yes', 'Otomatik yedekleme', 'Her gün şifreli yedek alınır; yedeğin ikinci bir kopyası harici diske yazılabilir. Ayrıntısı aşağıda.'],
    ['yes', 'Otomatik güncelleme', 'Yeni sürüm kendiliğinden indirilir. Ayrıntısı aşağıda.'],
    ['limited', 'Bulut kasası, internet kesilince', 'Nakit ve kart satış devam eder, bağlantı gelince satışlar kendiliğinden gönderilir. Kasa sayfasının önceden internetle açılmış olması gerekir; Chrome’da denendi. İndirim, iade, veresiye ve sadakat çevrimdışıyken kapalıdır.'],
    ['limited', 'Online mağaza', 'Ürünleri seçip tek adreste yayınlarsınız, siparişler stokla birlikte düşer. Kapıda ve mağazada ödeme vardır. Kartla ödeme için kendi iyzico hesabınız gerekir; bu bağlantı gerçek hesapla henüz denenmedi.'],
    ['untested', 'Terazi', 'Terazi etiketindeki barkod bugün okunur. Kasada seri port üzerinden kablolu terazi bağlantısı Windows’ta 2.4.82 ile eklendi (CAS, Mettler Toledo, Dibal/Bizerba ve genel düz satır çıktı). Gerçek bir terazide denenmedi.'],
    ['untested', 'Pazaryeri bağlantıları', 'Trendyol: sipariş, stok, iade ve hakediş çekme var, gerçek mağazada denenmedi. Hepsiburada ve N11: bağlantı altyapısı eklendi, gerçek mağazada denenmedi; bağlantı kapalı kaydedilir, siz açarsınız.'],
];
$plan = [
    ['build', 'Mağaza ile bulutun kendiliğinden eşitlenmesi', 'Yapım aşamasında.'],
    ['plan', 'Yazarkasa (yeni nesil ÖKC) entegrasyonu', 'Planlanıyor. Satışlarınız bugün yazarkasadan geçmez; yasal olarak yazarkasa gerekiyorsa mevcut yazarkasanızı kullanmaya devam edin.'],
    ['plan', 'e-Fatura, e-Arşiv ve e-İrsaliye', 'Planlanıyor. Bugün mükellef sorgulama vardır; gerçek belge gönderimi kapalıdır. Faturalarınızı mevcut yönteminizle kesmeye devam edin.'],
    ['plan', 'Logo, Mikro ve Paraşüt’e doğrudan aktarım', 'Planlanıyor. CSV ve Excel aktarımı bugün vardır.'],
    ['no', 'iPhone uygulaması', 'Yok. Telefon desteği Android içindir.'],
];
$chips = ['yes' => ['Bugün var', 'yes'], 'limited' => ['Bugün var, sınırlı', 'limited'], 'untested' => ['Denenmedi', 'untested'], 'build' => ['Yapım aşamasında', 'build'], 'plan' => ['Planlanıyor', 'plan'], 'no' => ['Yok', 'no']];
$faq = [
    ['Veniux’u denemek için ne yapmalıyım?', '14 günlük deneme hesabı açabilir, kendi ürünlerinizi ekleyip kasayı ve stoku deneyebilirsiniz. Önce bir iki gün gerçek ürünlerinizle deneyin, sonra karar verin.'],
    ['Verilerim nerede duruyor?', 'Windows kurulumunda kendi bilgisayarınızda ya da ayrı bir sunucuda. Bulut kullanıyorsanız bulut sunucusunda. Seçenekler için <a href="/sunucu-kurulumu">kurulum seçenekleri</a> sayfasına bakın.'],
    ['Bilgisayarım bozulursa verilerimi kaybeder miyim?', 'Yedeğin ikinci bir kopyasını harici diske yazdırıyorsanız ve kurtarma kodunu sakladıysanız hayır. İkisini de yapmadıysanız evet, risk vardır. Aşağıdaki yedekleme bölümünü okuyun.'],
    ['Kasa yazarkasa yerine geçer mi?', 'Hayır. Veniux satış ve stok takibi yapar; yeni nesil yazarkasa entegrasyonu henüz yoktur.'],
    ['Resmî fatura kesebilir miyim?', 'Hayır, henüz. e-Fatura ve e-Arşiv gönderimi planlanıyor. Faturalarınızı mevcut yönteminizle kesmeye devam edin.'],
    ['Hangi barkod okuyucu çalışır?', 'Klavye gibi yazan okuyucular ve telefon kamerası. Özel bir cihazınız varsa önce bize sorun.'],
    ['Ürünleri tek tek mi gireceğim?', 'Hayır. Excel veya CSV dosyanızı yükler, sütunları eşleştirir ve önizlemeden sonra aktarırsınız.'],
    ['Yapay zekâ benim yerime bir şey yapar mı?', 'Hayır. Değişiklik gerektiren her şeyi size gösterir ve siz onaylayınca uygular. Ürün ve fatura fotoğrafından okunan hiçbir şey siz onaylamadan stoğa işlenmez.'],
];
?>
<section class="ho-hero">
  <div class="hx-wrap">
    <h1>Veniux hakkında bilmeniz gereken her şey</h1>
    <p class="hx-lead">Veniux, işletmenizin stoğunu, deposunu ve kasasını bir arada tutan bir programdır. Bu sayfa neyi bugün yaptığını, neyi yapmadığını ve nasıl çalıştığını olduğu gibi anlatır. Hazır olmayan hiçbir şeyi hazırmış gibi göstermiyoruz.</p>
    <p class="hx-lead"><small>Son güncelleme: <?=e($infoUpdated)?>. Fiyatlar için <a href="/fiyatlandirma">fiyatlandırma</a> sayfasına bakın.</small></p>
    <p class="ho-cta"><a class="hx-btn" href="/program-indir">Veniux’u indir</a> <a class="hx-btn hx-btn-ghost" href="/#iletisim">Bize yazın</a></p>
  </div>
</section>

<section class="hx-plain hx-roadmap" id="bugun">
  <div class="hx-wrap">
    <h2>Bugün neler var?</h2>
    <p class="hx-road-lead">Her kalemin yanındaki etiket gerçek durumu söyler. “Denenmedi”, kodu yazıldı ama gerçek cihaz veya hesapla sınanmadı demektir.</p>
    <ol class="hx-road">
<?php foreach($have as [$state,$name,$text]):?>
      <li data-s="<?=e($chips[$state][1])?>"><span class="hx-chip"><?=e($chips[$state][0])?></span><div><strong><?=e($name)?>.</strong> <?=e($text)?></div></li>
<?php endforeach;?>
    </ol>
  </div>
</section>

<section class="hx-plain hx-roadmap" id="yok">
  <div class="hx-wrap">
    <h2>Neler henüz yok?</h2>
    <p class="hx-road-lead">Tarih vermiyoruz. Hazır olduğunda burada yazacak.</p>
    <ol class="hx-road">
<?php foreach($plan as [$state,$name,$text]):?>
      <li data-s="<?=e($chips[$state][1])?>"><span class="hx-chip"><?=e($chips[$state][0])?></span><div><strong><?=e($name)?>.</strong> <?=e($text)?></div></li>
<?php endforeach;?>
    </ol>
  </div>
</section>

<section class="ho-steps-sec" id="kurulum">
  <div class="hx-wrap">
    <h2>Kurulum ve ilk gün</h2>
    <ol class="ho-steps">
      <li><h3>Programı indirin.</h3><p>Windows için kurulum dosyasını, Android için uygulamayı <a href="/program-indir">indirme sayfasından</a> alın. Her dosyanın SHA-256 özeti <a href="/surum-arsivi">sürüm arşivinde</a> yazılıdır; indirdiğiniz dosyayı bununla doğrulayabilirsiniz.</p></li>
      <li><h3>Windows uyarısı çıkabilir.</h3><p>Kurulum dosyası henüz kod imzalı değildir. Windows “bilgisayarınızı korudu” diyebilir. Dosyayı bu siteden indirdiyseniz <b>Ek bilgi</b> ve ardından <b>Yine de çalıştır</b> ile devam edebilirsiniz. İmzalı kurulum için çalışıyoruz.</p></li>
      <li><h3>Verileriniz nerede olsun?</h3><p>Otomatik yerel kurulumda veritabanı bilgisayarınızda hazırlanır; ilk kurulumda indirme için internet gerekir, bilgisayar açık kalmalıdır. Bilgisayara kurulumda internet kesilse de satış sürer. Ayrı sunucu da seçebilirsiniz. <a href="/sunucu-kurulumu">Kurulum seçenekleri</a></p></li>
      <li><h3>Ürünlerinizi girin, kasayı açın.</h3><p>Ürünleri Excel/CSV ile aktarın ya da tek tek ekleyin. Kasayı ilk açarken başlangıç nakdini girip vardiyayı açın, barkodu okutup ödemeyi alın. Gün sonu raporu aynı ekrandadır.</p></li>
    </ol>
  </div>
</section>

<section class="hx-plain" id="yedekleme">
  <div class="hx-wrap">
    <h2>Yedekleme: bilgisayar bozulursa ne olur?</h2>
    <p class="hx-lead">Verileriniz kendi bilgisayarınızdaysa, o bilgisayar bozulduğunda yedeğiniz de içindeyse her şey gider. Bu yüzden iki şeyi sizin yapmanız gerekir.</p>
    <div class="ho-fork">
      <article class="ho-road">
        <span class="ho-sign">Program yapar</span>
        <h2>Her gün şifreli yedek</h2>
        <p>Son 7 günü, 4 haftayı ve 12 ayı saklar. Yedekler şifrelidir. Program yedeklerin gerçekten açılabildiğini zaman zaman kendisi dener; açılamazsa ekranda uyarı çıkar.</p>
      </article>
      <article class="ho-road ho-road-ink">
        <span class="ho-sign">Siz yaparsınız</span>
        <h2>İkinci konum ve kurtarma kodu</h2>
        <p>Ayarlar → Sistem → Yedekleme ekranında yedeğin ikinci kopyası için harici disk veya USB bellek seçin. Aynı ekrandaki <b>kurtarma kodunu</b> bir kâğıda yazıp saklayın; kod olmadan yedek açılmaz. Bilgisayarınız bozulursa yeni bilgisayarda yedeği bu kodla geri yüklersiniz.</p>
      </article>
    </div>
  </div>
</section>

<section class="ho-steps-sec" id="guncelleme">
  <div class="hx-wrap">
    <h2>Güncellemeler</h2>
    <ol class="ho-steps">
      <li><h3>Kendiliğinden iner.</h3><p>Program yeni sürümü arka planda indirir. Çıkan değişiklikleri <a href="/guncelleme-notlari">güncelleme notlarında</a> yazıyoruz.</p></li>
      <li><h3>Kurulum birkaç dakika sürebilir.</h3><p>Program kapanınca yeni sürüm kurulur. Bu sırada program birkaç dakika görünmeyebilir; bu normaldir. Bitince masaüstü kısayolundan açın. Sürüm numaranız Sürüm notları düğmesinde yazar.</p></li>
    </ol>
  </div>
</section>

<section class="hx-plain" id="destek">
  <div class="hx-wrap">
    <h2>Destek</h2>
    <div class="hx-supportcard">
      <div class="hx-rate-top"><span>VENİUX · DESTEK FİŞİ</span><span>E-POSTA</span></div>
      <dl>
        <div><dt>Nereden?</dt><dd><strong>Bize yazın formundan</strong><span>Size e-postayla dönelim. Ne yaptığınızı ve ekranda ne gördüğünüzü yazın, mümkünse ekran görüntüsü ekleyin.</span></dd></div>
        <div><dt>Ne zaman?</dt><dd><strong>Hafta içi 09:00–18:00</strong><span>Cumartesi 10:00–14:00</span></dd></div>
        <div><dt>Ne kadar sürede?</dt><dd><strong>Kasa satış yapamıyorsa 2 saat</strong><span>Diğer sorularda 1 iş günü içinde ilk yanıt.</span></dd></div>
      </dl>
    </div>
    <p class="ho-cta"><a class="hx-btn" href="/#iletisim">Bize yazın</a></p>
  </div>
</section>

<section class="hx-faq" id="sorular">
  <div class="hx-wrap">
    <h2>Sık sorulanlar</h2>
    <div class="hx-qa hx-qacards">
<?php foreach($faq as [$q,$a]):?>
      <div><h3><?=e($q)?></h3><p><?=$a /* kaynak bu dosya: yalnız sabit metin ve iç bağlantılar */?></p></div>
<?php endforeach;?>
    </div>
  </div>
</section>
