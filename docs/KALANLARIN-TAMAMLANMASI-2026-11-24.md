# "Kalanlar" listesinin uygulanması — 24 Kasım 2026

Yerel çalışma; **canlıya alınmadı** (şema 035 canlı veritabanına uygulanmadı). Her madde için gerçek durum:

## 1. Para birimi
- **Kasada döviz ödeme (ana para birimi AZN vb.):** `currencyService` ana para birimine göre genelleştirildi. Yabancı para = ana birim dışındaki desteklenen paralar (TRY ana birimde liste eskisi gibi USD/EUR/GBP; AZN ana birimde TRY/USD/EUR/GBP). Kur = "1 birim yabancı paranın ana birim karşılığı" (sütun adı `rate_try` eski ad olarak kaldı). Otomatik TCMB kuru yalnız TRY ana birimli işletmede açılabilir (diğerlerinde 400). Kasa, kur penceresi ve ürün döviz fiyatı ekranları ana birime bağlandı. Test: `currencyBase.test.js`.
- **Sunucu tarafı ₺/TL metinleri:** fiş (satışın para birimi anlık görüntüye yazılır), brüt kâr Excel biçimi, çevrimdışı fiyat uyuşmazlığı notu, satın alma siparişi belgesi, kasa farkı, stok düşüşü ve sayım uyarıları, restoran iade mesajı artık işletmenin para birimini kullanır (TRY için çıktı değişmedi; AZN yazıcıda "AZN"). **Bilerek dokunulmadı:** e-fatura/UBL-TR (Türk yasal belgesi, TRY/TL kalmalı), online mağaza ödemeleri (iyzico TRY), Veniux'un kendi paket fiyatları, CRM fırsat tutarı açıklamaları (işletme bağlamı yok), demo hesap örnek verisi.
- **`purchase_orders.currency`:** şema 035 ile eklendi; sipariş oluşturulurken işletmenin ana para birimi yazılır, belge bunu kullanır.

## 2. Azerbaycanca arayüz (kısmen)
- **Altyapı tamam:** `frontend/src/i18n/` — Türkçe metin anahtardır, çeviri yoksa Türkçe görünür; dil: açık seçim (cihazda) > ana para birimi AZN ise Azerbaycanca > Türkçe. Seçici: Ayarlar → Şirket → "Arayüz dili". Yeni dil = bir dosya.
- **Çevrilen yüzeyler:** tüm menü ve grup adları (testle kapsama garantili), giriş ekranı, Toplu mal kabul sayfası (testle kapsama garantili), ortak düğmeler. **Arayüzün büyük kısmı hâlâ yalnız Türkçe** (kasa, ürün sayfaları, raporlar, ayarlar, hata mesajları, sunucu mesajları, e-postalar). Kasa gibi yoğun ekranlar metin metin `t()`'ye çevrilmeli.
- **Çeviri kalitesi:** Azerbaycan dilini ana dil kimi bilen biri tarafından **mutlaka gözden geçirilmeli** (ticaret/mühasebe terimleri). Sayı/tarih biçimi hâlâ Türkiye biçiminde.

## 3. Barkod sağlayıcı kalıcılığı
- Şema 035: `barcode_provider_settings` (platform sıra/etkinlik), `barcode_provider_usage` (gün/sağlayıcı/işletme sayaçları). Kullanım belleğe yazılır, 60 sn'de bir ve kapanışta toplu kalıcı yazılır; tablo yoksa sessizce bellek davranışı. `GET/PUT /api/retail/lookup/providers` (yalnız platform yöneticisi; son 30 gün kalıcı kullanım dahil). Veritabanı kaydı ortam değişkeni varsayılanını geçersiz kılar; anahtarı olmayan ücretli sağlayıcı yine etkin sayılmaz. **Arayüz yok** (platform yöneticisi için API; ekran yazılmadı).
- GS1 Türkiye ve yerel Türk veri tabanları eklenmedi (erişim/fiyat doğrulanmadı).

## 4. Ortak katalog
- Şema 035: `shared_catalog_votes`, `shared_catalog_products`, `tenants.catalog_sharing` (varsayılan 1). Yeni ürün barkodlu kabulle oluşunca (tek ya da toplu kabul) işletmenin oyu yazılır; en az 2 farklı işletme aynı barkodu girince en çok oy alan ad yayımlanır ve `shared` sağlayıcısı olarak (varsayılan sıra `shared,off`) öneri verir. Fiyat/stok/işletme kimliği saklanmaz. İşletme Ayarlar → Şirket'ten katkıyı kapatabilir. Kapsam kullanıma bağlı büyür; **ilk günlerde boştur**. Ürünler yalnız kabul akışından beslenir (ürün ekranı/Excel içe aktarımı katkı vermez).

## 5. Kullanıcıya şube/depo atama — **düzeltme**
Önceki raporda "yok" demiştim; **yanlıştı.** `user_access_scopes` + `user_warehouse_access` (şema 027), yönetici arayüzü (`AccessScopeEditor`), denetim kaydı ve `warehouseAccessScope.test.js` zaten var. Eski inceleme belgesi (`AUTHORIZATION-REVIEW.md`, 7 Ekim) güncel değildi. Bu oturumda yeni iş yapılmadı.

