# Uzun kullanım ve büyük veri performansı — 23 Kasım 2026

## Kısa sonuç
- Büyük veride (50.000 ürün, 150.001 satış / 525.001 satış satırı, 525.001 stok hareketi, 150.003 denetim kaydı, 2 yıllık tarih) kasanın sıcak yolları (katalog sayfası, barkod, satış, gün raporu) zaten hızlıydı (≈3–45 ms). Yavaş olanlar **eksik indeksler** yüzünden rapor/liste ekranlarıydı (0,7–2 sn) ve **sayfalamasız ürün/stok listeleriydi** (32 MB / 19 MB yanıt).
- Düzeltildi: yeni indeksler (SQLite göçü 064), barkod sorgusunun yeniden yazımı, `/products` ve `/stock/records` için isteğe bağlı sayfalama, çevrimdışı katalog sınırı ve günlerce açık kasada katalog yenileme.
- **Yapılmayan / dikkat:** bu indeksler **MySQL'e henüz gitmiyor** (aşağıda "Üretim veritabanı uyarısı"). Gerçek tarayıcıda saatlerce süren bellek eğrisi **ölçülmedi**; yerine kod incelemesi + Node'da simülasyon yapıldı.

## Ne ölçüldü, nasıl
- Betikler: `backend/scripts/perf-seed.js` (yalnız `TEST_SQLITE_PATH` ile, gerçek veriye dokunmaz) ve `backend/scripts/perf-bench.js` (süreç içi `supertest`, gerçek Express yolu; her uç nokta 5 kez, satış 15 kez; tabloda **ortanca ms**).
- Ortam: bu geliştirme bilgisayarı, **SQLite (WAL)**, tek kullanıcı, ağ yok. Gerçek kasada ağ + Electron + MySQL gecikmesi eklenir; sayılar **göreli karşılaştırma** içindir, mutlak söz değildir.
- Sentetik veri gerçek satıştan kopyalanan bir `snapshot_json` şablonuyla üretildi (satır başına ≈2 KB); gerçek satışlarda sepet büyüdükçe daha büyük olur.
- Veritabanı dosyası: 411 MB (indeksiz) → 452 MB (yeni indekslerle, +≈41 MB). En büyük tablo `retail_sales` ≈ 294 MB (satış anlık görüntüsü JSON'u).

## Önce / sonra (ortanca ms)
| Senaryo | Önce | Sonra | Not |
|---|---|---|---|
| Katalog ilk sayfa (100) | 5,5 | 5,6 | zaten anahtar-kümeli sayfalı |
| Katalog derin sayfa (after=45000) | 5,2 | 5,3 | |
| Katalog arama (önek) | 16,6 | 16,7 | |
| Katalog arama (ortada geçen "Makas") | 15,4 | 15,3 | baştan eşleşmeyen arama tarar; 50 bin üründe 15 ms, kabul edildi |
| Barkod okutma `POST /scanner/lookup` | 23,0 | 10,1 | `OR` zinciri → indeksli UNION |
| Barkod `GET /retail/lookup` | 3,4 | 3,3 | |
| Satış tamamlama (2 satır, nakit) | 44,6 | 26,4 | yazma maliyeti artmadı; ölçüm gürültüsü büyük, "iyileşti" demiyorum |
| Gün raporu (bugün / eski gün) | 7,3 / 6,3 | 4,4 / 6,5 | zaten indeksli |
| Satış geçmişi (100 kayıt) | 4,6 | 4,6 | |
| `/stock/movements` (100) | 671,7 | 3,6 | `ORDER BY created_at` indeksle |
| Denetim günlüğü (50) | 70,4 | 3,0 | |
| Pano metrikleri `/stock/dashboard-metrics` | 806,4 | 102,5 | |
| Kasa içgörü `/pro/insights` | 2019,1 | 79,1 | tarih aralığı taraması |
| En çok satanlar `/pro/top-products` | 2002,9 | 49,3 | kasa açılışında çağrılıyor |
| `/products` (tüm liste) | 1159,8 (32,4 MB) | 1094,4 (32,4 MB) | limit verilmezse eski davranış korunur |
| `/products?limit=50` | – | 4,1 (32 KB) | yeni |
| `/products?limit=50&offset=40000` | – | 14,8 | yeni |
| `/stock/records` (tüm) | 514,8 (19,1 MB) | 493,9 (19,1 MB) | |
| `/stock/records?limit=50` | – | 3,8 (19 KB) | yeni |
| Stok analizi `/stock/analytics` | 833,1 | 919,5 | **düzeltilmedi**, kalan risk |
| Göç 064 (≈1,2 milyon satırlık veritabanında) | – | ≈7 sn | tek seferlik |

"Önce" satış ve gün raporu değerleri, 064 olmadan çalıştırılan ayrı bir kopya veritabanından alındı; diğer "önce" değerleri ilk tam koşudan.

### Diğer ölçümler
- Yedek (SQLite çevrimiçi `backup()`, 452 MB): 7,1 sn; `VACUUM INTO`: 8,0 sn; yedeğin `integrity_check` doğrulaması: 9,9 sn. Bunlar ham SQLite çağrılarıdır; uygulamanın `POST /api/backups` yolu platform yöneticisi gerektirdiği için çalıştırılmadı, uygulama içi yedek süresi **ölçülmedi**.
- `EXPLAIN QUERY PLAN` ile bulunan eksikler: `retail_sales` yalnız `(tenant_id, shift_id)` ile aranıyordu (tarih aralığı tüm kiracıyı tarıyordu); `pos_sale_items(sale_id)` indeksiz (99 ms tarama); `stock_movements`, `audit_logs`, `pos_sales`, `stock_records` için `ORDER BY` geçici sıralama (TEMP B-TREE); barkod sorgusunda `gtin` ve koli barkodu (`product_uoms.barcode`) indeksiz `OR`.

## Yapılan değişiklikler
1. `backend/src/database/migrations/064_performance_indexes.js` — yalnız `CREATE INDEX IF NOT EXISTS`, veri/tablo değişmez, LF.
   `retail_sales(tenant_id,business_date)`, `pos_sale_items(sale_id)`, `pos_sale_items(tenant_id,product_id)`, `pos_sales(tenant_id,created_at)`, `stock_movements(tenant_id,created_at)`, `audit_logs(tenant_id,created_at)`, `stock_records(tenant_id,updated_at,id)`, `products(tenant_id,gtin)`, `product_uoms(tenant_id,barcode)`, `products(tenant_id,created_at)`.
2. `scannerService.lookup`: `barcode OR gtin OR sku OR koli barkodu` → dört indeksli sorgunun `UNION`'ı; sonuç kümesi aynı.
3. `/products` ve `/stock/records`: isteğe bağlı `?limit=` (1–1000 / 1–2000) ve `?offset=`; geçersiz değer 400; **limit yoksa eski davranış**. Sıralamaya `id` eklendi (sayfalar arası kararlı). Not: `GlobalCommandPalette` zaten `limit=5` gönderiyordu ama sunucu yok sayıyordu, her aramada tüm katalog iniyordu; artık sınır uygulanıyor.
4. Kasa çevrimdışı katalog (`frontend/src/lib/offline`): indirme sınırı **50 sayfa (=5.000 ürün) → 1000 sayfa (100.000 ürün)**. Eski sınır, 5.000'den büyük katalogda indirmeyi "tamamlanmadı" sayıp önbelleği hiç yazmıyordu. Ayrıca katalog yaşı yalnız açılışta/bağlantı değişince kontrol ediliyordu; günlerce açık kasada fiyatlar eski kalırdı. Artık 30 dakikada bir yaş kontrolü (TTL 6 saat) ve eşzamanlı indirme kilidi var.
5. Testler: `backend/tests/performanceIndexes.test.js` (5 test: indeksler, sorgu planları, sayfalama, barkod/GTIN/stok kodu/koli, bilinmeyen kod) ve `offline.test.mjs` içinde 60.000 ürünlük katalog testi (indirme eksiksiz, indeks kurma < 1,5 sn, 1000 arama < 200 ms).
   Sonuç: backend 187 paket / 1374 test geçti; frontend `node --test` 180/180; masaüstü 43/43.

## Sızıntı / büyüme incelemesi
- Kod incelemesiyle doğrulananlar (sınırlı): `RetailPos.jsx` ölçüm dizisi `slice(-50)`; bekletilen sepet `MAX_HELD=8`; incelenen tüm `setInterval` kayıtlarında `clearInterval` var (kasa, AssistantLauncher, LicenseContext, OfflineBanner, BackupHealth, başlık çubuğu, müşteri ekranı, ağ nabzı); `online/offline/matchMedia` dinleyicileri temizleniyor; okuma önbelleği 24 saat süreli ve başka oturum kayıtlarını siliyor; masaüstü günlüğü 512 KB'ta döner (`.old` ile ≈1 MB tavan); tanılama geçmişi `HISTORY_LIMIT` ile sınırlı. Tüm arayüz dosyaları satır satır okunmadı; `setInterval` kullanan diğer sayfalar (LabelCenter, MobileHome, Storefront, vb.) incelenmedi.
- Node simülasyonu (gerçek tarayıcı değil): 50.000 ürünlük katalog + indeks ≈ 16,5 MB yığın; 28 yenileme (7 gün × 6 saat) sonrası artış yok; 5.000 çevrimdışı satış kuyruğa girip gönderilince kuyruk boşaldı ve bellek geri döndü.
- **Ölçülmedi:** gerçek tarayıcıda saatlerce süren kasa döngüsü (DOM düğümü ve JS yığını eğrisi), Electron ana süreç ve yerel sunucu bellek eğrisi. Ölçüm için gerçek bir kasa oturumunda DevTools bellek kaydı gerekir.

## Üretim veritabanı uyarısı (önemli)
Masaüstü kurulumu yerel **MySQL** (`veniux_local`) kullanıyor; SQLite geliştirme/test yolu. MySQL şeması `backend/src/database/mysql/*.json` bildirimleriyle yönetiliyor ve `tools/release/yayinla.py` `SHIPPABLE_MYSQL_SCHEMA = '032-fx-auto-tasks'` kapısına bakıyor; masaüstü yükseltmesi (`upgradeAdditive`) **yalnız yeni tablo** ekler, mevcut tabloyu değiştiren adımı `SCHEMA_UPGRADE_UNSUPPORTED` ile reddeder. Bu yüzden:
- **MySQL bildirimi eklemedim** (eklense kapı yayını durdurur, eski kurulumlar açılmaz). 064 yalnız SQLite'ı iyileştirir.
- Üretimde aynı kazancı almak için ayrı bir iş gerekir: `033` bildirimi + `upgradeAdditive`'in "yalnız indeks ekleme" adımını güvenle desteklemesi (önce yedek zaten alınıyor) + eski kurulum yükseltme testi + sabitin bilinçli güncellenmesi. Karar kurucuda; yayın yapılmadı.
- 064 uygulanmış bir SQLite veritabanını daha eski bir program sürümüyle açmak "veritabanı bu kod sürümünden daha yeni" hatası verir (mevcut göç kurallarının sonucu).
- Ölçümlerim SQLite'tır; MySQL/InnoDB'de plan farklı olabilir. Aynı eksik indeksler orada da var, ama MySQL'de **ölçmedim**.

## Kalan riskler ve öneriler (hiçbiri otomatik uygulanmadı)
1. `Dashboard.jsx` ve `NormalDashboard.jsx` her açılışta `/products` + `/stock/records` + `/stock/movements?limit=5000` indiriyor (50 bin üründe ≈50 MB). `QuickModals`, `Movements`, `PurchaseOrders`, `NormalPicking` vb. de tüm ürünleri çekiyor. Sunucuda sayfalama hazır; ekranların sayfalı/aramalı kullanıma geçirilmesi ayrı bir arayüz işi.
2. `/stock/analytics` ≈0,9 sn (ilişkili alt sorgular); düzeltilmedi.
3. `retail_sales.snapshot_json` satır başına ~2 KB; `top-products` ve `insights` son N günün anlık görüntülerini JSON olarak ayrıştırıyor. Çok yoğun mağazada (günde binlerce satış, 90 gün) CPU/bellek artar; uzun vadede özet tablo gerekir.
4. Sınırsız büyüyen tablolar: `audit_logs`, `stock_movements`, `inventory_transactions`, `pos_sale_items`, `retail_sales`. **Otomatik silme yok ve önermiyorum** (denetim bütünlüğü zinciri, saklama yükümlülüğü); gerekirse yıllık arşive alma (dışa aktarıp doğrulama sonrası) ayrı ve onaylı bir işlem olmalı. Bu veride büyüme ≈2,7 KB/satış (tablolar + indeksler).
5. Baştan eşleşmeyen katalog aramaları (`%metin%`) indekssiz tarar; 50 bin üründe 15 ms, 500 bin üründe belirgin olur.
6. React `memo`/sanallaştırma eklemedim: ölçülmüş bir çizim darboğazı yok.

## MySQL indeksleri (şema 033-performance-indexes) — sonuç
**Yapılan:** `backend/src/database/mysql/033-performance-indexes.json` (032 ile aynı tablolar + 9 yeni indeks), `mysqlMigrator.js`: `upgradeAdditive` artık mevcut tablolarda **yalnız yeni indeks eklenmesine** izin veriyor (başka her fark hâlâ `SCHEMA_UPGRADE_UNSUPPORTED`); indeksler önce `information_schema.STATISTICS` ile kontrol edilip `ALTER TABLE … ADD INDEX …, ALGORITHM=INPLACE, LOCK=NONE` ile ekleniyor, kayıt en sonda yazılıyor (yarıda kalırsa kayıt yok, yeniden çalıştırılabilir; var olan indeks atlanır). Boş kurulumda `migrate()` indeksleri tabloyla birlikte kuruyor; `verifyStructure` indeks varlığını denetliyor. `SHIPPABLE_MYSQL_SCHEMA` → `033-performance-indexes` (yükseltme provası yeşil).
- 064'teki 10 indeksten **9'u** eklendi: `pos_sale_items(sale_id)` MySQL'de zaten var (yabancı anahtar `fk_pos_sale_items_1` otomatik indeks açıyor), yineleme eklenmedi.
- `gtin` ve `product_uoms.barcode` MySQL'de LONGTEXT; indeks **64 karakter önekli** (`gtin(64)`, `barcode(64)`).
- Sınır: yeni mekanizma yalnız indeks ekler; sütun/tetikleyici/kısıt değişikliği yine kapıya takılır.

**Testler:** `schemaUpgrade.test.js` — 032'den (tablolar + indeksler geri alınmış eski kurulum) 033'e yükseltme, ayrıca yalnız-033 testi: indeksler eklenir, veri korunur, ikinci çalıştırma indeks sayısını değiştirmez, eksik indeks + silinmiş kayıt yeniden tamamlanır. `npm run test:mysql` 14 paket/43 test yeşil (test DB'si `mysql_test_migrate.js --recreate-test` ile yeniden kuruldu); backend `npm test` 187 paket/1374 test yeşil.

**Ölçüm** (yerel MySQL 8.4.13, SQL düzeyinde, `backend/scripts/perf-mysql.js`; 50 bin ürün, 150 bin satış, 525 bin satır/hareket; ortanca ms, 5 tekrar; HTTP katmanı dahil değil):
| Sorgu | Önce | Sonra |
|---|---|---|
| pos_sales son 100 | 969,8 | 0,8 |
| stock_movements son 100 | 369,7 | 0,8 |
| retail_sales hafta aralığı | 244,3 | 0,8 |
| audit_logs son 100 | 99,0 | 0,6 |
| ürünler en yeni 50 | 93,5 | 0,7 |
| ürün GTIN ile | 70,7 | 0,4 |
| koli barkodu | 20,5 | 0,2 |
| stock_records sayfa | 17,5 | 4,1 |
| pos_sale_items ürün geçmişi | 0,3 | 0,4 |
| ürün "barkod VEYA GTIN" | 72,0 | 69,5 (**düzelmedi**: MySQL OR için indeks birleştirmedi; uygulamadaki gerçek sorgu şekli ayrıca bakılmalı) |

**Kilit/süre riski:** 9 indeksin toplam kurulumu 6,1 sn (en uzunu `pos_sale_items(tenant_id,product_id)` 1,8 sn, `stock_movements` 1,4 sn) bu büyüklükte. Kurulum sürerken başka bağlantıdan yazma: boşta ortanca 2,6 ms; kurulum sırasında ortanca 2,8 ms, p99 12,8 ms, en yavaş tek yazma 59 ms (457 yazma) — `LOCK=NONE` ile yazmalar engellenmedi. Disk maliyeti: yeni indekslerin tek başına boyutu ayrı ölçülmedi; sekiz tablonun toplam indeks boyutu 033 sonrası ≈202 MB (veri ≈237 MB). **Ölçülemeyen:** bulut app.veniux.com'un gerçek veri büyüklüğü ve yükü (bakılmadı); gerçek kullanıcı trafiğiyle yarışma.

**Bulutta uygulama adımları (yapılmadı, onay + Plesk girişi gerekir):** (1) yedek al (mevcut akış); (2) sunucu kodunu 033 bildirimiyle güncelle; (3) `MySQLMigrator#upgradeAdditive` çalıştır (bulutta yükseltme komutu mevcut `mysql_migrate.js` akışıyla aynı; kilit `GET_LOCK` ile korunur); (4) `information_schema.STATISTICS` ile 9 indeksin varlığını doğrula; (5) `--record-deployment` ile dağıtım kaydını yaz. Düşük trafik saatinde çalıştırılması önerilir. Geri alma: `ALTER TABLE … DROP INDEX …` (veri etkilenmez; sürüm kaydı ayrıca geri alınmalı).


## Arayüz sayfalaması ve `/stock/analytics` (kalan riskler 1 ve 2) — sonuç

Ölçüm: `perf-seed.js` ile yeni sentetik veritabanı (50.002 ürün, 50.001 stok kaydı, 175 bin hareket, `TEST_SQLITE_PATH` ile; gerçek veriye dokunulmadı), `perf-bench.js` (süreç içi, supertest; 5 tekrar, ortanca ms). SQLite'tır; MySQL'de yalnız doğruluk sınandı, süre **ölçülmedi**.

### Ölçümler
| Uç nokta | Önce | Sonra |
|---|---|---|
| `GET /stock/analytics` | 450 ms | **162–175 ms** (2,6 KB, aynı içerik) |
| Pano verisi: `/products` + `/stock/records` (+ `/stock/movements?limit=5000`) | 1.098 ms + 521 ms; **32,4 MB + 19,1 MB** (+1,7 MB) | `GET /stock/dashboard-summary`: **258 ms, 2 KB** (+ aynı 1,7 MB hareket) |
| Depo filtreli pano özeti | (yoktu; istemci tüm kaydı süzüyordu) | 281 ms, 1,9 KB |
| Ürün seçiminde tek ürünün stoku (`/stock/records?product_id=`) | 521 ms, 19 MB (tümü) | 18,6 ms, 380 B |
| `GET /stock/dashboard-metrics` | 104 ms | 103 ms (değişmedi; depo dağılımı kiracıya bağlandı) |

Sorgu düzeyi (`EXPLAIN QUERY PLAN`): analytics'te ürün başına ilişkili alt sorgu ve `COUNT(DISTINCT)` yerine ürün başına bir kez gruplanmış türetilmiş tablo kullanıldı; 4 ayrı geçiş (toplam, kritik, tükenen, kategori) tek kategori sorgusuna indi (özet kalemleri kategori satırlarından toplanıyor). Depo dağılımı 76 → 20 ms (`stock_records` bir kez gruplanıp `warehouses`'a bağlanıyor). Hareket trendi 124 ms tüm tabloyu tarıyordu; artık `stock_movements(tenant_id, created_at)` indeksiyle 1–3 ms. **Yeni indeks eklenmedi** (064/033 yeterli).

**Davranış düzeltmeleri (analytics/dashboard-metrics):** (1) `warehouse_distribution` ve `movements_trend` kiracı süzgeci taşımıyordu: **başka kiracıların depo adları/miktarları ve hareketleri karışıyordu** (`dashboard-metrics` depo dağılımı da). Artık yalnız çağıranın verisi. (2) `movements_trend` "son 7 gün" diye yazılıydı ama **en eski 14 günü** döndürüyordu; artık son 14 günü tarih sırasıyla verir. Ön yüzde `/stock/analytics`'i çağıran ekran yok (yalnız API), bu yüzden görünür bir kırılma yok. Çıktı karşılaştırması: özet, kategori kırılımı, en değerli 5 ürün ve depo dağılımı eski sürümle birebir aynı (tek ayrım trend).

### Yeni uç nokta ve filtre
- `GET /stock/dashboard-summary[?warehouse_id=]`: ürün sayısı, kayıt sayısı, birim, değer, satış değeri, stok sağlığı sayıları (sağlıklı/kritik/tükenen/fazla), öncelikli 8 ürün, değere ve adede göre ilk 8 ürün, kategori ve depo kırılımı. Depo verilirse yalnız o depoda kaydı olan ürünler ve o depodaki miktar sayılır (eski istemci kuralıyla aynı).
- `GET /stock/records?product_id=` filtresi eklendi (limit yoksa eski davranış sürer). `GET /stock/movements` yanıtına `unit_cost` (ürün alış fiyatı) eklendi (pano "stok değeri trendi" bunu kullanıyor).

### Ekran kararları
| Ekran | Karar |
|---|---|
| `Dashboard.jsx`, `NormalDashboard.jsx` | Ürün ve stok kayıtlarının tamamı artık inmiyor; `dashboard-summary` + `movements?limit=5000` (sunucu zaten sınırlı). NormalDashboard depo seçince özeti sunucudan yeniden ister. Önce 52 MB, sonra ≈1,7 MB. |
| `QuickModals` (stok giriş/çıkış, transfer) | Tüm ürün + tüm stok kaydı yerine yeni `ProductSelect` (yazdıkça sunucuda arama, en fazla 20 sonuç) ve yalnız seçili ürünün stok kayıtları. |
| `NormalPicking`, `WMSPicking`, `WMSInbound`, `WMSCycleCount` | `/products` indirmesi kaldırıldı; seçim kutusu `ProductSelect`. |
| `NormalInbound`, `PurchaseOrders` | Seçim `ProductSelect`; **seri barkod okutma** artık yerelde bulamazsa sunucuda arıyor (`SerialScanInput` eşzamansız sonucu destekler). PurchaseOrders varsayılan ilk satır için ilk 20 ürünü alır. |
| `Movements`, `NormalMovements` | Kullanılmayan `/products` çağrısı silindi (veri hiç çizilmiyordu). |
| `RetailQuickAdd` | Tüm depo stok kaydı yerine `?product_id=`. |
| `VirtualTerminal` | Örnek kod için `limit=20`. |
| `Inventory` (`/inventory`), `NormalProducts` | **Çizim sayfalaması (100 satır) + Önceki/Sonraki**; arama/depo/kategori filtresi sunucuda zaten vardı. Veri hâlâ tek seferde iniyor (bkz. kalan riskler); 50 bin satırlık DOM yerine 100 satır çiziliyor (tarayıcıda 100 satır/501 sayfa doğrulandı). |
| `ImportExport` (stok dışa aktarma) | Gerçekten tüm kaydı istediği için **eski davranış korundu ama 2000'lik sayfalarla** çekiliyor (tek 19 MB yanıt yok). |
| `Products.jsx` | Hiçbir yola bağlı değil (ölü dosya); dokunulmadı. |

### Doğrulama
- Backend `npm test`: 188 paket / 1380 test geçti; yeni `dashboardSummary.test.js` (6 test: sayılar elle hesaplanan değerlerle, depo filtresi, başka kiracı/geçersiz depo reddi, analytics özet/kiracı yalıtımı, trend penceresi, `product_id` ve `category` süzgeçleri) ve aynısı **gerçek MySQL 8.4'te** (`npm run test:mysql` altındaki `tests/mysql/dashboardSummary.test.js`, 6/6). MySQL testi `DECIMAL`'ın metin döndüğünü yakaladı; test buna göre `Number()` kullanıyor.
- Frontend `node --test`: 192/192 (yeni `productSearch.test.mjs`: arama sınırı, birleştirme, sayfa sayfa çekme + sonsuz döngü koruması, 50 bin satırda 100'lük dilim); `vite build` temiz. Masaüstü `node --test *.test.cjs`: 32/32 (önceki rapordaki "43" farklı sayımdan; bu çalışmada masaüstü koduna dokunulmadı).
- Tarayıcı (yerel arka uç + 50 bin ürünlük veri): Depo Özeti ve Genel Bakış doğru sayıları gösterdi, depo seçimi `?warehouse_id=` ile özeti yeniledi, 375 px'te yatay taşma yok; Hızlı stok hareketinde "SKU12345" araması tek sonuç döndürdü, seçilince `?product_id=` ile stok geldi; Ürünler ve Stok sayfaları 100 satır çizdi, sayfa 2'ye geçti, 375 px'te sayfalama sığdı. **Gerçek tarayıcıda denenmedi:** PurchaseOrders / NormalInbound / WMS formlarındaki yeni seçici ve eşzamansız seri okutma (yalnız derleme + birim testi), ImportExport indirmesi.
- Tarayıcı denemesi **gerçek bir hatayı yakaladı**: `product_id` süzgecini eklerken yer tutucu `$` yanlış kaçtığı için sorgu `product_id = 2` sabitine dönüşmüştü (ve kategori süzgeci de bozulmuştu); testlerde kapsanmıyordu. Düzeltildi ve `product_id`/`category` için test eklendi.

### Kalan riskler (otomatik uygulanmadı)
1. `NormalProducts` ve `Inventory` veriyi hâlâ tek seferde indiriyor (`/products` ≈32 MB, `/stock/records` ≈19 MB / 50 bin kayıt): görünüm sekmeleri (kritik/tükenen/fazla), sütun sıralama, varyant gruplama ve üst kart sayıları istemcide hesaplanıyor. Bunları sunucu sayfalamasına almak için `products` ve `stock/records` uçlarına sıralama + görünüm süzgeçleri + özet sayıları eklenmeli (ayrı iş). Çizim sayfalaması DOM'u çözer, indirme süresini çözmez.
2. `scanIntoLines` GTIN ile okutmayı yerel listede bulur; sunucu araması yalnız ad/SKU/barkodda arar. Yalnız GTIN'i olan (barkod alanı farklı) ürün, 20'lik başlangıç listesinde yoksa seri okutmada "bulunamadı" der. Çözüm: aramaya `gtin` ve koli barkodunu eklemek.
3. Pano `movements?limit=5000` sınırı sürüyor: çok yoğun mağazada "dönem çıkışı" 5.000'de kesilir (önceki davranış; özet ucu yalnız stok tarafını değiştirdi).
4. `warehouse_distribution` / `dashboard-metrics` depo etiketi adla eşleniyor; iki depo aynı adı taşırsa Genel Bakış'ta aynı sayı iki kez görünür (önceden de böyleydi).

### Yayın öncesi tarayıcı doğrulaması (yerel sunucu + 50 bin ürünlük sentetik veri)
- **PurchaseOrders (masaüstü):** seri okutma SKU ile ürün ekledi, tekrar okutunca adet arttı; aramalı seçici tam SKU'yu en üstte getirdi; ürün değişince birim fiyat güncellendi; kayıt sunucuda doğru (2 kalem, toplam 510). 375 px'te yatay taşma yok.
- **NormalInbound:** SKU ve barkodla okutma iki satır ekledi, mal kabul sunucuda 2 kalemle oluştu.
- **NormalPicking:** aramalı seçici doğru ürünü (id) gönderdi; sunucu "yetersiz stok" yanıtı verdi (ürün bu depoda stoksuz; beklenen iş kuralı).
- **ImportExport CSV:** 50.001 stok kaydının tamamı, tekrarsız (sayfalama kayıp/yineleme yapmadı).
- **NormalProducts:** sayfa 2 → sıralama sayfayı 1'e döndürdü; arama sunucuda (11 sonuç, tek sayfa).
- **Bulunan hata:** sunucu araması `limit` ile en yeni kayıtları döndürdüğü için "SKU777" okutması SKU7770… satırlarının arkasında kalıp "bulunamadı" veriyordu. `/products?search=` artık tam SKU/barkod eşleşmesini öne alıyor (`dashboardSummary.test.js`, SQLite + MySQL).
- **Denenmedi:** `WMSInbound`, `WMSPicking`, `WMSCycleCount` hiçbir yola bağlı değil (ulaşılamaz); `NormalInbound`/`PurchaseOrders` 375 px'te yalnız taşma kontrolü; GTIN ile okutma.
