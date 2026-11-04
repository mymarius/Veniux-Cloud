# Veniux kaynak ve mimari denetimi

15 Ekim 2026. Bu ilk kapsamlı envanter ve doğrulama turudur; bütün ürün için hatasızlık veya ticari lansman onayı değildir. Üretim yayını/migration yapılmadı; müşteri verileri okunmadı veya değiştirilmedi.

## Gerçek mimari

| Klasör | Tespit ve teknik kanıt | Durum |
|---|---|---|
| backend | Express5/CommonJS, better-sqlite3, mysql2; package.json, src/config/database.js | Operasyon API; testte SQLite, üretimde açık sqlite/mysql seçimi |
| frontend | React19, Vite8, React Router; App.jsx | Windows ve Android tarafından kullanılan ortak arayüz |
| desktop | Electron44, electron-builder26, NSIS; main.js, preload.js, runtime.js | Mevcut program korunuyor; 2.4.31 imzasız yerel paket |
| mobile/android | Java WebView + ZXing; MainActivity.java, AndroidManifest.xml | 2.4.32/272; platform sürümü Windows ile zorunlu eşit değil |
| website-php | index.php ön denetleyici, PHP şablonlar, accounts.php | Laravel/Blade/composer yok; göç yapılmadı |
| api.veniux.com | PHP lisans merkezi; src/core.php, installation.php, updates.php | Üretim tasarımı MySQL; canlı DB motoruna bağlanılmadı |
| scanner-bridge | serialport, server.cjs | İsteğe bağlı cihaz köprüsü; gerçek seri cihaz denenmedi |
| shared | Barkod, etiket, para ve bekleyen satış modelleri | Tekrar kullanılabilir testli ortak kod |
| kenium-php | assets/includes ve PHP config | Veniux çalışma zincirinde aktif olduğuna kanıt yok; silinmedi |
| docker-compose.yml | PostgreSQL16 + Redis7 | Çalışan operasyon veritabanı kanıtı değil; örnek varsayılan parola ve tüm arayüz portları üretime uygun değil |

Tam kaynak yol listesi: SOURCE_INVENTORY.md. Çalışma klasörü Git deposu değil; değişiklikler commit düzeyinde izlenemiyor.

## Önceden tamamlananlar

Ürün/barkod, depo/raf, kabul/yerleştirme, toplama/paketleme, transfer/sayım, lot/SKT/FEFO, kasa/vardiya, satış/iade/maliyet, CRM/ekip, audit, tenant/depo erişimi, parola/MFA, lisans merkezi, yedekleme/geri yükleme, güncelleme yayın kanalı, mobil eşleştirme ve etiket atölyesi kaynakta bulunuyor. Bunların tamamı bu tur yeniden yazılmadı. Önceki raporların başarı sayıları yeni çalıştırma sonucu yerine kullanılmadı. Eczane uçları index.js içinde HTTP410 ile emekli; eski tablolar/dosyalar veri korumak için hâlâ var.

## Eksikler ve ticari sınırlar

Fiziksel cihaz kabulü ve temiz VM kaldırma testi yok. Merkezi lisans internet kesilince işlemleri kapatıyor; çevrimdışı çalışma vaat edilemez. Etiket gönderimi fiziksel kağıt sensör onayı değildir. Sitedeki dosya tabanlı görüşme kaydı tam CRM/iş ortaklığı başvuru paneli değildir. GA4 etiketi ve rıza arayüzü bulunamadı. Search Console ölçümleri yok. Şirket tüzel kişiliği, gelir, kullanıcı sayısı ve partner sözleşmeleri doğrulanmadı. Laravel testleri uygulanamaz.

## Bulgular ve en önemli 20 görev

