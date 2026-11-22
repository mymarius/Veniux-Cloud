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
