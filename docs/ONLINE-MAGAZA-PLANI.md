# Veniux Online Mağaza: ayrıntılı plan

Güncellendi: 15 Kasım 2026. Amaç: her işletmenin, Veniux'taki ürün ve stoğuyla çalışan **kendi online mağazasını** açabilmesi.
Başka bir e-ticaret yazılımıyla bağlantı kurulmaz; benzer özellikler Veniux içinde olur. **Ayrı bir ek paket** olarak sunulur
(anahtar: `online_store`, ad: "Online mağaza paketi"), sektör paketleri gibi satın alınır ve kapatılabilir. Fiyatı henüz belirlenmedi.

Bu belge Faz 1'in ince ayrıntısıdır. Kararlar aksi söylenmedikçe aşağıdaki varsayılanlarla ilerlenir.

## İlerleme (15 Kasım 2026)
- **Tamam (sunucu, commit `005eeda`):** paket anahtarı `online_store` (sunucu, lisans merkezi `LICENSE_ADDONS`), şema SQLite 052, mağaza ayarı ve adres kuralları, ürün yayını/açıklaması, herkese açık vitrin uçları, sipariş oluşturma (fiyat, stok, tekrar gönderim, bal küpü, istek sınırı), durum makinesi ve iptalde stok iadesi, yönetici uçları. 28 yeni test; firma ayrımı taraması bu uçları da kapsıyor.
- **Sıradaki:** görsel yükleme, yönetici paneli, vitrin (müşteri sayfaları), bildirimler, MySQL manifesti 022 ve MySQL provası, dağıtım.
- **Plan değişiklikleri:**
  1. **Görsel işleme sunucuda yapılmaz** (`sharp` gibi yerel kütüphane yok; bulutta derleme riski). Tarayıcı görseli küçültüp WebP/JPEG'e çevirir (EXIF kendiliğinden silinir); sunucu bayt imzasını, boyutu ve en/boy sınırını doğrular, olduğu gibi saklar.
  2. **Paket kapanması:** vitrin yalnızca işletmenin lisansı süresi bitince durur. Paket tek başına kaldırılırsa mağaza, yöneticinin ilk girişine/panel isteğine kadar açık kalabilir (lisans merkezi cihazsız ziyaretçi isteğinde sorgulanamaz). Faz 2'de merkezi paket doğrulaması eklenecek.
  3. **Müşteri kaydı** (siparişten otomatik CRM müşterisi) Faz 2'ye alındı.

## Durum (15 Kasım 2026, son)
- Faz 1 kodu tamam (görsel, panel, vitrin, SEO, bildirim, MySQL 022 provası). Tüm sunucu testleri geçiyor (1231).
- Paket kalkınca mağaza, işletmenin bir sonraki paket sorgusunda kapanır (uygulandı).
- Faz 2 maddelerinin hepsi yapıldı (bölüm 16 ve 17).
- Dağıtım bekliyor: şema 022, lisans sunucusunda `online_store`, 2.4.78, fiyat kararı.

## 0. Varsayılan kararlar
1. Adres: `app.veniux.com/magaza/<mağaza-adı>`. Özel alan adı Faz 2.
2. Ödeme: **kapıda ödeme, havale/EFT, mağazadan teslim**. Online kart ödemesi yok (Faz 3, şirket gerekir).
3. Ayrı paket: `online_store`. Hak kaynağı sektör paketleriyle aynı: lisans merkezi `addons`, paket sözleşmesi ya da `sector_packs`.
4. Görsel: ürün başına en çok 5 görsel, her biri en çok 2 MB; JPEG/PNG/WebP; sunucu doğrular ve küçültür.
5. Tek dil (Türkçe), TL, KDV dahil fiyat (ürünün `sale_price` değeri aynen).
6. Faz 1'de yalnız **tam sayı adetle** satılan ürünler (adet, paket, takım). Kiloyla/litreyle satılan ürün mağazada gösterilmez (Faz 2).