| Öncelik | Sorun / çözüm | Dosya / teknik kanıt / test yöntemi | Durum |
|---|---|---|---|
| P0 | Başarısız testleri ürün hatası / eski sözleşme / ortam diye sınıflandır | backend/tests; .local/master-audit-tests*.json | Açık; testler gizlenmedi |
| P0 | Lisanssız giriş ve eski oturum engelini koru | mandatoryLicense, auth, mfa testleri | 15 hedefli test geçti |
| P0 | Tenant/depo erişim ve IDOR regresyonunu kapat | authMiddleware; accessScope; scopeQueryContext | Geniş sonuçta kalanlar var |
| P0 | Yedek→geri yükleme→başarısızlık geri dönüşünü doğrula | backupService; backupRecovery.test.js | Güncel test raporundan takip |
| P0 | İmzalı Windows yayın zincirini tamamla | desktop/electron-builder.signed.config.cjs | Sertifika/hesap yok; onay ve bütçe gerekli |
| P1 | Eczane kalıntılarını görünür yetki ekranından kaldır | roleCapabilities.js; UsersTab.jsx | Yerel uygulandı; eski rol ID/veri korundu |
| P1 | Son stok için eşzamanlı satış ve iade kontrolü | retailCritical; retailRecovery; stockHealth | Mevcut; geniş sonuçta doğrulanmalı |
| P1 | FEFO, SKT, raf ve lot hareket zinciri | wmsLotOperations; stockHealth | Mevcut; emekli API testi ayrı engel |
| P1 | Kurulum/kaldırma ve veri koruma VM kabulü | desktop/installer.nsh; deploymentLifecycle | Gerçek temiz VM kabulü bekliyor |
| P1 | Donanım kabul matrisi | docs/hardware/REAL_DEVICE_TEST_PLAN.md | Plan hazır; cihaz yok |
| P1 | Sürüm kaynağını platform bazında netleştir | desktop/package.json; AndroidManifest.xml | Windows31/Android32 bilinçli; backend1.0 yanıltıcı |
| P1 | Çevrimdışı işlemleri ürün sözüne uygun sınırla | centralLicense.js; pendingSale.mjs | Lisans çevrimdışı engeli korunacak |
| P2 | Sitemap tarih ve test doğruluğunu düzelt | website-php/seo.php; bin/seo-check.cjs | Yerel uygulandı |
| P2 | Search Console mülkünü doğrula ve gerçek ölçüm al | docs/growth/SEARCH_CONSOLE_SETUP.md | Hesap/DNS erişimi ve yayın onayı gerekli |
| P2 | GA4 için rıza ve başarılı olay sözleşmesi | docs/growth/GA4_SETUP.md | Plan hazır; izleyici eklenmedi |
| P2 | Form bozuk tip girişini reddet | website-php/contact.php; seo-contact-test.php | Yerel uygulandı; 13 kontrol geçti |
| P2 | Özgün rehberleri mevcut sayfalara bağla | organic-guides.php; CONTENT_PLAN_30_DAYS.md | Mevcut içerik korunacak; yeni içerik taslak |
| P2 | Mobil/erişilebilirlik ölçümünü yenile | website assets; frontend mobile styles | Bu tur yeni Lighthouse puanı yok |
| P3 | İş ortaklığı başvuru durum makinesini uygula | docs/partnerships/PARTNERSHIP_STRATEGY.md | Tasarlanmış; kodlanmadı |
| P3 | LinkedIn/YouTube/dağıtım ve startup hazırlığı | docs/growth; docs/startup | Taslaklar hazır; yayın/başvuru yok |

## Güncel test kanıtı

İlk tam koşu: 615 başarılı, 77 başarısız / 692; 68 başarılı, 19 başarısız test grubu. Alt süreç EPERM hataları için izinli izole koşu ayrıca alınıyor. Sonuçlar TEST_RESULTS.md içine kaydedilecek. Bazı eski testler kaldırılmış eczane API’lerinden 200 veya403 bekliyor; güvenli ürün davranışı410. Bu testleri atlamak yerine ayrı iş kalemi olarak raporladık.

## SEO ve trafik engelleri

Canlı 12 sitemap URL’si HTTP200, özgün title/description, canonical, H1, robots/header ve şema kontrolünden geçti. Robots engeli bu örnekte bulunmadı. Bu, Googlebot erişim logu veya indeks kanıtı değildir. Search Console verisi yok; düşük trafik kök nedeni kesinleştirilemez. İçerik dağıtımı, arama niyeti eşleşmesi ve dönüşüm ölçümü eksikliği büyüme önündeki doğrulanabilir süreç açıklarıdır. SEO_AUDIT.md ayrıntıları içerir.

## İzin ve sıra

Hemen: kaynak envanteri, izole testler, yerel güvenli düzeltmeler, taslak içerik/planlar. Açık onay: üretim dosyası/DB değişimi, DNS/hesap doğrulaması, Analytics etkinleştirme, ücretli sertifika/hizmet, dış platform başvurusu ve paylaşım.

Uygulama sırası: P0 test ayrıştırma ve erişim/veri bütünlüğü → P1 kurulum/cihaz kabulü → bağımsız P2 teknik SEO ve ölçüm → içerik/doğrulanmış ekran kayıtları → P3 dağıtım/ortaklık. Yeni marka veya mimari değişikliği yapılmadı.

## Bu tur değişiklikleri

seo.php: doğrulanmamış dosya tarihinden lastmod üretimi kaldırıldı. seo-check.cjs: sabit11 sayfa sınırı kaldırıldı. contact.php: dizi/nesne form girdisi reddedildi. seo-contact-test.php: izole13 kontrol. auth/mfa testlerinde açık sentetik lisans, mobilePairing mock’unda etkin lisans merkezi sözleşmesi. roleCapabilities.js ve UsersTab.jsx: emekli modül tanıtımları kaldırıldı; rol kimlikleri ve izinler korunuyor. scheduler.test.js: mevcut üç cron ifadesi açık kontrol ediliyor. Jest dışlama/skip eklenmedi. Emekli iki yetki tanımı kaldırılınca bunlara ait12 parametrik kontrol artık üretilmiyor; sayı farkı TEST_RESULTS.md içinde açıklandı.

## Son doğrulama

624/680 test başarılı; 56 test başarısız. Ayrıntı ve bütün sınırlamalar TEST_RESULTS.md içinde. HTTP/www yönlendirmesi tek301 ile HTTPS ana adrese ulaşıyor. Üretime yayın yapılmadı.

Son tam koşu:87 grubun79’u geçti;680 testin624’ü geçti,56’sı başarısız. Kalan8 grup emekli eczane/ilaç uçlarına bağlı eski beklentiler içeriyor; ayrıntılı dönüşüm ve aktif WMS eşdeğerleri ayrıca doğrulanacak. Testler gizlenmedi.

## Phase2 — 15 Ekim 2026

Phase2 güncellemesi: önceki56 başarısızlık çözüldü. Sonuç680/680; detay PHASE2_SUMMARY.md. Önceki sayılar tarihsel ilk denetimdir, güncel TEST_RESULTS.md esas alınır.
