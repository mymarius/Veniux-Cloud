# Kasa bellek ve gecikme ölçümü (gerçek Electron penceresi) — 23 Kasım 2026

Önceki rapor (`UZUN-KULLANIM-PERFORMANS-2026-11-23.md`) "gerçek tarayıcıda saatlerce süren kasa döngüsü ölçülmedi" diyordu. Bu rapor onu gerçek bir Electron penceresinde ölçer. Kod değişikliği **yok**; yalnız ölçüm aracı (`tools/kasa-bellek/`) ve bu rapor eklendi.

## Kısa sonuç
- **JS yığını ve DOM sızıntısı bulunmadı.** 1.200 satışta (1.200 ödeme penceresi, ≈2.400 barkod okutma, 64 çevrimdışı satış, bekletme/geri alma/silme, müşteri seçimi) çöp toplama sonrası JS yığını 16,9 → 18,7 MB'a çıkıp **düz kaldı** (600. satıştan sonra 18,7 MB); DOM düğümü 1.374'te, olay dinleyicisi 319'da, ekrandaki düğüm ≈271'de **sabitlendi**. Çevrimdışı kuyruk her çevrimiçi dönüşte boşaldı (IndexedDB `sales` = 0).
- **Yavaşlama yok.** Barkod→sepet medyanı 13,5 → 13,0 ms, ödeme→fiş medyanı 37,9 → 36,6 ms (1–300 ile 901–1200. satışlar arası). Ayrıntı tabloda.
- **Katalog yenileme (50.000 ürün) sızıntı bırakmıyor**, ama geçici tepe var: yenileme sırasında yığın ≈28–29 MB'a, renderer özel belleği ≈210 MB'a çıkıp iniyor.
- **Bir kez tuhaf davranış görüldü, kök nedeni kanıtlanmadı** (aşağıda "Ayrık DOM düğümleri"). Düzeltme denedim, işe yaramadı, **geri aldım**; kasada kod değişikliği yok.
- Renderer özel belleği ölçüm aracıyla satış başına ≈0,1 MB artıyor göründü; **araçsız kontrol** (satış döngüsü sayfa içinde) bunun büyük kısmının ölçüm yükü olduğunu gösterdi (aşağıda). Günlerce süren gerçek eğri **ölçülemedi**.

## Ne ölçüldü (gerçek) / ne simüle edildi

