# 1. Offline-first eşitleme ve ÖKC yerel köprü mimarisi (19 Kasım 2026)

Bu belge, fiyat sayfasında taahhüt edilen "internetsiz çalışma", "yazarkasa köprüsü" ve "çok cihaz" vaatlerinin bugünkü koda göre durumunu ve hedef tasarımını verir. Sonraki çıktılar (veri şeması, yetki matrisi, API sözleşmeleri, sprint planı) bu belgeye dayanır.

## 0. İstekteki varsayımlardan düzeltmeler
1. **Veritabanı:** İstek "yerel SQLite + bulut PostgreSQL" diyor. Gerçek durum: yerel ve bulut MySQL (geliştirme/test SQLite). Sürümlü şema manifest sistemi ve yükseltme kuralları buna göre kurulu; PostgreSQL'e geçiş yapılmayacak.
2. **CRDT gerekmiyor.** Perakende kayıtlarının çoğu "ekle, değiştirme" (satış, stok hareketi) türünde; çakışma çıkmaz. Aşağıda daha basit ve denetlenebilir bir tasarım var: olay günlüğü + imleç (cursor) + sunucu otoriteli ana veri. CRDT yalnız ileride aynı kaydı iki yerde düzenleyen alanlar (not, etiket) çıkarsa düşünülür.
3. **ÖKC bir yazılım işi olduğu kadar üretici ve mevzuat işidir.** Mali fiş yalnız onaylı cihaz ve onaylı protokolle (GMP3 / yeni nesil ÖKC) kesilir. Üretici SDK'sı, test cihazı ve çoğunlukla sözleşme gerekir; bunlar benim kontrolümde değil.
4. "Hazır 3M+ barkod", iOS, kod imzalama, e-fatura entegratörü, iyzico/PayTR **dış bağımlılıktır**; bu belgenin kapsamı dışında, plan belgesinde izleniyor.

## 1. Bugün çalışan (kodda var)
| Parça | Durum |
|---|---|
| Çevrimdışı satış kuyruğu | Tarayıcı/WebView IndexedDB kuyruğu (`frontend/src/lib/offline`). Bir satır yalnız sunucu "işlendi" dedikten sonra silinir; reddedilen kaybolmaz; sıra korunur; aynı satış iki kez eklenmez (kimlik = `Idempotency-Key`). |
| Sunucuda kabul | `offlineSaleService`: `X-Veniux-Offline: <geçici fiş>|<zaman>` başlığı, en çok 7 gün, saat sapması 5 dk. Stok açığı reddedilmez; fark kadar stok düzeltmesi yazılır ve **uyuşmazlık** olarak yönetici sayımına bırakılır. |
| Cihaz lisans izni | Masaüstünde sunucudan alınan imzalı son "geçerli" yanıt 72 saat çevrimdışı kullanılır. |
| Mağaza → bulut eşitleme (Aşama 1) | `storeSyncService`: tek yön, yalnız raporlama. Cihaz anahtarı (`vsk_`), satış ve vardiya gruplar halinde yüklenir, tekrar gönderim güvenli; bulut stoğunu değiştirmez. |
| Yazarkasa | **Yok.** `desktop/devices.cjs` yalnızca takılı yazıcı/COM/USB aygıtlarını listeler. |

Eksik olanlar: ana verinin (ürün, fiyat, müşteri) cihaza çift yönlü inmesi, stok hareketlerinin ve cari hareketlerinin eşitlenmesi, çakışma ekranı, ÖKC.

## 2. Hedef eşitleme tasarımı

### 2.1 Veri sınıfları ve çakışma kuralı
| Sınıf | Örnek | Kural |
|---|---|---|
| **Olay (ekle-yalnız)** | satış, iade, stok hareketi, kasa hareketi, vardiya | Değiştirilemez. Kimliği cihazda üretilir (UUID), sunucu `INSERT … ON DUPLICATE` ile bir kez işler. Çakışma yoktur. |
| **Türetilmiş** | stok miktarı, cari bakiye | Olaylardan hesaplanır, doğrudan yazılmaz. Sapma `uyuşmazlık` olarak görünür (bugün stok açığında olduğu gibi). |
| **Ana veri** | ürün, barkod, fiyat, müşteri, kullanıcı | **Sunucu otoriteli.** Her kayıtta tek yönlü artan `version`. Cihaz değişikliği "öneri" olarak gönderir; sunucu sürüm uyuşmazsa 409 verir, cihaz güncel kaydı çekip kullanıcıya gösterir. Fiyat her zaman satış anında sunucuda (veya son eşitlenen sürümle cihazda) hesaplanır. |
| **Ayar** | yazıcı, kısayol, tema | Cihaza özel, eşitlenmez. |

