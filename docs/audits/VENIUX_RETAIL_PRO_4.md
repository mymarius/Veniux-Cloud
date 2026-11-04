# Veniux Cloud — Retail Pro 4.0 geliştirme ve doğrulama

Tarih: 18 Ekim 2026. Durum: yerel geliştirme, canlıya yayımlanmadı. Bu rapor bir donanım sertifikası veya tüm Retail Pro kapsamının tamamlandığı beyanı değildir.

## Mimari ve veri güvenliği

Gerçek mimari PHP web sitesi, React arayüz, Node.js API, Electron Windows ve Java Android uygulamasıdır. Laravel bulunmuyor; mimari taşınmadı. Mevcut POS/FEFO/stok/lot/KDV/iade/idempotency motoru genişletildi. Lisans ve ödeme sistemi değiştirilmedi. Üretim veritabanına bağlanılmadı. Testlerde ayrı SQLite dosyası, sentetik işletme, geçici anahtarlar ve dış HTTP isteklerini engelleyen test koruması kullanıldı. Test sonlarında geçici veritabanları ve anahtarlar temizlenir. Ekran görüntülerindeki Deneme ürünleri yalnız test fikstürüdür; gerçek ürün kataloğu olarak dağıtılmadı.

## Özelliklerin gerçek durumu