**Gerçek:**
- `desktop/node_modules/electron/dist/electron.exe` (Chromium, Windows 10) içinde derlenmiş kasa arayüzü (`vite build`, üretim paketi, `RetailPos.jsx` dahil), gerçek DOM/React/IndexedDB/XHR; gerçek yerel Express backend (SQLite test veritabanı) ile.
- Veri: `backend/scripts/perf-seed.js` ile 50.002 ürün, 5 cari hesap, 1 ürüne fiyat kademesi (müşteri seçici görünsün diye). Yalnız `TEST_SQLITE_PATH` ile ayrı klasör; gerçek veriye ve canlı sunucuya dokunulmadı (tüm istekler `127.0.0.1:3100`).
- Satış döngüsü gerçek arayüz yollarıyla: barkod alanına yazma (`Input.insertText`) → **Ekle** düğmesi → sepet → **Ödeme al** → **Ödemeyi kaydet** (nakit tam tutar) → "Satış tamamlandı" fişi. Her satışta 1–3 satır. Satışlar sunucuya gerçekten yazıldı (sunucu testinde ≈4.000 satış, 222'si `mode=offline`).
- Çevrimdışı: `Network.emulateNetworkConditions(offline)` ile tarayıcı gerçekten çevrimdışı; satış yerel katalogdan, "Çevrimdışı satış kaydedildi", kuyruğa yazıldı; çevrimiçi dönünce uygulamanın kendi kodu kuyruğu gönderdi.
- Bekletme (her 10. satışta), bekleyeni geri alma (20'de), silme (30'da), müşteri seçimi (15'te).
- Katalog yenileme: uygulamanın kendi `updateCatalog` kodu, 500 sayfa × 100 ürün.
- Ölçümler: `Runtime.getHeapUsage` (zorunlu çöp toplama sonrası), `Memory.getDOMCounters`, `Performance.getMetrics`, `SystemInfo.getProcessInfo` + `Get-Process` (renderer/browser/GPU/sunucu özel bellek), `navigator.storage.estimate()`, her satışın gecikmesi sayfa içinde `performance.now()` ile.

**Simüle / sınırlı (dürüstçe):**
- **Zaman hızlandırma:** `Date` değiştirilmedi. Yalnız ≥10 dakikalık `setInterval`'lar CDP ile sayfaya enjekte edilen bir kılıfla 90'a bölündü (katalog yaş denetimi 30 dk → 20 sn), ve katalog yaşı anahtarı elle eskitildi (6 saat TTL beklenmedi). Yani "günlerce" gerçek saat süresiyle ölçülmedi; **toplam çalışma birkaç on dakika**. Kasa saatlerinin geri kalanında oluşan boşta kalma (12 sn bağlantı yoklaması, 60 sn ÖKC yoklaması) gerçek süresiyle ölçülmedi.
- **Satış hızı insan hızı değil:** saniyede ≈1 satış (gerçek kasiyer 20–60 sn). Bellek sayıları satış başına doğru olmalı; zaman başınaları değil.
- **Ekle düğmesi kullanıldı, tuş (Enter) değil.** Yeni yüklenmiş sayfada CDP ile gönderilen Enter bazen barkodu göndermedi (neden araştırılmadı; gerçek tarayıcı/okuyucu girişi bu raporda sınanmadı). Okuma yolu (`useScanner` → `scan` → `/scanner/lookup`) aynı.
- **Ana süreç:** uygulamanın kendi `main.js`'i çalıştırılmadı; küçük bir Electron kabuğu (`tools/kasa-bellek/electron-ana.cjs`) kasa sayfasını açtı. Paketlenmiş uygulama, yerel **MySQL** sunucusu, yazıcı/ÖKC/müşteri ekranı penceresi **ölçülmedi**. "Sunucu" sayıları Node+SQLite test backend'inin; üretimdeki yerel sunucuya (MySQL) uygulanamaz.
- Tek pencere, 1366×850, geliştirme makinesi (hızlı CPU, SSD). Düşük donanımlı kasa bilgisayarında gecikmeler büyük olur.
- `perf-seed` satışları gerçek satış kadar çeşitli değil; sepet küçük (en çok 3 satır).

## Sonuçlar

### Satış döngüsü, 1.200 satış (`run4`; kataloğu yenilemeden, çevrimdışı pencereler dahil)
Çöp toplama sonrası değerler (sütunlar: satış sayısı).

| Satış | JS yığını MB | DOM düğümü (toplam) | Ekrandaki düğüm | Dinleyici | Renderer özel MB* | IndexedDB MB |
|---|---|---|---|---|---|---|
| 0 | 16,9 | 383 | 279 | 178 | 126 | 14,0 |
| 200 | 18,2 | 801 | 274 | 318 | 172 | 14,0 |
| 400 | 18,6 | 1.214 | 271 | 319 | 184 | 14,1 |
| 600 | 18,7 | 1.374 | 271 | 319 | 199 | 14,1 |
| 800 | 18,7 | 1.380 | 274 | 318 | 220 | 14,1 |
| 1000 | 18,7 | 1.374 | 271 | 319 | 225 | 14,1 |
| 1200 | 18,7 | 1.374 | 271 | 319 | 251 | 14,1 |

\* Ölçüm aracının kendi yükü dahil; aşağıdaki kontrole bakın. Satış 100'deki "12.336 düğüm" satırı atlandı: aşağıda anlatılan ayrık düğüm olayı.

Gecikme (ms, çevrimiçi satışlar; 568 okutma / 284 ödeme her dilimde):

| Satış aralığı | Barkod→sepet medyan / p95 / p99 | Ödeme→fiş medyan / p95 / p99 |
|---|---|---|
| 1–300 | 13,5 / 25,5 / 46,7 | 37,9 / 55,8 / 67,2 |
| 301–600 | 13,0 / 22,4 / 28,9 | 34,3 / 49,5 / 68,6 |
| 601–900 | 13,0 / 25,0 / 29,4 | 35,7 / 50,6 / 69,1 |
| 901–1200 | 13,0 / 24,6 / 28,9 | 36,6 / 47,5 / 71,9 |

Çevrimdışı ödeme→fiş: 64 satışta medyan 22,6 ms, p95 31,1 ms (yerel kuyruk sunucu gidiş-dönüşünü atlıyor). Zaman aşımı: 0. Eğri **düz**; yavaşlama yok. Bu sayılar yerel makine, sıfır ağ gecikmesi içindir; gerçek ağ/MySQL gecikmesi eklenir.

Diğer koşular tutarlı: `run3` (400 satış) ve `run6` (500 satış, kare hızı 64 fps) aynı plato (yığın 20,3 / 18,6 MB; düğüm 1.214 / 1.380), `run5` (800 satış) yığın 18,7 MB.

### Katalog yenileme, 50.002 ürün (`run8`, 12 dakikada ≈19 tam indirme)
Yenileme arka arkaya zorlandı (gerçek: 6 saatte bir). Çöp toplama sonrası yığın 17,4 MB → 19,2 MB (ilk 3 yenilemeden sonra), sonraki 16 yenilemede 19,1–19,4 MB **düz**; yenileme sürerken geçici 28–29 MB; renderer özel belleği 130 MB → yenileme sırasında 172–211 MB → yenileme bitince 163 MB. Düğüm/dinleyici sabit (1.334 / 278), IndexedDB 25 MB (50k ürün) sabit. Her yenileme 500 istek (toplam ≈9.500); **28 kat sık** yenileme zorlandığında (`run2`, her 40 satışta) sunucu `requestFirewall` sınırına (varsayılan limit 6000, burst 600; hangisinin tetiklendiği ölçülmedi) çarptı ve `İstek sınırına ulaşıldı` verdi; o koşu 388. satışta bozuldu (ilk 375 satış geçerli, yığın 17,3 → 19,9 MB, düğüm 1.273). Gerçek kullanımda (6 saatte bir) risk yok; ama 50 bin ürünlü katalog tek yenilemede 500 istek demektir, yavaş ağda uzun sürer.

### Sunucu (Node + SQLite test backend, **üretim sunucusu değil**)
Özel bellek ilk 200 satışta 212 → 288 MB (önbellek ısınması), sonra düz (258–288 MB, 1.200 satışın sonunda 269 MB). Bir kerelik dalgalanma (137 MB'a düşüş) görüldü; neden araştırılmadı (muhtemelen çöp toplama).

## Ayrık DOM düğümleri olayı (kanıtlanmamış, kasada değişiklik yok)
Bazı koşularda (`run1`, `run3` başı, `run4` ilk 100, `run5` 100–300) toplam DOM düğümü ödeme penceresi başına ≈118 düğüm + ≈28 dinleyici artıp (örn. 383 → 36.401 düğüm / 8.837 dinleyici), sonra **tek seferde** boşaldı (`n=400`: 1.214). Ekrandaki düğüm sayısı hep ≈271 idi, yani sızan düğümler ekranda değil, **ayrık (detached)**.

Yığın anlık görüntüsü (satış 150, 14.245 ayrık düğüm): ayrık düğümlerin çoğu 182 adet kapanmış `.vx-dialog` ağacıydı (≈78 düğüm/pencere) ve tutucu yol `Window → HTMLDocument → DocumentTimeline → CSSAnimation → KeyframeEffect → .vx-dialog-panel` idi: **bitmiş CSS animasyonlarını belge zaman çizelgesi tutuyordu**. Olay `run2`, `run6`, `run8` ve sayfa-içi kontrolde hiç oluşmadı; kare hızını ölçtüğüm koşularda (`run6`, `run8`) hep 64 fps idi. Olayın oluştuğu koşularda kare hızı o anda ölçülmemişti (ölçüm sonradan eklendi), yani bağlantı **kanıtlanmadı**. **Tahmin (doğrulanmadı):** pencere örtülü/görünmez olduğunda tarayıcı kare üretmeyi bırakıyor, animasyon temizliği ertelenip pencere görünür olunca birden yapılıyor.
- **Gizli pencere denemesi (sonradan):** pencere `show:false` ile açıldı, kare hızı 2–4 fps'e düştü (`document.visibilityState` yine `visible` göründü), 150 satış: düğüm 1.334 → 1.746, dinleyici 418–450, **olay oluşmadı**. Yani yalnızca düşük kare hızı olayı üretmiyor; "gizli pencere" tahmini bu denemede **desteklenmedi**. Gerçekten küçültülmüş/örtülü pencere denemesi (Browser.setWindowBounds) yanıt vermedi, **ölçülemedi**. Olayın nedeni hâlâ bilinmiyor.
- Denediğim düzeltme (`DialogShell.jsx`: kaldırmadan önce `getAnimations({subtree:true})` ile `cancel()`) **hiçbir şeyi değiştirmedi** (`getAnimations` bu animasyonları döndürmüyor, çünkü bitmişler) ve aynı koşulda olay yine oldu. **Geri aldım.**
- Laboratuvar denemeleri (sentetik pencere ekle/kaldır, animasyon `both`/`backwards`) olayı yeniden üretmedi.
- Etkisi: bellek ≈118 düğüm/ödeme penceresi; yalnız pencere kare üretmezken sürüyorsa sorun kasada satış yapılmayan zamanlara denk gelir. Gerçek bir kasada (pencere kapalı/küçültülmüşken satış olmaz) **muhtemelen önemsiz**, ama emin değilim. İleride kanıtlamak için: sorun görülünce kare hızını ve `document.visibilityState`'i kaydeden `tools/kasa-bellek/olcum.mjs` ile tekrar edin.

## Ölçüm aracının kendi bellek yükü (kontrol)
`olcum.mjs` satış başına ≈10 CDP çağrısı yapar. Renderer özel belleği bu koşularda satış başına ≈0,07–0,1 MB arttı (126 → 251 MB / 1.200 satış), JS yığını ve DOM düz iken. Bunun ölçüm yükü mü uygulama mı olduğunu ayırmak için **satış döngüsünü sayfanın içinde** çalıştırdım (`kontrol-sayfa-ici.mjs`, satış başına CDP çağrısı yok, 403 satış, hata 0, ödeme medyanı 33,7 ms): renderer özel belleği 148 MB → 170 (100. satış) → 166 → 178 → 177 MB (400. satış) ve son çöp toplamadan sonra **148 MB**'a döndü; JS yığını 16,9 → 18,5 MB, düğüm 368, dinleyici 318. Yani büyüme, satış başına CDP yükü ve ısınmadan kaynaklanıyor; **uygulamada satış başına sürekli bellek artışı görmedim**. Sınır: bu kontrol yalnız 400 satış; saatler/günler sürmedi.

## Kalan sınırlar (ölçülemedi / yapılmadı)
- **Günlerce gerçek zamanlı çalışma ölçülemedi** (her koşu en çok ≈20 dakika sürdü; zaman hızlandırma yalnız 30 dk'lık katalog denetimini kapsadı).
- **Paketlenmiş uygulama, uygulamanın `main.js`'i, yerel MySQL sunucusu, ana süreç/yerel sunucu RSS'i ölçülemedi.** Burada ölçülen sunucu Node+SQLite test backend'idir.
- **Gerçek donanım**: okuyucu (HID tuşları), yazıcı, ÖKC, müşteri ekranı penceresi, düşük güçlü CPU ölçülmedi.
- **Boşta (satışsız) saatlerin** bellek eğrisi (yoklama zamanlayıcıları, bekletilen sepetlerin sessionStorage'ı) ölçülmedi; bekletilen sepet kodu sınırlı (`MAX_HELD=8`), satış sonunda `sessionStorage` 6,3 KB idi.
- Ayrık DOM düğümü olayının kök nedeni **bilinmiyor** (yukarıda).
- Enter tuşuyla barkod gönderme CDP altında bir kez güvenilir çalışmadı; gerçek okuyucuda yeniden doğrulanmalı.
- 28 kat hızlı katalog yenilemesi sunucu hız sınırına çarptı (yalnız ölçüm artefaktı).

## Dosyalar
- `tools/kasa-bellek/` — ölçüm araçları (sunucu kılıfı, Electron kabuğu, CDP istemcisi, döngü, kontrol, özet, yığın anlık görüntüsü) ve `README.md` (nasıl yeniden çalıştırılır).
- Ham çıktılar ve yığın anlık görüntüleri geçici klasörde kaldı (repoya eklenmedi).
- Kod/test değişikliği yok: backend/frontend/desktop testleri çalıştırılmadı çünkü kaynak koda dokunulmadı (`DialogShell.jsx` denemesi geri alındı).
