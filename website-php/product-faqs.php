<?php
declare(strict_types=1);
// Page-specific product questions, based on existing workflows; no device certification claims.
return [
 '/stok-yonetimi'=>[
  ['Barkodu okutmak stok miktarını değiştirir mi?','Barkod okutma ürün kartını bulmaya yardımcı olur. Stok miktarı, seçtiğiniz giriş, çıkış, satış veya iade işlemi kaydedildiğinde değişir. İşlemden önce ürünün birimini, miktarını ve seçili depoyu kontrol edin.'],
  ['Excel stok listesi programa nasıl aktarılır?','Ürün ve stok dosyasındaki sütunları izin verilen alanlarla eşleştirin; önizlemede barkod, birim ve miktarları kontrol edin. Baştaki sıfırları koruyun. Önce küçük bir örnek dosyayla deneyin ve sonuçları fiziksel sayımla karşılaştırın.'],
  ['Satıştan sonra kalan stok nasıl kontrol edilir?','İlgili ürünün stok hareketlerini inceleyin. Başlangıç miktarı, giriş, satış, iade ve transferleri seçili depo için birlikte değerlendirin. Fark varsa yeni bir düzeltme kaydı oluşturmadan önce hareketlerin nedenini araştırın.'],
 ],
 '/depo-yonetimi'=>[
  ['Depo transferi ile stok girişi arasındaki fark nedir?','Transfer mevcut miktarı kaynak depodan hedef depoya taşır; tek başına toplam işletme stoğunu artırmaz. Mal kabul ise gelen ürünü ilgili depoya kaydeder. Hedef depoya ayrıca bağımsız giriş yapmak aynı miktarın iki kez sayılmasına yol açabilir.'],
  ['Raf transferinde hangi bilgiler kontrol edilmeli?','Doğru ürün, kaynak raf, hedef raf, depo ve miktarı karşılaştırın. İşlemden sonra konum kayıtlarını inceleyin. Sayım miktarıyla kayıt farklıysa kabul, çıkış ve önceki transferleri kontrol edin.'],
  ['Depo işlemleri Android cihazdan yapılabilir mi?','Veniux Android bağlantısı ve terminal çalışma alanını işletmenizin sunucu kurulumu, lisansı ve kullanıcı yetkileriyle birlikte değerlendirin. Okuyucu tuşları, üretici SDK ve bağlantı davranışı cihaz modelinde ayrıca test edilmelidir.'],
 ],
 '/lot-miat-takibi'=>[
  ['Aynı ürünün farklı lotları neden ayrı izlenir?','Aynı ürünün partileri farklı son kullanma tarihleri ve miktarlara sahip olabilir. Toplam ürün miktarı bu ayrımı göstermez. Lot kaydını, miktarını ve ambalajdan doğruladığınız tarihi birlikte değerlendirin.'],
  ['FEFO ile son kullanma tarihi kontrolü aynı şey mi?','FEFO uygun lotlar içinde tarihi önce gelen partiye öncelik verir. Tarih kontrolü ise geçmiş tarihli lotun işleme uygunluğunu da değerlendirir. Veniux’ta doğru kaydedilmiş geçmiş lotun kasa satışı sunucu tarafında engellenir; eksik tarih tahmin edilerek doldurulmaz.'],
  ['İade edilen ürün hangi lota dönmeli?','İade miktarı ilgili satış ve lot ilişkisiyle kontrol edilmelidir. Ürünün fiziksel olarak geri gelmesi yeniden satılabilir olduğu anlamına gelmez. Hasarlı veya karantina iadelerini normal satılabilir stoktan ayrı değerlendirin.'],
 ],
];
