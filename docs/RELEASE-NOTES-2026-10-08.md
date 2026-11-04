# Veniux Windows güvenlik dağıtımı — 8 Ekim 2026

Uygulama sürümü 1.0.0; yeni güvenlik revizyonu 2026-10-08 ve benzersiz build_id release.json içinde. Güncel paket: veniux-1.0.0-security-dependencies-20261008-4d86b234ea564849936e2c932ad02802.zip. Önceki b473f56c... ve 7 Ekim ZIP’leri bu bağımlılık revizyonu değildir. Şema/migration kataloğu değiştirilmedi.

**Genel yayına hazır değildir. ZIP, bağımsız EXE veya Windows servisi değildir.** Windows x64, Node.js 24.x/npm ve PowerShell 7 gerekir. İlk bağımlılık kurulumu internet ister; uygun native ikililer yoksa yerel derleme araçları gerekir. Arayüz derlenmiştir; Vite gerekmez. Mevcut dağıtım SQLite içindir. API/terminal açık kalmalıdır. Başka bilgisayar, fiziksel okuyucu/yazıcı ve MySQL kabulü bekler.

## Güvenlik değişiklikleri

- Üretimde controller kaynaklı 5xx mesajları güvenli açıklama/requestId’ye dönüştürülür; 4xx’e çevrilen SQL hata ayrıntıları temizlenir.
- Hata/uyarı logları ham hata, şifre ve token yazmaz; diğer loglarda bilinen sırlar/bağlantı URI’leri ayıklanır. Üretim WMS logunda işlem payload’ı yoktur.
- Yönetici kullanıcı ekleme ve şifre sıfırlama en az 8 karakter/en fazla 72 bayt sınırını uygular; güçlü şifre tercihi korunur. İlk kurulum daha güçlü, açıkça girilmiş 12 karakterlik şifre ister. Varsayılan hesap/şifre yoktur.
- Üretim varsayılan originleri seçili loopback portuyla sınırlıdır; geliştirme 5173 otomatik açık değildir. Mevcut Electron dosya origininin gereksinimi korunur. Sınırlı object/base/frame CSP eklenmiştir; tam XSS kabulü değildir.
- Yerel Medula kaydı kurum onayı gibi oluşturulmaz: draft/official_submission=false. Yerel tahmin ve eski doğrulanmamış kayıtlar açıkça ayrılır. Fatura mevcut internal_draft kalır; gerçek e-belge gönderilmiş sayılmaz.
- Temiz kurulum/güncelleme, WhatsApp’ın isteğe bağlı Chromium indirmesini varsayılan olarak atlar. Chrome/Edge veya WHATSAPP_BROWSER_PATH ile mevcut adaptör korunur; ayrıca indirmek için -DownloadWhatsAppBrowser kullanılabilir. Sağlayıcı TLS hatası ana uygulama kurulumunun gereksinimi değildir; TLS güvenliği gevşetilmedi.

## Bağımlılık revizyonu

- proxy-addr 2.0.8, qs 6.16.0, ip-address 10.7.3, brace-expansion 2.1.7/1.1.21; Nodemailer 10.0.16; resmî SheetJS 0.20.3 tarball.
- WhatsApp altında scoped Puppeteer 25.12.0; savunmasız extract-zip ve eski proxy/FTP zinciri kaldırıldı. NYC altında scoped js-yaml 4.3.2; kullanılmayan pg-migrate kaldırıldı.
- Arayüz Axios 1.20.0, router 7.18.4, PostCSS 8.5.29 ve ilgili build zincirleri güncellendi. Kilit dosyaları temiz kurulumla doğrulandı.
- Taze geliştirme lisans PEM’inin ikinci açılışını bozan açıklama düzeltildi; üretim anahtarları değişmedi.
- Ayrı SQLite’ta 66 grup / 509 test; ek 4 bağımlılık uyumluluğu/7 shared/1 köprü testi geçti. Temiz ZIP kurulum, giriş/sağlık ve güvenlik yedeği alan güncelleme geçti. Büyük JS parçası ve bazı üst paket deprecation uyarıları sürer.

## Yenilenmesi gereken daha önce paylaşılmış anahtarlar

