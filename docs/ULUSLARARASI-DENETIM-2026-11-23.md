# Veniux: Uluslararası genişleme, mimari denetim ve iş planı (23 Kasım 2026)

Durum: yalnız analiz. Kodda değişiklik yapılmadı. Bu rapor üç kaynağa dayanır: (1) koddan doğrudan okuduklarım, (2) repodaki mevcut inceleme belgeleri (bunları yeniden çalıştırmadım), (3) 23 Kasım'da yaptığım web aramaları. Her satırda hangisi olduğu belirtilir. Doğrulayamadığım şey "bilinmiyor" diye yazılır.

Sınır: Bu oturumda tüm ekranları ve tüm API uçlarını tek tek çalıştırmadım. "Tamamlandı" yalnız kodda ve mevcut testlerde karşılığı bulunan şeyler için yazıldı; gerçek cihaz, canlı sunucu ve resmî kurum testi gerektirenler ayrıca işaretli.

## 1. Mevcut durum özeti (önemli bulgular)

Prompt'ta istenen şeylerin büyük kısmı zaten var; sıfırdan değil, **Türkiye'ye sabitlenmiş bir ürünü genelleştirme** işindesiniz.

| Alan | Durum | Kanıt |
|---|---|---|
| Çok kiracılık | Tamamlandı, test edilmiş | Her tabloda `tenant_id`; firma kimliği oturumdan alınır; yabancı ürün/depo ve `x-tenant-id` değiştirme reddedilir (docs/AUTHORIZATION-REVIEW.md, 130 kontrol). Sınır: tüm uçlar pentest edilmedi |
| Roller/yetki | Tamamlandı, bir eksik | admin/manager/cashier/operator. **Kullanıcıya şube/depo atama yok**; izinli rol firmanın tüm depolarını görür. Çok şubeli müşteri için eksik |
| Ürün/stok/depo/WMS | Tamamlandı | 40+ rota, WMS (raf, toplama, sayım, lot, SKT) |
| Barkodla ürün bulma | Kısmen | Kendi katalog → Open Food Facts → elle. Önbellek ve hız sınırı var. **Sağlayıcı soyutlaması yok** (tek sağlayıcı koda gömülü), yedek sağlayıcı yok, API kullanım sayacı yok. Gerçek kapsam ölçülmedi (30–50 barkod bekleniyor) |
| `shared_catalog` (Pro vaadi) | **Eksik** | Planda etiket var, arkasında veri/kod yok (docs/BARKOD-KATMANI-2026-11-22.md). Pro paketin boş vaadi |
| Sayım | Tamamlandı | Kör sayım, hızlı sayım, istisna raporu, onay, denetim kaydı. Koli barkodu yalnız NORMAL modülde çalışıyor, WMS ürünlerinde "listede yok" |
| Toplu mal kabul | Kısmen | `RetailQuickAdd` tek tek; hızlı seri liste var, yüzlerce ürün için toplu onay akışı doğrulanmadı |
| Android | Kısmen | Electron masaüstü + Android WebView uygulaması, köprü ile istek. Çevrimdışı satış var. **Zebra/hardware tarayıcı (DataWedge) gerçek cihazda test edilmedi** |
| POS donanımı | Kısmen | ESC/POS, tartı protokolleri, ÖKC sürücü iskeleti (`services/ecr`), çekmece. **Fiziksel cihazla çoğu test edilmedi** (VENIUX_HARDWARE_TEST_REPORT.md) |
| E-belge | Kısmen | Taslak XML + sahte sağlayıcı; gerçek entegratör yok |
| Lisans/abonelik | Tamamlandı | Merkezi lisans, panel, ödeme (iyzico/PayTR bekliyor) |
| i18n | **Yok** | Çeviri altyapısı yok. Arayüz metni Türkçe olarak bileşenlere gömülü |
| Para birimi/ülke | **Kritik eksik** | Aşağıda |

### Kritik sorunlar (sıralı)