| Alan | Mevcut / geliştirilen | Doğrulama ve sınır |
|---|---|---|
| Ortak satış motoru | Mevcut motor korundu; standart, klasik market ve görselli hızlı satış modları eklendi | API regresyonu ve gerçek tarayıcı etkileşimi geçti. Mod değişimi sepeti korur. Ayrı satış motoru yok. |
| Klasik kasa | Büyük toplam, sayısal nakit klavyesi, barkoda dönüş ve mevcut klavye kısayolları | 1024×768 tarayıcı kontrolü; yatay sayfa taşması yok. Geniş tablo kendi alanında kaydırılır. |
| Görselli kasa | İşletmeye ait ürün kartları, sayfalama, favoriler, kategori rengi/tema seçimi, kullanıcıya özel hızlı işlemler | Sahte fotoğraf yok; fotoğraf olmayan kartta harf yer tutucusu var. Kategori tema seçenekleri metinseldir, özel ikon tasarım paketi değildir. |
| Ürün fotoğrafları | İstemcide küçük PNG önizlemesine dönüşüm; kimlik doğrulamalı, işletmeye özel resim erişimi | Yetkisiz erişim 401, başka işletme 404. Katalog listesi base64 fotoğraf taşımaz. Harici takip URL'si kabul edilmez. |
| Fiyat sorgusu / bekletme | Salt okunur fiyat sorgusu; aynı depo ve boş sepete geri alınabilen en çok 5 bekleyen sepet | Tarayıcıda 2 ürünlü sepet bekletildi ve 46,25 TL ile geri alındı. Bekleyen sepet satışı tamamlamaz. Taslak aynı sekme/oturum içindir. |
| Tartılı satış | kg/litre ürünlerinde açık miktar girişi; gram/kg dönüşümü; BigInt tabanlı ondalık ayrıştırma | 0,125 kg satış ve 0,025 kg kısmi iade API testi geçti. UI: 250 g elma = 0,25 kg × 45 TL = 11,25 TL. Miktar üst sınırı ve hassasiyet doğrulanır. |
| Terazi barkodu / GS1 | Mevcut değişken ağırlık/fiyat kuralı ve GTIN alternatifleri korundu | Mevcut scanner testleri geçti; tüm GS1 uygulama tanımlayıcıları veya üretici barkod biçimleri için sertifika verilmedi. |
| Seri/TCP terazi | Enjekte edilen taşıma/protokol çözümleyici arayüzü; taze/kararlı ölçüm ve zaman aşımı kontrolü | Sahte taşıma ile yazılım testi geçti. Gerçek seri/TCP cihaz taşıyıcısı, üretici protokolü ve model doğrulaması henüz yok. Otomatik tartı bağlı gösterilmez. |
| Cari/veresiye | Yönetici için cari hesap, limit, vade, ekstre, kısmi nakit tahsilat, gerekçeli borç/alacak düzeltme | Satış, cari borç ve stok aynı transaction içinde. Limit hatası her şeyi geri alır. Tahsilat açık vardiyaya nakit girişidir; ikinci kez satış geliri sayılmaz. |
| Cari iade | Aynı satışa bağlı negatif cari hareketi; ödenmiş borç iadesinde müşteri alacağı mümkün | Kısmi iade ve idempotency geçti. Müşteri alacağı otomatik nakit ödeme oluşturmaz; işletme prosedürü gerekir. |
| Çoklu ödeme | Nakit/kart/veresiye API birleşimi; mevcut UI nakit/kart bölüşümü ve ayrı tam veresiye seçimi | Üç yöntemli 0,40+0,40+0,40 TL satışın 10 mikro iadesi toplam 1,20 TL; yöntem tutarları negatif olmadı. UI'da üç yöntemi tek ekranda paylaştırma editörü yok. |
| Katalog ölçek altyapısı | İşletme ve modül kapsamlı indeksler, ID cursor, azami 100 ürün/sayfa; mevcut barkod/alternatif birim eşlemeleri ve içe aktarma motoru korundu | Tenant izolasyonu, sınır ve sayfalama test edildi. Milyon ürün yük testi yapılmadı; milyonluk veri kaynağı veya lisansı edinilmedi. Evrensel ürün bulma iddiası yok. |
| Çevrimdışı katalog | Kullanıcı/işletme kapsamında azami 250 güvenli ürün, 24 saat önbellek | Süre/izolasyon testi geçti. Önbellekten satış tamamlanmaz; fiyat ve stok için sunucu doğrulaması gerekir. Fotoğraflar çevrimdışı paketlenmez. |
| ÖKC temeli | Güvenilir sunucu modülü adaptör kaydı, kalıcı işlem kimliği, pending/unknown/success/failed; kaynak satışa bağlı iade/iptal sınırı | Bilinmeyen sonuçta yeniden tahsilat yapılmadığı test edildi. Yapılandırılmamış cihaz 503 verir. Üretici SDK'sı, onaylı cihaz ve banka mutabakatı yok. |
| ÖKC gün sonu | Yerel işlem günlüğü ve çözümlenmemiş işlemler API'si | bank_reconciled=false. Üretici/banka gün sonu raporu ile gerçek karşılaştırma henüz yok. |
| E-belge temeli | Satışın tarihsel KDV snapshot'ından müşteri/satır/vergi toplamı iç JSON taslağı | sent_to_gib=false. Resmî UBL-TR XML, entegratöre gönderme, resmî durum/iptal/başarısızlık yaşam döngüsü ve resmî arşiv henüz uygulanmadı. Eski eczane tablolarına bağlı servis açılmadı. |
| SmartCount kör sayım | Operatörden sistem miktarı gizlendi; baseline AES-256-GCM ile şifrelendi; yönetici görünümü korundu | Düz metin miktar dönmez; değiştirilmiş token reddedilir. Mevcut raf/lot/onay/idempotent düzeltme testleri geçti. |
| SmartCount taslak | Aynı sekmede kullanıcı/işletme/depo/reyon kapsamında 8 saatlik sayım taslağı; özgün baseline korunur | Otomatik stok düzeltmez. Sunucu yeniden başlarsa baseline geçersizleşir, yeniden sayım gerekir. Cihazlar arası dayanıklı offline outbox değildir. |
| Sayım sırasında satış | Mevcut snapshot çatışması denetimi korundu | Stok değişirse çelişkili düzeltme reddedilir ve yeniden sayım gerekir. Hareketleri otomatik denkleştiren kesintisiz canlı sayım ve görev atama kuyruğu henüz yok. |
| Kurulum rehberi | Mevcut sihirbaza kullanıcı POS modu tercihi ve donanım sınırları eklendi | İlk kurulum regresyonları geçti. Desteklenmeyen donanım çalışır gösterilmez. Yeni EXE/APK paketlenmedi. |
| Yetki/onay | Yönetici ve mevcut kasiyer yetkileri; şirket kapsamı olmayan yöneticinin cari/cihaz erişimi engellenir | Tenant ve rol izolasyonu geçti. İşlem başına ayrı yönetici onay kuyruğu yeni özellik olarak uygulanmadı. |

