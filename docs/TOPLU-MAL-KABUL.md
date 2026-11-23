# Toplu mal kabul — 23 Kasım 2026

Yerel çalışma; canlıya alınmadı. Şema değişikliği YOK.

## Akış (ekran: `/magaza/toplu-kabul`, menüde "Toplu Mal Kabul", mobilde "Toplu Kabul")
Barkod okut (USB/Bluetooth okuyucu, klavyeden yazıp Enter ya da kamera) → ürün tanınır → listeye eklenir → sıradaki barkod.
- Aynı barkod tekrar okutulursa satırın adedi artar (ağ isteği yok, anında). "Her okutma ×1/×6/×10/×12/×24" ile okutma başına adet seçilir.
- Barkod listede yoksa: kendi katalog (koli/paket barkodu dahil) → etkin barkod sağlayıcıları (öneri) → boş satır. Sağlayıcı yanıt vermese bile satır eklenir, ad ve fiyat elle doldurulur.
- Yeni ürün satırında ad, birim, alış ve satış fiyatı zorunludur; eksik satırlar işaretlenir ve kaydet düğmesi kapalı kalır. Mevcut ürün satırı yalnız adet ister.
- Okutmalar sırayla işlenir (art arda hızlı okutma birbirini ezmez). Liste cihazda taslak olarak saklanır; sayfa yenilense bile kaybolmaz.
- Kayıt iki aşamalı: "Hepsini kaydet" → "N satır, M adet stoğa eklenecek…" → "Onayla ve kaydet". Onaysız stok değişmez.

## API
`POST /api/retail/receive/batch` (yönetici/müdür, `Idempotency-Key` zorunlu)
Gövde: `{ warehouse_id, lines:[ { barcode?, product_id? | name,unit,purchase_price,sale_price, quantity, pack_unit? } ] }`, en çok 500 satır.
- Tek işlemde, hepsi ya da hiçbiri. Bir satır hata verirse hiçbiri yazılmaz; hata `Satır N: …` ve `line_index` ile döner. Biçim hataları tüm satırlar için tek yanıtta (`line_errors`) toplanır.
- Aynı anahtar + aynı gövde: stok ikinci kez eklenmez, aynı sonuç döner (`replayed:true`). Aynı anahtar başka gövde: 409.
- Aynı yeni barkod birden fazla satırda gelirse ürün bir kez oluşur, sonraki satırlar ona eklenir. Koli/paket barkodu temel birime çevrilir (tek kabulle aynı kural).
- Satır başına stok hareketi (`source=retail_bulk_receive`), envanter işlemi ve denetim kaydı; ayrıca toplu kabul için özet denetim kaydı (`retail.receive_batch`).
- Tek ürün `/retail/receive` aynı satır mantığını (`retailReceiveService.receiveLine`) kullanır; davranışı değişmedi.
- Ekran 500'den uzun listeyi 500'lük parçalara böler; parçalar ayrı işlemdir (önceki parçalar kaydedilmiş kalır, ekran bunu söyler).

## Doğrulama
Backend 191 dosya/1398 test, frontend+shared 232 test geçti; yeni testler: `retailBulkReceive.test.js` (karışık kabul, geri alma, biçim hataları, sınırlar/yetki, 300 satır), `bulkReceive.test.mjs` (liste mantığı). Ekran izole bir yerel deneme hesabıyla tarayıcıda denendi: okutma, aynı barkodda adet artışı, eksik alan işaretleme, iki aşamalı onay, kayıt, taslağın temizlenmesi, kayıtlı ürünün yeniden tanınması çalıştı.

## Denenmedi / sınırlar
- Gerçek barkod okuyucu ve telefon kamerası ile denenmedi (okuyucu simülasyonu: klavye girişi). Kamera akışı yalnız mevcut BarcodeCamera bileşenine bağlandı.
- Dış sağlayıcıdan gelen öneri yolu sahte yanıtla (sağlayıcı testleri) doğrulandı; bu denemede dış katalog ürün bulamadı, bu yüzden öneri kartı ekranda görülmedi.
- Miktarlar tam sayıdır (kg gibi kesirli kabul tek ürün akışındaki gibi desteklenmez).
- MySQL'de toplu kabul testi çalıştırılmadı (mantık SQL açısından tek kabulle aynı sorguları kullanır).
- Yüzlerce satırda ekran performansı gerçek cihazda ölçülmedi (300 satır API'de 60 sn sınırı içinde kabul edildi).
- Tamamlanmamış alış faturası/irsaliye eşleştirmesi bu akışın dışında (satın alma emri kabulü ayrı).