1. **Para birimi TRY'ye gömülü.** `tenants.currency` alanı var ama `frontend/src/lib/stockAnalytics.js` içinde `tl()` ve `money()` doğrudan `tr-TR` + `TRY` ile biçimliyor; 142 yerde `toLocaleString`/`Intl.NumberFormat`, 199 yerde `tr-TR`. `currencyService` yalnız USD/EUR/GBP'yi **TL'ye** çevirir (satışlar hep TL). AZN işletmesi şu an çalışamaz: tutarlar ₺ ile gösterilir.
2. **Satır başına para birimi saklanmıyor.** Satış/fatura kayıtlarında kendi para birimi alanı yok; işletme para birimini değiştirirse geçmiş rakamlar yanlış yorumlanır. İstediğiniz "geçmiş işlem orijinal para biriminde kalmalı" kuralı şu an sağlanmıyor.
3. **KDV mantığı Türkiye'ye özel.** `retailVatService.js` (23 satır), `ublTrService.js`, `tax_office` alanı: Türkiye'ye özgü. Ülke bazlı vergi kuralı katmanı yok.
4. **Dil:** Azerbaycan Türkçesi için çeviri sistemi hiç yok; çevirisiz de arayüz bozulmaz ama AZ'ye açılmak için tüm metinlerin çıkarılması gerekir (büyük iş, aşağıda tahmin).
5. **Pro paketin "hazır katalog" vaadi boş.** Satış sayfasında yazıyorsa düzeltilmeli ya da kaldırılmalı.
6. **Kullanıcı–depo/şube ataması yok** (çok şubeli müşteri için güvenlik boşluğu).
7. **Fiziksel cihaz testi yok:** Zebra, DataWedge, ÖKC, seri tartı, kamera. Bunlar bozulabilir, satış öncesi test şart.
8. Dağıtım: tek MySQL, tek Plesk Node uygulaması. 100+ müşteri için yedekleme/izleme planı gerekli (bkz. bölüm 8).

## 2. Uluslararası mimari önerisi

Mevcut kodu yeniden yazmadan, **üç katmanlı ülke yapılandırması**:

1. **`country_profiles`** (veri, kod değil): `TR`, `AZ` kayıtları. Alanlar: dil listesi, varsayılan para birimi, ondalık/yuvarlama, tarih/sayı biçimi, saat dilimi, varsayılan vergi dilimleri, fiyat KDV dahil mi, belge türleri, sağlayıcı listesi. Yeni ülke = yeni kayıt + (gerekirse) sağlayıcı eklentisi.
2. **Sağlayıcı arayüzleri** (zaten `integrations/contracts` ve `payment/PaymentProvider.js` modeli var): `TaxRuleProvider`, `FiscalDeviceProvider` (ÖKC/e-kassa), `EInvoiceProvider`, `BarcodeProvider`, `PaymentProvider`. Çekirdek modül yalnız arayüzü çağırır. Türkiye için mevcut kod bu arayüzlerin arkasına taşınır.
3. **Para ve biçim yardımcıları** tek yerde: `shared/money` (zaten `retailMoney.mjs` var, onu genişlet) → `formatMoney(amount, currency, locale)`. Tüm `tl()/money()` çağrıları buna yönlendirilir (ilk iş: 142 çağrının otomatik taranması).

Para modeli: her satış/alış/fatura satırında `currency` ve (gerekirse) `fx_rate_to_base`; tutarlar kuruşa (tam sayı) yuvarlanır (Veniux zaten tam sayı kuruş kullanıyor, `retailMoney.mjs`). İşletme taban para birimini değiştirmek **yasak** ya da yalnız "yeni dönem" başlatarak yapılır; eski kayıtlar dokunulmaz.

Dil: arayüz metinlerini `t('anahtar')` ile `tr`/`az` JSON sözlüklerine çıkarmak. Önce yalnız yeni ekranlarda ve ortak bileşenlerde başlayın; hepsini tek seferde yapmayın. AZ metni, Azerbaycanlı bir kişi tarafından gözden geçirilmeli (makine çevirisi yeterli değil; "kasa", "iade", "vergi" gibi terimler farklı).

## 3. Türkiye hazırlık raporu

| Konu | Durum |
|---|---|
| Dil/₺/biçim | Hazır |
| KDV (%1/%10/%20) | Uygulanıyor; **mali müşavir doğrulaması yapılmadı** |
| E-Arşiv/E-Fatura | Taslak var; gerçek gönderim için özel entegratör şart (docs/EARSIV-ENTEGRATOR-KARSILASTIRMA.md). Basit usul 2027 zorunluluğu repodaki notlara göre geliyor; resmî metni (GİB) siz/mali müşavir doğrulamalı |
| Yazarkasa (YN ÖKC) | Entegrasyon yok. Üretici SDK/sözleşme ve GİB teknik rehberi gerekir; sertifikasyon yükü cihaz üreticisinde olabilir ama bu doğrulanmadı. Q1 2027 |
| e-Adisyon | Herkese zorunlu değil (repodaki not, resmî kaynak doğrudan okunmadı) |
| Yasal | Şirket kuruluşu, KVKK, sözleşmeler: sizin işiniz (PLAN-1-OCAK-2027.md) |

