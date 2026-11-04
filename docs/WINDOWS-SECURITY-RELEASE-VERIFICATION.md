# Windows ZIP kabulü — bağımlılık güvenliği revizyonu, 8 Ekim 2026

Güncel paket: **veniux-1.0.0-security-dependencies-20261008-4d86b234ea564849936e2c932ad02802.zip**. Önceki b473f56c... ZIP’i güncel değildir. Genel yayına hazır değildir; Windows x64, Node 24/npm, PowerShell 7 ve ilk kurulumda internet gerekir. Bağımsız EXE/Windows servisi değildir.

| Kontrol | Sonuç | Kanıt ve sınır |
|---|---|---|
| Üç bileşende temiz npm ci | Geçti | Ayrı test kopyası; kaynakta açık sunucunun native dosya kilidi nedeniyle clean deneme EPERM verdi, source install --ignore-scripts tamamlandı. |
| Üretim derlemesi | Geçti | Ayrı temiz kopya ve ZIP derlemesi. Büyük JS parçası uyarısı sürer. |
| Satış/stok/iade/yetki/yedek/kurulum | Geçti | 66 grup / 509 test; ayrı SQLite. Bağımsız yarış, miktar, para, kapsam, migration ve restore koşulları korunur. |
| Ek bağımlılık/istemci/köprü | Geçti | 4/4 uyumluluk, 7/7 shared, 1/1 bridge; gerçek ayrı Chrome headless API. Canlı WhatsApp/SMTP/donanım testi değil. |
| Yeniden audit | Geçti | Backend/frontend/bridge tam ve üretim altı tarama + gerçek ZIP üretim taraması 0 bulgu. Bilinen advisory tarama anıyla sınırlı. |
| ZIP kurulum/giriş/sağlık | Geçti | Gerçek Install-Windows.ps1, ayrı veri ve sahte ilk yönetici; HTTP UI/SQLite/current/19 migrations, auth/me. Başka PC/tarayıcı UI testi değil. |
| ZIP güncelleme/güvenlik yedeği/yeniden giriş | Geçti | Gerçek Update-Windows.ps1 aynı şemadaki ayrı kurulumda; test migration/kurtarma ayrıca deploymentLifecycle’da. Gerçek eski müşteri verisi kullanılmadı. |
| ZIP gizlilik/boş ayarlar/SHA | Geçti | Son arşiv tekrar açılarak içerik taranır; .env/DB/PEM/yedek/log/anahtar/test hesabı/node_modules yok. .env.example boş. SHA eşlik dosyasında. Bilinen sır/biçim sınırı korunur. |
| Haricî anahtar yenileme | Doğrulanamadı | NVIDIA/Gemini/Fish sağlayıcı hesabında iptal yapılmadı; hepsi bekler. Değerler gösterilmez. |
| MySQL/başka PC/fiziksel cihaz/tarayıcı dosya kaydı/canlı servis | Doğrulanamadı | Kapanış raporundaki B01–B05 ve T kabul koşulları açık. |

İlk test hataları gizlenmedi: .local yolundaki Express dotfile koruması/boş backup fixture klasörü; taze geliştirme PEM kalıcılık hatası (düzeltildi ve iki-process testi eklendi); Excel UTC varsayımı/Edge headless kapanışı (gerçek tarih metni ve Chrome ile ayrı doğrulama). Gerçek kurucu ACL’si kısıtlı aracı engelledi; sadece sahte veri klasörüne geçici erişim verildi, test temizliği kanıtı dependency-windows-cleanup.json’dadır: şifre dosyası silindi, 26 sahte dosyada private ACL sıfırlaması geçti; işlem sonrası bağımsız recursive ACL incelemesi yapılmadı. Normal Windows kullanıcı/başka PC recursive ACL kabulü bekler.

Kanıtlar: audit/dependency-security-regression-accepted.json, dependency-security-findings.json, dependency-security-*-final.json, dependency-windows-{install,runtime-before-update,runtime,update,package,cleanup}.json. Ham log/test verisi ZIP’e eklenmez. Paket kapsamı ve anahtar listesi kapanış raporu/sürüm notlarındadır.