Hiçbir anahtar değeri, parçası veya hash’i bu dokümana yazılmamıştır. Sağlayıcı hesaplarında iptal işlemi yapılmadı; aşağıdakilerin tamamı **yenileme/iptal bekliyor** durumundadır.

| Hizmet | Kullanıldığı yer | Yenileme sonrası kabul adımı |
|---|---|---|
| NVIDIA API | Özel veri klasöründeki install.env → NVIDIA_API_KEY; nvidiaAIService, aiAnalysisService ve varsa nvidiaSpeechService. | Sağlayıcı hesabında paylaşılmış anahtar iptal edilir, yenisi özel dosyaya yazılır; API yeniden başlatılır. Eski anahtarın reddi sağlayıcıda doğrulanır; yeni anahtarla yönetim bağlantı testi ve gerçek AI yanıtı ayrı doğrulanır. Bağlantı testi ses üretim kanıtı değildir. |
| Google AI Studio / Gemini | Daha önce metin ve ekran görüntüsüyle paylaşılmış Google anahtarları; install.env → GEMINI_API_KEY; googleSpeechService. | İlgili projelerde paylaşılmış anahtarların her biri iptal/yenilenir; yeni sır özel dosyada tutulur. Eski anahtarlar reddedilir; yeni anahtarla gerçek Türkçe ses yanıtı ve uygulamada oynatma kabul edilir. Anahtar biçimi/geçerliliği paylaşılmış olmasıyla kabul edilmez. |
| Fish Audio | install.env → FISH_API_KEY; fishSpeechService ve platformDiagnostics. | Fish hesabında paylaşılmış anahtar iptal edilir; yeni anahtar özel dosyaya girilir. Eski anahtar reddi, yeni anahtarın seçili modelle ses üretimi ve oynatımı doğrulanır. Model kimliği bir erişim anahtarı değildir. |

Yeni sırları sohbet, frontend, ZIP veya indirilebilir yedeğe koymayın. Anahtar değişimi tek başına eski JWT oturumunu iptal etmez: B01 kapsamında eski zayıf kullanıcılar ayrıca düzeltilmeli; şifre/rol/durum değişikliği eski oturumlarını geçersiz kılar. SMTP, Netgsm, Telegram veya WhatsApp eşleştirme anahtarının paylaşıldığına dair bu oturumda kanıt yok; paylaşılmış diye listelenmedi. Bunların yapılandırılmış olması canlı teslimat kabulü değildir.

## Devam eden yayın engelleri

B01 paylaşılmış anahtarlar/eski hesaplar; B02 doğrulanmış iletişim ve gizlilik metni; B03 resmî ilaç/KÜB/KT/SUT kapsamı; B04 İTS/Medula/gerçek e-belge kabulü; B05 gerçek HTTPS/proxy/erişim/izleme/dış yedek ve tam XSS/oturum kabulü açıktır. İlgili kabul koşulları PROJECT-CLOSURE-REPORT.md içindedir. Yeni ZIP bu engelleri ortadan kaldırmış sayılmaz.

İlk ZIP taramasının 1 kritik/12 yüksek/2 orta bulgusu B06 kapsamında giderildi. Backend/frontend/barkod köprüsü tam ve üretim audit’leri ile gerçek yeni ZIP kurulum taraması 0 uyarı. Hedefli güncellemeler uygulandı; audit fix --force veya bastırma yok. DEPENDENCY-SECURITY-REVIEW.md bütün paket zincirleri/etki ve override kabul sınırlarını içerir. WhatsApp canlı teslimatı ayrıca bekler.

## Kurulum ve doğrulama

Örnek backend/.env.example dosyasındaki bütün değerler boştur. Dosya tek başına sunucuyu başlatmaz. Install-Windows.ps1 dış kalıcı veri klasöründe güvenli install.env ve anahtar çifti üretir; sağlayıcı anahtarları kendiliğinden eklenmez. WINDOWS-DEPLOYMENT.md adımlarını izleyin.

Bu revizyon için üretim derlemesi, regresyon, ZIP içerik kontrolü ve paketten ayrı temiz kurulum/giriş/sağlık kabulünün kesin sonuçları kapanış raporundaki “Windows güvenlik ZIP’i kabulü” bölümünde tutulur. Fiziksel donanım ve başka PC test edilmiş sayılmaz.
