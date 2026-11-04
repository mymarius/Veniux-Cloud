# Windows 2.4.32 — kurulum sponsor satırı

16 Ekim 2026. Kullanıcı ekran görüntüsünde sponsor bağlantısının NSIS içerik alanının altında kesildiği görüldü.

- `desktop/installer.nsh`: iki seçeneğin aralıkları azaltıldı. Hostimux bağlantısı y=134u yerine 100u; ayrı lisans/hosting açıklaması 161u yerine 118u. Tüm kontroller en geç 138u'da biter ve 140u içerik alanına sığar. Kurulumun managed/external seçimi ve kayıt davranışı değiştirilmedi.
- `desktop/package.json`, `desktop/package-lock.json`: yeni değişmez sürüm 2.4.32.
- `frontend/src/data/programRelease.json`: program içi 2.4.32 Windows notu.
- `frontend/dist`: mevcut kaynaklardan yeniden derlendi. Vite'nin opsiyonel Sass çözümlemesi ortamda çalışmadığı için `.local/build-installer-ui.mjs` kurulu Dart Sass'ı aynı SCSS kaynağına uyguladı; SCSS içeriği değiştirilmedi.
- `website-php/release-notes.php`: Windows 2.4.32 kurulum düzeltmesi. `sync-release-notes.cjs`: Windows notları yanlışlıkla Android geçmişine kopyalanmaz.

Doğrulama: 15 kurulum/bağlantı/baskı testi geçti. Paketlenmiş app.asar sürümü 2.4.32; beş frontend giriş varlığı mevcut derlemeyle bayt bazında eşleşti. NSIS derlemesi başarılı. EXE 195740009 bayt; latest.yml SHA-512 değeriyle eşleşti. Kurulum içerik sınırı kontrolü 138u/140u. Makineye yeni Veniux kurulumu yapılmadı. Yerleşim önizlemesinde kullanıcı girdisi algılandığında native UI işlemi durduruldu; tam gerçek kurulum ekranının görsel kabulü tamamlanmış sayılmaz.

Windows geçici imzasız yayın tercihi korunur; imzalı üretim yapılandırması değiştirilmedi. Android 2.4.32 bu Windows düzeltmesi nedeniyle değiştirilmez. Eski Windows 2.4.31 dosyasının üzerine yazılmaz. Production işletme veritabanına dokunulmaz.

## Yayın sonucu
Windows 2.4.32 canlı kanala alındı. Tüm EXE indirilerek SHA-512 ve 195740009 bayt boyutu doğrulandı. latest.yml otomatik güncelleme beslemesi 2.4.32; Android dosyası değişmeden 2.4.32 ve tam SHA-256 kontrolü başarılı. Kanıt: .local/packages-published-20261016.json. Kullanıcı verileri veya production veritabanı değiştirilmedi.
