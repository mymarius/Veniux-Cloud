# Veniux Online Mağaza: ayrıntılı plan

Güncellendi: 15 Kasım 2026. Amaç: her işletmenin, Veniux'taki ürün ve stoğuyla çalışan **kendi online mağazasını** açabilmesi.
Başka bir e-ticaret yazılımıyla bağlantı kurulmaz; benzer özellikler Veniux içinde olur. **Ayrı bir ek paket** olarak sunulur
(anahtar: `online_store`, ad: "Online mağaza paketi"), sektör paketleri gibi satın alınır ve kapatılabilir. Fiyatı henüz belirlenmedi.

Bu belge Faz 1'in ince ayrıntısıdır. Kararlar aksi söylenmedikçe aşağıdaki varsayılanlarla ilerlenir.

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
