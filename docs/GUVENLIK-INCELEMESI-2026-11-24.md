# Güvenlik incelemesi (sınırlı kapsam) — 24 Kasım 2026

**Bu bir sızma testi ya da tam güvenlik denetimi DEĞİLDİR.** Kaynak koddan, bu oturumda eklenen/değiştirilen yüzeylere ve işletme (tenant) yalıtımına odaklı bir inceleme. Dış sızma testi, canlı sistem taraması, yük/DoS testi ve bağımlılık zafiyet taraması yapılmadı (bağımlılıklar için `docs/DEPENDENCY-SECURITY-REVIEW.md` önceki durumdur).

## Yöntem
1. **Kiracı yalıtımı taraması (sezgisel):** SQLite şemasındaki `tenant_id` sütunlu 172 tabloya dokunan ve metninde `tenant_id` geçmeyen SQL ifadeleri otomatik çıkarıldı (96 aday; uzun/çok satırlı ifadelerde filtre sonradan eklendiği için çoğu yanlış pozitif). Adayların riskli görünenleri (kimlikle güncelleme/silme, kullanıcı girdisiyle gelen id) tek tek okundu: depo güncelleme, kullanıcı güncelleme, hediye listesi, restoran kalemi, iade yönetimi, asistan ürün güncellemesi, satın alma, depo cari hareketi. Hepsinde sahiplik kontrolü ya sorgunun devamında ya da önceki sorguda vardı.
2. Bu oturumda yazılan yeni uçların kimlik, yetki ve girdi doğrulaması elle gözden geçirildi (aşağıda).
3. Mevcut `tenantCrossReference`, `warehouseAccessScope`, `apiScope` testleri çalıştı ve geçti.

## Bulgular
| # | Bulgu | Önem | Durum |
|---|---|---|---|
| 1 | `products.sku` şemada **küresel UNIQUE**; ürün güncellemede "SKU already exists" yanıtı başka işletmenin aynı SKU'yu kullandığını dolaylı gösterir (SKU varlığı sızıntısı, içerik değil). Kalıcı çözüm `UNIQUE(tenant_id, sku)` şema değişikliğidir. | Düşük | **Açık** (şema değişikliği ve veri çakışması riski; ayrı planlanmalı) |
| 2 | `patientReminderService.deleteReminder(id)` tenant parametresi almıyor; ancak hiçbir rota bu fonksiyonu çağırmıyor (ölü kod). | Bilgi | Bağlanırsa yetki açığı olur; silinmesi ya da tenant parametresi eklenmesi önerilir |
| 3 | Sezgisel tarama tüm ifadeleri kapsamaz; çok satırlı ifadeler ve dinamik SQL parçaları (şablon dizeleriyle birleşen WHERE) atlanmış olabilir. | — | Sınır |

Yeni yüzeyler (bu oturum):
- `POST /retail/receive/batch`: rol (admin/manager), `Idempotency-Key`, depo sahipliği (başka işletmenin deposu 404), satır sayısı sınırı (500), tam sayı miktar sınırı, ürün sahipliği; kayıt işlemi tek transaction. Testle doğrulandı.
- `GET/PUT /retail/lookup/providers`: yalnız platform yöneticisi; anahtar değeri hiçbir yanıta/sayaca/hataya girmez (testle doğrulandı); PUT kimlik/konum doğrulaması ve denetim kaydı.
- `/retail/lookup?any=1`: aynı işletme kapsamı; başka işletme göremez (test). Maliyet alanları mevcut yanıt-sınırı gizleme katmanından geçer.
- Ortak katalog: yalnız barkod, ad, marka, birim, kategori; fiyat/stok/işletme kimliği hiç saklanmaz; en az 2 farklı işletme gerekir; işletme katkıyı kapatabilir. **Bilinen risk:** kötü niyetli iki hesap aynı barkoda yanıltıcı ad vererek öneriyi manipüle edebilir (oylama ile sınırlı koruma; öneri her zaman kullanıcı onayına tabidir, otomatik kayıt yok).
- Android donanım tarayıcı alıcısı: `com.veniux.companion.SCAN` yayınını **dışa açık** dinler (DataWedge başka uygulama olduğu için gerekli). Aynı cihazdaki başka bir uygulama sahte barkod yayınlayabilir; etkisi klavyeden barkod yazmakla aynıdır (kullanıcı görür, kimlik doğrulaması aşılmaz). Giriş 128 karakterle sınırlı.
- Para birimi: sunucu tarafı doğrulama listesi (TRY/AZN/USD/EUR/GBP); satış varken değiştirilemez.

## Yapılmayanlar (gerçek bir sızma testi için gerekenler)
Kimlik doğrulama saldırıları (kaba kuvvet, oturum tekrarı, MFA atlatma), JWT/anahtar yönetimi incelemesi, dosya yükleme sertleştirmesi, SSRF (barkod sağlayıcıları sabit adres kullanır; webhook/entegrasyon adresleri incelenmedi), yedek şifreleme ve geri yükleme güvenliği, hız sınırı ve DoS, yönetim paneli (PHP) ve lisans sunucusu, cihaz kimlik doğrulaması ve çevrimdışı eşitleme güvenliği. Şirket kurulunca bağımsız bir sızma testi bütçelenmelidir.
