# Barkod / ürün arama katmanı — 22 Kasım 2026

Yerel commit; canlıya alınmadı, gerçek cihazda denenmedi. Şema değişikliği YOK (SQLite migrasyonu da MySQL manifesti de eklenmedi; `SHIPPABLE_MYSQL_SCHEMA` = `032-fx-auto-tasks` aynen geçerli).

## 1. Dökümü: ne vardı, ne eksikti

| Alan | Var olan | Eksik (bu işten önce) |
|---|---|---|
| Hızlı ürün girişi (`RetailQuickAdd`) | Barkod okut/yaz/kamera → `GET /retail/lookup` (ürün barkodu, sonra koli/paket barkodu `product_uoms`). Yoksa elle form (ad, alış/satış, birim), `POST /retail/receive` (Idempotency-Key, tam sayı miktar). Koli barkodu çarpanla temel birime çevrilir | Barkod kendi kataloğunda yoksa hiçbir yardım yok; ad/marka/gramaj tamamen elle |
| Sayım (`WMSCycleCount`) | Kör sayım, taslak (sessionStorage), hızlı sayım (raf okut + ürün okut = +1), fark önizleme, yönetici onayı + gerekçe, hareket olduysa yeniden kontrol | Sayılmayan satırların görünürlüğü yok; onay bekleyenler için toplu özet yok; koli barkodu okutunca "listede yok" hatası (birim dönüşümü sayımda yoktu) |
| Birimler | `products.unit` (adet, paket, kutu, kg, litre, metre), `product_uoms` (barkod + `conversion_factor`), kasada tartı şeması | Sayımda dönüşüm yok |
| `shared_catalog` | Yalnızca plan bayrağı (`shared/planMatrix.mjs`, "Hazır barkodlu ürün kataloğu" etiketi, Pro paket). Arkasında **veri veya kod yok**; paylaşılan/ortak ürün tablosu mevcut değil | Gerçek bir ortak katalog. Bu işte yapılmadı (yeni tablo = şema kapısı); Pro paketin vaadi hâlâ boş. İleride işletmelerin onaylı kayıtlarından türetilen merkezi tablo düşünülebilir |
| Dış katalog | — | Yoktu |

## 2. Ürün arama katmanı

`GET /api/retail/lookup/suggest?barcode=…` (admin/manager) — `backend/src/services/barcodeLookupService.js`

Sıra: **(1) kendi katalog** (ürün ve koli barkodu, baştaki sıfırlı/sıfırsız GTIN eşdeğerleri; işletmeler arası görünmez) → **(2) Open Food Facts** (yalnız 8/12/13/14 haneli sayısal barkod) → **(3) elle giriş** (`source:'none'`, `manual:true`, nedeni `lookup_state`: missing / limited / error / skipped).

- **Önbellek:** sunucu belleğinde, bulunanlar 7 gün, bulunamayanlar 6 saat, en çok 5000 kayıt; eşzamanlı aynı barkod tek istek. Ağ/sunucu hataları önbelleğe yazılmaz. Sunucu yeniden başlarsa önbellek boşalır (bilinçli: tablo gerektirmesin).
- **Sınır:** OFF IP başına ürün okumada dakikada 100, aramada 10 izin verir; biz sunucu başına **dakikada 15** (işletme başına 10) ile sınırlıyız. Aşılınca istek gitmez, kullanıcıya "bir dakika sonra tekrar deneyin veya elle girin" denir.
- **Gizlilik:** OFF'a yalnız barkod gider; kullanıcı/işletme bilgisi, anahtar yok. User-Agent genel ürün adıdır. Ücretli API (Barcode Lookup vb.) yok, anahtar yok. Ortam: `VENIUX_OFF_DISABLED=1` dış sorguyu kapatır, `VENIUX_OFF_URL` adresi değiştirir.
- **ODbL atfı:** yanıtta `attribution` (Open Food Facts, ODbL 1.0, görseller CC BY-SA, ürün sayfası bağlantısı); formda görünür bağlantı. Görsel sunucuya indirilmez, yalnız `openfoodfacts.org/.net` https adresi önerilir (CSP `img-src https:` zaten izinli).
- **Onaysız kayıt yok:** `suggest` hiçbir şey yazmaz. Alanlar (ad = marka + ad + gramaj, marka, gramaj, görsel) forma ÖNERİ olarak dolar; fiyatlar boş kalır (zorunlu), kayıt yine kullanıcının "Oluştur ve stoğa ekle" ile yaptığı `/retail/receive` çağrısıdır. Sağlama basamağı tutmayan barkod için uyarı çıkar.
- Önyüz: `RetailQuickAdd.jsx` (sarı "Open Food Facts önerisi — kontrol edip onaylayın" kartı).

