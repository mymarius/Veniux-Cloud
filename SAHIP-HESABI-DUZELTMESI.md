# Sahip hesabı — 13 Ekim 2026

Sahip kimliği: `mymarius1@gmail.com`. Şifre kaynak koduna, Android paketine veya Windows kurulumuna eklenmedi.

- API: mevcut etkin yönetici kaydı korunarak e-posta ve şifre güncellendi. Diğer yönetici/müşteri kayıtları silinmedi. Önceki kayıt özel sunucu dizininde `license-private/owner-account-before-20261013.json` olarak yedeklendi. Tek seferlik özel uzlaştırma dosyası işlemden sonra kaldırıldı.
- Site: bu e-posta ayrı indirme hesabı dosyasından doğrulanmaz; HTTPS üzerinden API'deki sahip kaydı doğrulanır. Başarılı girişte “Veniux · Sahip / Yönetici” görünür. Diğer müşterilerin kayıt ve girişleri devam eder. Sahip için eski yerel site şifresine dönüş yapılmaz.
- Program: bilgisayardaki gerçek MySQL veritabanında kullanıcı 3, firma 3 ve platform yöneticisi kaydı doğrulandı. Ortak şifrenin mevcut program şifresiyle eşleştiği doğrulandı; çalışan hesabı ve firma verileri korunmuştur. Yeni Windows 2.4.9, bağlı sahip girişini merkezden doğrular. Mevcut ikinci doğrulama korunur; gerçek giriş denemesi merkezi şifre doğrulamasından geçip `mfa_required` yanıtı verdi. İkinci doğrulama tamamlanmadan oturum oluşturulmaz.
- Yerel firma sahibi ilk kayıt yapacaksa yalnız merkezde doğrulanmış sahip, kendi yeni firması için platform yöneticisi olabilir. Mevcut firmada eşleştirme için sahip e-postası, şirket sahibi e-postası ve yönetici rolü birlikte aranır. Başka müşteri hesabı yalnız bir e-posta iddiasıyla yükseltilmez.
- Logo: site genelinde eski harfli SVG sekme simgesi mevcut Veniux PNG logosuna çevrildi; yeni URL ile önbellek yenilendi.

Windows 2.4.9 canlı indirme dosyası: 201.198.615 bayt; SHA-256 `d6074201c42532e9eb2ef880c6e5d9b7d7f9d9e157703d1402e4538db4793f99`. Android 2.4.8 arayüzü aynı bilgisayar API'sine bağlanmaya devam eder; Android paketine yeni sahip şifresi konmadı.

Doğrulama: API ve site tarayıcı girişleri başarılı; programın gerçek veritabanındaki sahip yetkisi ve merkezi şifre + mevcut MFA kontrolü doğrulandı. Sahip doğrulama için dört Node testi ve geçerli/yanlış şifre/devre dışı sahip PHP testleri geçti. Müşteri kayıt/giriş/CSRF testi geçti. Canlı müşteri kayıt ve indirme testi Windows/Android dosyalarının tamamının bayt sayısı ve SHA-256 değerlerini doğruladı.

Merkezi sahip girişi internet gerektirir. Ticari Windows kod imzası ve gerçek Android cihazıyla kapsamlı kullanım kabulü önceki dağıtım raporundaki sınırlarıyla devam eder. Hesap yetkisi lisans/terminal koşullarını kaldırmaz.
