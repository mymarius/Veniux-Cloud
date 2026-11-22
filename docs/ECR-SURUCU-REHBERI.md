# ÖKC (yazarkasa) marka sürücüsü ekleme rehberi

22 Kasım 2026. **Şu an hiçbir marka için gerçek sürücü yoktur ve hiçbir sürücü "hazır/doğrulanmış" değildir.** Simülatör dışındaki markalar (`ingenico`, `beko`, `hugin`, `pavo`, `odeal`) "henüz kurulu değil" hatası verir. Bu belge, marka bilgisi ve test cihazı geldiğinde sürücünün nasıl, hangi sırayla ve hangi kabul ölçütleriyle ekleneceğini anlatır.

## 1. Mevcut yapı

```
Satış (kasa)  →  ecr_jobs (bekliyor)  →  ecrService.processJob  →  drivers[marka].openSale(device, satış, ctx)
                                                                       │
                                                      (isteğe bağlı)  └→ findSale(device, satış, ctx)
```

- Satış **asla** cihaz yüzünden engellenmez; cihaz yoksa ya da hata verirse iş `failed` kalır, gün sonunda "bekleyen mali fiş" sayılır (`blocking`).
- `backend/src/services/ecrService.js`: sürücü kayıt defteri (`drivers`, `registerDriver`, `driverStatus`), iş akışı (sahiplenme, zaman aşımı, belirsiz sonuç).
- `backend/src/services/ecr/` (bu turda eklendi):
  - `errors.js` — `EcrError(code, mesaj, {retryable, uncertain})`; kodlar `OFFLINE`, `TIMEOUT`, `REJECTED`, `PROTOCOL`, `NOT_INSTALLED`, `UNSUPPORTED`.
  - `frames.js` — ortak zarf: `STX veri ETX LRC`, tek bayt `ACK`/`NAK`. Yalnız zarftır, hiçbir markanın komutu değildir.
  - `transport.js` — `TcpTransport` (ağ), `SerialTransport` (COM; `serialport` paketi gerekir, sunucu paketinde yoksa net hata verir), `RecordedTransport` (kayıtlı çerçeve oynatıcı).
  - `framedDriver.js` — `createFramedDriver(protocol, {transportFactory})`: bağlan → gönder → ACK (NAK'ta sınırlı tekrar) → yanıt → ACK → kapat. Marka protokolü `protocol` nesnesiyle takılır.

### Sürücü sözleşmesi
```js
driver.openSale(device, sale, ctx) -> { fiscal_receipt_no, z_no }   // hata: EcrError fırlatır
driver.findSale?(device, sale, ctx) -> { fiscal_receipt_no, z_no } | null   // belirsiz satışı cihazdan sorar (varsa)
// sale = { receipt_no, total_cents, payments[], lines[{ name, quantity, net_cents }] }
// ctx  = { idempotency_key: 'veniux-sale-<satış no>', job_id, sale_id, attempt }
```

### Sağlamlaştırma (çift mali fiş riskine karşı)
| Konu | Davranış |
|---|---|
| Zaman aşımı | Her cihaz çağrısı en çok `VENIUX_ECR_TIMEOUT_MS` (varsayılan 20 sn, en az 1 sn) bekler; kasa akışı takılmaz. |
| Aynı anda iki işlem | İş `attempts` üzerinde iyimser kilitle sahiplenilir; ikincisi `busy` döner, cihaza yalnız bir kez yazılır. |
| Süreç yarıda kesilirse | Sahiplenirken iş `BELİRSİZ:` işaretlenir; başarıyla bitince temizlenir. Çökerse iş belirsiz kalır, kendiliğinden yeniden yazılmaz. |
| Belirsiz sonuç (gönderildi ama yanıt yok) | `uncertain: true` → `BELİRSİZ:` ön ekiyle `failed`. `processPending` bunları atlar. Sürücü `findSale` destekliyorsa önce cihaza sorulur; desteklemiyorsa operatör fişi cihazdan kontrol edip `POST /api/ecr/jobs/:id/process` gövdesinde `{ "confirm_reprint": true }` ile onaylamalıdır. |
| Bağlantı kurulamadı | `OFFLINE`, `uncertain: false`: hiçbir şey gönderilmedi, güvenle yeniden denenir. |
| Cihaz açık red (kâğıt, mali bellek) | `REJECTED`; `retryable:false` sürücü tarafından belirtilebilir. |
| Yeniden deneme | İş düzeyinde en çok 5 deneme (`MAX_ATTEMPTS`); çerçeve düzeyinde yalnız NAK için sınırlı tekrar. |
| Kimlik anahtarı | Aynı satış için her denemede aynı `ctx.idempotency_key`; cihaz/protokol destekliyorsa kendi tarafında tekilleştirmek için kullanılmalıdır. |

## 2. Marka sürücüsü ekleme adımları

1. **Bilgileri topla** (aşağıdaki liste). Bunlar olmadan kod yazılmaz; tahminle yazılan protokol mali cihazda yanlış fiş demektir.
2. **Protokolü belgeden `protocol` nesnesine çevir** (`backend/src/services/ecr/drivers/<marka>.js`): `encodeSale`, `decodeSaleResponse`, mümkünse `encodeStatusQuery`/`decodeStatusResponse`. Zarf farklıysa (STX/ETX/LRC değilse) `frames.js` yerine markaya özel codec yaz.
3. **Kayıtlı çerçeve testi yaz** (`RecordedTransport`): belgedeki örnek alışverişi ya da cihazdan yakalanan gerçek bayt dökümünü `script` olarak ver. Test, sürücünün kayıtla **birebir** aynı baytları ürettiğini ve yanıtı doğru çözdüğünü kanıtlar. (`backend/tests/ecrDrivers.test.js` oyuncak protokolle örnek verir.)
4. **Cihaz bağlantı ayarını sakla.** `ecr_devices` tablosunda bağlantı adresi/port/COM adı sütunu **yok** (`transport.js` `device.config` bekler). İlk gerçek sürücüyle birlikte yeni bir şema adımı gerekir (ör. `config` metin sütunu; eklemeli yükseltme kuralı: yalnız yeni sütun/tablo, MySQL manifesti `032`'den sonraki sürüme) ve cihaz kayıt ekranına alanlar eklenmelidir. Bu iş henüz yapılmadı.
5. **Takma:** `ecrService.registerDriver('<marka>', createFramedDriver(protocol, { transportFactory: createTransport }))` — sunucu açılışında ya da masaüstü alt sürecinde. Seri (COM) cihaz yerel makinededir; bulut sunucusu COM'a erişemez, bu yüzden yazarkasa işini yapan süreç **masaüstü/yerel köprü** olmalıdır (bkz. `docs/MIMARI-SENKRON-OKC.md`).
6. **Gerçek cihaz kabulü** (aşağıda) geçilmeden `VERIFIED_BRANDS` listesine marka **eklenmez**. Takılan sürücü `driverStatus` = `unverified` görünür; arayüzde "hazır" denmez.

## 3. Gereken bilgiler (marka başına)

| # | Bilgi | Neden |
|---|---|---|
| 1 | Marka, model, yazılım (firmware) sürümü | Protokol sürüme göre değişir |
| 2 | Mali onaylı entegrasyon yolu: GMP3 / dijital sertifika / üretici SDK'sı (DLL, JAR, REST) | Türkiye'de ÖKC entegrasyonu üretici ve TÜBİTAK/GİB onaylı arayüzle yapılır; protokolü tahmin edemeyiz |
| 3 | Protokol belgesi (komut listesi, alan düzeni, hata kodları, zaman aşımları) ve **örnek bayt alışverişleri** | Kayıtlı çerçeve testinin kaynağı |
| 4 | Bağlantı türü ve ayarlar: COM (baud, parite, bayt), USB-seri, TCP (IP/port), eşleştirme/anahtar | Taşıyıcı seçimi |
| 5 | Satış akışı: fiş açma, satır ekleme (KDV grubu eşlemesi), ödeme türleri (nakit, kart, yemek kartı), fiş kapatma, iptal/iade, Z raporu | `sale` alanlarının eşlemesi |
| 6 | KDV oranı → cihaz departman/KDV grubu eşlemesi | Yanlış eşleme yanlış KDV demektir |
| 7 | Belirsiz durum çözümü: "son fişi sorgula" komutu ve fiş numarası/Z no okuma | `findSale` için; yoksa operatör onayı kalır |
| 8 | **Test cihazı** (mali olmayan eğitim/test modu varsa) ve geliştirici desteği/sertifikası | Gerçek kabul bu olmadan yapılamaz |
| 9 | Üretici sözleşmesi/NDA, SDK lisansı ve dağıtım izni | Belgeyi/SDK'yı depoya koyabilmek için |
| 10 | Bu marka için pilot işletme (market/kırtasiye) | Pide restoranı yalnız banka POS'u kullanıyor |

## 4. Gerçek cihaz kabul listesi (hepsi geçmeden "doğrulandı" denmez)

- [ ] Nakit, kart ve karma ödemeli satış: cihazdaki fiş tutarı Veniux satışıyla aynı; KDV kırılımı doğru.
- [ ] Mali fiş numarası ve Z numarası Veniux'ta satış kaydına yazıldı (`pos_sale_meta.okc_*`).
- [ ] İndirimli ve çok satırlı satış; uzun ürün adı; Türkçe karakterler.
- [ ] Kâğıt bitti / kapak açık / mali bellek dolu: `REJECTED`, satış engellenmedi, iş `failed`.
- [ ] Kablo çek-tak ve cihazı kapat-aç: `OFFLINE`; bağlantı gelince **tek** fiş yazıldı.
- [ ] Yazdırma sırasında bağlantı kopması (belirsiz): `BELİRSİZ` işaretlendi; cihazdan fiş var/yok kontrolü doğru; `findSale` veya operatör onayıyla **çift fiş olmadı**.
- [ ] Aynı satışın aynı anda iki işlemle gönderilmesi: tek fiş.
- [ ] İptal/iade fişi (varsa) ve Z raporu sonrası gün sonu.
- [ ] En az 50 ardışık satışta sürücünün bellek/bağlantı sızıntısı yok; uygulama yeniden başlayınca bekleyen işler devam ediyor.
- [ ] Marka/model, firmware, sürücü sürümü, bağlantı, test verisi, beklenen/gerçek sonuç ve fotoğraf kaydı (`docs/hardware/REAL_DEVICE_TEST_PLAN.md` biçimi).

## 5. Kod tarafında yapılmayanlar
- Hiçbir marka protokolü yazılmadı; `framedDriver` yalnız iskelettir.
- Cihaz bağlantı ayarı sütunu ve cihaz ekranı yok (bkz. adım 4).
- Masaüstü alt süreci (yerel COM erişimi) ve kasada "mali fiş bekliyor" rozeti yok.
- `docs/MIMARI-SENKRON-OKC.md` §6'daki "yok" listesi hâlâ geçerlidir.