## 3. Sayım

- **İstisna ile sayım** (`shared/countSummary.mjs` → `exceptionReport`): hızlı sayımda "N satır sayıldı, M satır sayılmadı" ve sayılmayanları listeleme. Sayılmayan = sıfır DEĞİL; onaya gitmez, stok değişmez. Yalnız sayılan satırlar gönderilir (önceki davranış aynı, artık açıkça görünür).
- **Onay özeti** (`approvalSummary`): onay bekleyen sayımlar için satır / fark yok / fazla (+adet) / eksik (−adet) / net / en büyük fark.
- **Birim dönüşümü** (`applyScan(…, {productId, factor})`): listede olmayan kod okutulunca `GET /retail/lookup` ile koli/paket barkodu çözülür; 1 koli = N temel birim olarak sayaç N artar, durum satırında "(koli ×24)" görünür. Not: bu çözümleme yalnız `module_type='NORMAL'` ürünlerde çalışır (retail lookup sınırı); WMS/depo ürünlerinde koli barkodu hâlâ "listede yok" der.
- Sınır: stok miktarı onaya `preview` ile gider, sunucu mantığı değişmedi.

## 4. Kapsam ölçümü

`tools/barkod-olcum/kapsam-olc.mjs` — kullanıcı 30–50 gerçek barkodu verene kadar ÇALIŞTIRILMADI; sonuç yok, uydurma yok.

```powershell
Copy-Item tools\barkod-olcum\barkodlar.ornek.txt tools\barkod-olcum\barkodlar.txt   # içine rafta okuttuğunuz barkodları yazın
node tools\barkod-olcum\kapsam-olc.mjs tools\barkod-olcum\barkodlar.txt
```

Çıktı (`tools/barkod-olcum/sonuc/`): CSV + özet (bulundu, ad, marka, gramaj, görsel, Türkiye etiketi oranları). 15 istek/dk'ya uyar (50 barkod ≈ 4 dk), hatalı/geçersiz satırlar oranlara girmez, 30'dan azsa "yetersiz örnek" uyarısı basar.

## 5. Gerçek cihazda denenmesi gerekenler

1. Elde terminal/telefon kamerasıyla, kendi katalogda olmayan gerçek bir paketli ürünü okutup öneri kartının gelmesi, adın/gramajın doğruluğu, görselin yüklenmesi; internet yokken elle girişe düşmesi.
2. 15/dk sınırı: art arda 16+ yeni barkod okutunca "sınıra ulaşıldı" mesajı; bir dakika sonra yeniden çalışma.
3. Hızlı sayımda koli barkodu okutunca sayacın çarpanla artması (ürünün `product_uoms` kaydı olan bir mağaza ürünüyle) ve sayılmayanlar/onay özeti satırlarının telefon ekranında okunur olması.
4. Android WebView'da görselin (OFF https) yüklenmesi.
5. Ölçüm betiği: kullanıcının gerçek 30–50 barkoduyla; sonuca göre "OFF yeterli mi / kendi katalog gerekli mi" kararı.

## Testler
`backend/tests/barcodeLookup.test.js` (6), `shared/countScan.test.mjs` (+1), `shared/countSummary.test.mjs` (2). Frontend `vite build` temiz.
