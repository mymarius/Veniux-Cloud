# Cihazsız otomatik doğrulama — 22 Kasım 2026

Gerçek donanım (yazarkasa, el terminali, Zebra, telefon) OLMADAN yapılan ölçümler. Her satırda **ölçüldü** (gerçek çalıştırma) ile **simüle** (sahte sunucu / sanal girdi) ayrılmıştır. Hiçbiri paketlenmiş (kurulumlu) uygulamada veya gerçek cihazda değildir. Yayın, push, `yayinla.py` yok.

Ortam: Windows 10, Node 24.15, `desktop/node_modules/electron` (geliştirme modu), yerel backend (SQLite, port 3100, geçici veri klasörü), sahte Open Food Facts + TCMB sunucusu (port 3200), Vite dev + yerleşik tarayıcı 375×812.

## Özet

| Alan | Sonuç |
|---|---|
| Electron + 7 `diag*` köprüsü | **Geçti** (gerçek Electron penceresi) |
| Destek paketi dışa aktarma | **Geçti**, kaydetme penceresi **stub** (yol sistem penceresinden gelmiyor, simüle) |
| `desktop.log` oluşumu | **Geçti** |
| `desktop.log` kişisel veri | **Başarısızdı → düzeltildi** (günlük maskelenmiyordu) |
| Katı IPC | **Geçti** (ham IPC yok, kötü girdi reddediliyor) |
| Barkod katmanı (HTTP, sahte OFF) | **Geçti** |
| Önyüz öneri kartı 375 px | **Geçti**, 15 px yatay taşma **bulundu → düzeltildi** |
| Sayım ekranı 375 px (koli ×N, sayılmayanlar, onay özeti) | **Geçti** |
| Seri okutma (sanal akış + tarayıcıda hızlı tuş) | **Geçti** |
| ÖKC simülatörü hata → düzelme | **Geçti** (yeni test) |
| Otomatik kur "Şimdi güncelle" (sahte TCMB) | **Geçti** |
| Android emülatör/adb | **Ölçülemedi** (yok) |
| Zebra DataWedge intent | **Ölçülemedi** (uygulamada intent alıcısı yok) |

## 1. Gerçek Electron penceresi

Nasıl: `electron.exe --remote-debugging-port=9333 wrapper.cjs`. `wrapper.cjs` yalnız (a) `desktopRuntime().profile`'ı geçici klasöre yönlendirir (böylece geliştirici profiline `.local/desktop-profile` dokunulmadı) ve (b) `dialog.showSaveDialog`'u sabit bir dosya yoluna stub'lar; `main.js`, `preload.js`, `diagnostics.cjs` aynen yüklendi. Ekran `frontend/dist/index.html` (file://) olarak açıldı, Node 24 WebSocket'iyle CDP.

Ölçülenler (gerçek):
- `window.veniuxDesktop` altında 7 köprü var: `diagList, diagHistory, diagRun, diagCancel, diagExport, diagPrinters, diagTestPrint` (+ `onDiagProgress`).
- `diagList` 11 test; `quick` taraması 7, `full` taraması 11 sonuç döndü. Durumlar: sys.* ok, net.internet ok, net.cloud ok, net.license ok, dev.printers ok (5 yazıcı), dev.ports ok; `data.database`, `data.backup-last`, `data.backup-writable` **unavailable** (geçici profilde veritabanı/yedek yok; başarısızlık değil, "ölçülemedi" olarak ayrı raporlandı — beklenen).
- `diagHistory` geçmiş dosyasına iki tarama yazıldı (`len: 2`).
- `diagCancel` → `true`. `diagPrinters` 5 yazıcı. `diagTestPrint('Olmayan Yazici')` → "Yazıcı Windows listesinde bulunamadı" reddi. Gerçek bir yazıcıya deneme fişi **gönderilmedi**.
- Katı IPC: `{mode:'x', path:'C:/x'}` → "Geçersiz tanılama isteği"; `{id:'../../etc'}` → "Geçersiz test kimliği"; `diagExport('str')` → reddedildi; 600 KB'lık veri → "çok büyük" reddi. Sayfada `require`, `ipcRenderer`, ham `invoke/send` **yok**; yalnız `window.veniuxDesktop` açık. Rastgele kanal çağıracak bir yüzey olmadığı için "başka kanal reddi" doğrudan çağrılamadı; kanıt, yüzeyin yokluğu + mevcut kanalların giriş doğrulaması. (Güvenilmeyen pencereden `handle()` `trusted(event)` reddi bu turda **denenmedi**.)
- `diagExport`: stub'lanan kaydetme penceresi doğru başlık/dosya adı/filtreyle çağrıldı, dosya yazıldı. Dosyada e-posta → `[E-POSTA]`, telefon → `[TELEFON]`, `token=…` → `token=[GİZLİ]`, `customer` anahtarı → `[GİZLİ]`, günlük kuyruğunda `C:\Users\[KULLANICI]` maskelendi. **Gerçek sistem kaydetme penceresi (kullanıcı tıklaması) simüle**.
- `<userData>/logs/desktop.log` oluştu (`Günlük başladı`, `Uygulama ekranı yüklendi`, reddedilen IPC çağrılarının hataları).

