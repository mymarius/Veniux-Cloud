# QR ile otomatik mobil giriş — 13 Ekim 2026

Windows ve Android 2.4.10 birlikte yayımlandı. Önceki Android ve Windows sürümleri oturum aktarımı yapmaz; iki taraf güncellenmeli ve bilgisayarda yeni QR oluşturulmalıdır.

Bilgisayarda mevcut kullanıcı hesabıyla giriş yapın. Ayarlar → Lisans ve plan → Mobil bağlantıyı aç → Yeni QR kodu oluştur adımını kullanın. Aynı yerel ağdaki Android uygulaması kodu okuttuğunda, bilgisayardaki açık kullanıcı ve firma bağlamıyla oturum açar. Site/merkez şifresi QR'a veya kurulum dosyalarına eklenmez.

QR kodu iki dakika geçerlidir ve bir kez kullanılabilir. Paylaşılmamalıdır. İstek yalnız eşleştirilmiş, sertifika kimliği doğrulanmış yerel HTTPS bağlantısından kabul edilir. Oturum kullanıcı kimliği, firma, rol ve session_version üzerinden tekrar doğrulanır. Mobil oturum bilgisayar oturumunun kalan süresini geçmez; ayrıca en çok bir saattir. Yeniden oturum açmak için yeni QR okutulur. Mevcut MFA ile açılmış bilgisayar oturumu aktarılır; MFA ayarı kaldırılmaz.

Telefon ayrı merkezi terminal olarak kaydedilir. Aynı mobil cihaz yeniden eşleştiğinde yeni terminal satırı oluşturulmaz; terminal anahtarı yenilenir. Terminal sınırı, kapatılmış cihaz, lisans süresi ve askıya alma denetimleri korunur. Mobil terminal kimliği başka telefonları kaydetmek için bilgisayar yetkisi olarak kullanılamaz. Mobil istemci geçit/runtime yönetim uçlarına erişemez.

Süresi dolan/kullanılmış QR, geçersiz bilgisayar oturumu, bağlantı veya terminal hakkı sorunu giriş/lisans ekranına sessizce yönlendirilmez; hata ve “Yeni QR kodu okut” adımı gösterilir. Önceden saklanan eski QR için bilgisayarı güncelleyip yeni QR alma uyarısı verilir.

Doğrulama: üç Node test grubunda altı test geçti; tek kullanım, zaman aşımı, eşleştirme zorunluluğu, JWT kimliği/yaşam süresi, kapalı kullanıcı, geçersiz session_version, terminal doluluğu ve TLS taşıma sınırı kontrol edildi. PHP lisans testinde kayıt, yeniden kayıt, kapasite, kapalı bilgisayar ve mobil zincirleme kayıt engeli doğrulandı. Canlı merkez sağlık kontrolü 200, hatalı terminal kaydı 403 döndü. Android v2/v3 imzası önceki sürümle aynı sertifikayla doğrulandı.

Mobil başlangıç için ek kabul testi ilk korumalı istek öncesinde lisans başlıklarının hazır olduğunu, yeniden açılışta tek kullanımlık QR'ın tekrar tüketilmediğini ve yeni QR ile yeni oturum alındığını doğruladı. Nihai Android SHA-256: `268365cea7a3ecf96f50e7d804ee5cb16f95c37da8a3036784219c692122b273`; Windows SHA-256: `16882f5bee7734e710c2529fb71e6202a9964d302b7e779bf221200f38368795`. Canlı indirme testi her iki dosyanın tamamını okuyarak manifestle eşleştiğini doğruladı.

Fiziksel telefonda gerçek QR okuma ve çalışma alanı açılışı bu çalışma ortamından denenemedi. Windows kurulumu ticari kod imzası taşımamaya devam eder. İndirme manifesti `.local/website-downloads-release-2.4.10/releases.json` içindedir.
