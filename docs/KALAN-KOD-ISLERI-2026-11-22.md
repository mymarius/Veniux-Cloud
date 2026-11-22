# Kalan kod işleri — 22 Kasım 2026

Hiçbir iş canlıya gönderilmedi; hepsi yerel commit. Şema 032 (SQLite 062–, MySQL `032-fx-auto-tasks.json`) ve sürüm 2.4.102 yayını kullanıcı onayı bekliyor.

## 1. Otomatik döviz kuru — YAPILDI
- TCMB `today.xml` → `fxAutoService` (USD/EUR/GBP, satış kuru TL kuru olarak, alış ayrıca saklanır). Hafta sonu/tatilde dosya son iş gününü verdiği için son kur kalır; XML'deki tarih "TCMB kur tarihi" olarak gösterilir.
- Zamanlayıcı: her gün 10:05 ve hafta içi 15:45 (`cronJobs.js`); yalnız "otomatik" açık işletmeler. Ağ/okuma hatasında kur değişmez, `exchange_rate_settings.last_status/last_error` yazılır, günlüğe uyarı düşer. Varsayılan KAPALI (mevcut elle kurlar kendiliğinden değişmesin).
- Elle girilen/değiştirilen kur `exchange_rate_sources.source='manual'` olur ve otomatik tarafından ezilmez; kuru silmek o para birimini tekrar otomatiğe açar. Arayüz aynı değeri geri gönderirse kaynak bozulmaz.
- Uçlar: `PUT /api/products/currency-rates/auto {enabled}`, `POST /api/products/currency-rates/refresh`; `GET /currency-rates` artık `source`, `rates_date`, `auto{...}` döner.
- Arayüz: Ürünler › Döviz kurları penceresinde onay kutusu, "Şimdi güncelle", her kurun altında "Otomatik/Elle · zaman". Gerçek tarayıcıda gerçek TCMB ile denendi.
- Test: `backend/tests/fxAuto.test.js` (ağa çıkmaz; XML örneği).
- Yeni tablolar: `exchange_rate_settings`, `exchange_rate_sources` (migration `062_fx_auto.js`).

## 2. Sayım ve alışta seri okutma — YAPILDI
- Ortak mantık `frontend/src/lib/serialScan.mjs` (ön/son ek ve Enter/Tab temizleme, satır ekle/adet artır, yanlış barkod, kontrol hanesi ipucu, ses/titreşim kararı, oturum sayacı) + `components/SerialScanInput.jsx` (sürekli odakta kutu, Enter **veya Tab** ile biten okutma, ayarlardaki okuyucu ön/son eki).
- Mal kabul (`NormalInbound`) ve alış siparişi (`PurchaseOrders`, varsayılan ilk satır okutulan ürünle değişir) bu kutuyu kullanır. Çift okutma = adet artışı; tanınmayan barkodda hata sesi + kırmızı uyarı + "kontrol hanesi tutmuyor" ipucu.
- Stok sayımı (`wms/WMSCycleCount`, zaten `shared/countScan.mjs` ile seri sayıyordu): okutma temizliği ve ses/titreşim geri bildirimi eklendi.
- Eski `pages/StockCount.jsx` hiçbir yoldan açılmıyor (ölü sayfa); dokunulmadı.
- Test: `frontend/src/lib/serialScan.test.mjs` (6 test). Gerçek tarayıcıda mal kabulde Enter/Tab okutma, adet artışı, yanlış barkod denendi.
- Sınır: kamera okuyucu ve Bluetooth/seri okuyucu `ScannerPanel` yolunu kullanan ekranlarda (sayım) zaten çalışır; mal kabul/alış kutusu klavye-takılı (HID) okuyucu içindir.

