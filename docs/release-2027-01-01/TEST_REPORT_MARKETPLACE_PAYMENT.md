# Test raporu: pazaryerleri ve iyzico ödeme — 25 Kasım 2026

Bu rapor yalnız bu turda **resmî belgeden** doğrulananları ve **gerçekten çalıştırılan** testleri içerir. Gerçek hesap/sandbox ile çalıştırılan hiçbir test yoktur; hiçbir madde `SANDBOX_VERIFIED` değildir.

## 1. Belge kaynakları (okuma tarihi 25 Kas 2026)
| Servis | Okunan | Sonuç |
|---|---|---|
| Trendyol | developers.trendyol.com (sipariş, stok, iade, ekstre, kimlik, limitler) | Okundu (önceki raporda) |
| N11 | developer.n11.com (sipariş, fiyat-stok, görev sorgulama, iade, parçalı iptal, hata mesajları, değişiklik günlüğü) | Okundu (9 sayfa) |
| iyzico | docs.iyzico.com (sandbox, HMAC kimlik, checkout form, 3DS, iptal/iade, webhook, imza, test kartları, limitler, hata kodları) | Okundu (16 sayfa) |
| **Hepsiburada** | developers.hepsiburada.com/tr/ | **Okunamadı**: otomatik istemciye HTTP 403 dönüyor. Belgesiz hiçbir şey doğrulanmadı |

## 2. Belgeyle kodun karşılaştırması
### N11 (REST: sipariş, stok; SOAP: iade, parçalı iptal)
| Konu | Belge | Kod | Karar |
|---|---|---|---|
| Sipariş listeleme | `GET /rest/delivery/v1/shipmentPackages`, `size` ≤ 100, `page` 0'dan | aynı, `pageSize` 100 | Uyumlu |
| Kimlik | `appKey`/`appSecret` başlığı | `appkey`/`appsecret` (HTTP başlıkları büyük/küçük harf duyarsız) | Uyumlu |
| Fiyat-stok | `POST /ms/product/tasks/price-stock-update`, `{payload:{integrator,skus:[{stockCode,listPrice,salePrice,quantity}]}}`, ≤ 1000 sku, listPrice ve salePrice birlikte | aynı biçim, parti 100 | Uyumlu |
| Görev sonucu | `POST /ms/product/task-details/page-query` (`PROCESSED`/`IN_QUEUE`/`REJECT`, kalem `SUCCESS`/`FAIL`) | Önceden **yoktu** (görev sonucu hiç sorulmuyordu) | **Eklendi** (`checkBatch`) |
| Paket durumları | Created, Picking, Shipped, Cancelled, Delivered, Unpacked, **UnSupplied** | `UnSupplied` iptal sayılmıyordu: tedarik edilemeyen pakette stok düşülü kalırdı | **Düzeltildi** |
| İade (claim) | SOAP (`ReturnService.wsdl`), `ClaimReturnList/Approve/Deny/Pending` | `claims()` boş: iade stoğu geri eklemez | **Uygulanmadı** (SOAP istemcisi gerekir; belgedeki örnekler tutarsız; canlı yanıtla doğrulama şart) |
| Parçalı iptal | SOAP `ClaimCancelPartial` | yok | Uygulanmadı |
| Hız sınırı | yalnız sipariş listeleme: dakikada 1000 | mevcut hız sınırı yönetimi (429/backoff) | Uyumlu |
| Test ortamı | belgede **yok** | yalnız canlı | Sandbox yok; erişim için `sellerintegration@n11.com` |

### iyzico (Checkout Form + iptal/iade)
| Konu | Belge | Kod | Karar |
|---|---|---|---|
| Adresler | canlı `api.iyzipay.com`, sandbox `sandbox-api.iyzipay.com` | aynı | Uyumlu |
| Kimlik | `IYZWSv2 base64(apiKey:..&randomKey:..&signature:..)`, imza = HMAC-SHA256(randomKey + yol + gövde) | aynı (testle imza yeniden hesaplanıyor) | Uyumlu |
| Ödeme başlatma/sorgu | `/payment/iyzipos/checkoutform/initialize/auth/ecom`, `.../auth/ecom/detail` | aynı; sonuç ayrıca sunucudan sorgulanıyor, tutar ve sepet eşleşmesi denetleniyor | Uyumlu |
| İptal | `POST /payment/cancel` (gün sonundan önce); gün sonrası `10223 REQUIRES_DAY_END` | yalnız iptal; başarısız → "elle iade" | **Eklendi:** iptal olmazsa `POST /v2/payment/refund` (paymentId + price) denenir |
| Geri çağırma gelmedi | belge: sonuç sorgulanmalı / webhook | süre dolunca ödeme **sorulmadan** iptal ediliyordu (para alınmış olsa bile) | **Düzeltildi:** süre dolunca iyzico'ya sorulur; ödenmişse iptal edilmez; ulaşılamazsa 24 saat beklenir |
| Yanıt imzası | alan sırası belgede; sondaki sıfırlar atılır | doğrulanmıyor | **Uygulanmadı** (sandbox olmadan alan sırasını doğrulayamam; yanlış olursa geçerli ödemeyi reddeder) |
| Webhook (`X-IYZ-SIGNATURE-V3`) | HMAC-SHA256, alan sırası belgede; hesapta özelliğin açılması gerekir | uç yok | Uygulanmadı (sandbox hesabı + özellik açma gerekir) |
| Kısmi iade | `/v2/payment/refund` price ≤ ödeme | yalnız tam iade | Uygulanmadı |
| Hız sınırı | hata 50000 "Request Limit Exceeded", dakikada sınırlar | 429/50000 özel işlenmiyor | Bilinen sınır |

