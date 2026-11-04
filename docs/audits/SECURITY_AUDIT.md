# Güvenlik denetimi

15 Ekim 2026. Bağımsız sızma testi sertifikası değildir. Yalnız kaynak ve izole test kanıtı.

| Alan | Kanıt | Sonuç ve açık kontrol |
|---|---|---|
| SQL/tenant | database.js parametreler + scopeQueryContext.js; multi_tenant_isolation testleri | Dinamik SQL ve bütün route kapsamı ayrıca incelenmeli; başarısız tenant testi kapatılmadan lansman yok |
| Oturum | authMiddleware DB rol/status/session_version kontrolü | Token tek başına hesap kapatmayı aşmıyor; auth/MFA hedefli testleri geçti |
| Lisans | centralLicense imzalı nonce/kısa süre yanıtı; cloudLicenseBinding | Lisanssız sahip hesabı dahil engel korunuyor; zorunlu çevrimdışı erişim yok |
| XSS | PHP e(), React escaping, etiket kaçışı ve CSP | Bütün HTML/export yolları ayrı incelenmeli; otomatik tüm-XSS-güvenli iddiası yok |
| CSRF | accounts ve iletişim session token; SameSite/HttpOnly | Bozuk dizi girdisi422; yanlış token403; başarılı işte token yenilenir |
| Brute-force | requestFirewall, auth limiter | Çok süreçte kalıcı/merkezi limitin canlı topoloji kontrolü bekliyor |
| Dosyalar | updateStorage allowlist; web-root dışı talepler | Üretim document root ve yedek dosya HTTP erişimi ayrı kabul maddesi |
| Sırlar | runtimeConfig zorunlu güçlü JWT; dış veri/anahtar dizini | Bu tur özel anahtar/.env içeriği okunmadı; sızıntı yokluğu sertifikası verilmez |
| Yedek | backupService ve backupPrivacy | Farklı diskte kurtarma + anahtar saklama tatbikatı bekliyor |
| Güncelleme | electron-updater; signed builder zorunluluğu | SHA bütünlüğü yayıncı kimliği değildir; sertifika yok |
| Eski docker | postgres/postgres, 5432/6379 public bind | Çalıştırılmadı; üretimde kullanılmamalı; parola/loopback/erişim planı gerekli |

Önem: lisans veya IDOR atlatma doğrulanırsa P0; test uyuşmazlığı ürün açığı diye sunulmaz. Eski eczane uçlarının410 dönmesi güvenli emekliliktir. Dosyalar silinmedi. Gerçek veriye erişim, saldırı/yük testi, port taraması veya dış hesap işlemi yapılmadı.

## Phase2 — 15 Ekim 2026

Phase2: tenant/rol/lisans ve güvenlik regresyonu dahil680 test geçti. Emekli uçlarda beşHTTP yöntemi ve veri değişmezliği doğrulandı. Webde başarı makbuzu ve PII allowlist eklendi; dış GA4 kapalı. Üretim güvenlik sertifikası iddiası yok.
