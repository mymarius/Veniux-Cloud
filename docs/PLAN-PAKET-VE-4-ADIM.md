# Paket, fiyat ve 4 adımlı yol haritası (19 Kasım 2026, kullanıcı kararı)

Bu belge kullanıcının verdiği ürün/paket planının uygulama planıdır. Önceki "6 haftalık rakip planı" bunun Adım 1–2 kapsamına katlanır; çelişirlerse bu belge geçerlidir.

## Mevcut durumla farklar ve kabul ettiğim varsayımlar (itiraz varsa söyleyin)
1. **Veritabanı:** İstekte "SQLite + PostgreSQL" geçiyor. Mevcut sistem yerelde SQLite, bulutta MySQL. Veritabanı değiştirmek 1 Ocak hedefini riske atar; MySQL'de kalıyoruz. Mimari her ikisini de destekleyen sürüm numaralı şema mantığını (manifest) kullanmaya devam eder.
2. **Lisans altyapısı var:** İmzalı lisans, merkez lisans otoritesi, plan tablosu (şimdi USD: Starter 149, Normal WMS 299, Kurumsal 799), paket sözleşmeleri ve sektör paketleri (hırdavat, züccaciye, restoran, online mağaza ayrı satılıyor). Yeni 4+1 paket bunun üstüne eşlenir; mevcut lisanslar bozulmaz (geriye uyum).
3. **Deneme:** Bugün 14 gün, e-posta doğrulamalı, kartsız. Hedef 30 gün; bitince veri silinmeden Lite'a düşer.
4. **Birleşik perakende çekirdeği:** Hırdavat ve züccaciye ayrı satılan paketler olmaktan çıkıp Pro/İşletme çekirdeğine girer (özellik bayrağıyla açılır). Pide ve Restoran ayrı dikey kalır.
5. **Fiyatlar** (KDV dahil, sizin kararınız): Lite 0; Pro 5.490/yıl veya 599/ay; Ömür Boyu 11.490; İşletme WMS 14.900/yıl. Bunlar `shared/planMatrix.mjs` içinde durur ama **sitede ve satışta henüz yayında değil**; yayın için ayrıca onay gerekir. Sitede rakip adı geçmez.
6. **Dışa bağımlı kalemler** tek başıma başlatamayacağım şeyler: ÖKC üretici SDK/sözleşmeleri, e-Fatura entegratörü ve şirket kuruluşu, kod imzalama sertifikası, Apple hesabı ve Mac, WhatsApp Business API onayı, 3 milyonluk katalog için veri kaynağı. Bunlar için hazırlık (arayüz, sahte sağlayıcı, test) yapılır; canlıya geçiş sizin işlemlerinize bağlıdır.
7. **Altın güvenlik kuralı** zaten uygulanıyor (asistan onaysız yazmaz); yeni AI özellikleri aynı kuralla eklenir.

## 1. Sistem ve çevrimdışı eşitleme mimarisi (özet)
- Yerel: Windows masaüstü uygulaması, SQLite, her satış önce yerelde işlenir (mevcut).
- Bulut: MySQL, imzalı lisans, eşitleme kuyruğu (mevcut: çevrimdışı satış kuyruğu, çift kayıt önleme).
- ÖKC köprüsü: masaüstü uygulamasında yerel servis; satış tamamlanınca cihaza komut gider, mali fiş numarası geri yazılır. Üreticiye özel sürücüler tek arayüz (`open/sale/cancel/close`) arkasında; ilk hedef cihaz grubu için sahte sürücüyle test.
- Tam çift yönlü eşitleme (olay günlüğü + çakışma kuralı) Adım 3'te; bugünkü yön "yerel → bulut kuyruğu"dur.

## 2. Veri şeması (yeni olanlar)
Mevcut tablolar kalır. Eklenecek: `plan_assignments` (işletme, plan, başlangıç, bitiş, deneme bitişi), `entitlement_overrides` (platform sahibi istisnası), `lot_batches` zaten var (SKT/lot), `ecr_devices`/`ecr_receipts` (ÖKC), `sync_events` (Adım 3). Şema her seferinde yalnız yeni tablo ekler (güvenli yükseltme kuralı).