## 3. Çalıştırılan testler (25 Kas 2026, Windows 10, SQLite test DB, sahte sunucu/taşıma)
| Test | Senaryo | Sonuç |
|---|---|---|
| `marketplaceProviders` N11: UnSupplied | Created paket stok düşer → UnSupplied → stok geri gelir | Geçti |
| `marketplaceProviders` N11: görev sonucu | IN_QUEUE bekler; FAIL kalemi bildirilir; REJECT bildirilir; SUCCESS hatayı temizler; sorgu 500 verirse sipariş eşitlemesi durmaz | Geçti |
| `onlineStorePhase3`: tarayıcı kapandı | süre doldu, iyzico "SUCCESS" → ödenmiş kalır, iptal edilmez, stok rezerve | Geçti |
| `onlineStorePhase3`: belirsiz sonuç | iyzico sorgusu ağ hatası → 24 saat bekler, sonra iptal; stok geri | Geçti |
| `onlineStorePhase3`: iade | iptal reddedilirse V2 iade; ikisi de olmazsa `manual` | Geçti |
| Çevrede mevcut 37+19 test | Trendyol, Hepsiburada, N11, online mağaza | Geçti |

## 4. Gerçek test için gerekenler (özet; ayrıntı `BLOCKERS.md`)
- **iyzico sandbox:** https://sandbox-merchant.iyzipay.com/auth/register → API anahtarı + güvenlik anahtarı (Ayarlar → Firma Ayarları → API Anahtarları). Test kartları: https://docs.iyzico.com/ek-bilgiler/test-kartlari.md (ör. başarılı 5890040000000016, yetersiz bakiye 4111111111111129). Veniux'ta Online mağaza → Ödeme ayarlarına sandbox anahtarlarıyla girip bir sipariş ver, "iyzico sandbox panelinde ödemeyi gör", iptal ve iade dene.
- **N11:** satıcı hesabı + API anahtarı; test ortamı belgede yok, `sellerintegration@n11.com` ile sorulmalı. Canlı mağazada **gerçek stok değişir**: önce kapalı bağlantı kaydedip "Bağlantıyı dene".
- **Hepsiburada:** belgeler otomatik okunamadı. Senin yapacağın: developers.hepsiburada.com'dan ilgili sayfaları (kimlik, sipariş, stok, iade, SIT ortamı) PDF/metin olarak kaydedip bana ver, ya da entegrasyon e-postasından test ortamı bilgisini iste.
- **Trendyol:** stage için satıcı hesabı + IP izin listesi (Seller Center destek talebi).

## 5. iyzico SANDBOX denemesi (27 Kasım 2026, canlı bulut app.veniux.com, sandbox anahtarlarıyla)
| Senaryo | Sonuç |
|---|---|
| Checkout Form başlatma ve ödeme sayfası | Geçti |
| Başarılı kart (3D Secure ekranıyla) | Ödeme alındı. İlk denemede dönüş "Bu kaynaktan erişime izin verilmiyor" ile reddedildi (gerçek hata; 2.4.121'de düzeltildi). Sipariş yine de sonradan sorguyla "ödendi" oldu |
| Dönüş düzeltmesinden sonra (S-000003) | Müşteri sipariş sayfasına döndü, "Ödemeniz alındı" |
| Yanıt imzası (gölge doğrulama) | S-000001 ve S-000003 "uyumlu" |
| Sipariş iptali ile iade (S-000001) | iyzico panelinde "Tamamı İade Edildi". Veniux panelinde iade bilgisi GÖRÜNMÜYOR |
| Eşzamanlı sorguda çift olay notu | Bulundu; kodda düzeltildi (henüz yayınlanmadı) |
| Reddedilen kart, ödeme sayfasını kapatıp süre dolması, webhook | DENENMEDİ (webhook ucu yazılmadı; hesapta özellik açık) |

Bu sonuçlar yalnız sandbox içindir (SANDBOX_VERIFIED); canlı ödeme denenmedi.
Bulunan küçük kusurlar: kartla siparişte yönetim panelinde "Mağazada ödeme" yazıyor; e-posta alanı "isteğe bağlı" görünüyor ama kartta zorunlu; anahtar alanlarını tarayıcı kayıtlı e-posta/parolayla dolduruyor; iade durumu panelde yok.