## 3. Görev yönetimi — YAPILDI
- Şema: `063_business_tasks.js` → `business_tasks` (başlık, açıklama, atanan, vade, durum açık/yapılıyor/bitti, öncelik düşük/normal/yüksek/acil); MySQL `032-fx-auto-tasks.json` yeniden üretildi (artık fx tabloları + görev tablosu = 032). CRM görevlerinden ayrı.
- Servis `businessTaskService`, uçlar `/api/tasks` (`GET /`, `/badge`, `/assignees`, `POST /`, `PUT /:id`, `PATCH /:id/status`, `DELETE /:id`).
- Yetki: admin/manager atar, düzenler, siler, hepsini görür. Kasiyer ve depo sorumlusu (`warehouse_lead`) yalnız kendine atananı görür ve durumunu değiştirir; görüntüleyici (`viewer`) kendi görevini yalnız okur. Başka işletmenin kullanıcısına atanamaz, başkasının görevi 404.
- Vadesi geçen açık görev "Vadesi geçti" ile kırmızı vurgulanır (vade günü İstanbul takvimine göre). Özet kartları: açık/yapılıyor/vadesi geçen/biten.
- Denetim kaydı (`audit_logs`, `entity_type=business_task`): `task.created`, `task.assigned`, `task.status_changed`, `task.completed`, `task.reopened`, `task.deleted`.
- Arayüz: `pages/BusinessTasks.jsx`, rota `/gorevler`, menüde "İş görevleri" (Genel grubu; CRM "Görevler"inden ayrı). Gerçek tarayıcıda atama, vade vurgusu ve "Bitti" denendi.
- Test: `backend/tests/businessTasks.test.js` (6 test).
- Sınır: bildirim/WhatsApp hatırlatması yok (yalnız ekranda vurgu); menü rozeti için `GET /tasks/badge` hazır, arayüze bağlanmadı.

## 4. Kâr raporları — YAPILDI
- Zaten vardı: günlük/haftalık/aralık brüt kâr (`retailProfitService`, `GET /scanner/gross-profit`, CSV/Excel). Maliyet, KDV ve lot ağırlıklı ortalama (satışta sabitlenen `cost_snapshot`) hesabı **yeniden yazılmadı**; yeni katman bu satırları toplar.
- Yeni: `profitAnalysisService` + `GET /api/scanner/profit-analysis` (admin/manager; kasiyer 403): tarih aralığı (varsayılan son 30 gün, en çok 1 yıl), depo/kategori/ürün süzgeci, gruplama ürün/kategori/gün/hafta(pazartesi)/ay, KDV hariç net satış, maliyet, brüt kâr, **kâr marjı %**, en kârlı ve zarar eden ürünler, `format=csv` dışa aktarma (BOM, `;`, formül enjeksiyonu kaçışı).
- Maliyeti/KDV temeli bilinmeyen satırlar kâra ve marja katılmaz (sıfır sanılmasın), "eksik maliyet" olarak sayılır ve KDV dahil net satışları uyarıda gösterilir.
- Arayüz: Raporlar › Kâr sekmesinde mevcut brüt kâr tablosunun altına `ProfitAnalysis` bölümü. Gerçek tarayıcıda 2 ürünle (kârlı/zararlı) denendi, sayılar elle hesapla tuttu.
- Paket kısıtı (Pro ve üstü) ve `VENIUX_PLAN_ENFORCE` değiştirilmedi. Yeni tablo yok.
- Test: `backend/tests/profitAnalysis.test.js` (5 test) + mevcut `retailProfit.test.js` yeşil.

## 5. Yazarkasa (ÖKC) sürücü katmanı — KISMEN (kasıtlı)
**Yapıldı (gerçek cihaz gerektirmeyen kısım):**
- `ecrService` sağlamlaştırıldı: cihaz çağrısına zaman aşımı (`VENIUX_ECR_TIMEOUT_MS`), `attempts` üzerinde iyimser kilitle aynı işin çift yazdırılmasının engellenmesi, **belirsiz sonuç** (zaman aşımı/yarıda kesilen süreç) `BELİRSİZ:` işaretiyle otomatik yeniden denenmez, `findSale` desteği, operatör onayı (`POST /api/ecr/jobs/:id/process {confirm_reprint:true}`), sürücüye sabit `idempotency_key`.
- Yeni `backend/src/services/ecr/`: `errors.js`, `frames.js` (STX/ETX/LRC zarfı), `transport.js` (TCP, COM, kayıtlı çerçeve taşıyıcısı), `framedDriver.js` (iskelet).
- `driverStatus` / `registerDriver`; `GET /api/ecr/devices` artık `driver_status` döner (`simulator` | `not_installed` | `unverified` | `verified`). `VERIFIED_BRANDS` **boş**; testte boş olduğu doğrulanıyor.
- Rehber: `docs/ECR-SURUCU-REHBERI.md` (sözleşme, ekleme adımları, gerekli bilgi listesi, gerçek cihaz kabul listesi).
- Test: `backend/tests/ecrDrivers.test.js` (12 test: zarf, kayıtlı çerçeve mutlu yol/NAK/zaman aşımı/sapma/red, gerçek yerel TCP, çift işleme, belirsiz iş, findSale, sürücü durumları) + mevcut `ecrBridge.test.js` yeşil.