## 6. Faz 6, 7, 8, 10
- **Koli barkodu WMS sayımı:** `/retail/lookup?any=1` depo ürünlerini de çözer, sayım ekranı bunu kullanır (test: `lookupWmsPack.test.js`).
- **Faz 7 (Zebra/DataWedge):** klavye (HID) modu zaten çalışır. Yeni: DataWedge "Intent output" (action `com.veniux.companion.SCAN`) için Android alıcı + web olayı (`veniux-hw-scan`) + tarayıcı kancası; Java **derlendi** ama **gerçek cihazda ve APK olarak denenmedi**. DataWedge profili cihazda elle yapılandırılmalı.
- **Faz 8 (donanım):** `tools/hardware-sim/` — CAS/Toledo/Dibal/genel terazi simülatörü (TCP, mevcut ayrıştırıcıyla gidiş-dönüş testli) ve ESC/POS yazıcı havuzu (TCP; etiket baytlarını fiş metnine, kesme ve çekmece komutuna çözer). `node tools/hardware-sim/index.cjs --scale=cas --printer=9100`. Gerçek cihaz davranışını (kod sayfası, kağıt bitti, hata kodları) taklit etmez. Ayrı bir "donanım soyutlama katmanı" yazılmadı: mevcut modüller (ESC/POS üreticisi, terazi ayrıştırıcı/adaptörü, ÖKC sürücü çerçevesi, tarayıcı köprüsü) olduğu gibi duruyor; yeni bir katman kullanılmayacak kod olurdu.
- **Faz 10 (güvenlik):** `GUVENLIK-INCELEMESI-2026-11-24.md` (sınırlı kapsam, sızma testi değil).

## Şema 035 (canlıya alınmadı)
SQLite `066_catalog_and_provider_state.js`; MySQL manifesti `035-catalog-provider-state` (yükseltici güvenli sütun + yeni tablo destekler). `yayinla.py` kapısı 035'e güncellendi. MySQL 8.4 yükseltme testi geçti (yeni 035 testi dahil); MariaDB'de denenmedi (canlı MariaDB; 034'te benzer sütun ekleme sorunsuzdu). Canlıya alma: yedek → kaynak yükle → `run stage` → `upgradeAdditive` → `--record-deployment` → yeniden başlat.

## Bilinen eksikler
Arayüzün çoğunun Azerbaycanca çevirisi; ortak katalog için ürün ekranı katkısı; barkod sağlayıcı yönetim ekranı; `products.sku` küresel benzersizlik (güvenlik bulgusu 1); gerçek cihaz testleri (DataWedge, yazıcı, terazi); sızma testi.

## İkinci tur (aynı gün)
- **Sayı biçimi:** Azerbaycan ve Türkiye aynı biçimi kullanır (binlik nokta, ondalık virgül); ayrı bir iş gerekmedi. Önceki "sayı biçimi Türkiye biçiminde" notu geçersiz.
- **Çeviri:** kasa (RetailPos), hızlı ürün ekleme, ana sayfa ve şirket ayarları sayfalarının metinleri çevrildi (`tools/i18n/extract.cjs`; yalnız sözlükte karşılığı olan metinler sarılır; testle kapsama garantili). Kasada hâlâ Türkçe kalan parçalar var (iç içe iletişim kutuları, hata mesajları, ürün/rapor/ayar sayfaları, sunucu mesajları). Tarayıcıda AZN + Azerbaycanca ile kasa, ana sayfa ve hızlı ekleme denendi: ₼ ve Azerbaycanca metinler görünüyor, çökme yok.
- **Kasada "TL" sızıntısı düzeltildi:** `posMoneyInput.moneyLabel` işletmenin para birimini kullanıyor.
- **Barkod sağlayıcı yönetim ekranı:** Platform yöneticisi → API Yönetim Merkezi altında "Barkod sağlayıcıları" (sıra, aç/kapa, son 30 gün kullanım, anahtar tanımlı mı).
- **Ortak katalog katkısı:** ürün ekranından (POST /products) ve Excel içe aktarımından eklenen barkodlu ürünler de katkı verir.
- **CRM:** fırsat etkinlik açıklamasındaki ₺ kaldırıldı (CRM tabloları işletme bağlamı taşımıyor).
- **SKU benzersizliği: YAPILMADI (bilerek).** Küresel UNIQUE'i `UNIQUE(tenant_id, sku)` yapmak SQLite'ta `products` tablosunun yeniden oluşturulmasını (çok sayıda yabancı anahtar, canlı müşteri verisi) ve MySQL'de mevcut tablonun benzersiz indeksinin değişmesini gerektirir; ek yükseltici bunu desteklemez. Bulgu düşük önemli (yalnız SKU varlığı sızıntısı); ayrı bir veri taşıma planı, yedek ve prova ile yapılmalı.