**Bulgu 1 (düzeltildi):** `desktop/logger.cjs` ham metni yazıyordu; destek paketi maskeliyordu ama diskteki `desktop.log` yığın izlerinde `C:\Users\<ad>` ve konsola düşen e-posta/telefon/token olduğu gibi kalırdı. Artık `diagnostics.cjs`'in `redactString` desenleriyle yazılmadan önce maskeleniyor. Test: `desktop/logger.test.cjs` (+1).

Not (dürüstlük): tanılamanın "İnternet / bulut / lisans" testleri tasarımı gereği gerçek uçlara GET atar; bu ölçüm sırasında `gstatic.com`, `app.veniux.com` ve `api.veniux.com` sağlık uçlarına birkaç sağlık isteği gitti (okuma, veri göndermedi, yazma yok).

## 2. Barkod katmanı

HTTP seviyesinde gerçek backend (`/api/retail/lookup/suggest`) + sahte OFF (`VENIUX_OFF_URL`). Ölçülen:
- Bulunan ürün: `source:'off'`, `review_required:true`, ad/marka/gramaj önerisi, ODbL atfı; ikinci sorgu `cached:true`, sahte sunucuya yalnız 1 istek gitti.
- Bulunamayan: `lookup_state:'missing'`, `manual:true`. Kısa kod (5 hane): `skipped`, elle giriş. Boş barkod 400, yetkisiz 401.
- OFF 500 → `lookup_state:'error'`, "Dış katalog şu an yanıt vermiyor. Bilgileri elle girin."; hata önbelleğe yazılmadı (sunucu düzelince aynı barkod `off` döndü, `cached:false`).
- OFF yanıtsız (asılı) → ~6 sn sonra `error` (zaman aşımı), elle giriş.
- Sınır: iki işletmeyle art arda istek; sahte sunucuya toplam **tam 15** istek gitti, sonrakilerin hepsi `limited`. Tek işletme için sınır 10'dur (işletme başına 10, sunucu başına 15 — belge ile uyumlu); "16. istek" yalnız birden çok işletmenin toplamında geçerli.
- "İnternet yok" ayrıca bağlantı reddi olarak denenmedi; aynı `catch` yolundan geçen 500/zaman aşımı ile kapsandı.
- Önyüz (yerleşik tarayıcı, 375 px): barkod → sarı "Open Food Facts önerisi — kontrol edip onaylayın" kartı, ad alanı önerilenle doldu (`Sahte Kola 991 330 ml`), fiyatlar boş, ODbL bağlantısı var. OFF hatasında kart yok, "Dış katalog şu an yanıt vermiyor…" mesajı ve boş elle giriş formu. Önerilen görsel gerçek OFF adresi olmadığı için kırık göründü (sahte sunucu; gerçek görsel yüklemesi **ölçülemedi**).
- "Sınıra ulaşıldı" mesajı önyüzde görsel olarak denenmedi (yalnız API'de `limited`).

**Bulgu 2 (düzeltildi):** 375 px'te öneri/tarama kartları 15–18 px yatay taşıyordu (`.rq-grid` ve `.rq-main` tek sütunu `1fr`, uzun içerikte min-content ile genişliyordu). `frontend/src/pages/RetailQuickAdd.css`: `minmax(0, 1fr)`. Düzeltme sonrası `scrollWidth = 375`.

Sayım ekranı (375 px, gerçek veriyle: 3 ürün, 1 raf, 1 koli barkodu ×24): raf okutma "Raf seçildi"; ürün 2 kez → 2; koli barkodu → "Kola 330: 26 (KOLI ×24)"; başka ürün 1; bilinmeyen barkod → "listesinde yok" uyarısı; "2 / 3 satır sayıldı" + "İstisna ile sayım: 2 sayıldı, 1 sayılmadı", "Sayılmayanları göster" → Cips 100; "Sayılanları onaya gönder" → "Onay özeti: 2 satır · 0 fark yok · 1 fazla (+16) · 1 eksik (−9) · net +7 · En büyük fark: Kola 330 (+16)". Yatay taşma yok. Kamerayla okuma ve gerçek el terminali **ölçülemedi**.

## 3. Seri okutma, ÖKC, kur

- Seri okutma (sanal): yeni `frontend/src/lib/serialScanStream.test.mjs` (4 test) — sanal seri akış baytları rastgele parçalara bölünerek `Framer` → `scanIntoLines` hattına verildi: 300 okutma × 4 farklı parçalama tohumu doğru toplandı, CRLF/Tab/ön-son ek, bozuk barkod ve boş terminatör davranışı doğru. Gerçek `navigator.serial` portu **yok** (simüle).
- Klavye-okuyucu (gerçek tarayıcı tuş olayları): mal kabul ekranındaki `SerialScanInput`'a CDP ile hızlı yazım + Enter / Tab: Kola ×2 (biri Tab ile), Su ×1 → satırlar 2 ve 1, yanlış barkod "tanınmadı". Not: araç `type` içindeki satır sonunu Enter tuşu yapmıyor (boşluk yazıyor); bu aracın sınırı, uygulama hatası değil — Enter/Tab `key` ile gönderildi. Gerçek HID okuyucunun zamanlaması **ölçülemedi**.
- ÖKC: yeni `backend/tests/ecrBridge.test.js` testi "hata veren cihaz düzelince": simülatör (ad "hata" içerir) → iş `failed`, `blocking:1`; cihaz adı düzeltilince (simülatörde hatanın kalkması) → iş `done`, `SIM-…` fiş numarası, `blocking:0`, `okc_status='done'`. Yalnız simülatör; üretici sürücüleri hâlâ "kurulu değil" / doğrulanmamış.
- Otomatik kur: backend `VENIUX_FX_URL` ile sahte TCMB XML'ine bağlandı; arayüzde (375 px) "Kuru TCMB'den otomatik güncelle" açılınca USD 43.25 / EUR 50.3 geldi (GBP yok → boş). 503 → "alınamadı, son kur korunuyor (Kur sunucusu 503 döndü.)", kurlar değişmedi. Bozuk XML → "Kur dosyası okunamadı", kurlar değişmedi. Sunucu düzelince "Şimdi güncelle" → "TCMB kur tarihi 2026-11-22". Gerçek TCMB'ye istek atılmadı.

## 4. Android

- `adb` PATH'te yok; `.local/android-sdk` yalnız build-tools/platform içeriyor (platform-tools, emulator, system-image yok). Android Studio emülatörü yok → emülatör testi **ölçülemedi**.
- Telefon ekranı yerine 375×812 yerleşik tarayıcı kullanıldı (yukarıdaki arayüz ölçümleri). Bu, gerçek Android WebView, dokunmatik, kamera ve Xiaomi dokunma engeli sorununu **göstermez**.
- Zebra DataWedge: `mobile/android` içinde ve önyüzde DataWedge/vendor intent alıcısı **yok** (`BroadcastReceiver`/intent-filter yalnız MAIN ve TTS; `docs/VENIUX_HARDWARE_TEST_REPORT.md` #164 de bunu söylüyor). Zebra terminalleri bugün yalnız DataWedge'in "klavye çıkışı" (HID wedge) ile çalışır; o yol yukarıdaki klavye-okuyucu testiyle simüle edildi. `adb shell am broadcast` ile sanal intent denenemedi (adb yok, alıcı da yok) → **ölçülemedi**; kod yazılırsa gerçek terminalde doğrulanmalı.

## Test durumu (bu turun sonunda)

- Masaüstü `node --test`: 43/43 geçti.
- Frontend + shared `node --test`: 195/195 geçti.
- Backend `npm test`: 186 paket, 1368 test geçti.

## Gerçek cihazda hâlâ gerekenler

Paketlenmiş kurulumda Tanılama ekranı ve gerçek kaydetme penceresi; gerçek yazıcıya deneme fişi; gerçek yazarkasa; telefonda kamera/dokunma/WebView ve OFF görseli; gerçek HID/seri okuyucu zamanlaması; Zebra DataWedge (gerekirse intent alıcısı yazılıp); gerçek TCMB/OFF ağı.
