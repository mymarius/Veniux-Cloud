# Veniux sanal market laboratuvarı

Durum (27 Kasım 2026): **1. Aşama (inceleme) bitti, 2. Aşama hafif modda kuruldu.** 3-8. aşamalar yapılmadı. Bu laboratuvar henüz "hazır" değildir.

## Kullanım
Depo kökünde:

    node qa-lab/lab.cjs start     # boş veritabanıyla http://127.0.0.1:3999
    node qa-lab/lab.cjs status
    node qa-lab/lab.cjs stop      # veriler kalır
    node qa-lab/lab.cjs reset     # yalnız laboratuvar verisini siler
    node --test qa-lab/lab.test.cjs

Veriler `%TEMP%\veniux-qa-lab` altındadır (Windows geçici klasör temizliği silebilir). Arayüz `frontend/dist` içinden sunulur; arayüz kodu değiştiyse önce `frontend` içinde `npm run build`. Sentetik veri üretici yoktur: veritabanı boş açılır.

Güvenlik: yalnız 127.0.0.1; çağıran kabuğun ortam değişkenleri (üretim DB, SMTP, ödeme anahtarı) aktarılmaz; `backend/.env` uygulama tarafından okunmaz; sıfırlama işaretsiz ya da başka adlı klasörü reddeder.

## 1. Aşama: inceleme

### Mimari
| Parça | Teknoloji |
|---|---|
| Arka uç | Node.js, Express; SQLite (masaüstü, `better-sqlite3`) ve MySQL (bulut) aynı kodla |
| Veri erişimi | ORM yok, elle SQL; SQLite geçişleri + MySQL şema katalogları |
| Web arayüzü | React, Vite; çevrimdışı kasa için service worker + IndexedDB |
| Masaüstü / Android | `desktop/`, `mobile/` (bu turda ayrıntılı incelenmedi) |
| Testler | Jest (`backend/tests`, 210'dan fazla dosya/öğe), `node --test` (frontend, shared, donanım simülatörü) |
| CI | `.github/workflows/ci.yml` yazılı; GitHub'da çalıştığı doğrulanmadı |

### Bu bilgisayardaki araçlar
| Araç | Durum |
|---|---|
| Node 24 | var |
| PHP, MariaDB (XAMPP) | var (`C:\xampp`) |
| Docker | **yok** |
| MySQL 8.4 (`Start-MySQL-Test.ps1` bunu ister) | bulunamadı; XAMPP'taki MariaDB aynı şey değildir, denenmedi |
| k6, OWASP ZAP, adb / Android emülatörü, Playwright | yok |

Chrome yüklü; 26-27 Kas'ta Playwright olmadan DevTools protokolüyle kasa ve "Saha ve bayi" denendi (betikler depoya alınmadı).

### Uyumluluk notları
- Kökteki `docker-compose.yml` **Postgres ve Redis** tanımlıyor; arka uç SQLite/MySQL kullanıyor. Eski dosya, laboratuvar için kullanılamaz (silinmedi).
- Docker olmadığı ve burada doğrulanamayacağı için yeni compose dosyası yazılmadı. Docker istenirse kurulum indirme ister; Docker Desktop'ın ticari kullanım koşulları kurulumdan önce resmî lisans sayfasından kontrol edilmelidir.
- Hafif mod SQLite kullanır: masaüstü programını temsil eder, **bulutu (MySQL) temsil etmez**. Eşzamanlılık sonuçları MySQL için geçerli sayılamaz.

### İstenen senaryoların bugünkü karşılığı (kısa tarama; tam denetim değildir)
| Konu | Kodda | Bu turda çalıştırılan test |
|---|---|---|
| Lot/SKT ile satışta ilk dolacak önce, tarihi geçmiş ve bloke lot satışa girmez | var (`stockHealthService.reserveSaleLots`) | `procurement.test.js` 24/24 geçti; kasa ekranından denenmedi |
| Ürün başına birden fazla barkod | **bulunamadı** (arama sınırlıydı) | yok |
| Tartı barkodu / PLU | var (`product_scale_codes`, `shared/scaleProtocols`) | koşulmadı; gerçek terazi yok |
| Şubeler | ayrı şube modeli yok; depo bazlı rapor (`branchReportService`) | koşulmadı |
| Çevrimdışı satış, tekrar gönderim, yeniden açılış | var | 26 Kas'ta testler ve yerel Chrome geçti; bu turda tekrar koşulmadı |
| İade, vardiya, Excel aktarımı, yedek geri yükleme, işletme ayrımı | test dosyaları var | bu turda koşulmadı |
| Pazaryeri | sahte sunucu testleri var | bu turda koşulmadı; gerçek hesap yok |
| ÖKC, ödeme terminali, yazıcı | ÖKC çerçevesi + simülatör, `tools/hardware-sim` | koşulmadı; gerçek cihaz yok |

## Aşama durumu
| Aşama | Durum |
|---|---|
| 1. İnceleme ve plan | Bitti (yukarıda) |
| 2. Altyapı | Hafif mod: başlat/durdur/sıfırla ve güvenlik testleri geçti. Docker/MySQL ortamı **engelli** |
| 3. Sentetik market verisi (1.000+ ürün, 3 kasa, 10 tedarikçi, lotlar; sabit tohumlu) | Yapılmadı (sıradaki) |
| 4. Kasa, stok, depo, SKT, tedarikçi testleri | Yapılmadı |
| 5. Çevrimdışı ve pazaryeri sahte sunucusu | Yapılmadı (mevcut testler buraya bağlanacak) |
| 6. Donanım ve ödeme simülatörleri | Yapılmadı |
| 7. Güvenlik (ZAP) ve yük (k6) | Yapılmadı; araçların indirilmesi onay ister |
| 8. HTML / JUnit raporu | Yapılmadı |

Rapor sözlüğü: geçti, kaldı, engelli, özellik yok, denenmedi. Atlanan test "geçti" sayılmaz.
