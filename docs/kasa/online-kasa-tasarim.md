# Veniux Online Kasa — tasarım ve geliştirme planı (9 Kasım 2026)

**İşaretler:**
- **[Var]** bugün kodda var.
- **[Ekle]** geliştirilecek.
- **Varsayım:** doğrulanmamış kabul.
- **[DOĞRULA]** mevzuat veya üçüncü taraf bilgisi; resmî kaynaktan doğrulanmalı.

Yasal ve vergisel her sonuç bir **mali müşavire** ve **yetkili ÖKC firmasına** doğrulatılmalıdır. Bu belge hukuki görüş değildir.

---

## 1. Mimari (onaylandı)
**Seçim:** Mağaza sunucusu (hub) + bulut eşitlemesi + kasada sınırlı acil durum modu.

```
            ┌────────────── Bulut (app.veniux.com) ──────────────┐
            │ Eşitleme alıcısı · MySQL kopya · rapor · lisans     │
            └─────────▲──────────────────────────┬───────────────┘
           outbox     │ HTTPS REST, toplu+sıralı  │ ürün/fiyat/kampanya (sürüm no ile çekme)
┌──────────────────── Mağaza (yerel ağ) ─────────▼────────────────────┐
│ Mağaza sunucusu (Windows): yerel API + MariaDB + eşitleme + ÖKC köprüsü │
│     ▲ eşleştirilmiş cihaz anahtarıyla HTTPS                              │
│ Kasa 1 (aynı PC) · Kasa 2 (Android, acil kuyruk) · El terminali          │
└──────────────────────────────────────────────────────────────────────────┘
```
- Mağaza içinde tek doğruluk kaynağı mağaza sunucusu. Bulut raporlama ve çok şube kopyasıdır.
- Mağaza sunucusuna gelen yönde ürün, fiyat ve kampanya çekilir; giden yönde satış, iade, vardiya, nakit hareketi ve stok hareketi gönderilir.
- WebSocket şimdilik yok; dakikalık çekme yeterli.

## 2. Satış akışı (onaylandı)
Ayrıntılı tablo sohbette verildi. Özet:
- **Akış:** giriş → vardiya → okutma (tartılı dahil) → kampanya teklifi → ödeme → tek işlemde kayıt (stok FEFO) → fiş → iade/iptal → vardiya kapanışı → Z raporu.
- **Yasal belgeler:** Z raporu ve yasal fiş ÖKC'den gelir. Veniux'un ürettikleri bilgi fişi ve gün sonu raporudur.

---

## 3. Çevrimdışı çalışma ve eşitleme

### 3.1 Üç bağlantı durumu
| Durum | Ne çalışır | Kasada gösterge |
|---|---|---|
| **Çevrimiçi** (mağaza sunucusu + internet var) | Her şey | Yeşil: "Bağlı · eşitlendi 12:04" |
| **İnternet yok, mağaza sunucusu var** | Satış, iade, vardiya, stok tamamen çalışır; buluta giden kayıtlar kuyrukta bekler | Turuncu: "İnternet yok · 37 kayıt bekliyor" |
| **Mağaza sunucusuna ulaşılamıyor** (yalnız ayrı cihazdaki kasalar) | **Acil durum modu** | Kırmızı: "Acil mod · 4/50 satış · kalan 3 sa 40 dk" |

