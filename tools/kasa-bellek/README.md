# Kasa bellek / gecikme ölçümü (Electron + CDP)

Gerçek bir Electron penceresinde kasa ekranını (`/magaza/kasa`) satış döngüsüyle sürer, bellek ve gecikme örnekleri alır.
Yalnız TEST veritabanıyla çalışır; canlı sunucuya ve gerçek veriye dokunmaz. Üretim koduna test bayrağı eklemez
(aralık hızlandırma ve sayaçlar CDP ile sayfaya enjekte edilir).

Sonuçlar: `docs/KASA-BELLEK-OLCUMU-2026-11-23.md`.

## Kurulum
1. Büyük katalog: `cd backend && NODE_ENV=test TEST_SQLITE_PATH=<klasör>/pos.db node scripts/perf-seed.js 50000 2000` (çıktıdaki kiracı e-postası `owner_...@tenant.com`).
   Seed ürünleri depo 2'ye yazar; kasa depo 1'i seçer: `UPDATE stock_records SET warehouse_id=1, quantity=100000000 WHERE warehouse_id=2` (test DB'sinde).
   Kasa için en az bir kasiyer vardiyası açık olmalı (arayüzden "Vardiyayı aç").
2. Arayüzü derle: `cd frontend && npx vite build --outDir <klasör>/dist --emptyOutDir`.
3. Sunucu (API + statik arayüz, aynı kökenden): `DIST_DIR=<klasör>/dist CORS_ORIGIN=http://127.0.0.1:3100 TEST_SQLITE_PATH=<klasör>/pos.db node tools/kasa-bellek/sunucu.cjs`.
4. Electron: `desktop/node_modules/electron/dist/electron.exe --user-data-dir=<geçici klasör> tools/kasa-bellek/electron-ana.cjs` (CDP portu 9444; uygulamanın kendi `main.js`'i DEĞİL, yalnız bir pencere açar).
5. Giriş: `EMAIL=owner_...@tenant.com node tools/kasa-bellek/giris.mjs`.

## Ölçüm
- Satış döngüsü: `CAT_EVERY=100000 OFF_START=50 OFF_EVERY=150 node tools/kasa-bellek/olcum.mjs <satış> <örnek aralığı> <çıktı.jsonl> <sunucu PID>`
  (barkod → sepet → nakit → fiş; her 10. satışta bekletme, 20'de geri alma, 30'da silme, 15'te müşteri seçimi; `OFF_*` çevrimdışı pencereleri; `CAT_EVERY` katalog yenilemesini zorlar).
- Katalog yenileme: `MODE=catalog node tools/kasa-bellek/olcum.mjs <dakika> <örnek sn> <çıktı.jsonl> <PID>`.
- Özet tablo: `node tools/kasa-bellek/ozet.mjs <çıktı.jsonl>`.
- `yigin-anlik.mjs`: yığın anlık görüntüsü alır, ayrık (detached) DOM düğümlerini ve tutucu yolu yazar.

Uyarı: ölçüm aracının kendi CDP yükü renderer özel belleğini şişirir (rapora bakın); mutlak sayı için sayfa-içi döngü (satış başına CDP çağrısı yok) ayrıca doğrulanmalıdır.