**ENGEL (kullanıcıdan gerekenler):** marka + model, protokol belgesi/SDK ve örnek bayt alışverişleri, test cihazı, üretici sözleşmesi, pilot işletme (rehber §3). Bunlar olmadan marka sürücüsü yazılmadı; hiçbir sürücü "hazır" işaretlenmedi.
**Eksik ve ilk sürücüyle gelecek:** `ecr_devices` için bağlantı ayarı sütunu (şema adımı), cihaz kayıt ekranı, masaüstü alt süreci, kasada "mali fiş bekliyor" rozeti.

## Test sonucu (yerel, canlıya hiçbir şey gönderilmedi)
- Backend `npm test`: **183 paket / 1355 test yeşil** (öncesi 179 / 1323; yeni: `fxAuto`, `businessTasks`, `profitAnalysis`, `ecrDrivers`).
- Frontend: **205 test yeşil** (öncesi 199; `serialScan.test.mjs` eklendi). `vite build` temiz.
- MySQL 8.4 (yerel): `schemaUpgrade.test.js` (eski kurulum → 032 `upgradeAdditive`, veri ve tetikleyiciler korundu, yeni tablolar çalışıyor) ve `parity.test.js` 5/5 geçti. MySQL sunucusu işlem bitince kapatıldı.
- Not: ilk 032 manifesti `001-parity` yeniden üretim tuzağına düşüp eski tabloları değiştirmişti (yükseltme `SCHEMA_UPGRADE_UNSUPPORTED` verdi); düzeltildi — 032 = 031'in birebir kopyası + 3 yeni tablo (`.local/mkmanifest.cjs` bunu yapar).

## Yayın için gerekenler (YAPILMADI, onay bekliyor)
1. Sürüm 2.4.102: `backend/src/config/release.json`, `desktop/package.json` + `package-lock.json`, `mobile/android` (AndroidManifest + MainActivity), `frontend/src/data/programRelease.json` sürüm notları (otomatik kur, seri okutma, görevler, kâr analizi, ÖKC sağlamlaştırma) — 2.4.101 commit'indeki dosya kümesi.
2. Şema 032: `tools/release/yayinla.py` kapısı zaten `032-fx-auto-tasks` (bu turda çekildi); yükseltme provası yerel MySQL'de geçti. Bulutta: Plesk veritabanı dökümü → kaynak yükleme → `run stage` → `upgradeAdditive` → `mysql_migrate.js --record-deployment --confirm-target` → yeniden başlatma (bkz. `docs/MIMARI-SENKRON-OKC.md` §7 ve `cloud-deploy` adımları). Yeni tablolar: `exchange_rate_settings`, `exchange_rate_sources`, `business_tasks`.
3. Bulut sunucusunda TCMB'ye (`www.tcmb.gov.tr`) dışarı HTTPS erişimi olmalı; kapalıysa kur otomatik güncellenmez, son kur korunur (hata "Kur penceresi"nde görünür). Masaüstü programı kendi makinesinden çeker. Otomatik kur varsayılan KAPALI; işletme Ürünler › Döviz kurları'ndan açar.
4. Business sunucusu (business.veniux.com) ayrıca güncellenir (her sürümde ayrı).
5. Yayın sonrası elle deneme: otomatik kur aç/kapat, görev ata/bitir (kasiyer hesabıyla), mal kabulde okuyucuyla seri okutma, Raporlar › Kâr sekmesi.
6. Açık iş: ÖKC için marka bilgisi/belge/test cihazı (rehber §3); görev bildirimi/rozeti; çevrimdışı kasa/telefon (Android) tarafında seri okutma yalnız web arayüzünde denendi.