### 2.2 Protokol
- **Çekme (pull):** `GET /sync/pull?table=products&after=<version_imleci>&limit=500` → değişen kayıtlar + yeni imleç. Silme "mezar taşı" (`deleted=1`) olarak gelir.
- **İtme (push):** `POST /sync/push` gövdesi: `{ device_id, batch_id, events:[{id,type,at,payload}] }`. Yanıt olay başına `ok | duplicate | rejected(+neden)`. `batch_id` tekrar gönderimi güvenli yapar.
- **Sıra:** Olaylar cihazın `seq` sırasıyla işlenir; bir olay reddedilirse sonrakiler bloklanmaz ama reddedilen "çakışma kutusuna" düşer.
- **Zaman:** Cihaz zamanına güvenilmez; olay iki zaman taşır (`device_at`, sunucu kabul zamanı). Saat sapması > 5 dk ise cihaza uyarı.
- **Kimlik ve izolasyon:** Her istekte cihaz anahtarı + işletme; sunucu hiçbir zaman istemciden gelen işletme kimliğine güvenmez (bugünkü kural korunur).
- **Geri çekilme:** Hata durumunda 2 sn → 5 dk üstel bekleme, rastgele sapmalı; kuyruk sınırı ve en eski bekleyen için uyarı (bugün var).

### 2.3 Yeni tablolar (şema 028'e girer, yalnız yeni tablo)
`sync_device_state(device_id, table_name, last_version)`, `sync_events(id, tenant_id, device_id, seq, type, payload, accepted_at, status)`, `sync_conflicts(id, tenant_id, event_id, kind, detail, resolved_by, resolved_at)`. Ana veri tablolarına `version` sütunu **eklenemez** (mevcut tablo değişimi güvenli yükseltmeyi bozar); bunun yerine `entity_versions(entity, entity_id, version)` yan tablosu kullanılır.

### 2.4 Aşamalar
1. **Aşama 2a (ana veri çekme):** ürün + fiyat + barkod çift yönlü olmadan **yalnız bulut→cihaz**. Kabul: cihazda fiyat değişince en geç 2 dk içinde kasada görünür; internet kesikken kasa son sürümle çalışır.
2. **Aşama 2b (olay itme):** stok hareketi, cari hareket ve kasa hareketi olay olarak buluta; tekrar gönderim testleri.
3. **Aşama 3 (çakışma ekranı + iki cihaz):** aynı ürünü iki cihazda düzenleme, aynı stokta eşzamanlı satış senaryoları, çakışma kutusu arayüzü.

### 2.5 Kabul ölçütleri (otomatik test)
- 1.000 satırlık olay grubu iki kez gönderilir → tek kayıt (idempotans).
- Ağ ortasında kesilen toplu gönderim → eksik kalan olaylar sonraki denemede tamamlanır, kopya yok.
- İki cihaz aynı son parça için satış yapar → ikisi de kabul edilir, biri stok açığı uyuşmazlığı olarak işaretlenir, stok eksiye düşmez.
- Eski sürümle (7 günden eski) gelen olay reddedilir ve çakışma kutusunda görünür.
- Saat 10 dk ileri cihaz → uyarı, olay `device_at` yerine sunucu zamanıyla sıralanır.

## 3. ÖKC yerel köprü tasarımı

### 3.1 Sınırlar
Veniux **mali fiş düzenlemez**; yalnızca ÖKC'ye "bu satışı yaz" komutunu gönderir ve cihazın verdiği mali fiş numarasını geri okur. Yasal fiş yazarkasadan çıkar; bu bugün sitede de böyle yazıyor ve öyle kalacak.

### 3.2 Süreç modeli
```
Kasa (React) ─HTTP→ Yerel API ─→ ecr_jobs (kuyruk, idempotent)
                                   │
              ÖKC köprü süreci (Node alt süreç, yalnız 127.0.0.1)
                                   │  sürücü arayüzü
        ┌──────────┬───────────┬───┴────┬─────────┬────────┐
     Simülatör  Ingenico    Beko     Hugin     Pavo    Ödeal   (üretici SDK/GMP3)
```
- Köprü, masaüstü uygulamasının alt süreci; yalnız yerel adreste dinler, her istekte rastgele oturum anahtarı ister, günlüğe tutar/kart verisi yazmaz.
- **Sürücü arayüzü (tek sözleşme):** `status() · openSale(lines, payments) · cancel(ref) · close(kind) · lastReceipt()`. Her üretici bu arayüzü uygular; ilk sürücü **simülatör** (testler ve demo için).

### 3.3 Satış akışı
1. Kasa satışı tamamlar (bugünkü akış, değişmez).
2. Satış kaydıyla aynı işlemde `ecr_jobs(sale_id UNIQUE, status='pending')` yazılır.
3. Köprü işi alır → cihaza yazar → yanıttaki **mali fiş no / Z no** satış anlık görüntüsüne (`snapshot.fiscal`) yazılır, iş `done`.
4. **Hata kuralı:** ÖKC kapalı/kâğıt bitti/zaman aşımı satışı **asla bloklamaz**. Satış tamam, fişte "mali fiş bekliyor" rozeti; kullanıcı elle yeniden dener. Gün sonu bekleyen iş varsa uyarı verir (kapatma engeli yönetici ayarı).
5. İade/iptal aynı yolla (`cancel`); ÖKC'de iptal edilemeyen satış için kullanıcıya açık uyarı.

