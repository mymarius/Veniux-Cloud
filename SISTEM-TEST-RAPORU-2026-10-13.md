# Veniux sistem değerlendirmesi — 13 Ekim 2026

## Sonuç

Otomatik yazılım kontrolleri ve kontrol edilen canlı site/API işlemleri başarılı. Ancak tüm sistemi, bütün cihazlarda sorunsuz kabul etmek için henüz yeterli kanıt yok. Kurulu Windows programı güncel değil; bazı sunucu/DNS güvenlik işleri ve gerçek cihaz kabulü açık.

| Kontrol | Nihai sonuç |
|---|---|
| Ana uygulama / SQLite | 79 test grubu, 657 test başarılı; 0 başarısız |
| Gerçek MySQL test sunucusu | 7 test grubu, 26 test başarılı; 0 başarısız |
| Masaüstü bağlantısı ve özel ayar sınırları | 9 test başarılı |
| Windows güncelleme uyarısı | Merkezi adres, sürüm kontrolü, indirme ve kurulum onayı testleri başarılı |
| Terminal / QR | Tek kullanım, süre aşımı, oturum aktarımı, TLS taşıma, cihaz kotası ve kapalı cihaz engeli başarılı |
| Lisans merkezi | Eşzamanlı cihaz sınırı, imzalı doğrulama, askıya alma/iptal ve cihaz yeniden kaydı ayrı test ortamında başarılı |
| Site hesabı | Ayrı ortamda kayıt/giriş, parola özeti, CSRF, indirme yetkisi ve çıkış kontrolleri başarılı |
| Canlı sahip hesabı | API kimlik doğrulaması ve sitede sahip/yönetici girişi başarılı |
| Canlı site | 11 herkese açık sayfa, site haritası, başlıklar, asıl adresler, gerçek 404 ve özel sayfaların indeks dışında kalması başarılı |
| Canlı Windows / Android indirmeleri | İki dosya tam indirildi; boyut ve SHA256 değerleri yayımlanan paketlerle eşleşti |
| Canlı API güvenliği | Sağlık 200; bilinmeyen adres 404; HSTS ve Permissions-Policy mevcut; PHP sürüm başlığı yok |
| Canlı yönetici giriş sınırı | Altı sınırlı hatalı deneme: 401, 401, 401, 401, 401, 429 |
| Android paket imzası | APK v2/v3 imzası doğrulandı |
| Arayüz derlemesi | Üretim derlemesi başarılı |
| Arayüz kaynak kontrolü | 0 hata; 614 uyarı. Bunlar temizlenmiş sayılmıyor |
| PHP kaynakları | 34 dosya kontrol edildi; sözdizimi hatası yok |

MySQL kontrolleri müşteri veritabanında değil, 127.0.0.1:33316 üzerindeki yalnız `veniux_test_` adlarıyla kullanılan ayrı test hedefinde çalıştırıldı. Veri geçişi, büyük kimliklerin korunması, stok/satış/iade, yetkiler, yedekleme/geri yükleme ve oturum iptali bu kapsamdadır. Test sunucusu işlem sonunda kapatıldı.

## Açık kalanlar

1. **Kurulu Windows sürümü 2.4.9.** Site ve merkezi yayın 2.4.11. QR ile otomatik giriş ve güncelleme uyarısı için bilgisayar ve Android bir kez 2.4.11 veya sonraki sürüme yükseltilmeli. Kontrol anında 17849/3000 yerel sağlık uçları erişilebilir değildi; kurulu programın gerçek oturumuyla uçtan uca kullanım doğrulanmadı.
2. **SPF, DMARC ve CAA DNS kayıtları bulunmadı.** DNS üzerinden e-posta ve sertifika yetkilendirme yapılandırması tamamlanmış değil. Yetkili DNS erişimi gerekiyor.
3. **Bilinen servis portları:** 21, 22, 110, 143 ve 8443 TCP bağlantısı kabul etti. 25 numaralı port zaman aşımına uğradı; bu, kapalı olduğu kanıtı değildir. Servis kimlik doğrulaması denenmedi. Portların gerekli olup olmadığı ve erişim sınırları hosting yönetimiyle değerlendirilmeli.
4. **HTTPS sertifikası geçerli; ALPN HTTP/1.1.** HTTP/2 bu bağlantıda seçilmedi. WAF varlığı veya etkinliği bu testlerle doğrulanmadı. `X-Powered-By: PleskLin` bilgisi hâlâ dönüyor; PHP sürümü gizlenmiş olsa da platform bilgisi tamamen kaldırılmış değil.
5. **Fiziksel cihaz kabulü eksik.** Gerçek Android telefon/el terminalinde kamera ile QR okuma, giriş, stok hareketi, Wi-Fi kesilip gelmesi, bilgisayar yeniden başlatılması ve uygulama yükseltmesi uçtan uca denenmedi. Barkod okuyucu/yazıcı gibi donanımlar için de gerçek ekipman kabulü gerekir.
6. **Gerçek dış hizmetler:** Bu denetimde e-posta, WhatsApp/SMS, ödeme veya resmî kurumlara gerçek işlem gönderilmedi. Birim testlerinin geçmesi bu hizmetlerin canlı kabulü değildir. Windows paketi ticari kod imzası taşımıyor; gerçek Windows yükseltme kurulumu ayrıca denenmeli.

## İlk başarısızlıkların açıklaması

- Tarayıcı lisansı testinde güncel VNX anahtarı doğrulamasına uygun anahtar eksikti. Test verisine geçerli biçimde bir deneme anahtarı eklendi; ürün doğrulaması değiştirilmedi.
- MySQL büyük kimlik testinde önceki testin iptal ettiği oturum sürümü sabit kullanılıyordu. Test, seçtiği kullanıcının mevcut oturum sürümünü okuyacak şekilde düzeltildi; oturum iptali kontrolü korunuyor.
- İlk MySQL çalıştırması belgelenmiş `log_bin_trust_function_creators=1` test ayarı olmadan başlatıldı. Windows'ta ebeveyn sürecin durdurulması alt süreci kapatmadığından ilk yeniden başlatma da geçerli değildi. Gerçek test alt süreci doğrulanıp durduruldu; doğru ayar SQL sorgusuyla teyit edildikten sonra bütün MySQL testleri tekrar çalıştırıldı ve geçti. Müşteri sunucusunun ayarı değiştirilmedi.

Nihai sonuçlar: `.local/system-audit-20261013.json`, `.local/full-regression-final-20261013.json`, `.local/mysql-regression-confirmed-20261013.json`. İlk başarısız denemelerin kayıtları da karşılaştırma için korunmuştur.