**Hukuki bir uyum iddiası yapmayın.** Satış fişinde zaten "bilgi fişidir; mali belge yerine geçmez" notu var; bu doğru ve kalmalı.

### Donanım (Türkiye)
- USB/Bluetooth HID tarayıcı: klavye gibi çalışır, **kolay**, `shared/scanner.mjs` var.
- Android terminal (Zebra TC26, DataWedge): intent/klavye modu ile mümkün; **gerçek cihazda test edilmedi**. Cihaz almadan önce 1 adet ikinci el/kiralama ile denenebilir.
- Fiş yazıcı (ESC/POS), çekmece, tartı: kodda var; fiziksel test yok.
- Yazarkasa ve EFT-POS: üretici SDK, çoğu zaman sözleşme/sertifika/ortaklık. Teknik olarak mümkün, ticari olarak yavaş. İlk müşterilerde müşterinin kendi cihazı yanında kullanılsın.

### Barkod/ürün veritabanları (Türkiye)
- **Open Food Facts**: ücretsiz, ODbL lisans, atıf şart. Türk ürün kapsamı **ölçülmedi** (ölçüm betiği hazır, 30–50 gerçek barkod bekliyor). Kapsam yüksek diye varsaymayın.
- **Barcode Lookup / Go-UPC vb.**: ücretli, fiyatlar aramada doğrulanamadı (satıcı sayfasından teklif/plan alınmalı); ağırlıklı ABD/UPC, Türk market ürünü kapsamı şüpheli.
- **GS1 Türkiye (TOBB-GS1)**: GEPIR 2023 sonunda "Verified by GS1" ile değişti; kurumsal API ve toplu sorgu için GS1 Türkiye ile görüşmek gerekiyor. Fiyat/erişim doğrulanmadı.
- Gerçekçi strateji: kendi kataloğunu **işletmelerin onayladığı kayıtlardan** büyütmek (hazır katalog vaadinin dürüst hali) + OFF + elle giriş.

## 4. Azerbaycan hazırlık raporu