## 1. Ürün ve yetki akışı
- Mağaza açmak için paket etkin olmalı. Paket kapanırsa mağaza **kendiliğinden sipariş almayı bırakır** (vitrin "şu an sipariş alınmıyor" der), veri silinmez.
- Herkese açık uçlar oturum kullanmaz; işletme kimliği yalnız `mağaza-adı` ile bulunur. Lisans merkezi cihaz anahtarı ister, ama ziyaretçide cihaz yoktur;
  bu yüzden mağaza "yayında" bilgisi **sunucuda tutulur** (`published`, `accepting_orders`) ve her yönetici isteğinde paket kontrol edilip güncellenir.
  Ziyaretçi isteklerinde ayrıca işletmenin **geçerli (süresi bitmemiş) lisansı** olup olmadığı kontrol edilir.
- Kullanıcı rolleri: ayarlar ve ürün yayını yönetici/müdür; siparişleri görme ve durum değiştirme kasiyer dahil çalışanlar (depo kapsamı kuralı geçerli).

## 2. Veri modeli (yeni tablolar; mevcut tablolara dokunulmaz)
**`online_stores`** (işletme başına bir satır)
`tenant_id` (benzersiz), `slug` (benzersiz, küçük harf/rakam/tire, 3-40 karakter, ayrılmış sözcükler yasak: `admin`, `api`, `giris`, `kayit`, `magaza`…),
`name`, `tagline`, `about`, `logo_media_id`, `contact_email`, `public_phone` (isteğe bağlı; sitede gösterilmesi **işletmenin seçimi**, varsayılan boş),
`cod_enabled`, `transfer_enabled`, `pickup_enabled`, `transfer_note` (IBAN ve açıklama), `delivery_fee`, `free_delivery_over`, `min_order`,
`warehouse_id` (stok kaynağı), `published`, `accepting_orders`, `terms_text` (sipariş koşulları; şablon sağlanır), `created_at`, `updated_at`.

**`online_product_settings`** (`tenant_id`, `product_id` birlikte benzersiz)
`published`, `description` (en çok 2000 karakter, düz metin), `sort_order`, `max_per_order` (boş = sınırsız).

**`online_product_media`**
`id`, `tenant_id`, `product_id`, `position`, `file_key` (rastgele, tahmin edilemez), `mime`, `bytes`, `width`, `height`, `alt`, `created_at`.
Dosya: veri klasörü altında `online-media/<işletme>/<file_key>.webp`; özgün dosya saklanmaz, küçültülmüş sürümler saklanır.

**`online_orders`**
`id`, `tenant_id`, `number` (işletme içinde artan, "S-000123"), `public_code` (20 karakter rastgele; müşterinin durum sorgulaması için),
`status`, `delivery_method` (`delivery`|`pickup`), `payment_method` (`cod`|`transfer`|`pickup`),
`customer_name`, `phone`, `email`, `address`, `note`, `subtotal`, `delivery_fee`, `total`, `warehouse_id`,
`consent_at` (aydınlatma ve sipariş koşulu onayı), `idempotency_key` (işletme içinde benzersiz), `cancel_reason`, `created_at`, `updated_at`.

**`online_order_items`**: `order_id`, `product_id`, `sku`, `name` (**sipariş anındaki** ad), `unit`, `unit_price` (sipariş anındaki), `quantity`, `line_total`.
**`online_order_events`**: durum geçmişi (`order_id`, `from_status`, `to_status`, `user_id`, `at`, `note`).

Sipariş sayaçları ve benzersizlik kısıtları veritabanı düzeyindedir (uygulama hatasına güvenilmez). MySQL tarafı bulut şeması **022**.

