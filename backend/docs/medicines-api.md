# İlaç Veritabanı API

Tüm ilaçlar tek, ortak bir referans katalogdadır (işletmeye özel değildir).
Okuma uçları: oturum açmış ve **Eczane** modülü (PHARMACY/BOTH) olan kullanıcılar.
Yönetim uçları: yalnızca **platform yöneticisi**.

Yanıt biçimi:

```json
{ "success": true, "data": { } }
{ "success": false, "message": "İlaç bulunamadı." }
```

Oran sınırı: okuma 240 istek/dk, yönetim 120 istek/dk (IP başına).

## Okuma

| Yöntem | Yol | Açıklama |
|---|---|---|
| GET | `/api/medicines` | Liste + filtre. `q`, `company`, `activeIngredient`, `atc`, `marketStatus` (`active`/`suspended`/`passive`), `page`, `limit` (en fazla 100). Varsayılan olarak pasif ilaçlar gizlenir. |
| GET | `/api/medicines/search?q=parol` | Ad, barkod, etken madde, firma, ATC içinde arama. Büyük/küçük harf ve Türkçe karakter duyarsız; sonuç yoksa yazım hatası toleranslı arama yapılır (`"fuzzy": true`). |
| GET | `/api/medicines/barcode/:barcode` | Barkod veya GTIN ile tek ilaç (indeksli, hızlı). Bulunamazsa 404 + `İlaç bulunamadı.` |
| GET | `/api/medicines/:id` | İlaç detayı |
| GET | `/api/medicines/:id/image` | İlaç görseli. **Kimlik doğrulaması istemez** (`<img>` için). Yerel kopya varsa dosya, yoksa https uzak adrese 302, görsel yoksa 404. |
| GET | `/api/medicines/stats` | Katalog sayıları ve son başarılı senkronizasyon tarihi |

Liste yanıtı:

```json
{ "success": true, "data": [ { "id": 1, "barcode": "8699514090150", "name": "PAROL 500 MG 20 TABLET", "activeIngredient": "Parasetamol", "company": "ATABAY KİMYA", "price": 45.9, "image": "/medicines/1/image?v=…", "imageVerified": false, "marketStatus": "active" } ],
  "pagination": { "page": 1, "limit": 24, "total": 1, "pages": 1 }, "fuzzy": false }
```

## Yönetim (platform yöneticisi)

| Yöntem | Yol | Gövde / açıklama |
|---|---|---|
| GET | `/api/admin/medicines` | Liste (pasifler dahil). Ek filtreler: `source`, `image` (`missing`/`unverified`/`verified`) |
| POST | `/api/admin/medicines` | `{ barcode, name, activeIngredient, dosage, pharmaceuticalForm, packageSize, company, manufacturer, atcCode, prescriptionType, marketStatus, price, kubUrl, ktUrl }` → `source = manual`. Aynı barkod varsa 409. |
| PUT | `/api/admin/medicines/:id` | Aynı alanlar (barkod değiştirilebilir). Kaynaktan gelen kayıt düzenlenirse `manualOverride` olur, senkronizasyon üzerine yazmaz. `releaseOverride: true` korumayı kaldırır. |
| DELETE | `/api/admin/medicines/:id` | Pasife alır. `?permanent=1` kalıcı siler. |
| POST | `/api/admin/medicines/:id/image` | Ham dosya (`application/octet-stream`), JPEG/PNG/WEBP, ≤ 2 MB. Tür dosya imzasından doğrulanır. Doğrulanmış sayılır. |
| PUT | `/api/admin/medicines/:id/image` | `{ imageUrl, imageSource: "manufacturer"|"provider", verified }` veya yalnızca `{ verified }` |
| DELETE | `/api/admin/medicines/:id/image` | Görseli kaldırır |
| POST | `/api/admin/medicines/:id/image/cache` | Uzak görseli yerel depoya kopyalar (yalnızca `MEDICINE_IMAGE_CACHE_HOSTS` içindeki alan adları) |
| POST | `/api/admin/medicines/import` | Ham dosya: .xlsx / .xls / .csv, ≤ 40 MB. Başlık: `x-file-name` (URL kodlu) |
| POST | `/api/admin/medicines/sync` | `{ provider?: "titck", useUploadedFile?: true }` → 202 `{ logId }`. Aynı anda tek senkronizasyon (çakışmada 409). |
| GET | `/api/admin/medicines/sync/status` | Çalışan iş, son başarılı senkronizasyon, sağlayıcı durumları |
| GET | `/api/admin/medicines/sync/logs` | Senkronizasyon geçmişi |
| GET | `/api/admin/medicines/sync/logs/:id` | Tek kayıt (canlı ilerleme için de kullanılır) |
| GET/PUT | `/api/admin/medicines/settings` | `active_provider`, `chunk_size` (50-2000), `auto_deactivate` ("0"/"1"), `deactivate_max_percent` (1-100) |

## Yeni veri sağlayıcısı eklemek

1. `src/services/medicines/providers/` altında `BaseMedicineProvider`'dan türeyen bir sınıf yazın.
2. `static key`, `static label`, `status()` ve `async *fetchBatches(chunkSize)` uygulayın. `fetchBatches` standart kayıt dizileri üretir:
   `{ barcode, name, activeIngredient, dosage, pharmaceuticalForm, packageSize, manufacturer, company, prescriptionType, atcCode, marketStatus, price, currency, image, kubUrl, ktUrl, sourceUrl }`
3. Kaynak tüm piyasayı listeliyorsa `get fullCatalog() { return true; }`. Görselleri barkodla birebir eşleşiyorsa `get imagesBarcodeMatched() { return true; }`.
4. Sınıfı `providers/index.js` içindeki `PROVIDERS` dizisine ekleyin. Servis, panel ve ayarlar otomatik olarak tanır.
# Otomatik görsel eşleştirme

Eksik görseller için iki kaynak kullanılır: Polifarma'nın resmî ürün kataloğu (üretici, ürün adı, doz ve form eşleşmesi) ve ilacdepo.com.tr üzerinde barkodla adlandırılan kutu görselleri. Barkod kaynağı, görsel uç noktası çağrıldığında kontrol edilir. Yalnızca erişilebilir JPEG/PNG/WEBP görsellerin bağlantısı kaydedilir; kaynak dosyaları yerel diske kopyalanmaz. Mevcut görseller değiştirilmez. Ambalaj boyutu ve setli/setsiz varyantı kesin onaylanmamış görseller `imageVerified=false` olarak kalır.

`POST /api/admin/medicines/images/sync` üretici eşleştirmesini arka planda başlatır; `GET /api/admin/medicines/images/sync` işlem durumunu döndürür. İkisi de platform yöneticisi gerektirir. Aynı işlem CLI'da `node --env-file-if-exists=.env scripts/syncMedicineImages.js` ile çalıştırılabilir (`--dry-run` kayıtları değiştirmez).

Ürün listesi DTO'sunda kayıtlı görsel yoksa `image=null`, `imageLookup=/medicines/:id/image` olur. Arayüz bu adresi görünür kartlar için tembel yükler. Kaynakta bulunmayan görseller bir gün boyunca bellekte olumsuz önbelleğe alınır; ağ bağlantısı gereklidir. Manuel görsel yükleme ve doğrulama mevcut yönetim ekranından yapılabilir.

Kaynaklar: https://www.polifarma.com.tr/urunler/ ve https://www.ilacdepo.com.tr/
