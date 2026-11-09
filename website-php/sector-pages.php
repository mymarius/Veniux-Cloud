<?php
// Sektöre özel tanıtım sayfaları: TASLAK. index.php'ye bağlı değildir; yayında görünmez.
// Yayına almak için: her sayfaya gerçek arayüz görseli (sentetik örnek işletmeyle) ekleyin, metni ürünle
// karşılaştırın, sonra index.php'de growth-pages gibi kaydedin. SEO-ALTYAPISI.md kurallarına uyun:
// yalnız gerçek özellik, uydurma yorum/puan/müşteri yok, aynı metni sayfalar arasında çoğaltmayın.
// 'status'=>'draft' olan sayfa yayınlanmamalıdır. Eczane sayfası ayrıca karar ister (ECZANE-MODULU-KALDIRILDI.md).
return [
 '/market-stok-ve-kasa-programi'=>[
  'status'=>'draft',
  'title'=>'Market Stok ve Kasa Programı | Veniux',
  'description'=>'Market ve bakkal için barkodlu kasa, stok, kampanya, veresiye ve çok şube takibi. Windows ve Android’de, internet kesilse de çalışır.',
  'headline'=>'Market için kasa ve stok, tek ekranda.',
  'subtitle'=>'Barkodu okutun, satışı kapatın; stok, kampanya ve veresiye kendiliğinden güncellensin.',
  'benefits'=>[
   'Barkodlu hızlı satış: nakit, kart, parçalı ve veresiye ödeme aynı ekranda.',
   'Kampanyalar kasada kendiliğinden uygulanır: “3 al 2 öde”, yüzde indirim, tarih aralığı.',
   'Tartılı ürün etiketleri (manav, şarküteri) barkoddan ağırlık veya fiyatla okunur.',
   'Kritik stok ve miadı yaklaşan ürün uyarısı; isterseniz e-posta veya SMS ile.',
   'İnternet kesilse de yerel kurulumda satış devam eder; yedekler otomatik alınır.',
  ],
  'keywords'=>['market programı','market stok takip programı','bakkal kasa programı','barkodlu satış programı','market otomasyonu','market veresiye defteri programı','tartılı ürün barkod okuma'],
 ],
 '/kirtasiye-stok-programi'=>[
  'status'=>'draft',
  'title'=>'Kırtasiye Stok ve Satış Programı | Veniux',
  'description'=>'Binlerce küçük ürünü barkodla takip edin; okul sezonu kampanyaları, kurum veresiyesi ve tedarikçi siparişleri tek yerde.',
  'headline'=>'Kırtasiyede binlerce ürün, karışmadan.',
  'subtitle'=>'Okul sezonunda kasa hızlansın, raf boşalmadan sipariş hazır olsun.',
  'benefits'=>[
   'Küçük ve çok çeşitli ürünler barkodla ya da adla saniyeler içinde bulunur.',
   'Sezon kampanyaları tarih aralığıyla kurulur, sezon bitince kendiliğinden durur.',
   'Okul ve kurumlara veresiye satış; vade hatırlatması ve tahsilat kaydı.',
   'Satın alma siparişi PDF olarak hazırlanır, tedarikçiye e-posta veya WhatsApp ile gider.',
   'En çok satanlar ve satılmayan (ölü) stok raporu ile rafı doğru doldurursunuz.',
  ],
  'keywords'=>['kırtasiye programı','kırtasiye stok takibi','kırtasiye kasa programı','okul sezonu stok','kırtasiye barkod programı','kırtasiye veresiye takibi'],
 ],
 '/hirdavat-stok-programi'=>[
  'status'=>'draft',
  'title'=>'Hırdavat ve Nalbur Stok Programı | Veniux',
  'description'=>'Koli/adet birimleri, tartılı ürünler, çok depo ve tedarikçi siparişleriyle hırdavat ve nalbur stoğunu düzenli tutun.',
  'headline'=>'Hırdavatta “var mı?” sorusuna anında cevap.',
  'subtitle'=>'Koli, paket ve adet karışmasın; hangi raf ve depoda ne kaldığını bilin.',
  'benefits'=>[
   'Koli ve paket barkodları: koli barkodu okutulunca içindeki adet kadar işlenir, stok adet olarak doğru kalır.',
   'Kiloyla satılan ürünler (çivi, vida) tartılı ürün olarak satılabilir.',
   'Birden çok depo ve şube; depolar arası transfer toplam stoğu şişirmez.',
   'Ustalara ve firmalara veresiye: limit, vade ve ekstre.',
   'Kritik stok uyarısı ve tedarikçiye tek tıkla sipariş belgesi.',
  ],
  'keywords'=>['hırdavat programı','nalbur stok programı','hırdavat stok takibi','nalbur kasa programı','hırdavat barkod sistemi','yapı market stok programı'],
 ],
 '/kafe-hizli-satis-programi'=>[
  'status'=>'draft',
  'title'=>'Kafe ve Büfe İçin Hızlı Satış Programı | Veniux',
  'description'=>'Görselli hızlı satış ekranı, kampanya ve sadakat puanı ile tezgâhtan satış yapan kafe ve büfeler için kasa ve stok.',
  'headline'=>'Tezgâhta hızlı satış, akşam net rapor.',
  'subtitle'=>'Ürün görsellerine dokunarak satın; hangi saatte ne sattığınızı görün.',
  'benefits'=>[
   'Görselli hızlı satış ekranı: barkodsuz ürünler bir dokunuşla sepete.',
   'Sadakat kartı: her alışverişte puan, sonraki alışverişte indirim.',
   'Saat bazlı yoğunluk raporu ile personeli doğru saate planlayın.',
   'Kasiyer bazlı satış ve gün sonu raporu.',
   'Paketli ürün (içecek, atıştırmalık) stoğu barkodla takip edilir.',
  ],
  // Dürüstlük notu: Masa/adisyon takibi ve reçeteden malzeme düşme YOK. Sayfa masa servisi vaat etmemeli.
  'limits'=>'Masaya servis (adisyon, masa takibi) ve reçeteye göre malzeme düşme şu an yoktur. Tezgâhtan satış yapan işletmeler için uygundur.',
  'keywords'=>['kafe kasa programı','büfe satış programı','kafe hızlı satış','kafe stok takibi','büfe programı','kahve dükkanı kasa programı'],
 ],
 '/eczane-yan-urun-stok'=>[
  'status'=>'draft-needs-decision',
  'title'=>'Eczanede İlaç Dışı Ürün Stoğu | Veniux',
  'description'=>'Dermokozmetik, medikal ve bebek ürünleri gibi ilaç dışı ürünlerin barkodlu stok, son kullanma ve kampanya takibi. İlaç takibi (İTS/MEDULA) yapmaz.',
  'headline'=>'Eczanenin ilaç dışı rafları için stok takibi.',
  'subtitle'=>'Dermokozmetik ve medikal ürünlerde son kullanma tarihi, kampanya ve kritik stok, tek yerde.',
  'benefits'=>[
   'Son kullanma tarihi lot bazında; yaklaşan ürün için uyarı.',
   'Dermokozmetik kampanyaları kasada kendiliğinden uygulanır.',
   'Sadakat kartıyla düzenli müşteriye puan.',
   'Kritik stok uyarısı ve tedarikçiye sipariş belgesi.',
   'Satılmayan ürün raporu ile bağlı kalan sermayeyi görün.',
  ],
  // ZORUNLU NOT: Eczane modülü 13 Ekim 2026'da kaldırıldı; site eczane tanıtımlarını bilerek kaldırdı ve
  // /eczane-stok-takibi genel stok sayfasına 301 ile yönlenir. Bu sayfa ilaç satışı, reçete, İTS, MEDULA
  // vaat etmemeli. Yayına almak ayrı bir ürün kararıdır.
  'limits'=>'İlaç satışı, reçete, İTS ve MEDULA işlemleri Veniux’ta yoktur. Bu işlemler için eczane yazılımınızı kullanmaya devam edersiniz.',
  'keywords'=>['eczane dermokozmetik stok takibi','eczane yan ürün stok','parafarmasi stok programı','medikal ürün stok takibi'],
 ],
];
