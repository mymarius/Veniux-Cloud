# Paket yayını — 16 Ekim 2026

Kullanıcı Windows 2.4.31'in geçici olarak imzasız yayınlanmasına açık onay verdi. İmzalı derleme yapılandırması değiştirilmedi; sertifika veya Windows koruması devre dışı bırakılmadı.

| Platform | Önce | Şimdi | Doğrulama |
|---|---|---|---|
| Windows | 2.4.21 | 2.4.31 | 195740086 bayt; tam canlı indirmede SHA-512 eşleşti |
| Android | 2.4.32 | 2.4.32 | 3224211 bayt; tam canlı indirmede SHA-256 eşleşti |

Windows EXE ve blockmap özel yayın klasörüne FTPS ile yüklenip tekrar okunarak doğrulandı. Eski manifest ve latest.yml `.local/windows-publish-backup-20261015T215645Z` altında saklandı. Manifest sürümü yükseltilmeden önce eşzamanlı değişiklik kontrol edildi. Var olan sürüm dosyaları değiştirilmedi. Ardından windows.json ve Electron latest.yml etkinleştirildi. Python ile son HTTP kontrolünde bağlantı reddedildi; ayrı Node doğrulaması her iki platformun tüm dosyasını indirerek başarılı oldu. Kanıt: `.local/packages-published-20261016.json`.

15 masaüstü testi geçti: mevcut sunucu seçimini koruma, HTTPS hedefi, lisans/DB ayarlarının hizmet anahtarlarından etkilenmemesi, yetkili baskı ve tekrar basım koruması. İlk izole test çalıştırması ortamın alt süreç kısıtına takıldı; aynı testler assertion/skip değiştirmeden `--test-isolation=none` ile çalıştırıldı.

Paketlenmiş frontend'de Hostimux bağlantısı ve görseli, etiket atölyesi ve sürüm notları doğrulandı. Paketlenmiş renderer ile çalışma dizinindeki son renderer çıktısı bire bir aynı değildir; bu işlem mevcut 2.4.31 inceleme paketinin onaylı yayınıdır, yeni derleme değildir. Sonraki kaynak değişiklikleri için ayrı sürüm/derleme gerekir.

Site dosyaları: program-view.php ve accounts.php imzasız yayın açıklaması; release-notes.php Windows yayın kaydı; sync-release-notes.cjs ve release-catalog.php gerçek sürüm özeti. Son site yedeği `.local/growth-publish-backup-20261015T215905Z`. Kullanıcı verileri, lisanslar, production veritabanı ve Android paketi değiştirilmedi.

Kalanlar: Windows doğrulanmış yayıncı sertifikası/SmartScreen itibarı, temiz Windows cihazında kurulum/güncelleme ve fiziksel yazıcı/telefon kabul testi. Bunlar tamamlanmış sayılmadı. Kurulu programlar bu işlemle zorla kapatılmadı veya güncellenmedi; mevcut istemci güncelleme kontrolü ve kullanıcı kurulumu gerekir.