## 3. Sipariş durum makinesi
`new` → `confirmed` → `preparing` → `ready` (kargoya hazır / gel-al hazır) → `delivered`. `cancelled` yalnız `delivered` olmayanlardan.
- Geriye dönüş yok (yanlış durumu düzeltmek için "iptal" ve yeni sipariş değil; yönetici `confirmed ↔ preparing` arasında geri alabilir).
- Her geçiş `online_order_events`'e yazılır ve denetim kaydına düşer.
- **İptal** stoğu geri verir (aynı depoya, hareket kaydıyla), ödeme kapıda/havale olduğu için para iadesi işletmenin işi (sistem para taşımaz).

## 4. Stok kuralları
- Sipariş oluşturulurken, **aynı işlemde**, sipariş deposundan koşullu düşülür (`quantity >= istenen`). Yetmezse **hiçbir şey yazılmaz** ve müşteriye hangi ürünün kaç adet kaldığı söylenir.
- Aynı anda iki sipariş son ürünü isterse yalnız biri alır (koşullu güncelleme; MySQL'de satır kilidi).
- Stok hareketi `source='online_store'`, not: sipariş numarası. İptalde `return` hareketi.
- Kasada satılan ürün aynı havuzdan düştüğü için mağazada anında yansır. Vitrin stoğu **önbelleğe alınmaz** (ya da en çok 15 sn).
- Mağazada gösterilen "stokta" bilgisi: bol/az/yok (tam sayı stok gösterilmez, rakip bilgisi sızdırmamak için); az: ≤ 5.

## 5. Fiyat ve toplamlar
- Tüm tutarlar **sunucuda** yeniden hesaplanır; tarayıcıdan gelen fiyata güvenilmez. Sipariş anındaki ad ve fiyat kalem satırına kopyalanır; ürün sonradan değişse de sipariş değişmez.
- Küsurat: kuruş cinsinde tam sayıyla hesap (mevcut `retailMoney` kalıbı), yuvarlama kalem sonunda.
- Teslimat ücreti: `free_delivery_over` aşılırsa 0; mağazadan teslimde 0. Minimum sepet altında sipariş reddedilir, nedeni yazılır.
- Fiyat sepet ile sipariş arasında değiştiyse müşteriye **yeni fiyat gösterilip onay** istenir (sipariş sessizce farklı tutara oluşmaz).

## 6. Herkese açık API (oturumsuz)
Yol: `/api/public/shop/:slug/...`. Hepsi yalnız `published` mağaza için çalışır; yoksa/kapalıysa **aynı 404** (varlığı sızdırmaz).
- `GET /` mağaza bilgisi, kategoriler, ödeme/teslimat seçenekleri.
- `GET /products?q=&category=&page=` en çok 24 ürün/sayfa, yalnız yayında ve stoğu izlenen/satılabilen ürün.
- `GET /products/:id` ürün sayfası verisi (açıklama, görseller, fiyat, stok durumu).
- `GET /media/:fileKey` görsel (`Cache-Control` uzun, adres içeriğe bağlı).
- `POST /orders` sipariş oluşturur (aşağıdaki kurallar).
- `GET /orders/:publicCode` durum sorgusu (yalnız durum, kalemler, toplam; kişisel veri maskeli: telefonun son 2 hanesi).
**Sipariş uç kuralları:** `Idempotency-Key` zorunlu; en çok 30 kalem, kalem başı en çok 50 adet (ya da `max_per_order`); ad 2-80, telefon TR biçimi (normalize),
adres teslimat ise 10-300 karakter; e-posta isteğe bağlı ve biçimi doğrulanır; not ≤ 300; **onay kutusu zorunlu** (aydınlatma + sipariş koşulu);
bal küpü alanı dolu gelirse sessizce başarılı gibi yanıt verilip kayıt açılmaz; istek gövdesi sınırı 32 KB.
**İstek sınırları:** IP başına katalog 120/dk, sipariş 5/dk ve 30/saat; mağaza başına günlük 500 sipariş tavanı (aşılırsa işletmeye uyarı, mağaza geçici durur).
Turnstile (CAPTCHA) Cloudflare kurulunca eklenir.

## 7. Yönetici API (oturumlu, `/api/online-store/...`)
Ayarlar (GET/PUT), slug uygunluk kontrolü, ürün listesi ve yayın durumu (toplu yayınla/gizle), ürün açıklaması, görsel yükle/sil/sırala,
sipariş listesi (durum, tarih, arama), sipariş ayrıntısı, durum değiştirme, özet (bugünkü sipariş, bekleyen, ciro). Her uçta işletme ayrımı testle kanıtlanır.

## 8. Görsel işleme
- Yükleme: yalnız oturumlu, ayrı boyut sınırı (2 MB), içerik **bayt imzasından** tanınır (dosya adına/MIME'a güvenilmez), JPEG/PNG/WebP; SVG, GIF ve diğerleri reddedilir.
- Sunucuda küçültme (en uzun kenar 1200 px; liste için 400 px küçük sürüm), EXIF/konum bilgisi **silinir**, WebP'ye çevrilir.
- Dosya adı rastgele; yol geçişi (path traversal) imkânsız; başka işletmenin görseli adresle bile okunamaz (kayıt `tenant_id` ile eşleşir).
- Kota: işletme başına toplam 300 MB (aşılınca yükleme reddedilir, uyarı verilir).
- Silinen ürünün/mağazanın görselleri temizlenir.
- Not: bu işlem için bir görsel kütüphanesi gerekir (öneri: `sharp`); bulutta (Plesk, Node 24) derleme uyumu **dağıtımdan önce denenmeli**. Olmazsa yedek plan: tarayıcıda küçültüp yükleme.

## 9. Vitrin (müşteri tarafı)
- Mobil öncelikli, hızlı (görseller tembel yüklenir, boyutları sabit: sayfa kayması yok), erişilebilir (klavye, ekran okuyucu, kontrast).
- Sayfalar: mağaza ana sayfası (kategoriler, arama, ürün ızgarası), ürün sayfası, sepet, sipariş formu, sipariş tamam/durum sayfası.
- Sepet tarayıcıda saklanır (oturum gerekmez), sipariş öncesi sunucuyla doğrulanır.
- **SEO:** sayfa başına başlık/açıklama, `Product` yapılandırılmış verisi (ad, görsel, fiyat, stok), mağaza için site haritası (`/magaza/<ad>/sitemap.xml`), kanonik adres. Sipariş ve sepet sayfaları `noindex`.
- Paylaşım görseli (Open Graph) mağaza logosundan; QR kodu yönetici panelinden indirilir.
- Hukuki bağlantılar her sayfada: ön bilgilendirme, mesafeli satış/iade koşulları (işletmenin düzenlediği şablon), KVKK aydınlatma.

## 10. Yönetici paneli
Menüde **"Online Mağaza"** (paket kilidiyle): Ayarlar, Ürünler (yayınla/gizle, açıklama, görsel), Siparişler (liste, ayrıntı, durum, iptal), QR ve paylaşım bağlantısı.
Yeni sipariş gelince: panelde sayaç, e-posta bildirimi (var olan e-posta altyapısı), mobil bildirimi (var olan web push). Boş durumlarda ne yapılacağı yazılı.

## 11. Gizlilik ve hukuk
- Müşteri verisi (ad, telefon, adres) yalnız ilgili işletmenin kaydında durur; Veniux **veri işleyen**dir. Gizlilik/KVKK metinlerimiz buna göre güncellenir.
- Aydınlatma onayı ve zamanı kaydedilir. IP **ham olarak saklanmaz** (kısıtlama için kısa süreli, özetlenmiş).
- Saklama: tamamlanmış siparişlerin kişisel alanları işletme tarafından silinebilir/anonimleştirilebilir (Faz 2: otomatik süre).
- Mesafeli satış ve cayma hakkı şablonları sağlanır; **avukat/mali müşavir onayı gerekir** (sistem hukuki yeterlilik vaat etmez).
- Sitede ve vitrinde **WhatsApp numarası gösterilmez**; işletme isterse yalnız bağlantı düğmesi (`wa.me`) eklenir.

## 12. Test planı
Birim ve entegrasyon testleri (sunucu): işletme ayrımı (A'nın ürünü/siparişi/görseli B'den görülmez), paket kapalıyken sipariş reddi, stokta olmayan/yetersiz stok, **eşzamanlı son ürün** yarışı,
tekrar gönderim (aynı `Idempotency-Key` aynı siparişi döner), fiyat değişimi onayı, minimum sepet, ücretsiz teslimat eşiği, iptalde stok geri dönüşü, bal küpü, istek sınırı, geçersiz görsel (SVG, yanlış imza, aşırı büyük),
yol geçişi, durum makinesi (geçersiz geçiş), mağaza adı çakışması/ayrılmış sözcük. Ekran: telefon ve masaüstü gerçek tarayıcıda uçtan uca (sepet → sipariş → panelde görünme → durum → iptal → stok).
MySQL uyumu: yerel MySQL ile prova (büyük/küçük harf duyarlı arama, DECIMAL dizge, katı GROUP BY).

## 13. Dağıtım
Şema 022 **yalnız yeni tablolar**: canlı veritabanı dökümü → yerel MySQL'de prova → `upgradeAdditive` → dağıtım kaydı → yeniden başlatma → sağlık 022. Lisans sunucusunda (`api.veniux.com`) paket anahtarı (`online_store`) eklenir;
yönetim panelinden işletmeye verilir. Pilot işletme: önce yalnız Veniux Test hesabı, sonra bir gerçek işletme. Sorun olursa paketi kapatmak yeterlidir (veri korunur).

## 14. Uygulama sırası (her adım ayrı commit ve test)
1. Paket anahtarı `online_store` (sunucu, lisans, arayüz kilidi) ve şema (SQLite 052, MySQL 022).
2. Mağaza ayarı ve slug kuralları; yönetici uçları ve testleri.
3. Ürün yayını ve açıklaması.
4. Sipariş oluşturma çekirdeği: doğrulama, fiyat, stok düşüşü, iptal, durum makinesi, yarış testi.
5. Herkese açık okuma uçları, istek sınırları, işletme ayrımı testleri.
6. Görsel yükleme ve işleme.
7. Yönetici paneli (ayarlar, ürünler, siparişler).
8. Vitrin (müşteri sayfaları) ve SEO.
9. Bildirimler (e-posta, push).
10. Güvenlik gözden geçirmesi, telefon/masaüstü denemesi, MySQL provası, dağıtım.

## 15. Faz 2 ve 3 (sonra)
**Faz 2:** indirim kodu, kargo ücret kuralları ve takip no, varyant, müşteri hesabı, özel alan adı, vitrin teması, müşteriye SMS/e-posta, kiloyla satış, otomatik veri silme süresi.
**Faz 3 (şirket gerekir):** kredi kartı ödemesi (iyzico, PayTR), kargo entegrasyonları, e-Arşiv, pazaryerleri.

## 16. İndirim kodları ve kargo kuralları (yapıldı, canlıya alınmadı)
- Şema: `053_online_store_extras.js` (MySQL manifest `023-online-store-extras`, yalnız yeni tablolar): `online_discount_codes`, `online_shipping_rules`, `online_order_extras` (il, uygulanan kod ve tutarı, kargo kuralı adı, kargo firması, takip no).
- Kod türleri: yüzde, tutar, kargo bedava. Alanlar: minimum sepet, toplam kullanım sınırı, başlangıç/bitiş tarihi, aktif/pasif. Büyük/küçük harf fark etmez.
- Kullanım hakkı sipariş işleminde tek SQL ile atomik tüketilir (aynı anda iki sipariş son hakkı alamaz); sipariş iptalinde hak geri verilir. Aynı Idempotency-Key tekrarı hakkı bir kez harcar.
- Kargo kuralı: ad, il listesi (ya da `*`), ücret, ücretsiz eşik; sırayla bakılır, ilk eşleşen kazanır, eşleşme yoksa mağaza varsayılan ücreti. Kural tanımlıysa vitrin il seçtirir (81 il, Türkçe harf farkı yok sayılır).
- Fiyat hesabı tek fonksiyonda (`onlineStoreExtras.priceCart`), kuruş cinsinden: sepet özeti ucu `POST /api/public/shop/:slug/quote` ile sipariş aynı hesabı kullanır. Minimum sipariş indirimden önceki tutara bakar. İndirim sepeti aşamaz.
- Takip: onaylanmış adrese-teslim siparişe firma + takip no girilir (`PUT /api/online-store/orders/:id/shipping`), müşteri sipariş sayfasında görür.
- Arayüz: yönetici panelinde "Kod & Kargo" sekmesi, sipariş ayrıntısında kargo kutusu; vitrinde il seçici, indirim kodu alanı, sunucudan gelen toplamlar.
- Sınır: kod tahminine karşı `quote` ucu IP başına dakikada 40 (SHOP_QUOTE_MAX).
- Canlıya alırken: `022` + `023` birlikte `upgradeAdditive` ile uygulanır; `SHIPPABLE_MYSQL_SCHEMA` = `023-online-store-extras`.

## 17. Faz 2 tamamlayıcıları (yapıldı, canlıya alınmadı)
Şema: `054_online_store_phase2.js` (MySQL manifest `024-online-store-phase2`, yalnız yeni tablolar): `online_product_measure`, `online_customers`, `online_order_customers`, `online_domains`, `cloud_pack_seen`.

- **Siparişten müşteri (CRM):** her sipariş telefon numarasına göre (biçimden bağımsız) müşteri kaydı açar/günceller; sipariş sayısı ve toplam harcama iptalde geri alınır. Yönetici panelinde "Müşteriler" sekmesi: arama, tekrar sipariş verenler, sipariş geçmişi. "Kişisel bilgileri sil (KVKK)": açık siparişi yoksa müşteri ve siparişlerindeki ad/telefon/adres anonimleşir.
- **Kiloyla/litreyle/metreyle satış:** ürün başına satış adımı ve en az miktar (varsayılan kg/L/m için 0,5; g için 100; cm için 10). Miktar adımın katı olmalı, en çok 3 ondalık, tutar kuruşa yuvarlanır. Stok ve sipariş kalemi ondalıklı tutulur; iptalde ondalıklı stok geri gelir. Vitrinde "₺200 / kg", adım adım artırma.
- **Merkezi paket doğrulaması (bulut):** lisans sunucusunun imzalı yanıtı geldikçe (kasa/yönetici istekleri) paketin açık olduğu `cloud_pack_seen` tablosuna yazılır; paket kalkmışsa kayıt silinir. Vitrin, paket 7 gün içinde doğrulanmamışsa kapalı görünür (lisansın kendi 7 günlük toleransıyla aynı). Kayıt hiç yoksa saat ilk bakışta başlar (dağıtım sonrası kilitlenmeyi önler).
- **Özel alan adı:** yönetici alan adını kaydeder; sahiplik `_veniux-verify.<alan>` TXT kaydıyla doğrulanır (CNAME `app.veniux.com` bilgi amaçlı denetlenir). Doğrulanmış alan adında kök adres mağaza sayfası olur, `/sitemap.xml` ve `/robots.txt` mağazaya özeldir; uygulamanın diğer sayfaları o alan adında açılmaz (302 ile köke döner). **Altyapı şartı:** alan adı başına HTTPS sertifikası ve Host yönlendirmesi sunucu tarafında ayrıca sağlanmalıdır (Cloudflare özel ana makine adı ya da Plesk alan adı takma adı + sertifika). Kodda bu adım yok.
- Ortam değişkenleri: `VENIUX_PRIMARY_HOSTS` (uygulamanın kendi alan adları), `VENIUX_SHOP_CNAME` (müşteriye gösterilen CNAME hedefi).
- Canlıya alırken `022`, `023`, `024` birlikte `upgradeAdditive` ile uygulanır; `SHIPPABLE_MYSQL_SCHEMA` = `024-online-store-phase2`.

## 18. Tek paket, kartla ödeme, tema, kargo bağlantıları (yapıldı, canlıya alınmadı)
**Paket ve fiyat:** tek yıllık paket `RETAIL_ONLINE` ("Online Mağaza Paketi": stok + kasa + online mağaza), yıllık **14.388 ₺** (ayda 1.199 ₺), KDV dahil. Kartla ödeme, tema, kargo takibi, müşteri kaydı, indirim kodu, özel alan adı ve Trendyol bağlantısı pakete dahildir; ayrı ek ücret yoktur. Fiyat katalogda (platform yöneticisi) `annual_cents = 1438800` olarak girilir; web sitesindeki yedek fiyat `website-php/pricing.php` içinde 14388. Karşılaştırma notu (yalnız iç kullanım; sitede rakip adı geçmez): benzer hazır mağaza hizmetlerinin giriş paketi yıllık kampanyalı yaklaşık 56.000 ₺.

**Şema:** `055_online_store_theme_payments.js` (MySQL manifest `025-online-store-theme-payments`): `online_store_theme`, `online_payment_settings`, `online_payments`.

- **Kartla ödeme (iyzico ödeme formu):** işletme kendi iyzico anahtarlarını girer (şifreli saklanır, geri okunamaz). Müşteri kartını iyzico'nun sayfasında girer; Veniux kart bilgisi görmez. Akış: sipariş + stok ayrılır → ödeme sayfası → iyzico geri çağırması → sonuç sunucudan sunucuya doğrulanır (tutar ve sipariş no eşleşmeli) → ödendiyse işletmeye bildirim; başarısız/30 dk dolan ödemede sipariş iptal, stok ve indirim kodu geri. Ödeme alınmadan sipariş onaylanamaz. Ödenmiş siparişin iptalinde iade denenir, olmazsa panelde "iyzico panelinden elle iade" uyarısı çıkar. Kartlı siparişte e-posta zorunludur. **Doğrulama durumu:** sahte taşıma katmanıyla testler geçti ve gerçek iyzico sandbox'ına imzalı istek gitti ("api bilgileri bulunamadı" yanıtı: istek biçimi kabul, anahtar yok). **Gerçek sandbox anahtarıyla uçtan uca deneme (ödeme sayfası, geri çağırma, iade) henüz yapılmadı.** Canlıya almadan önce işletme iyzico sandbox anahtarıyla bir kez denenmeli.
- **Vitrin teması:** 8 hazır renk + özel renk (beyaz zeminde kontrast 3'ten az ise reddedilir, düğme yazı rengi otomatik), ürün düzeni (kart/liste/sıkı), yazı tipi, üst alan stili, duyuru şeridi.
- **Kargo:** takip bağlantısı olan firmalar (Yurtiçi, Aras, Sürat, UPS, PTT) müşteriye "Kargom nerede?" düğmesi verir; MNG, Trendyol Express, HepsiJet, Kolay Gelsin yalnız takip numarasıyla listelenir. Firma anlaşması, kargo etiketi ve ücret sorgusu (API) bu sürümde **yoktur**: bunlar her firmayla ayrı sözleşme ister.
- **Pazaryeri:** mevcut Trendyol bağlantısı (stok, sipariş, hakediş) pakete dahildir. Hepsiburada, N11 ve diğerleri **yapılmadı**: satıcı hesabı ve API onayı olmadan geliştirilemez/denenemez (bkz. PLATFORM-ENTEGRASYON-TASARIMI.md).
- Canlıya alırken `022`–`025` birlikte `upgradeAdditive` ile uygulanır; `SHIPPABLE_MYSQL_SCHEMA` = `025-online-store-theme-payments`.

