# Veniux Windows kurulum görseli 2.4.36 — 16 Ekim 2026

## Tasarım ve gerçek davranış

Kullanıcının ikinci görseli hedef alındı: lacivert ürün sahnesi, sol adım sütunu, büyük seçilebilir bağlantı kartları, düzenlenebilir klasör, sponsor bağlantısı ve altta düzenli düğmeler. Mevcut Veniux logosu ve doğru Hostimux adı korundu. Yüzde yüz piksel eşitliği veya gerçek Windows ekran görüntüsüyle görsel kabul iddia edilmez.

Karşılama, tercihler, kurulum özeti, gerçek NSIS dosya kurulumu ve tamamlanma olmak üzere beş gerçek sayfa vardır. Sahte bileşen yükleme adımı veya uydurma ilerleme yüzdesi yoktur. Özette gerçek seçili sunucu türü ve `$INSTDIR` gösterilir. Dizüstü ekranı dekoratif ve boştur; uydurma ürün metrikleri/referansları çizilmez.

Kartlar görüntüden ibaret değildir: gerçek Windows düğmeleri klavye odağı, erişilebilir ad ve seçili durum açıklaması taşır. Bir kart seçildiğinde diğerinin seçimi görsel ve durum değişkeninde kaldırılır. Klasör gerçek düzenlenebilir Windows metin kontrolüdür; klasör seçici çalıştırır ve önceki doğrulanmış normalizasyonu kullanır. Geri gidildiğinde mod/konum korunur. Hostimux ayrı bir gerçek bağlantıdır.

## Dosya bazında

- `desktop/installer.nsh`: kartlı NSIS sayfaları; gerçek tercihler/özet; resimli ama gerçek düğmeler; düzenlenebilir klasör; yerel/ayrı sunucu durum kaydı; mevcut sessiz güncelleme ve kaldırma motoru korunur. Standart düğme çerçevesi klavye odağı korunarak yuvarlak sınırla kırpılır.
- `desktop/installer/build_artwork.py`: NSIS kontrol kimlikleri korunarak 600×350 DLU ana pencere ve 600×310 DLU içerik hazırlanır. Yerel ilerleme çubuğu 1004 korunur; resim 2202 arkada, ilerleme/status kontrolleri öndedir.
- `desktop/installer/render_interface.py`: 2× çözünürlükte deterministik başlık, ikon, kart, adım, alan ve düğme yüzeyleri. UI metinleri görsel modele çizdirilmez; koddan oluşturulur. Pencere boyutu sabit native şablondur; farklı DPI ve Windows metin ölçeğinde gerçek kabul ayrıca gerekir.
- `desktop/installer/warehouse-art-v1.png`: görsel modelden gelen yalnız dekoratif ürün sahnesi, proje içine kopyalandı.
- `desktop/installer/shell.bmp`, `*-body.bmp`, `card-*.bmp`, `button-*.bmp`, `sponsor.bmp`: kurulum derleme varlıkları. Çalışma zamanı veya ek kurulum uygulaması eklenmez; NSIS geçici dizine çıkarır.
- `desktop/installer/interface-layout.json`, `setup-preview-local.png`, `setup-preview-remote.png`, `*-render.png`: yerleşim kaydı ve aynı kaynaklardan hazırlanmış kompozisyon önizlemeleri. Bunlar çalışan Windows penceresinin ekran görüntüsü olarak sunulmaz.
- `desktop/package.json`, `desktop/package-lock.json`, `frontend/src/data/programRelease.json`, `frontend/dist`: 2.4.36 ve gerçek program içi değişiklik notları.

## Kontroller

15 masaüstü regresyon testi ve gerçek NSIS normalizasyon kodunu çalıştıran 8 sessiz klasör testi başarılı. Kontrol konumlarının içerik alanına sığdığı, iki durumdaki kart varlıklarının farklı olduğu, ilerleme çubuğunun native kaynakta kaldığı ve sayfa kapsayıcısının korunması ayrıca doğrulandı. Native önizleme beş sayfayla derlendi. Windows erişilebilirlik ağacında gerçek özet sayfası, seçilmiş yerel bağlantı, hedef klasör, Geri/Başlat/Vazgeç düğmeleri görüldü. Önizleme özet sayfasında gözlendi; ek otomasyon girdisi gönderilmedi.

Önizleme derlemesindeki kullanılmayan çalıştırma checkbox/fonksiyon uyarıları, test programının uygulama başlatmaması nedeniyle oluşur. Önizleme hiçbir program kurmaz, kayıt defteri veya işletme verisi değiştirmez. Üretim kurulumuna test atlama eklenmez.

Windows ekran yakalama aracı önceki denemelerde zaman aşımına uğradığı için doğrulama sınırı açık tutulur: yerleşim kompozisyonu incelendi, gerçek pencerenin ekran görüntüsüyle son görsel kabulü ve gerçek kurulum/güncelleme/kaldırma testi ayrıca bekler. Production veritabanına veya canlı dağıtım kanalına bu çalışmada dokunulmaz. Paket imzasızdır; Windows korumaları değiştirilmez.

## Görsel üretim kaydı

Tam Windows kurulum paketi 2.4.36 başarıyla derlendi (çıkış 0): `.local/desktop-installer-2.4.36/Veniux-Setup-2.4.36.exe`. Paket sürümü, beş UI giriş varlığı ve `latest.yml` ile EXE SHA-512 eşleşmesi doğrulandı. Sonuç `.local/installer-2.4.36-verification.json` içinde. Paket imzasızdır ve canlıya yüklenmedi.

Imagegen becerisi, yerleşik `image_gen` aracı kullanıldı; ücretli CLI/API etkinleştirilmedi. Kaynak stil görseli: kullanıcının `codex-clipboard-640fd1c1-da3d-4286-8eb1-922272da5bb5.png` eki. Son proje varlığı: `desktop/installer/warehouse-art-v1.png`.

Son prompt:

> Edit reference Image 2 only into a production installer BACKGROUND ART asset, not a mockup. Keep its elegant dark navy 3D photorealistic warehouse scene on the RIGHT: laptop, upright handheld barcode scanner, small cardboard package, restrained cool blue reflections and curved blue light ribbon. Keep almost identical composition and lighting. Remove ALL foreground interface elements, every label, logo, heading, number, button, input, divider and sidebar. Left 64 percent must be clean very dark navy negative space #071321, lower 38 percent similarly clean dark navy for actual native controls. Props confined to upper right 34 percent, fading seamlessly into navy before the lower controls. Laptop display should be blank dark blue glass, absolutely no invented dashboard metrics or text. No branding, no words, no watermark, no UI. Wide landscape around 1.6:1, high resolution sharp polished materials.
