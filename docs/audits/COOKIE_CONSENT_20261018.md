# Çerez tercih paneli — 18 Ekim 2026

## Yayınlanan davranış

İlk ziyarette Reddet / Tercihleri yönet / Tümünü kabul et seçenekleri; gerekli oturum-form güvenliği ile isteğe bağlı istatistiklerin ayrımı. İstatistikler varsayılan kapalıdır. Sürüm kontrollü, 180 gün süreli tarayıcı tercihi; bozuk, eski, gelecekte tarihli ve süresi dolmuş kayıtlar izin sayılmaz. İzin geri alındığında yerel dönüşüm makbuzları temizlenir. GPC sinyali ölçümü kapalı tutar. Sekmeler arasında tercih değişikliği dinlenir. Depolama engellenirse ölçüm kapalı kalır. Google Analytics veya reklam sağlayıcısı yüklenmedi, yeni dış veri aktarımı eklenmedi.

Normal site, kayıt/giriş ve indirme sayfalarında aynı panel vardır. Eşit ağırlıklı kabul/ret düğmeleri, ayrı istatistik anahtarı, Escape ile değişiklik yapmadan kapatma, doğal modal odak yönetimi, durum duyurusu, açık/koyu tema ve dar ekran düzeni eklendi. Eski tek analitik dialog kaldırıldı. Zorunlu oturum ve form güvenliği korunur.

## Dosyalar

- `website-php/cookie-consent.php`: ortak panel ve bildirim.
- `website-php/assets/cookie-consent.mjs`, `consent-state.mjs`, `cookie-consent.css`: davranış, süreli tercih kaydı, görünüm.
- `website-php/assets/conversion.mjs`: yalnız geçerli yeni tercih ile dönüşüm; GPC kontrolü.
- `website-php/footer.php`, `accounts.php`: ortak panel ve tercihleri yeniden açma düğmesi.
- `website-php/legal.php`: mevcut uygulamayı açıklayan saklama/geri alma metni.
- `website-php/bin/build-assets.cjs`, `asset-manifest.php` ve hashli 5 CSS / site JS / consent JS dosyası: bütün sayfa gruplarına stil ve bağımsız panel betiği.
- `website-php/release-notes-20261018.php`: kullanıcıya açık yayın notu.
- `website-php/bin/consent.test.mjs`, `conversion.test.mjs`: izin kapısı/süre/ret/tekrar gönderim doğrulaması.

## Gerçek doğrulama

- 8 birim testi PASS (izolasyonsuz Node test çalıştırması; varsayılan alt süreç başlatma sandbox nedeniyle EPERM verdi, uygulama hatası değildir).
- Dört form için izole gönderim testleri PASS: CSRF, tek kullanımlık dönüşüm makbuzu, yenilemede tekrar saymama, bildirim kapalı.
- İzole kayıt/giriş testi PASS: CSRF, şifre özeti, yetkili indirme, hatalı giriş, yalnız POST çıkış.
- 16 sayfalık SEO kontrolü hem yerelde hem canlıda PASS.
- Tarayıcıda ret sonrası yenilemede tercihin korunması, istatistik seçimini kaydetme ve kayıt sayfasında aynı seçimin okunması kontrol edildi.
- 390 px mobil görünümde yatay taşma yok (iç genişlik ve scroll genişliği 375 px). Modal içeriği dikey kaydırılabilir.
- Canlıda ilk ziyaret paneli ve varsayılan kapalı istatistik anahtarı doğrulandı. Kanıt: `.local/cookie-preferences-live.jpg`.
- Beş PHP dosyasının sözdizimi doğrulandı; canlı yayın sırasında tüm yüklemelerin SHA-256 kontrolü yapıldı.

Yedek/yayın manifesti: `.local/cookie-publish-20261018T003158Z/`. Hesap dosyasında yalnız alt menü/panel eklemesi uzak kaynak üzerinde uygulanmıştır; diğer oturum/hesap davranışları değiştirilmedi. Üretim veritabanına dokunulmadı. Bu teknik uygulama hukuki uygunluk sertifikası değildir; gelecekte sağlayıcı eklenirse politika ve izin kapısı ayrıca değerlendirilmelidir. GPC, süresi dolma ve engelli depolama kod/birim testiyle doğrulandı; çoklu sekme senkronizasyonu için ayrı gerçek tarayıcı senaryosu bu turda çalıştırılmadı.
