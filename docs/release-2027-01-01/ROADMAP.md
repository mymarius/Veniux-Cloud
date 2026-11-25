# Yol haritası — 25 Kasım → 31 Aralık 2026

Kurallar: çalışan sistemi yeniden yazma, production verisine dokunma, gerçek ödeme/e-belge/pazaryeri/ÖKC işlemi yapma. Sıra, `AUDIT.md` risklerine göre ayarlandı (çevrimdışı kasa tarayıcı katmanı ve CI açığı önce).

| Sprint | Odak | Yapılacak (kodlanabilir) | Dışa bağlı (BLOCKERS) |
|---|---|---|---|
| 1 — Denetim + kritik | CI, lint, bağımlılık, kritik regresyon | `ci.yml` (eklendi), tam backend/frontend test çalıştırma, SKU kiracı benzersizliği için taşıma planı, ölü kod temizliği planı | — |
| 2 — Çevrimdışı + eşitleme | Tarayıcı çevrimdışı kasa E2E, kuyruk kalıcılığı, yük | Playwright ile service worker/IndexedDB testi; 1.000 ve 10.000 satırlık eşitleme yük testi ve ölçüm raporu; çevrimdışı indirim/iade/veresiye/sadakat güvenlik analizi | Gerçek mağazada uzun süre |
| 3 — Donanım | Barkod sağlayıcı sözleşme testleri, terazi, DataWedge | Open Food Facts sözleşme testi (resmî şema), Barcode Lookup sözleşmesi, emülatörde sahte intent, Teşhis ekranı | Gerçek terazi, Zebra, anahtar |
| 4 — Pazaryerleri | Trendyol belge uyumu, Hepsiburada ve N11 belge okuma | Resmî belgeden okunan sözleşme testleri; ortak adapter arayüzünün denetimi; stok politikası belgesi | Satıcı hesapları, stage erişimi |
| 5 — Muhasebe + e-belge | Gerçek şablonla test, UBL doğrulama, sağlayıcı soyutlaması | Paraşüt API belgesi okuma; UBL-TR şema doğrulaması (resmî XSD); gönderim kodu **kapalı bayrakla** | Şablonlar, entegratör sözleşmesi, mali mühür |
| 6 — ÖKC + online mağaza + CRM | Simülatör sözleşmesi, iyzico sandbox hazırlığı, CRM regresyon | iyzico belge okuma ve sandbox istemcisi; CRM CRUD/yetki testleri | iyzico hesabı (şirket), ÖKC SDK |
| 7 — Son QA | Tam regresyon, güvenlik, performans, yayın listesi | Tüm testler, `npm audit`, performans ölçümü, bilinen sorunlar listesi, kullanıcı rehberi | Gerçek cihaz sonuçları |

**Dondurma:** yeni büyük özellik 20 Aralık'ta durur (`docs/PLAN-1-OCAK-2027.md` ile aynı).

## Bu turda yapılan (Sprint 1 başlangıcı)
- `docs/release-2027-01-01/` altında 8 belge.
- `.github/workflows/ci.yml`: backend lint, backend jest, frontend/shared testleri, frontend build, `npm audit` (yüksek ve kritik).
