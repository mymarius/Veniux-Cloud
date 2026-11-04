# Kurulum kontrol hataları — 2.4.37, 16 Ekim 2026

## Neden ve düzeltme

Dekoratif bitmap ile gerçek Windows kontrollerinin kardeş pencere sırası (z-order) yönetilmiyordu. Bitmap oluşturma sırasında yapılan sıralama tek başına yeterli değildir: diğer kontroller tamamlandıktan sonra arka plan açıkça alta alınmalıdır. Görsel önizleme ve yalnız derleme testi bu hatayı yakalamamıştı.

`desktop/installer.nsh` içindeki yeni `VeniuxShowPage`, her sayfada bütün kontroller oluştuktan sonra ana ve sayfa arka planını `HWND_BOTTOM` konumuna alır. Progress sayfası da aynı şekilde düzeltilir. Geri/Vazgeç resimleri her sayfada yeniden bağlanır. Bir düğme yüzeyi yüklenemezse `BS_BITMAP` kaldırılır; gerçek düğme yazısı boş bir dikdörtgen yerine görünür kalır.

Bağlantılar açıkça **Bu bilgisayarda (yerel) kurulum** ve **HTTPS sunucusuna bağlan** olarak adlandırıldı. İkinci seçenek yerel veritabanı hazırlamaz; HTTPS adresi ilk uygulama açılışında mevcut doğrulanan akışla alınır. Anahtar, şifre veya adres kurulum resmine gömülmez. Mevcut işletmenin kaydedilmiş hedefi otomatik değiştirilmez; özet sayfasında bu sınır belirtilir.

## Dosyalar

- `desktop/installer.nsh`: arka plan sırası, sayfa geçişi, düğme yedek davranışı, seçim adları, gerçek HWND kontrol testi (yalnız `VENIUX_LAYOUT_PROBE` koşulunda), sessiz güncelleme koruması ve özet açıklaması.
- `desktop/installer/render_interface.py`: kart yüzeylerinde Yerel/HTTPS metinleri ve HTTPS ilk açılış açıklaması.
- `desktop/installer/card-*.bmp`, `*-body.bmp`, `button-*.bmp`, `shell.bmp`, kompozisyon PNG'leri: aynı üreticiden güncellendi. Yeni görsel üretimi yapılmadı.
- `desktop/package.json`, `desktop/package-lock.json`, `frontend/src/data/programRelease.json`, `frontend/dist`: 2.4.37 ve hata düzeltme notları.

## Gerçek kontrol testi

`.local/installer-launcher-preview.nsi` derlenerek kendi kontrollerini oluşturup otomatik kapanan `.local/installer-controls-selftest.exe` çalıştırıldı. Uygulama, veritabanı, servis veya kayıt defteri kurmaz; sadece test penceresi ve sonuç dosyası oluşturur. Test kodu üretim paketine dahil edilmez.

`.local/installer-layer-check.txt` sonucu:

```text
background_bottom=PASS
folder_button_enabled=PASS
directory_initial=PASS
directory_edit=PASS
https_choice=PASS
local_choice=PASS
back_face=PASS
cancel_face=PASS
missing_face_text_fallback=PASS
```

Klasörün başlangıç değeri gerçek `$INSTDIR` ile doludur. Düzenlenebilir metin alanına test yolu yazılıp geri okunur ve başlangıç değeri geri yüklenir. Yerel ve HTTPS gerçek seçim callback'leri çalıştırılıp durum kontrol edilir. Geri/Vazgeç gerçek bitmap tanıtıcıları okunur. Bilerek bulunmayan bir yüzeyle fallback kolu çalıştırılır. Arka planın gerçek kardeş pencere listesindeki son kontrol olduğu Windows API ile doğrulanır; yalnız kaynak kodu metnine bakılmaz.

Ayrıca masaüstü regresyonları 15/15 ve gerçek NSIS klasör normalizasyonu 8/8 geçti. İlk derleme denemesinde geçersiz `InvalidateRect` komutu yakalandı; Windows API çağrısına çevrilip test baştan yeniden derlenerek çalıştırıldı. Eski test ikilisiyle alınan önceki çıktı yeni testin başarısı olarak sayılmadı.

## Sınırlar

Tam Windows paketi derlendi (çıkış 0): `.local/desktop-installer-2.4.37/Veniux-Setup-2.4.37.exe`. Paket içi sürüm 2.4.37, beş UI giriş varlığı ve EXE SHA-512 / `latest.yml` eşleşmesi doğrulandı. Kanıt `.local/installer-2.4.37-verification.json`. Dokuz native kontrol, sekiz klasör normalizasyonu ve 15 masaüstü regresyon kontrolü başarılıdır; bu 32 kontrol, aşağıda bekleyen elle uçtan uca testleri içermez.

Windows Computer Use uygulama izni zaman aşımına uğradı. Bu nedenle gerçek işletim sistemi klasör penceresinde elle seçim, fareyle kart/geri/ileri akışı ve tam kurulum/güncelleme/kaldırma son kabulü tamamlandı olarak raporlanmaz. Kontrol testi, bu elle yapılan uçtan uca testlerin tamamı değildir. Sıfır hata garantisi verilmez. Production veritabanına, lisansa ve canlı indirme kanalına dokunulmaz; Windows imza durumu değiştirilmez.
