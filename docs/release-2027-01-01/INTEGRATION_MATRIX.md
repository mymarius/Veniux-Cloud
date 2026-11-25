# Entegrasyon ve test matrisi — 25 Kasım 2026

Sütunlar: Unit · Integration (sunucu API+DB) · E2E (tarayıcı/cihaz) · Mock (sahte dış servis) · Sandbox · Real device. `✔` = var ve çalıştırıldı, `—` = yok, `△` = kısmen.

| Özellik | Unit | Integration | E2E | Mock | Sandbox | Real device | Statü |
|---|---|---|---|---|---|---|---|
| Mağaza→bulut eşitleme | ✔ | ✔ (15) | △ (elle) | ✔ (sahte fetch) | △ (gerçek bulut, tek satış) | — | AUTOMATED_TESTED |
| Çevrimdışı kasa (sunucu) | ✔ | ✔ | — | — | — | — | AUTOMATED_TESTED |
| Çevrimdışı kasa (IndexedDB + service worker) | ✔ (21) | ✔ (gerçek IndexedDB API, sahte ortam) | △ (Chrome elle) | ✔ (sahte self/caches) | — | — | AUTOMATED_TESTED (gerçek tarayıcı kesintisi elle) |
| Barkod sağlayıcı katmanı | ✔ | ✔ | — | ✔ | — | — | AUTOMATED_TESTED |
| Open Food Facts (gerçek çağrı) | — | — | — | ✔ | — | — | MOCK_TESTED |
| Barcode Lookup | — | — | — | ✔ | — | — | MOCK_TESTED (anahtarsız) |
| Terazi seri port | ✔ | — | — | ✔ (sahte port, TCP simülatör) | — | — | AUTOMATED_TESTED |
| Zebra DataWedge | — | — | — | — | — | — | IMPLEMENTED_UNTESTED |
| Trendyol | ✔ | ✔ (20) | — | ✔ | — (stage için hesap gerekir) | — | MOCK_TESTED |
| Hepsiburada | ✔ | ✔ | — | ✔ | — | — | MOCK_TESTED |
| N11 | ✔ | ✔ | — | ✔ | — (sandbox bulunamadı) | — | MOCK_TESTED |
| Muhasebe CSV paketi | ✔ | ✔ (8) | — | — | — | — | AUTOMATED_TESTED |
| Şablonla doldurma (CSV/XLSX) | ✔ | ✔ (6) | — | uydurma şablon | — | — | AUTOMATED_TESTED |
| Logo / Mikro / Paraşüt gerçek şablon | — | — | — | — | — | — | NOT_IMPLEMENTED (şablon yok) |
| e-Fatura / e-Arşiv gönderimi | — | — | — | — | — | — | NOT_IMPLEMENTED |
| Mükellef sorgusu (Uyumsoft) | ✔ | ✔ | — | ✔ | — | — | MOCK_TESTED |
| ÖKC çerçevesi + simülatör | ✔ | ✔ | — | ✔ | — | — | MOCK_TESTED |
| ÖKC marka sürücüleri | — | — | — | — | — | — | NOT_IMPLEMENTED |
| Online mağaza | ✔ | ✔ | — | — | — | — | AUTOMATED_TESTED |
| iyzico ödeme | — | — | — | △ | — | — | IMPLEMENTED_UNTESTED |
| CRM (JSON çalışma alanı) | △ | △ | — | — | — | — | IMPLEMENTED_UNTESTED |
| Azerbaycanca arayüz | ✔ (6+) | — | △ (canlı gözle, 25 Kas) | — | — | — | IMPLEMENTED_UNTESTED |
| Site hesabıyla giriş köprüsü | ✔ | ✔ (gerçek PHP+Node) | — | ✔ | — | — | AUTOMATED_TESTED |
| Yedek/geri yükleme | ✔ | ✔ | — | — | — | — | AUTOMATED_TESTED |
| Kiracı/yetki izolasyonu | ✔ | ✔ | — | — | — | — | AUTOMATED_TESTED |

Test kanıtı: ilgili dosya adları `AUDIT.md` §3'te; tam çalıştırma çıktıları `PROGRESS.md` ve `.local/` günlüklerinde.

## Karar notları (kaynak: resmî belgeler, okuma tarihi 25 Kas 2026)
- **Trendyol:** taban adres `https://apigw.trendyol.com/integration` (test: `stageapigw...`); sipariş `GET /order/sellers/{id}/orders`; stok `POST /inventory/sellers/{id}/products/price-and-inventory` (aynı istek 15 dakikada tekrarlanamaz, ≤1000 öğe); ekstre `/finance/che/...` (15 gün sınırı). 10 sn'de 50 istek sınırı (429). `User-Agent: <satıcıId> - SelfIntegration` zorunlu. Retry-After belgede yok.
- **Test ortamı:** Trendyol stage için satıcı hesabı + IP izin listesi gerekiyor (Seller Center destek talebi).
- **Hepsiburada / N11 / iyzico / Paraşüt / GİB:** bu turda resmî belge okunmadı; ilgili sprintte okunacak.