## 3. Paket ve özellik matrisi
`shared/planMatrix.mjs`: 4 plan + restoran eklentisi, 30 özellik bayrağı, limitler, deneme ve ömür boyu "bulut yılı bitince bulut/AI kapanır" kuralı; testli (7 test). Bulut/AI maliyeti yaratan özellikler (AI, mobil, ortak katalog, e-fatura, pazaryeri, online mağaza) yalnız etkin abonelikte açık.

## 4. Modül ve API sözleşmeleri
ÖKC, e-Fatura (mevcut sağlayıcı arayüzü + sahte sağlayıcı), pazaryeri (mevcut), AI OCR/Marj Radarı (onaylı taslak), POS ve KDS (mevcut). Her biri için sürümlü uç ve test; yeni uçlar `docs/API-SOZLESMELERI.md` altında toplanacak (Adım 1 sonunda).

## 5. Sprint planı ve kabul kriterleri
**Adım 1 (Hafta 1–2): vitrin ve paket altyapısı**
- Plan matrisi lisansa bağlanır: sunucu her istekte özelliği matristen kontrol eder; arayüz kilitli özelliği "Pro ile açılır" olarak gösterir, gizlemez.
- 30 günlük kartsız deneme + süre sonunda Lite'a düşme; veri silinmez.
- Fiyat sayfası tek kaynaktan (matris) beslenir; tutarsızlık kalmaz.
- Kabul: dört plan için uçtan uca test (özellik açık/kapalı, limit aşımı mesajı, deneme bitişi); mevcut lisanslı müşteri etkilenmez; duman testleri 0 hata.

**Adım 2 (Ay 1–3): yasal eşikler** — ÖKC köprüsü, e-Fatura canlı, kod imzalama, gerçek mağaza doğrulamaları. Kabul: sahte cihazla uçtan uca fiş; entegratörde test faturası; imzalı kurulum SmartScreen uyarısız.
**Adım 3 (Ay 4–6): platform eşitliği** — iOS, katalog, çift yönlü eşitleme, müşteri ekranı (var). Kabul: iki cihazda çakışma testi veri kaybı olmadan.
**Adım 4 (Ay 7–9): AI + WMS farkı** — Fatura OCR, Marj ve Zam Radarı, WhatsApp tedarik siparişi, kayıp şüphesi. Kabul: her AI eylemi "Onayla ve Uygula" olmadan kayıt yazmaz (test).

## Sade ekran ilkesi
Plan matrisindeki özellikler ekrana düğme olarak dökülmez; işletme türüne ve plana göre gizli gelir, ana satış ekranı sade kalır (bkz. rakip inceleme belgesi).

## Bu oturumda yapılanlar
- `shared/planMatrix.mjs` + testler (lisansa bağlı değil, canlıya etkisi yok).
- Bu plan belgesi.

## Düzeltme (19 Kasım, geç): fiyatın gerçek kaynağı paket kataloğu
Projede zaten bir paket kataloğu var (`backend/src/config/productPackages.json` + veritabanındaki katalog; aileler retail/warehouse/unified, modül ve limit sözleşmeli, fiyatı platform sahibi panelden girer, site `/api/public/prices` ile okur). `shared/planMatrix.mjs` içindeki fiyatlar bu yüzden **öneridir**, ikinci bir kaynak değildir.
- Hak hesabı artık katalog sözleşmesinin modüllerinden türetilir (wms → İşletme WMS, gelişmiş rapor/cari → Pro, yalnız stok+kasa → Lite hak kümesi); sözleşmesiz eski lisans İşletme WMS sayılır (özellik kaybı yok).
- Yeni 4 paket, onayınızla kataloğa plan olarak eklenecek (yapı uyuyor); fiyatlar o zaman panelden girilir ve site otomatik okur. Sitede eski paket adları (Başlangıç, Hırdavat, Züccaciye, Pide) o zamana kadar kalır.