### 3.2 Acil durum modu kuralları (önerdiğim değerler; ayarlardan değiştirilebilir) [Ekle]
- **Yalnız nakit ve kart satışı.** Kart tutarı, ayrı banka POS'undan elle girilir. Veresiye, iade, iptal, fiyat değişikliği, kampanya teklifi ve vardiya kapanışı kapalıdır.
- **Neden:** Veresiye ve iade, merkezde tutulan bakiye ve satış kaydına bağlı.
- **Kampanyalar:** Cihaz son eşitlenen kampanya listesini önbellekten uygular. Fişte "acil mod" notu çıkar.
- **Sınırlar:** **50 satış** veya **4 saat**, hangisi önce dolarsa. Sınır dolunca satış kapanır ve yönetici kodu ister.
- **Neden bu sınırlar:** Çakışma ve kayıp riskini küçük tutuyor; tipik bir kesinti (modem, elektrik) için yetiyor.
- **Yerel kayıt:** Satışlar cihazda şifreli ve sıralı bir kuyrukta tutulur (Android'de uygulama içi depolama). Mağaza sunucusu geri gelince otomatik gönderilir.
- **Stok:** Cihaz stok düşmez. Mağaza sunucusu satışları alınca stoğu sırayla düşer; eksi stok politikası (3.5) uygulanır.

### 3.3 Tekrarlı satışı önleme [Var, genişletilecek]
- Her satış, cihazda bir **UUID** ile başlar. Bu anahtar bugün de var (`Idempotency-Key`).
- Aynı UUID ikinci kez gelirse sunucu ilk sonucu döner, yeni kayıt açmaz [Var].
- **Eşitlemede:** Bulut, kayıtları `(şube, cihaz, cihaz_sıra_no)` ve UUID ile tekilleştirir. Aynı kayıt yüz kez gönderilse de bir kez yazılır [Ekle].

### 3.4 Cihaz bazlı fiş numarası [Ekle]
- **Biçim:** `ŞUBE-KASA-YYYYAAGG-NNNNN`. Örnek: `01-02-20261109-00042`.
- Sayaç kasa başına ve gün başına sıfırlanır. Sayaç, satışla aynı veritabanı işleminde artar; boşluk oluşmaz.
- **Acil modda:** Cihaz kendi aralığını kullanır, örneğin `01-02A-…` gibi ayrı bir önek. Mağaza sunucusu numarasıyla çakışmaz.
- Bu numara **Veniux numarasıdır**. Yasal fiş numarası ÖKC'den gelir ve satışa ayrıca yazılır (bölüm 6).

### 3.5 Çakışma çözümü ve eksi stok
| Çakışma | Kural |
|---|---|
| Satış ve iade aynı kayıt üzerinde | Satış kayıtları değiştirilemez; iade ayrı bir kayıttır. Değiştirme çakışması olmaz. |
| İki kasa son ürünü satar | Mağaza sunucusunda işlem kilidi var [Var]; ikinci satış "stok yetersiz" alır. |
| Acil moddan gelen satış stoğu eksiye düşürür | **Satış reddedilmez**, çünkü para alınmış ve ürün gitmiş. Stok eksiye düşer, "eksi stok" uyarısı ve sayım görevi açılır [Ekle]. |
| Ürün fiyatı bulutta değişti, kasada eski fiyattan satıldı | Satış, satıldığı fiyatla kalır. Fark raporlanır; geçmiş satış düzeltilmez. |
| Buluttaki ürün ile mağazadaki ürün aynı anda düzenlendi | Ana veriler (ürün, fiyat, kampanya) **buluttan** yönetilir; son değişiklik geçerli olur ve değişiklik işlem kaydına düşer. |

- **Eksi stok politikası:** Normal satışta eksi stok **kapalı** [Var]. Yalnız acil moddan gelen satışlar eksi stok yaratabilir. Eksi stok satırı ayrı listelenir, sayımla kapatılır.

### 3.6 Uzun süre internetsiz kalma
- **0-72 saat:** Lisans geçerli [Var], her şey çalışır, kayıtlar birikir.
- **72 saatten sonra:** Satış sürer, ama yeni cihaz eşleştirme, paket değişikliği ve buluttan ürün çekme durur. Yönetici ekranında kırmızı uyarı çıkar [Ekle].
- **Kuyruk:** Bekleyen kayıt sayısı ve en eski kaydın yaşı her zaman gösterilir. 7 günü aşan kuyruk günlük e-posta veya SMS uyarısı üretir (uyarı iletim altyapısı [Var]).

---

## 4. Veri modeli
**Kısıt:** Kurulu masaüstlerinde mevcut tabloya sütun eklenemez; **yalnız yeni tablo** eklenebilir (`upgradeAdditive`). Bu yüzden mevcut tablolar korunur, eksikler yeni tablolarla tamamlanır.

### 4.1 Mevcut tablolar (değişmez) [Var]
| Tablo | Rol |
|---|---|
| `pos_sales` | Satış başlığı: tenant, receipt_no, toplam/indirim/net, ödeme yöntemi, durum, tarih |
| `pos_sale_items` | Kalemler: ürün, barkod, miktar, birim fiyat, toplam |
| `retail_sales` | Satışın değişmez fotoğrafı (`snapshot_json`): kalemler, lot dağılımı, KDV, ödemeler, kampanya, sadakat, depo, vardiya, kasa |
| `retail_shifts`, `retail_registers`, `retail_cash_movements` | Vardiya, kasa, nakit giriş/çıkış |
| `retail_reversals` | İade ve iptal (tutar, kalemler, gerekçe) |
| `audit_logs` + `audit_seals` | İşlem kaydı + değiştirildiği anlaşılır zincir [Var] |

### 4.2 Yeni tablolar [Ekle]
**`pos_devices`** — kasa cihazları
| Alan | Tür | Not |
|---|---|---|
| id | PK | |
| tenant_id | FK | |
| register_id | FK retail_registers | Cihaz bir kasaya bağlı |
| device_uid | metin, tekil | Cihazın kalıcı kimliği |
| public_key | metin | Eşleştirmede verilir; istekler bununla imzalanır |
| platform | 'windows' / 'android' | |
| status | 'active' / 'revoked' | Kaldırılan cihazın kayıtları reddedilir |
| emergency_prefix | metin | Acil mod fiş öneki (ör. `02A`) |
| last_seen_at, created_at | zaman | |
Tekillik: `(tenant_id, device_uid)`. Paket cihaz sınırı bu tablodan sayılır.

**`pos_receipt_counters`** — fiş sayaçları: `tenant_id, register_id, business_date, last_no`. Tekillik: `(tenant_id, register_id, business_date)`.

**`pos_sale_meta`** — mevcut satışa eklenen bilgi (sütun eklenemediği için)
| Alan | Not |
|---|---|
| sale_id (PK, FK pos_sales) | |
| client_uuid (tekil) | Tekrar önleme anahtarı |
| device_id | Satışı yapan cihaz |
| local_receipt_no | `01-02-20261109-00042` |
| mode | 'online' / 'emergency' |
| device_created_at | Cihaz saati (sunucu saatinden ayrı) |
| okc_status | 'not_required' / 'pending' / 'printed' / 'failed' |
| okc_receipt_no, okc_z_no, okc_document_type | ÖKC'den dönen değerler |
| sync_state | 'local' / 'queued' / 'synced' |

**`sync_outbox`** — buluta gidecekler: `id, tenant_id, entity, entity_id, seq (şube içi artan), payload_hash, payload_json, attempts, next_attempt_at, sent_at, last_error`. İndeks: `(tenant_id, sent_at, seq)`.

**`sync_state`** — `tenant_id, direction ('in'/'out'), last_seq, last_success_at`.

**`okc_operations`** [kısmen Var: `retail_external_operations`] — ÖKC'ye giden her istek: `id (UUID), sale_id/reversal_id, action ('sale'/'refund'/'cancel'/'z'), status ('unknown'/'success'/'failed'), request_hash, response_json, created_at`.

### 4.3 Ödemeler
Bugün ödemeler `retail_sales.snapshot_json.payments` içinde [Var]. Rapor ve ÖKC için ayrı bir tabloya da yazılır:

**`pos_payments`** [Ekle]: `id, tenant_id, sale_id, method ('cash'/'card'/'on_account'), amount_cents, card_last4 (yalnız ÖKC/POS döndürürse), terminal_ref, created_at`.
- **Kart numarası, son kullanma tarihi veya güvenlik kodu asla saklanmaz.**

### 4.4 İndeksler
- `pos_sale_meta(client_uuid)` tekil.
- `retail_sales(tenant_id, business_date, warehouse_id)` [Var].
- `pos_payments(tenant_id, sale_id)`.
- `sync_outbox(tenant_id, sent_at, seq)`.
- `okc_operations(tenant_id, status, created_at)`.

### 4.5 Silinemez kayıt
- Satış, iade, nakit hareketi ve vardiya kapanışı **güncellenmez, silinmez**. Düzeltme her zaman yeni bir kayıtla yapılır (iade, ters hareket).
- SQLite'ta güncelleme/silme engeli tetikleyicileri `retail_*` için zaten var [Var]. MySQL'de uygulama düzeyinde engel var; bütünlük `audit_seals` ile doğrulanır [Var].
- Eşitleme kaydı, bulutta gönderilen veri özetini (`payload_hash`) saklar. Mağaza ile bulut arasındaki fark bu özetle bulunur.

---

## 5. Stok entegrasyonu
```
Satış kaydı (tek işlem)
 ├─ kalem başına: stok kontrol → lot seçimi (FEFO; SKT geçmiş lot satılmaz) [Var]
 ├─ stock_records düş, stock_movements 'outbound' yaz [Var]
 ├─ maliyet fotoğrafı (lot maliyetiyle) [Var]
 └─ outbox'a 'sale' + 'stock_movement' kaydı [Ekle]
Sonra (arka planda)
 ├─ kritik stok kuralı → uyarı → (ayarlıysa) e-posta/SMS [Var]
 ├─ sipariş önerisi (talep tahmini) → tedarikçi başına taslak [Var]
 └─ miat yaklaşan lot uyarısı [Var]
```
- **Lot seçimi:** En yakın son kullanma tarihli lot önce satılır; tarihi geçmiş lot kasada reddedilir [Var]. İade aynı lota geri döner; hasarlı iade ayrı durumda tutulur [Var].
- **Kasa stoğu ile sunucu stoğunun uzlaştırılması [Ekle]:**
  1. Mağaza sunucusu her gece ürün ve depo başına "stok özeti + hareket toplamı" gönderir.
  2. Bulut, kendi hareket toplamıyla karşılaştırır.
  3. Fark varsa "uzlaşmazlık" raporu açılır; kendiliğinden düzeltme yapılmaz.
  4. Sayımla kapatılır.
- **Kural:** Stoğu yalnız hareketler değiştirir; doğrudan "miktarı şu yap" eşitlemesi yoktur.

---

## 6. YN ÖKC entegrasyonu
**Önce dürüst sınır:** ÖKC üreticilerinin entegrasyon belgelerinin çoğu yalnız iş ortaklarına açık. Doğrulayabildiğim tek kaynak Token'ın herkese açık X Connect Cloud belgesi ve Postman koleksiyonu. Başka marka, model veya API için bilgi uydurmuyorum.

### 6.1 Doğrulananlar ve doğrulanmayanlar
| Konu | Durum |
|---|---|
| Token X Connect Cloud: sepet gönderme, sonuç bildirimi (`BASKET_COMPLETED`), fiş no / Z no dönüşü | **Belgeden okundu, kodda adaptör var [Var]**, gerçek cihazla denenmedi. Test erişimi Token'dan bekleniyor. |
| Token bulut üzerinden iade/iptal | Belgede yok. Adaptör iade/iptali reddediyor; cihazdan yapılmalı [Var]. |
| Bilgisayar–ÖKC kablolu bağlantı (GMP-3 protokolü, üretici kütüphanesi) | Varlığını kamuya açık kaynaklarda gördüm; ayrıntılar üreticiden alınmalı **[DOĞRULA]**. |
| Diğer markalar (Beko, Hugin, Profilo, Ingenico vb.) | **Bilmiyorum.** Her biri için üretici entegrasyon ekibine başvurulmalı. |
| YN ÖKC zorunluluğu, muafiyetler, VUK 593 (ÖKC'den e-belge, bilgi fişinin kaldırılması) | **[DOĞRULA]**: GİB resmî metni ve mali müşavir. |

### 6.2 Akış (Token Cloud örneği, belgeye dayalı) [Var + Ekle]
1. Satış Veniux'ta kaydedilir; `okc_status='pending'`.
2. Sepet ÖKC'ye gider. UUID, sepet kimliğidir; aynı sepet iki kez ödenmez.
3. Müşteri ÖKC'de öder (nakit veya kartlı ÖKC'de kart).
4. ÖKC sonucu bildirir; `okc_receipt_no` ve `okc_z_no` yazılır, `okc_status='printed'`.
5. **Sonuç gelmezse:** Satış "fiş bekliyor" listesinde kalır. Kasiyer ÖKC ekranına bakıp "basıldı / basılmadı" seçer, yönetici onaylar. **Asla otomatik yeniden gönderilmez**; aksi halde çift fiş riski doğar.

### 6.3 Banka POS'u
| Durum | Akış |
|---|---|
| **POS ÖKC'nin içinde** (kartlı ÖKC) | Kart ödemesi ÖKC'de yapılır; sonuç ÖKC bildirimiyle gelir. Veniux kart bilgisini görmez. Kasada en temiz akış bu. |
| **POS ÖKC'den ayrı** | Kasiyer tutarı POS'ta çeker, onay fişini görür, Veniux'ta "kart" seçer. POS ile ÖKC arasındaki bağlantı mevzuat gereği kablolu olmalı **[DOĞRULA]**. Veniux bu bağlantıya karışmaz. Uzlaştırma, gün sonunda POS raporu ile Veniux kart toplamının karşılaştırılmasıyla yapılır [Ekle]. |

### 6.4 İade ve iptal belgeleri
- ÖKC'de iade ve iptalin nasıl belgelendiği (iade faturası, gider pusulası, ÖKC iptal fişi) **mevzuat ve cihaz konusu [DOĞRULA]**.
- Veniux tarafında: iade ve iptal kendi kaydını tutar [Var]. ÖKC belge numarası alanı `okc_operations` tablosunda durur. Cihaz bulut üzerinden iadeyi desteklemiyorsa ekranda "ÖKC'de iade belgesini düzenleyin" yönlendirmesi çıkar.

### 6.5 ÖKC'siz (muaf) müşteriler
- **Ayar:** Şube başına "ÖKC kullanımı: zorunlu / kullanılmıyor (muafiyet beyanı)". Muafiyeti **müşteri beyan eder** ve tarih ile beyan eden kişi işlem kaydına yazılır. Veniux muafiyetin doğru olup olmadığına karar vermez.
- **Muaf akış:** Satış `okc_status='not_required'` olur. Belgeleme ihtiyacına göre e-Arşiv fatura (bölüm 9, 6. aşama) ya da bilgi fişi.
- Bilgi fişinin geçerliliği VUK 593 ile değişmiş olabilir **[DOĞRULA]**.
- **Zorunlu şubede ÖKC bağlı değilse:** Vardiya açılabilir, ama her satış "fiş bekliyor" olarak birikir ve kasada kırmızı uyarı çıkar. Satışın tamamen durdurulup durdurulmayacağı **mali müşavir kararıdır**; ayar olarak sunulur, varsayılan "uyar ve biriktir".

**Nereden öğrenilir:**
- Token entegrasyon ekibi (başvuru yapıldı).
- Diğer markaların bayi ve entegrasyon ekipleri.
- GİB sitesindeki YN ÖKC teknik kılavuzları ve onaylı cihaz listesi.
- Mali müşavir.

---

## 7. Yetki ve güvenlik
### 7.1 Rol matrisi
| İşlem | Kasiyer | Kasa sorumlusu (müdür) | Yönetici |
|---|---|---|---|
| Satış, bekletme, fiyat sorgu | ✓ | ✓ | ✓ |
| İndirim / fiyat değişikliği | Yetki verilirse [Var] | ✓ | ✓ |
| İade / iptal | Yetki verilirse; yalnız kendi satışı [Var] | ✓ | ✓ |
| Nakit giriş/çıkış | Yetki verilirse [Var] | ✓ | ✓ |
| Vardiya açma/kapama | Yetki verilirse [Var] | ✓ | ✓ |
| Vardiya farkı sınırı aşımı onayı | — | ✓ [Ekle] | ✓ |
| Veresiye satış | — | ✓ [Var] | ✓ |
| Acil mod sınırını aşma | — | ✓ (kodla) [Ekle] | ✓ |
| "Fiş bekliyor" kaydını kapatma | — | ✓ [Ekle] | ✓ |
| Cihaz eşleştirme/kaldırma, kasa tanımı | — | — | ✓ |
| Kampanya, sadakat, raporlar | — | ✓ (rapor: paket) | ✓ |

- **Kasiyer adı:** Mevcut "Kasiyer" rolü [Var]. "Kasa sorumlusu" ayrı bir rol olarak eklenmez; şube kısıtlı **müdür** rolüdür [Var].
- **Onay gerektiren işlemler [Ekle]:** Kasiyer ekranında yöneticinin kendi PIN'ini girmesiyle tek seferlik onay. Onaylayan kişi işlem kaydına yazılır. PIN, şifre değildir; kısa ömürlüdür ve yalnız kasa onayında geçerlidir.
- **Cihaz yetkilendirme:**
  - Eşleştirme QR ile yapılır [Var]; cihaz anahtarı ve paket cihaz sınırı denetlenir [Var].
  - Kaldırılan cihazın kuyruktaki kayıtları "kaldırılmış cihaz" olarak işaretlenir. Kayıtlar otomatik reddedilmez, çünkü para alınmış olabilir; yönetici inceler [Ekle].
- **Kasiyer ekranındaki menüler:** Satış, bekletilenler, fiyat sorgu, satış/iade (yetkiye göre), vardiya (yetkiye göre), kilitle. Ayarlar, raporlar ve ürün düzenleme **görünmez**.
- **İşlem kaydı:** Satış, iade, iptal, nakit, vardiya, indirim, fiyat değişikliği, onaylar, acil mod girişi ve çıkışı, ÖKC durum değişiklikleri. Hepsi değiştirildiği anlaşılır zincirde tutulur [Var].
- **KVKK saklama süreleri (öneri; mali müşavir ve hukukçuyla doğrula):**
  - Satış ve fatura kayıtları: VUK saklama süresi, genelde 5 yıl **[DOĞRULA]**. Veniux bunları otomatik silmez.
  - İşlem kaydı: ayarlanabilir; varsayılan 2 yıl [Var].
  - Sadakat kartı (ad, telefon): Müşteri silinmesini isterse kart anonimleştirilir, satış kaydı kalır [Ekle].
  - Kart verisi: saklanmaz.

---

## 8. Raporlar
| Rapor | Durum | Paket |
|---|---|---|
| Anlık satış (bugün, şu ana kadar) | Gün sonu raporu var [Var]; canlı pano [Ekle] | Başlangıç |
| Kasa ve kasiyer bazlı satış | Kasiyer [Var], kasa kırılımı [Ekle] | İşletme |
| İade/iptal oranı | [Ekle] (veri var) | İşletme |
| Vardiya farkı | Vardiya kapanışında var [Var]; geçmiş listesi [Ekle] | Başlangıç |
| Saat bazlı yoğunluk | [Var] | İşletme |
| Kâr/zarar (brüt) | [Var] | İşletme |
| Kasa satışı – stok çıkışı uyuşmazlığı | [Ekle] (bölüm 5 uzlaştırması) | Başlangıç (güvenlik için herkese) |
| ÖKC – Veniux uyuşmazlığı (fiş bekleyen, Z farkı) | [Ekle] | Başlangıç (yasal risk; herkese) |
| Acil mod satışları ve eksi stok | [Ekle] | Başlangıç |

**İlke:** Kayıp, uyuşmazlık ve yasal risk raporları her pakette olur. Analiz raporları İşletme ve üstünde olur; bu, mevcut paket kurgusuyla uyumlu.

---

## 9. Geliştirme planı
**Varsayım:** 1 geliştirici, haftada ~20 saat. Süreler bu varsayıma göre; tahmindir.

| Aşama | Görevler | Süre | Bağımlılık | Bitti sayılma |
|---|---|---|---|---|
| **0. Temel kasa** | **[Var]** satış, barkod, tartılı ürün, ödeme, fiş, stok FEFO | — | — | Zaten canlıda |
| **1. Vardiya ve iade** | **[Var]** Eklenecekler: vardiya farkı onay sınırı, geçmiş vardiya listesi, kasa bazlı kırılım | 1 hafta | 0 | Fark sınırı aşan kapanış onaysız kapanamıyor; testler |
| **2. Cihaz ve fiş numarası** | `pos_devices`, `pos_receipt_counters`, `pos_sale_meta`, cihaz bazlı numara, eşleştirmede cihaz kaydı | 1-2 hafta | 1 | Her satışın kasa-gün numarası boşluksuz; iki kasada eşzamanlı satış testi |
| **3. Mağaza→bulut eşitleme** | `sync_outbox`, gönderici (toplu, sıralı, yeniden deneme), bulut alıcısı (tekilleştirme), durum göstergesi, gece uzlaştırması | 3-4 hafta | 2 | 10.000 kayıt kesintili ağla gönderilip bulutta bire bir aynı; aynı paket 3 kez gönderilince tek kayıt |
| **4. Acil durum modu** | Android cihaz kuyruğu (şifreli), önbellek fiyat/kampanya, sınırlar, mağaza sunucusuna geri gönderim, eksi stok akışı | 2-3 hafta | 3 | Ağ kesik 50 satış → geri gelince hepsi tek kez, doğru sırada; sınır dolunca satış kapanıyor |
| **5. Kart ve kampanya** | Kampanya [Var]; ayrı POS uzlaştırma raporu; ödeme tablosu `pos_payments` | 1-2 hafta | 2 | POS gün sonu toplamı ile Veniux kart toplamı karşılaştırılıyor |
| **6. YN ÖKC** | Token adaptörünü test ortamında doğrulama, "fiş bekliyor" akışı, ÖKC uyuşmazlık raporu; ikinci marka ancak belge gelince | 3-6 hafta (**ÖKC firmasının test erişimine bağlı**) | 2; Token test erişimi | Gerçek test cihazında 100 satış, 10 iptal senaryosu; çift fiş yok; sonuç gelmeyen satış elle kapatılabiliyor |
| **7. e-Arşiv / e-Fatura** | Uyumsoft entegrasyonu [Var, canlı kapalı]; canlı hesapla test; muaf akış | 2-3 hafta | Sağlayıcı hesabı | Test ortamında belge gönderilip sorgulanıyor; belirsiz sonuç yeniden gönderilmiyor |
| **8. Terazi ve çoklu şube** | Etiket terazisi [Var]; canlı terazi (seri/TCP) marka bazlı; şube raporu [Var]; bulutta çok şube panosu | 2-4 hafta | 3 | Seçilen bir terazi modelinde canlı ağırlık okunuyor; 3 şube tek panoda |

**Toplam (aşama 1-8):** yaklaşık 15-25 hafta. En büyük belirsizlik ÖKC erişimi.
**MVP önerisi:** 1 + 2 + 3 + 4 (8-10 hafta) ve ÖKC'siz muaf müşterilerle pilot. ÖKC paralel ilerler.

---

## 10. Pilot test planı (gerçek market)
**Pilot:** 1 market, 2 kasa (biri mağaza sunucusu bilgisayarı, biri Android), 4 hafta.
- İlk hafta mevcut sistemle paralel çalışılır; Veniux "gölge kasa" olur.

**Senaryolar:**
| Senaryo | Beklenen |
|---|---|
| İnterneti 2 saat kesmek | Satış sürer; kuyruk büyür; internet gelince bulut eşitlenir; fark 0 |
| Eşitleme sırasında interneti kesmek (yarım gönderim) | Aynı kayıtlar yeniden gönderilir; bulutta çift kayıt yok |
| İki kasada aynı son ürünü aynı anda satmak | Biri satar, diğeri "stok yetersiz" alır; eksi stok yok |
| Android kasada mağaza sunucusunu kapatmak | Acil mod; 20 satış; sunucu açılınca hepsi tek kez geliyor |
| ÖKC bağlantısını koparmak | Satış "fiş bekliyor"; çift fiş yok; elle kapatma çalışıyor |
| Satış ortasında elektrik kesintisi | Yarım satış yok: ya tamamen kayıtlı ya hiç; sepet geri yükleniyor |
| Yanlış/okunamayan barkod | Reddediliyor; ürün bul ekranı |
| Kısmi iade, tam iade, iptal | Stok lota dönüyor; nakit/kart payı doğru; ÖKC yönlendirmesi |

**Metrikler:**
- Okutmadan ödemeye ortalama süre (hedef: tek kalem < 3 sn, mevcut sistemden yavaş değil).
- Eşitleme gecikmesi (hedef: çevrimiçi < 2 dk).
- Çift kayıt sayısı (hedef: 0).
- Stok uzlaşmazlığı (hedef: 0 açıklanmamış fark).
- Fiş bekleyen satış oranı.
- Kasiyer şikâyetleri.

**Başarılı sayılma:** 4 hafta boyunca veri kaybı ve çift satış olmaması, gece uzlaştırmalarında açıklanmamış fark çıkmaması, kasiyerin mevcut sisteme dönme talebinin olmaması ve marketin ücretli devam etmeyi kabul etmesi.

---

## 11. Riskler
| Risk | Önlem |
|---|---|
| Veri kaybı | Tek işlemde kayıt; otomatik yedek + ikinci konum + şifreli dış yedek [Var]; acil mod kuyruğu şifreli ve sıralı; eşitleme özet karşılaştırması |
| Çift satış | UUID tekilleştirme [Var]; eşitlemede (şube, cihaz, sıra) tekilliği; ÖKC'ye otomatik yeniden gönderim yok |
| Yasal uyumsuzluk | ÖKC zorunlu şubede uyarı ve "fiş bekliyor" listesi; muafiyet beyanı müşteride; mevzuat [DOĞRULA] ve mali müşavir onayı olmadan "yasal fiş" iddiası yok |
| ÖKC entegrasyon gecikmesi | MVP'yi ÖKC'siz (muaf) müşterilerle başlatmak; adaptör katmanı hazır [Var]; marka bağımlılığını tek adaptöre sınırlamak |
| Yoğun saatte yavaşlık | Kampanya teklifi zaman aşımında kampanyasız devam; katalog önbelleği [Var]; yerel ağda mağaza sunucusu; pilotta süre ölçümü |
| Mağaza sunucusu bilgisayarının arızası | Acil mod; günlük yedekten başka bilgisayara geri yükleme [Var]; kurtarma kodu [Var] |
| Saat kayması (cihaz saati yanlış) | Sunucu saati asıl kabul edilir; cihaz saati ayrı saklanır; büyük fark uyarı verir |

---

## 12. Müşteriye anlatım (yalnız bugün doğru olanlar)
**Site metni:**
> Veniux kasası barkodla satar, stoğu aynı anda düşer, son kullanma tarihi en yakın ürünü önce satar. Masaüstüne kurulan sürüm internet kesildiğinde de satışa devam eder; kampanya, sadakat kartı ve veresiye kasanın içindedir. Yazarkasa (ÖKC) entegrasyonu pilot aşamasındadır; yasal fiş bugün ÖKC'nizden ayrıca kesilir.

**SSS: İnternet kesilirse ne olur?**
> Bilgisayara kurulan (yerel) Veniux'ta satış, iade ve vardiya internet olmadan da çalışır; veriler o bilgisayarda tutulur ve yedeklenir. Lisans 72 saate kadar internetsiz geçerlidir. Bulut sürümünde satış için internet gerekir; bağlantı satış sırasında koparsa sepet saklanır ve aynı satış iki kez kaydedilmeden yeniden denenir. Mağaza ile bulut arasında otomatik eşitleme henüz yoktur; geliştirme planımızdadır.

(Acil durum modu, cihaz fiş numarası ve mağaza–bulut eşitlemesi geliştirilene kadar sitede anlatılmamalı.)