## Gerçek test sonuçları

Son tam regresyon: `.local/customer-experience/run-c0d153688ebd6241`.

| Paket | Gerçek sonuç | Kanıt |
|---|---|---|
| API/iş akışı — 16 Jest paketi | **162 PASS, 0 FAIL** | `jest.json`, `backend.log` |
| Paylaşılan miktar/önbellek/taslak, scanner, kurulum ve baskı sözleşmeleri | **34 PASS, 0 FAIL, 0 SKIP** | `presentation.log` |
| React üretim derlemesi | **PASS, çıkış 0** | `frontend-build.log`; çıktı yalnız bu izole koşu klasöründedir |
| Sanal donanım laboratuvarı | **162 PASS, 0 FAIL, 5 BLOCKED, 5 NOT TESTED** | `.local/hardware-lab-runs/run-e7fb0d54fa52a3915b0b1cb9/summary.json`; ayrıntılar `docs/VENIUX_HARDWARE_TEST_REPORT.md` |
| Android Java derleme kontrolü | **PASS** | Aynı donanım koşusunun `android-compile.log`; emülatör testi değildir |
| Android Emulator / üretici tuşu | **BLOCKED** | ADB/Emulator/AVD bulunamadı; `environment.json` |
| Temiz Windows kurulumu | **BLOCKED** | Windows Sandbox/uygun VM bulunamadı; installer_executed=false |
| Gerçek ESC/POS ve fiziksel çıktı | **NOT TESTED / adaptör eksik** | HTML 58/80 mm fiş testi fiziksel termal baskı değildir |
| Kod kalite taraması | Çalıştırılan değişen arayüz dosyalarında hata yok; uyarılar var | Kullanılmayan import, hook bağımlılığı/ref temizleme uyarıları tam lint temizliği olarak sunulmaz |

Paketlerin ortak testleri vardır; 162+162 sayısı benzersiz test toplamı olarak sunulmaz. Engelli/yapılmamış işler başarı sayısına eklenmedi. İlk tam regresyondaki üçlü ödeme testi gerçek bir hata buldu: ödeme girişi iki yöntemle sınırlıydı. Sınır üç yönteme çıkarıldı; mevcut iş kuralları/assertion'lar kaldırılmadı. Gerçek tarayıcı da başlangıçtaki değişken sırası hatasını buldu; düzeltildi ve tam paket yeniden geçti. Bir çalıştırma ortamın çocuk süreç kısıtıyla başlayamadı; izinli tekrarın gerçek sonuçları yukarıdadır.

### Gerçek tarayıcı kabul kontrolü

Yalnız loopback izole önizleme, sentetik kullanıcı ve ürünlerle:

1. Görselli karttan süt eklendi: 35,00 TL.
2. Klasik/görselli mod değişiminde sepet korundu.
3. 250 gram elma eklendi: 11,25 TL; toplam 46,25 TL.
4. İki ürünlü sepet bekletildi; boş sepete aynı tutarla geri alındı.
5. Onay düğmesiyle deneme satışı tamamlandı; sepet boşaldı, vardiya nakdi 46,25 TL oldu.
6. Gerçek 80 mm HTML önizlemede matrah 42,05 TL, KDV 4,20 TL, toplam 46,25 TL görüldü. Bu örnek ürünlerin test KDV oranı %10'dur; gerçek ürün vergisi tavsiyesi değildir.
7. 1024×768 klasik ve görselli görünümde sayfa yatay taşması yok. 390×844 dar tarayıcıda yerleşim oturduktan sonra clientWidth=scrollWidth=384; gerçek Android cihaz testi değildir.
8. Son tarayıcı konsolunda error kaydı yok. Geçici ekran ölçüsü sıfırlandı.

