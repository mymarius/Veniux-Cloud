# Yayın kontrol listesi — 1 Ocak 2027

İşaret: `[x]` kanıtlı yapıldı (tarih), `[ ]` yapılmadı, `[~]` kısmen. Üretime **otomatik dağıtım yoktur**; her adım elle.

## Her sürüm için (tekrarlanan)
- [x] Temiz çalışma ağacı (`yayinla.py` zorlar)
- [x] Testler çalışır (`yayinla.py` backend + frontend testlerini koşar)
- [x] Derleme (Windows + Android) ve canlı doğrulama (indirme adresleri)
- [x] Bulut yedeği: Plesk veritabanı dökümü (şema değişiminde) + `source.json` yedeği
- [x] `run stage` → yeniden başlatma → `/health` (migrasyon 035 güncel)
- [x] Site yayını (`publish-site.py`) ve canlı kontrol

## 1 Ocak öncesi
| Madde | Durum | Not |
|---|---|---|
| Build | [x] | her sürümde |
| Lint | [~] | uyarılar var, hata yok |
| Tür denetimi | [ ] | proje JavaScript; tür denetimi tanımlı değil (karar bekliyor) |
| Birim ve entegrasyon testleri | [x] | tam sayılar PROGRESS.md |
| E2E (tarayıcı) | [ ] | Playwright kurulmadı; Sprint 2 |
| Güvenlik, bağımlılık denetimi | [~] | `npm audit` 0 açık; sızma testi yok |
| Veritabanı migrasyonu | [x] | 035 canlı; rollback dump'ları saklı |
| Yedek ve geri yükleme | [~] | otomatik test var; gerçek makinede geri yükleme tatbikatı yok |
| Bulut eşitleme | [~] | sentetik testler; gerçek mağazada uzun süre yok |
| Çevrimdışı kasa | [~] | sunucu testli; tarayıcı katmanı otomatik testsiz |
| Barkod | [~] | sahte sağlayıcılarla; Barcode Lookup anahtarsız |
| Terazi | [ ] gerçek | sahte port testi; gerçek cihaz yok |
| Pazaryeri | [ ] gerçek | sahte sunucu; hesap yok |
| Muhasebe | [~] | CSV ve şablon motoru; gerçek şablon yok |
| e-Belge | [ ] | gönderim yok; entegratör sözleşmesi bekliyor |
| ÖKC | [ ] | yalnız simülatör |
| Online mağaza / iyzico | [~] | sunucu testli; iyzico hesabı yok |
| CRM | [~] | hafif çalışma alanı; testler sınırlı |
| Azerbaycanca | [~] | 1286 giriş; yerli okuyucu yok |
| İzinler ve kiracı izolasyonu | [x] | otomatik testler |
| Performans | [~] | ölçümler `docs/UZUN-KULLANIM-PERFORMANS-2026-11-23.md` |
| Hata günlüğü, izleme | [~] | masaüstü günlüğü, `/health`, `uptime.yml` |
| Dokümantasyon, kullanıcı rehberi | [~] | `docs/MUSTERI-ILK-GUN-REHBERI.md` |
| Donanım listesi | [x] | `HARDWARE_TEST_GUIDE.md` |
| Sürüm notları, bilinen sorunlar | [~] | bilinen sorunlar `AUDIT.md` §4 |

## Üretimde yapılmayacaklar (açık yetki gerekmeden)
Gerçek ödeme, gerçek e-belge, gerçek pazaryeri işlemi, gerçek ÖKC fişi, müşteri verisiyle test.
