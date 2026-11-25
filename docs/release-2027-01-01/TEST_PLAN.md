# Test planı

## Katmanlar ve nasıl çalıştırılır
| Katman | Komut | Not |
|---|---|---|
| Backend birim + entegrasyon (SQLite) | `cd backend && npm test` | `NODE_ENV=test`, `jest --runInBand`; ~9 dakika |
| Eşitleme yük testi (ağır, varsayılan atlanır) | `cd backend && SYNC_LOAD=1000 npx jest tests/storeSyncLoad.test.js --runInBand --setupFilesAfterEnv ./tests/setup.js` | Ortak test veritabanını şişirir; sonra `backend/stok_takip_test.db` silinmeli (yoksa yedek testleri 5 sn zaman aşımına düşer) |
| Backend MySQL | `npm run test:mysql` | Yerel MySQL 8.4 gerekir (yükseltme/kesim testleri) |
| Frontend + paylaşılan + simülatör | `cd frontend && node --test src/lib/*.test.mjs src/i18n/*.test.mjs ../shared/*.test.mjs ../tools/hardware-sim/*.test.mjs` | 221 test |
| Lint | `cd backend && npx oxlint` | yalnız uyarı |
| Derleme | `cd frontend && npm run build` | |
| Bağımlılık | `npm audit --omit=dev` (backend, frontend) | 0 açık |
| CI | `.github/workflows/ci.yml` | yukarıdakilerin tümü, PR ve `push` |
| Donanım | `HARDWARE_TEST_GUIDE.md` | elle |

## Senaryolar ve durumları (özet)
Eşitleme senaryoları (kullanıcı listesinden). Kaynak: `storeSync*.test.js`.
| # | Senaryo | Durum |
|---|---|---|
| 1 | 100 satış eşitle | GEÇTİ (205 satır parçalı + 1.000 satır yük) |
| 2 | 1.000 satış | GEÇTİ (0,69 sn eşitleme, çift kayıt yok, toplamlar eşit) |
| 3 | 10.000 kayıt yük | GEÇTİ (34 sn eşitleme, 435 MB; ortam bilgisi PROGRESS.md) |
| 4–5 | İnternet kes/geri gelsin | GEÇTİ (sahte `fetch` hatası) |
| 6 | İstek ulaştı, yanıt kayıp | GEÇTİ |
| 7 | Aynı satış 10 kez | GEÇTİ (10 tekrar, 0 yeni kayıt, yük testinde) |
| 8–10 | Tarayıcı/bilgisayar/worker yeniden başlama | YAPILMADI (istemci kuyruğu tarayıcı katmanında) |
| 11 | İki mağaza aynı ürün | YAPILMADI |
| 12 | Fiyat güncellemesi sırasında satış | YAPILMADI |
| 13 | Bozuk/yarım yanıt | GEÇTİ (HTML ara sayfa, kesik JSON, eksik alan, uyuşmayan sayı; kod düzeltildi) |
| 14 | 500/502/503/429 | GEÇTİ (500, 502, 503); 429 istek güvenlik duvarı testlerinde |
| 15 | Token süresi doldu | GEÇTİ (cihaz anahtarı süresiz; iptal=401, kayıtlar bekler, yeni anahtarla gider) |
| 16–17 | Bozuk kayıt, diğerleri kaybolmasın | KISMEN |
| 18 | İki kez stok düşmesin | GEÇTİ (idempotency, sale_id) |
| 19 | İptal doğru düzelsin | GEÇTİ (mevcut iade testleri) |
| 20 | Yerel/bulut toplam karşılaştırma | GEÇTİ (1.000 ve 10.000 satırda) |

Her satırın "YAPILMADI" olanı Sprint 2'nin test listesidir.

## Test kaydı biçimi (her çalıştırma için)
`Test adı | Senaryo | Beklenen | Gerçek | Geçti/Kaldı | Tarih | Ortam | Kanıt (günlük dosyası) | Bilinen sınır` — `PROGRESS.md` içine eklenir.

## Ortam kuralları
- Test için ayrı veritabanı: testler `backend/stok_takip_test.db` ve `TEST_SQLITE_PATH` kullanır; **gerçek veriye dokunulmaz**.
- Canlı bulutta yalnız "Deneme" adlı cihaz anahtarıyla, tek satırlık, sonradan iptal edilen denemeler yapılır.
- Dış servislerde gerçek işlem yok; sahte sunucu veya sandbox.