Resmî kaynaklarda doğrulananlar (aramada bulunan, taxes.gov.az kaynaklı):
- Perakende ve kamu cateringinde nakit ödemeler için sertifikalı kasa şart (Vergi Kanunu md. 16.1.8, istisnalarla). Yeni nesil **e-kassa (NKA)** programı 2019'da (Bakanlar Kurulu 52 sayılı karar) başladı; "program kassası + kontrol mekanizması" iki parçalı sistem; kasa verisi vergi bilgi sistemine gerçek zamanlı gider.
- Bu, yazılımın vergi idaresinin sistemiyle entegre olmasını gerektiriyor. **Üçüncü taraf yazılımın sertifikasyon/onay yolu araştırmamda bulunamadı.** Bu kararı verecek tek yol: Vergiler Nazirliği (DVX) ve mevcut onaylı yazılım sağlayıcılarıyla doğrudan görüşme.
- KDV %18, kayıt eşiği 200.000 AZN (ikincil kaynaklar; nakitsiz satışların %50'si sayılır iddiası doğrulanmadı).
- E-qaimə (elektronik fatura): KDV mükellefleri için; B2C'de e-fiş yeterli (ikincil kaynak, doğrulanmalı).

**Ana sonuç:** Azerbaycan'da perakende POS satışı yapacak ürün için e-kassa uyumu zorunlu olabilir ve bunu tek başınıza çözemezsiniz. Bu yüzden Azerbaycan'a ilk girişte **stok/depo/sayım ve sipariş yönetimi** (e-kassa gerektirmeyen) satılmalı, kasa (POS) modülü sertifikalı kasa/ortakla birlikte ya da sonra gelmeli. "Azerbaycan'da yasal uyumlu" demek **yasak**.

Rekabet (aramada zayıf sonuç): BRAVO CSI/Set Retail kullanıyor (zincir; sizin hedefiniz değil), Clopos (restoran/perakende SaaS), Odoo ortakları. Mağaza/Poster/iiko/1C'nin AZ durumu **doğrulanamadı**. Gerçek rakip analizi için sahada 10–15 dükkanı ziyaret etmek veya Azerbaycanlı bir danışmanla konuşmak gerekir.

Para/dil: AZN (₼), Azerbaycan Türkçesi: mimari bölüm 2'deki işler (en büyük teknik engel).

## 5. Ürün ve barkod sistemi: yapılacaklar

1. `BarcodeProvider` arayüzü + sağlayıcı tablosu (etkin/pasif, sıra, anahtar sunucuda, kullanım sayacı, yeniden deneme, yedek). OFF ilk sağlayıcı olarak taşınır.
2. Onaylı kayıtlardan **ortak katalog** tablosu (şema değişikliği; işletmeler arası veri paylaşımı için KVKK/izin metni gerekir).
3. Toplu mal kabul: tara → miktar → listeye ekle → toplu onay; yüzlerce satır için sayfa içinde kalma, taslak kaydetme.
4. API kapalıysa elle giriş zaten çalışıyor, korunmalı.

## 6. Sayım

Büyük kısmı var. Eksikler: koli barkodunun WMS ürünlerinde çalışmaması, "kısmi/döngüsel sayım" kayıtlarının raporlanması, kullanıcı-depo ataması. Önce gerçek bir dükkânda bir raf sayımı denenmeli.

## 7. Android ve el terminalleri

Mevcut mimari (Electron + Android WebView) **korunmalı**; PWA'ya veya React Native/Flutter'a geçmek yeniden yazım demektir ve gerekçesi yok. Donanım tarayıcısı için DataWedge'in klavye (keystroke) modu ilk adımdır, WebView'da özel kod gerektirmez. Çevrimdışı satış ve kuyruk var; **çakışma çözümü** (aynı ürünü iki cihazda sayma/satma) ayrı test ister. Dedicated APK zaten var (PWA yetmez: donanım ve arka plan eşitleme).

## 8. SaaS modeli, güvenlik, fiyat

- Güvenlik/üretim hazırlığı: yedekten geri yükleme düzenli denenmeli; MFA var; kullanıcı–depo ataması eksik; bağımlılık incelemesi docs/DEPENDENCY-SECURITY-REVIEW.md'de. Bir dış sızma testi (pentest) yaptırılmadı: bunu şirket kurulunca bütçeleyin.
- Fiyat: Türkiye fiyatları bu hafta yükseltildi (Pro 24.990 ₺/yıl, WMS 59.900 ₺/yıl, 3 aylık seçenekler). **Azerbaycan fiyatını şimdi belirlemeyin;** yerel alım gücü, rakip fiyatı ve vergi kasası maliyeti bilinmeden uydurma olur. Pilot müşterilerle 3–5 görüşmeden sonra belirleyin.
- Modeller: küçük işletme için "işletme başına yıllık + cihaz sınırı" doğru; kullanıcı başı fiyat küçük dükkânı korkutur. Donanım paketi ve kurulum ücreti ayrı ek gelir.

## 9. Pazara giriş

**Türkiye (sınırlı bütçe):** İlk hedef: market/bakkal, hırdavat, kırtasiye, toptan. Kanallar sırasıyla: doğrudan ziyaret + canlı demo (1 dükkân = 1 referans), mali müşavirler (e-arşiv 2027 zorunluluğu nedeniyle iyi bir giriş), WhatsApp topluluk grupları, yerel donanım bayileri ile komisyon. Reklam bütçesi harcamadan önce 5 ödeyen müşteri ve referans videosu.

**Azerbaycan:** Ofis açmadan: Azerbaycanlı bir bayi/ortak (ayrıca e-kassa onaylı yazılım ortağı), Bakü ile başlayıp tek şehirde pilot, WhatsApp + Telegram/Instagram tanıtımı. Önce stok/depo yazılımı olarak girin, POS'u kasa ortağıyla.

**5 dakikalık demo:** (1) barkod okut → ürün var/yok → önerilen ad (2) stok ekle (3) 20 ürünlük mal kabul listesi (4) raf sayımı, 3 fark (5) yalnız farklar onay (6) satış + fiş (7) rapor. Adım 2 şu an OFF kapsamına bağlı: demoda gerçek Türk barkodu olduğundan emin olmadan göstermeyin.

## 10. Donanım satışı

İlk 6 ay **donanım stoklamayın.** Önerilen: tavsiye edilen/uyumlu cihaz listesi + bayi komisyonu. Zebra TC26 yaklaşık yüksek birim maliyetli; ithalat, garanti ve destek yükü küçük şirketi boğar. Bir cihaz test için yeterli. Rakamları (maliyet, marj) bayilerden teklif alarak doğrulayın; ben web'den fiyat doğrulamadım.

## 11. Yol haritası (gerçekçi, tek geliştirici)

| Faz | İçerik | Tahmin (iş günü, yalnız siz+ben) |
|---|---|---|
| A Stabilizasyon | `shared_catalog` vaadini düzelt, kullanıcı–depo atama, WMS koli barkodu, gerçek cihaz testleri, yedek geri yükleme denemesi | 15–20 |
| B Çekirdek deneyim | BarcodeProvider + ortak katalog, toplu mal kabul, sayım cilası | 15–20 |
| C SaaS altyapısı | iyzico/PayTR (şirket gerekir), e-posta doğrulama (yapıldı), faturalama, izleme | 10–15 |
| D Türkiye lansmanı | e-arşiv entegratörü, ÖKC (cihaz bağımlı), yasal sayfalar, ilk 5–10 müşteri | 20–30 + dış bağımlılık |
| E Azerbaycan | para birimi/ülke profili refaktörü (en büyük), i18n AZ, AZN, e-kassa ortağı araştırması, pilot | 40–60 + resmî onay süresi bilinmiyor |
| F Yeni ülkeler | yalnız talep gelirse | — |

Bu tahminler gerçek müşteri geri bildirimiyle ve dış bağımlılıkla (GİB, DVX, entegratör) kayabilir; dış bağımlılığı olan işlerde süre vermiyorum çünkü bilmiyorum.

## 12. Şimdi YAPILMAMASI gerekenler

- Azerbaycan POS/e-kassa entegrasyonu (onay yolu bilinmeden).
- Yeni ülke (3.) eklemek, iOS uygulaması, AI özellikleri, yeni sektör paketleri.
- Donanım stoklamak, kendi ÖKC'nizi sertifikalatmak.
- Ücretli barkod API'si satın almak (önce OFF kapsamını ölçün).
- Tüm arayüzü bir seferde çevirmek.
- "Yasal uyumlu" iddiası (TR veya AZ).

## 13. Başarısızlık riskleri (dürüst liste)

1. Tek kişi: destek + satış + geliştirme aynı anda; ilk 10 müşteriden sonra destek yükü geliştirmeyi durdurur.
2. Türkiye'de e-arşiv/ÖKC dış bağımlılıkları takvimi sizin kontrolünüzde değil.
3. Azerbaycan'ı uzaktan, yerel ortak olmadan satmak büyük olasılıkla yürümez; e-kassa uyumu belirsiz.
4. Rakipler (Türkiye'de 9 yıllık, 6.300+ işletme) fiyat ve entegrasyonda önde; fark yaratacak alan sadelik, depo/sayım ve restoran/WMS, bu net anlatılmalı.
5. Barkod kapsamı düşükse "30 saniyede ürün ekleme" vaadi tutmaz.
6. Çok fazla özellik, az sayıda gerçek müşteri testi: kod burada olgun, pazar doğrulaması zayıf.

## 14. Önerilen sıra

1. Gerçek bir dükkânda (veya Redmi/ikinci cihazla) mevcut akışı uçtan uca deneyin ve OFF kapsamını ölçün (barkod listesi sizden).
2. Boş `shared_catalog` vaadini düzeltin.
3. Para/ülke profili refaktörü (TR'de davranış değişmeden): önce `formatMoney` ve `currency` alanları.
4. BarcodeProvider, ortak katalog, toplu mal kabul.
5. Türkiye lansmanı ve ilk müşteriler; **Azerbaycan'a ancak Türkiye'de 5+ ödeyen müşteri ve yerel ortak bulunduktan sonra.**

## Kaynaklar (23 Kasım 2026 araması)
- DVX e-kassa broşürü: https://taxes.gov.az/uploads/2024/eng/Bifold-eCASHREGISTER.pdf
- DVX NKA/POS yaptırımları: https://www.taxes.gov.az/en/page/nka-ve-pos-terminaldan-istifadeden-yayinmaya-gore-tetbiq-olunan-maliyye-sanksiyalari
- DVX e-kassa 2019 teknik: https://tedris.taxes.gov.az/assets/upload/files/E-kassa%2009.01.2019%20-%20EN.pdf
- DVX yeni nesil NKA: https://www.taxes.gov.az/az/post/781
- PwC Azerbaijan other taxes (KDV): https://taxsummaries.pwc.com/azerbaijan/corporate/other-taxes
- Barcode Lookup API: https://barcodelookup.com/api
- GS1 Türkiye: https://gs1.org/locations/turkiye ; GEPIR sonu: https://gepir.gs1.org/index.php/about
- BRAVO/Set Retail: https://www.trend.az/azerbaijan/business/3551650.html