Kanıt görüntüleri: `.local/retail-pro/visual-1024.png`, `.local/retail-pro/classic-1024.png`, `.local/retail-pro/kasa-onizleme.png`. Bunlar sentetik verili yerel önizleme; son nakit onay metni düzeltmesi ilk ekran görüntüsünden sonra yapılmış ve son üretim derlemesi tekrar geçmiştir.

## Dosya bazında değişiklikler

| Dosya | Değişiklik |
|---|---|
| `backend/src/database/migrations/031_retail_pro.sql` | Eklemeli medya, cari defter ve harici işlem tabloları/indeksleri; eski müşteri satırları yeniden yazılmaz |
| `backend/src/database/mysql/002-retail-pro.json` | Yeni tam şema manifesti; uygulanmış 001 değiştirilmedi |
| `tools/retail-pro/build-mysql.cjs` | Eski manifesti aynen geri koruyarak yeni şema üretimi |
| `backend/src/services/retailProService.js` | Kullanıcı mod/favori/tema/hızlı işlem tercihleri; sınırlı tenant katalog ve özel resim servisi |
| `backend/src/services/retailCreditService.js` | Cari hesap/ekstre/limit/vade/tahsilat/iade/düzeltme ve audit |
| `backend/src/services/retailExternalService.js` | ÖKC adaptör sınırı, idempotent günlük, durum sorgusu ve iç e-belge DTO'su |
| `backend/src/routes/scannerRoutes.js` | Kimlik/rol korumalı Retail Pro uçları |
| `backend/src/services/retailDailyService.js` | Tartılı miktar, veresiye satış, üçlü ödeme ve kümülatif iade dağılımı |
| `backend/src/services/retailReceipt.js` | Veresiye/vade bilgisini mevcut fişe ekleme |
| `backend/src/services/retailShiftService.js` | Cari hareketleri nakit hesabından ayırma; tahsilat kasaya girer |
| `backend/src/services/retailReportingService.js` | Gün raporunda veresiye satış/iade toplamları |
| `backend/src/services/wmsCountReviewService.js` | Kör baseline şifreleme, operatör miktar gizleme; eski token uyumu |
| `shared/retailPro.mjs` | Ondalık miktar, klavye ve kararlı/taze terazi verisi doğrulaması |
| `shared/scaleAdapter.mjs` | Enjekte edilen seri/TCP taşıma ve protokol sözleşmesi |
| `shared/retailCatalogCache.mjs` | Sınırlı/süreli, tenant ve kullanıcıya özel salt okunur katalog önbelleği |
| `shared/countDraft.mjs` | Orijinal sayım baseline'ını koruyan sekme taslağı |
| `frontend/src/components/RetailProTools.jsx` | Modlar, katalog/favoriler, tartı tuş takımı, fiyat, cari ve donanım rehberi |
| `frontend/src/components/RetailProductImage.jsx` | Kimlikli blob resim yükleme ve object URL temizliği |
| `frontend/src/components/RetailModeSetup.jsx` | İlk kurulumda POS görünümü tercihi |
| `frontend/src/pages/RetailPro.css` | Kapsamlı olmayan, yalnız yeni kasa modlarına ait duyarlı mavi/turuncu stiller |
| `frontend/src/pages/RetailPos.jsx` | Aynı satış motoruna modlar/tartı/cari/bekletme; eşzamanlı ürün eklemede ödeme engeli; nakit onay metni |
| `frontend/src/pages/CustomerSetup.jsx` | Mevcut donanım adımına mod seçimi |
| `frontend/src/pages/wms/WMSCycleCount.jsx` | SmartCount kör görünüm, taslak kurtarma ve eski lokasyon isteği koruması |
| `frontend/src/components/RetailDayReport.jsx` | Veresiye netinin gösterimi |
| `frontend/src/components/RetailShiftPanel.jsx` | Vardiyada veresiye neti |
| `backend/tests/retailPro.test.js` | 13 yeni API/iş kuralı testi |
| `shared/retailPro.test.mjs` | 6 miktar/terazi/cache/taslak testi |
| `tools/customer-experience/run.cjs` | Mevcut izole test koşusuna yeni testler ve odaklı seçenek |
| `tools/customer-experience/preview.cjs` | İzole Retail Pro tarayıcı fikstürü; gerçek müşteri verisi kullanmaz |
| `docs/VENIUX_HARDWARE_TEST_REPORT.md` | Gerçek tam laboratuvar koşusuyla yenilendi |
| `docs/audits/VENIUX_RETAIL_PRO_4.md` | Bu kapsam, dosya ve yayın engeli raporu |