### 3.4 Şema (028 paketine eklenir)
`ecr_devices(id, tenant_id, register_id, brand, connection, name)`, `ecr_jobs(id, tenant_id, sale_id UNIQUE, kind, status, attempts, last_error, fiscal_receipt_no, z_no, created_at, done_at)`.

### 3.5 Doğrulama
- Simülatörle: ödeme bölünmesi, iptal, tekrar deneme, köprü çökmesi sırasında satışın sağ kalması.
- **Gerçek cihaz testi şart:** her marka için üreticinin test sürümü veya pilot mağaza. Bu olmadan `/bilgilendirme` sayfasında "yazarkasa entegrasyonu hazır" yazılmaz.

## 4. Bu belgeden çıkan işler (sıralı)
1. Şema 028'e `sync_*`, `entity_versions`, `ecr_*` tabloları (+ üç fiyat türü, dövizli fiyat, grup ağacı).
2. Aşama 2a: bulut→cihaz ürün/fiyat çekme ve cihaz yerel önbelleği.
3. ÖKC köprü iskeleti + simülatör sürücüsü + `ecr_jobs` akışı.
4. İlk gerçek marka seçimi ve cihaz/SDK temini (sizin kararınız, aşağıda).

## 5. Sizden gereken kararlar
- **Hangi ÖKC markasıyla başlayalım?** Pilot mağazanın kullandığı marka en doğrusu. Üreticiden SDK ve test cihazı istenecek.
- **Pilot mağaza** (gerçek ödeme ve eşitleme testleri için).
- Çevrimdışı satışın 7 gün sınırı yeterli mi (şimdi 7).

## 6. Uygulama durumu (19 Kasım, gece)
Bekleyen kararlar şöyle ele alındı (itirazınız yoksa böyle kalır):
- **ÖKC markası:** Marka belli olmadan başlandı. Köprü marka bağımsız çalışır; ilk sürücü **simülatör**. Üretici sürücüleri (Ingenico, Beko, Hugin, Pavo, Ödeal) tanımlı ama "henüz kurulu değil" hatası verir; gerçek marka SDK'sı ve test cihazı geldiğinde yalnız o sürücü yazılır.
- **Pilot mağaza:** Pide restoranı yalnız banka POS'u kullanıyor (yazarkasa yok); ÖKC denemesi için ayrı bir market/kırtasiye pilotu gerekir.
- **Çevrimdışı sınır:** 7 gün olarak kaldı.

Yazıldı ve test edildi (backend, `tests/ecrBridge.test.js`): `ecr_devices` ve `ecr_jobs` tabloları (SQLite migrasyonu 058 + MySQL manifest 028), `ecrService` (cihaz tanımı, satışta iş üretme, işleme, yeniden deneme, 5 deneme sınırı, gün sonu engeli sayacı), `/api/ecr/*` uçları. Cihaz yokken satış hiç etkilenmez; cihaz hata verirse satış tamamlanır, iş `failed` kalır. İşler satış anlık görüntüsüne dokunmaz.
**Henüz yok:** kasa arayüzünde "mali fiş bekliyor" rozeti ve cihaz ekranı, masaüstü alt süreci ve üretici sürücüleri. **Şema 028 canlıya alınmadı**: `SHIPPABLE_MYSQL_SCHEMA` 027'de duruyor; MySQL'de eski-kurulum yükseltme provası ve bulut `upgradeAdditive` adımı yapılmadan yayınlanmaz. Kod şema yokken de güvenlidir (iş yazımı hata verirse yutulur, satış sürer).

## 7. Şema 028 yükseltme provası (19 Kasım, gece) — GEÇTİ
Yerel MySQL 8.4'te (`tests/mysql/schemaUpgrade.test.js`, canlıdaki `upgradeAdditive` ile aynı çağrı): "eski kurulum" (027) kuruldu, veri eklendi, ÖKC tabloları kaldırılıp sürüm kaydı silindi; yükseltme sonrası **tüm veri ve tetikleyiciler korundu**, `ecr_devices` ve `ecr_jobs` çalıştı (aynı satış için ikinci iş UNIQUE ile engellendi), yükseltmenin tekrarı zararsız. Ayrıca test veritabanı (`veniux_test_parity`, 27 sürümdeydi) `upgradeAdditive` ile 028'e yükseltildi.
Tam MySQL takımı: 14 dosyadan 10'u geçti (parity, API kapsamı, işletme, üretim vb.). Kalan 4 (cutover/recovery: yedekten geri yükleme ve geçiş) bu makinedeki geçici MySQL'in başlatma ayarlarına ve yedek araçlarına bağlı; ÖKC değişikliğinden bağımsız görünüyor ama değişiklik öncesi koda karşı ayrıca karşılaştırılmadı.
**Canlıya almak için kalanlar:** `tools/release/yayinla.py` içinde `SHIPPABLE_MYSQL_SCHEMA` → `028-ecr-bridge`; Plesk'te veritabanı dökümü (geri dönüş noktası) → kaynak yükleme → `run stage` → `upgradeAdditive` → `mysql_migrate.js --record-deployment --confirm-target` → Restart App. Kasa arayüzündeki "mali fiş bekliyor" rozeti 028 canlıya alınınca eklenecek (şema yokken uç 500 verir).