## 6. Veniux Tanılama — YAPILDI (yayın bekliyor)
Yeni tablo/şema YOK (şema 033 gerekmedi). Yeni bağımlılık YOK.

**Mimari:** Renderer (`DiagnosticsPanel.jsx`, Ayarlar › Sistem sekmesi) → `preload.js` (yalnız 7 sabit `diag*` fonksiyonu) → `main.js` `handle()` (güvenilir pencere denetimi, mevcut) → `desktop/diagnostics.cjs`. `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true` aynen duruyor. Kabuk komutu, dosya sistemi gezintisi, kod çalıştırma kanalı yok; kanal listesi testle sabitlendi. Girdi doğrulama: tarama türü `quick|full`, test kimliği `^[a-z]+\.[a-z0-9-]+$`, fazladan alan reddedilir. Dışa aktarma yolu arayüzden alınmaz; kaydetme penceresini sistem açar. Deneme fişinde yazıcı adı yalnız Windows listesinden seçilebilir, içerik sabit.

| Parça | Durum | Not |
|---|---|---|
| (a) Sistem özeti | Çalışıyor | Windows/mimari, RAM, disk (veri klasörü sürücüsü; <5 GB uyarı, <1 GB hata), program/Electron/Node/Chromium sürümü. Bu makinede gerçek değerlerle koşuldu. |
| (b) Veri ve yedek | Çalışıyor | Yerel veritabanı klasörü erişim+boyut, son yedek zamanı/boyutu (>7 gün uyarı), yedek klasörüne gerçek yaz-sil denemesi. Klasör yoksa "Ölçülemedi". |
| (c) Ağ ve bulut | Çalışıyor | İnternet, app.veniux.com, api.veniux.com (gerçek HTTPS isteği + gecikme; gerçek erişimle denendi: 204/200). Sunucu: lisans durumu/bitişi, son eşitleme ve hatası, sunucudaki çevrimdışı satışlar/çakışmalar; ekran: bu cihazın çevrimdışı kuyruğu. |
| (d) Cihazlar | Kısmen | Yazıcı listesi ve COM/USB/HID sayıları (`devices.cjs` + Electron yazıcı listesi), "deneme fişi yazdır", barkod okuyucu testi (okutunca algılandı/algılanmadı), ÖKC simülatörü gerçek sürücü akışıyla. **Terazi ve müşteri ekranı için ölçüm yazılmadı**: gerçek bir doğrulama yolu yok, uydurma sonuç verilmedi. Marka ÖKC'sine bağlantı denenmez ("doğrulanmamış/kurulu değil"). |
| (e) Test motoru | Çalışıyor | Benzersiz id, ad, açıklama, çalıştırma, ilerleme (`diag-progress`), süre, hata ayrıntısı, öneri; hızlı/tam/tek test; iptal ve zaman aşımı **ayrı durum**; "ölçülemedi" başarısızlık sayılmaz; son 20 tarama `userData/diagnostics-history.json`. |
| (f) Destek paketi | Çalışıyor | Sonuç + program/sürüm + lisans özeti + (varsa) `*.log` dosyalarının son 64 KB'ı tek `.json`; kullanıcı kaydeder, **otomatik yükleme yok**. Ayıklama: parola, token/JWT, lisans anahtarı, eşleştirme kodu, e-posta, telefon, IBAN, müşteri/firma adı, uzun onaltılık sırlar, Windows kullanıcı adı; birim testleriyle kanıtlandı. Not: masaüstü programı şu an günlük dosyası yazmıyor (alt süreç `stdio: ignore`), bu yüzden `logs` çoğunlukla boş gelir. |
| (g) Güvenlik | Çalışıyor | Onarım yok; yalnız öneri ve kullanıcı onaylı "Şimdi yedek al" (mevcut `POST /api/backup`). GPU/SMART/uygulama inceleme/bellek analizi yok. |

**Test:** `desktop/diagnostics.test.cjs` (14: motor, zaman aşımı/iptal/hata ayrımı, gerçek ölçümler, gerçek yerel HTTP, geçmiş, veri ayıklama, destek paketi, IPC doğrulama/kanal listesi), `backend/tests/diagnostics.test.js` (4), `frontend/src/lib/diagnosticsView.test.mjs` (4).