## Kalan riskler ve canlıya çıkış engelleri

### Lansman öncesi zorunlu

- Yeni şema yalnız test DB'lerinde uygulandı. Üretim yedeği, geri dönüş planı, gerçek DB motoruna göre kopya veri üzerinde migration provası ve kontrollü yayın gerekir. Gerçek MySQL üzerinde bu manifest çalıştırılmadı.
- Cari hesap limit/borç/tahsilat politikası ve ödenmiş satış iadesi iş akışı işletme pilotunda onaylanmalı. Service/API append-only ve audit vardır; DB yöneticisine karşı WORM/değiştirilemez mali arşiv değildir.
- Mevcut haklar dışında her indirim/iptal için ayrı amir onayı isteniyorsa ek onay iş akışı geliştirilmelidir.
- Harici adaptör status sorgusu henüz süre sınırına sahip değildir; gerçek adaptör bağlanmadan kontrollü timeout/iptal ve hata sözleşmesi tamamlanmalı. Execute 5 saniye sonra unknown olur; devam eden fiziksel işlem körlemesine tekrarlanmaz.
- Resimler sunucuda imza/IHDR/boyut ile sınırlanır; tam PNG decode/CRC ve ileri içerik taraması yoktur. Büyük katalogda resim depolama/istek yükü ayrıca ölçülmeli.
- EXE/APK oluşturulup cihaz kabulü yapılmadan kaynak değişiklikleri mevcut indirilebilir paketlerde varmış gibi duyurulmamalı. Bu çalışmada paket/yayın oluşturulmadı.

### Tamamlanması gereken yazılım kapsamı

- Kesintisiz çevrimdışı satış ve cihazlar arası güvenli outbox/senkronizasyon.
- SmartCount canlı satış hareketlerini otomatik mutabakat, kalıcı görev atama ve cihazlar arası taslak.
- Resmî e-belge XML/UBL doğrulama, gönderim, yaşam döngüsü ve resmî arşiv.
- ÖKC gerçek cihaz gün sonu karşılaştırması ve operatör arayüzü; üç yöntemli ödeme UI editörü.
- Lisanslı harici ürün veri kaynağı, marka/ürün öneri servisi ve milyon kayıtlı veriyle gerçek performans testi.

### Dış bağımlılık / fiziksel doğrulama

- Terazi marka/model/protokolü, gerçek taşıma adaptörü ve kalibrasyon; USB/seri/TCP kesinti/kararsız ağırlık testleri.
- ÖKC üretici SDK'sı/izinleri, mali cihaz sertifikasyonu, banka tahsilat/iade ve gün sonu kabulü.
- Yetkili e-belge entegratörü test hesabı, GİB/entegratör kabulü. İç JSON taslağı resmî belge değildir.
- Gerçek HID/Bluetooth okuyucu, Android üretici tarama tuşu/kamera, 58/80 mm termal baskı, ESC/POS kod sayfası/kesici ve kağıt bitmesi.
- Android Emulator/gerçek cihaz ve temiz Windows VM kurulumu; SmartScreen/kod imzası ayrı değerlendirme. Bu koşu imza durumunu yeni bir paket üzerinde doğrulamadı.
- Gerçek işletme pilotu ve gerçek milyon ürün yükü henüz yapılmadı.

Canlıya yayın, üretim DB değişikliği, ücretli servis etkinleştirme ve fiziksel donanım uyumluluk garantisi verilmedi. Uygulanan yazılım kapsamının çalıştırılabilir testleri geçti; yukarıdaki eksikler tamamlanmadan tüm Retail Pro 4.0 kapsamı bitmiş sayılmaz.
