<?php
declare(strict_types=1);
return [
 '/barkodlu-stok-takibi'=>[
  'title'=>'Barkodlu Stok Takibi: Ürün Eşleştirme | Veniux Cloud',
  'description'=>'Barkodu doğru ürün kartıyla eşleştirin. Veniux’ta barkodla ürün bulma, depo miktarını kontrol etme ve işlem öncesi doğrulama akışını inceleyin.',
  'label'=>'Barkodlu stok takibi','headline'=>'Barkodlu stok takibi: doğru ürün, doğru kayıt.',
  'intro'=>'Mağazada veya depoda barkodun karşılığını bulun; ürün, birim ve stok bilgisini işlemden önce kontrol edin.',
  'image'=>'product-barcode-v3.jpg','alt'=>'Veniux ürün listesinde barkod ve fiyat alanları; sentetik örnek ürünler',
  'caption'=>'Gerçek Veniux arayüzü, izole örnek işletme. Müşteri verisi ve fiziksel okuyucu testi içermez.',
  'solution'=>'stok','sections'=>[
   ['Barkodun karşılığını ürün kartında görün','Aynı ambalajı iki farklı ürün kartına bağlamak miktar ve fiyat takibini zorlaştırabilir. Ürünü kaydetmeden önce katalogda arayın. Barkod bir metin alanıdır; baştaki sıfırları koruyun ve üretici kodunu rastgele oluşturmayın.'],
   ['Okuma ile stok hareketini ayırın','Barkodu bulmak tek başına giriş, satış veya transfer değildir. Veniux’ta ilgili ürünün kaydını inceleyip yapılacak işlemi ayrıca seçersiniz. Kabulde depo ve miktarı; satışta ürün ve adedi kontrol edin.'],
   ['İlk denemeyi küçük bir ürün grubunda yapın','Bir ürünün barkodunu eşleştirin, açılış miktarını doğrulayın ve bir kabul örneği kaydedin. Ardından satış ve iade hareketlerini inceleyin. Aynı gönderimi tekrar denemek yeni stok düşümü oluşturmamalıdır.'],
   ['Hangi bağlantı kullanılacak?','USB/HID, seri okuyucu ve telefon kamerası farklı kullanım yollarıdır. Veniux’un Android ve Windows akışları geçerli lisans ve yetkilere bağlıdır. Kullanacağınız okuyucunun modeli, bağlantısı ve sonlandırma ayarı gerçek cihazda ayrıca doğrulanmalıdır.'],
  ],'related'=>['/stok-yonetimi'=>'Ürün ve stok yönetimi','/depo-yonetimi'=>'Mal kabul ve depo','/el-terminali-depo-yonetimi'=>'Terminal iş akışı'],
 ],
 '/son-kullanma-tarihi-takibi'=>[
  'title'=>'Son Kullanma Tarihi Takibi ve Stok Kontrolü | Veniux',
  'description'=>'Yaklaşan ve geçmiş tarihli lotları ayırın. Veniux’ta son kullanma tarihi görünümü, FEFO satış kontrolü ve iade durumlarını örnek ekranla inceleyin.',
  'label'=>'Son kullanma tarihi takibi','headline'=>'Son kullanma tarihi takibi: lot bazında kontrol.',
  'intro'=>'Depodaki fiziksel miktarı, satışa uygun miktar ve lot tarihiyle birlikte değerlendirin.',
  'image'=>'product-expiry-v2.jpg','alt'=>'Veniux stok ve lot takibinde tarihi yaklaşan örnek lot listesi',
  'caption'=>'Gerçek tarih kontrol ekranı; tarihler ve ürünler sentetik test kayıtlarıdır. Mevzuat veya sektör sertifikası iddiası değildir.',
  'solution'=>'lot','sections'=>[
   ['Tarih kontrolü doğru kabul kaydıyla başlar','Son kullanma tarihini ambalajdan doğrulayarak ilgili lota kaydedin. Katalog barkodu ile lot numarası farklı alanlardır. Eski kayıtta bulunmayan bir tarihi tahmin ederek doldurmayın.'],
   ['Yaklaşan ve geçmiş tarihleri ayrı inceleyin','Veniux stok ve lot panelinde tarih aralığı seçilerek yaklaşan partiler incelenebilir. Geçmiş tarihli lotlar ayrı gösterilir. Toplam depo miktarı ile işlem için uygun miktarın aynı olmayabileceğini göz önünde bulundurun.'],
   ['FEFO uygun lotlar arasında öncelik verir','Son kullanma tarihi önce gelen uygun lot, satışta öncelikli değerlendirilir. Doğru tarih bilgisiyle kaydedilmiş geçmiş lotun kasa satışı sunucuda engellenir. Tarihsiz stok için geçmişe dönük tarih uydurulmaz.'],
   ['İadeyi yeniden satış kararıyla karıştırmayın','Ürün fiziksel olarak geri geldiğinde ilgili satış ve lot ilişkisini kontrol edin. Hasarlı veya karantina iadesi, normal satılabilir stoktan ayrı tutulmalıdır. Bir ürünün depoda bulunması satışa uygun olduğu anlamına gelmez.'],
  ],'related'=>['/lot-miat-takibi'=>'Lot bazında izlenebilirlik','/depo-yonetimi'=>'Kabul ve raf kayıtları','/barkodlu-stok-takibi'=>'Barkodla doğru ürüne ulaşın'],
 ],
 '/el-terminali-depo-yonetimi'=>[
  'title'=>'El Terminali ile Depo İş Akışları | Veniux Cloud',
  'description'=>'Veniux terminal ekranında ürün sorgulama, mal kabul, çıkış, raf transferi ve sayım akışlarını keşfedin. Cihaz kabulü ve bağlantı sınırlarını öğrenin.',
  'label'=>'El terminali ve depo','headline'=>'El terminaliyle depo yönetimi: kabul, transfer ve sayım.',
  'intro'=>'Ürün sorgulama, kabul, çıkış, raf transferi ve sayım için hazırlanmış terminal çalışma alanını inceleyin.',
  'image'=>'product-terminal-v2.jpg','alt'=>'Veniux sanal terminal ekranında ürün sorgulama, mal kabul, transfer ve sayım menüsü',
  'caption'=>'Gerçek sanal terminal ekranı, sentetik örnek işletmede alınmıştır. Fiziksel el terminali üzerinde cihaz kabulü yapıldığı anlamına gelmez.',
  'solution'=>'depo','sections'=>[
   ['İşlemin amacını önce seçin','Ürün sorgulama ile mal kabul veya çıkış aynı işlem değildir. Terminal çalışma alanında uygun modu seçin; ürün, depo, raf ve miktarı ekrandaki bilgilerle karşılaştırın.'],
   ['Konum bilgisini hareketle birlikte kaydedin','Raf transferinde kaynak ve hedef lokasyonun doğru olması gerekir. Yanlış depoya ait bir konum seçilirse işlem kaydını düzeltmeden devam etmeyin. Sayımda güncel kayıtla fiziksel miktarı karşılaştırın.'],
   ['Telefon bağlantısı ve lisans sınırını planlayın','Android bağlantısını işletmenizin yerel veya ayrı sunucu kurulumuna göre değerlendirin. Merkezi lisans doğrulanamadığında işlemler kapanır; kesintisiz çevrimdışı çalışma vaadi verilmez. Kullanıcı ve depo yetkileri terminal işlemlerinde de geçerlidir.'],
   ['Gerçek cihaz kabulünü ayrı yapın','Cihazın Android sürümü, okuyucu bağlantısı, klavye sonlandırması ve ekran ölçüsünü test edin. Eldivenle kullanım, bağlantı kopması ve tekrar gönderim senaryolarını doğrulayın. Bu sayfa bütün cihazlarda sürücüsüz uyumluluk iddia etmez.'],
  ],'related'=>['/depo-yonetimi'=>'Depo yönetimi','/barkodlu-stok-takibi'=>'Barkod eşleştirme','/program-indir'=>'Windows ve Android kurulumu'],
 ],
];
