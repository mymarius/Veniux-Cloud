# Microsoft Store sürümü (28 Kasım 2026)

Partner Center: Veniux Cloud, Store ID 9NJP3F9M49C0, durum 28 Kas'ta "In draft". Henüz YÜKLENMEDİ ve onaylanmadı.

## Paket üretme
`frontend` derlenmiş olmalı. `desktop` klasöründe:
`VENIUX_RCEDIT_PATH=<electron-builder winCodeSign içindeki rcedit-x64.exe> node node_modules/electron-builder/out/cli/cli.js --config electron-builder.store.config.cjs --win appx --x64 --publish never`
Çıktı: `.local/desktop-store-<sürüm>/Veniux-Store-<sürüm>.appx` (imzasız; Store imzalar).

## Normal kurulumdan farkı
Yalnız app.veniux.com bulutuna bağlanır; yerel sunucu kurulumu pakette yok; kendi güncelleyicisi kapalı (`process.windowsStore`).

## Denenmeyenler
Paket Windows'a kurulup çalıştırılmadı (imzasız olduğu için); yazıcı, barkod, terazi seri portu, müşteri ekranı Store ortamında denenmedi. Ana yayın aracı (`yayinla.py`) Store paketi üretmez.

## Gönderim için gerekenler
Gizlilik politikası adresi, ekran görüntüleri, açıklama, yaş derecelendirme anketi, fiyat/pazar seçimi, `runFullTrust` gerekçesi, onay ekibi için deneme hesabı (gerçek müşteri verisi olmayan; parola depoya yazılmaz).