**Gerçek deneme:** Electron penceresi açılmadı. Motor Node'da gerçek ölçümlerle (bellek, disk, 3 ağ ucu, COM/USB/HID taraması) koşuldu; sunucu ucu ve arayüz yerel sunucu + Browser aracıyla (masaüstü 1024 px ve 375 px mobil, yatay taşma yok) denendi. Tarayıcıda masaüstü kanalları yoktur: bilgisayar ölçümleri "Ölçülemedi" görünür. **Gerçek Electron'da denenmesi gerekenler:** IPC köprüsü, kaydetme penceresi, yazıcı listesi, deneme fişi, geçmiş dosyası.

**Yayın adımları:** yeni sürüm (2.4.103) dosyaları ve sürüm notu; `desktop/electron-builder.config.js` `files` listesine `diagnostics.cjs` eklendi; şema yok, bulut yalnız `/api/diagnostics/app` kodunu alır; paketlenmiş masaüstünde Ayarlar › Sistem › Veniux Tanılama elle denenmeli (yukarıdaki liste).

## 7. MySQL'de düşen testler — İNCELENDİ, ÇÖZÜLMEDİ (kod değişmedi)
- Yerel MySQL 8.4'te `cutoverAndIntegrity`, `rc2Recovery`, `recovery` paketlerinden 5 test düşüyor (`recoveryBillingLedger` geçiyor); `schemaUpgrade` ve `parity` yeşil.
- Ortak neden: boş hedefe geri yükleme (`dataTransfer.restoreEmptyTarget`) `business_invitations` tablosuna satır yazarken `ER_DUP_ENTRY` veriyor (geçici tanılama ile tablo adı bulundu, tanılama kodu geri alındı). Kaynak tabloda 5 satır, 5 ayrı `token_hash`; benzersiz indeks tanımı kaynakta doğru, kopya yok. Yani sorun kaynak verisinde değil, yükleme sırasında (hedefte aynı satırın ikinci kez yazılması ya da ön yükleme) görünüyor.
- 19 Kasım'daki "bu makinede düşüyor" notuyla aynı; 2.4.101–2.4.103 değişikliklerinden önce de vardı (`business_invitations` bu turlarda değişmedi). Gerçek yedek/geri yükleme yolunu etkileyebileceği için canlıda geri yükleme gerekirse önce bu test hatası çözülmeli.
- Sonraki adım: `restoreEmptyTarget` içinde satır başına hangi kimliğin çakıştığını (anahtarı maskelemeden, yalnız yerelde) yazdırıp hedefteki mevcut satırı bulmak.

### 7a. Çözüldü (sonradan)
- **Neden:** taşınabilir yedek (`backupPrivacy.portable`) `token` içeren her sütunu (ör. `business_invitations.token_hash`) tüm satırlarda aynı `[REDACTED]` değerine çeviriyordu; tabloda `token_hash` benzersiz olduğundan 2 ve üzeri satırda geri yükleme `ER_DUP_ENTRY` veriyordu. Gerçek bir hata: birden fazla davetli işletme olan canlı veriden alınan taşınabilir yedek geri yüklenemezdi. `license_key` bu yüzden zaten satıra özgü maskeleniyordu.
- **Düzeltme:** gizli sütun manifestte benzersiz indeksin parçasıysa `[REDACTED]-<id>` (id yoksa satır no) yazılır; diğer gizli sütunlar eskisi gibi sabit. Test: `backend/tests/backupPrivacy.test.js` (2).
- **Test ortamı:** `schemaUpgrade.test.js` `veniux_test_rc2_fault` veritabanını bitişte siliyordu; `rc2Recovery` fault testi o boş veritabanının var olmasını bekler. Artık silip yeniden boş oluşturuyor.
- **Sonuç:** MySQL `cutoverAndIntegrity`, `rc2Recovery`, `recovery`, `recoveryBillingLedger` 18/18, `schemaUpgrade` yeşil; backend yedek testleri 46/46. Not: düzeltme sunucu kodunu etkiler (`backupPrivacy.js`); canlıya bir sonraki bulut kodu güncellemesiyle gider, şema değişikliği yok.
