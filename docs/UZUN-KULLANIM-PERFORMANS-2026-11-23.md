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
