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

## 28 Kasım durumu
Partner Center taslağında Pricing (indirme ücretsiz, TRY 0, tüm pazarlar), Properties (Business; gizlilik adresi; "Store dışı satın alma" ve "üretken yapay zekâ" beyanları), Packages, Store listing (yalnız Türkçe, 1 ekran görüntüsü; İngilizce liste kaldırıldı) ve Submission options (onaydan sonra elle yayınla; runFullTrust gerekçesi) tamam. Kalan: yaş anketi (IARC koşulları ve e-posta paylaşımı: kullanıcı yapar), Additional Testing Information deneme hesabı (kullanıcı), gönderim. Gönderilmedi.

## 28 Kasım: ONAYLANDI ve yayında
Store adresi: https://apps.microsoft.com/detail/9njp3f9m49c0 . Sitede /program-indir sayfasına Store seçeneği eklendi. Store sürümü bilgisayara kurulup tarafımızdan henüz denenmedi. Yeni Store paketi her seferinde elle üretilip gönderilir.
