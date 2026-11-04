# Kasa gerçek kullanım öncesi inceleme — 4 Ekim 2026

Kapsam: mevcut yerel kasa, SQLite veri katmanı, API yetkileri, tekrar gönderim, ödeme/iade hesabı, fiş ve gün sonu. Tasarım ve mevcut sekmeler korundu. Fiziksel cihaz kullanılmadı.

## Bulgular ve düzeltmeler

1. **Yenilemede satış anahtarı kayboluyordu.** Kasa işlemi, özgün sepet ve ödeme bilgisi ile birlikte istek gönderilmeden önce kullanıcı/işletme başına terminal sekmesinin sessionStorage alanına kaydedilir. Ağ hatası/sonucu belirsiz sunucu hatasında yeni satış engellenir; “Bekleyen satışı doğrula” aynı anahtar ve değişmeyen gövdeyle tekrar gönderir. Başarıda kayıt temizlenir. Doğrulanmış istemci hatasında sepet düzeltilebilir. Çift tıklama eşzamanlı ref kilidiyle durdurulur. Bu saklama aynı sekmede yenileme içindir; sekmenin tamamen kapatılması, tarayıcı depolamasının silinmesi ya da farklı cihaza geçilmesi kurtarma kaydını taşımaz. Böyle bir durumda sunucudaki satış geçmişi kontrol edilmelidir.
2. **Satış anahtarı firma düzeyinde başka kasiyer tarafından yeniden kullanılabiliyordu.** İşlem gövdesinin sunucuda üretilen parmak izine gerçek kullanıcı kimliği eklendi. Başka kullanıcı aynı anahtarla önceki satış yanıtını alamaz. Önceki sürüm anahtarları yalnız kalıcı satış/iade kaydındaki özgün kullanıcı doğrulanarak yükseltilir; mevcut satış tekrar yaratılmaz.
3. **Ondalıklı çarpım yarım kuruşta yanlış yuvarlanabiliyordu.** Tutarlar tam sayı kuruş, miktarlar altı ondalık basamak olarak ele alınır; çarpım, indirim dağılımı ve kümülatif iade oranı BigInt ile yapılır. Örneğin 2,01 TL × 0,5 = 1,01 TL. Sepet önizlemesi aynı kuralla kalem bazında hesaplanır. Bölünmüş ödeme toplamı net satışa tam eşit olmalıdır. Geçersiz/hassasiyeti fazla tutar reddedilir.
4. **Stok kontrolü transaction ile korunuyordu; ek savunma eksikti.** SQLite BEGIN IMMEDIATE ve işlem kuyruğu seri yürütür. MySQL firma kilidi ve stok satırı FOR UPDATE kullanır. Stok düşme ayrıca quantity >= düşülecek miktar koşuluyla ve etkilenen satır kontrolüyle yapılır; uyuşmazlıkta satışın tamamı geri alınır. Stok geri dönüşleri altı ondalık basamakta normalize edilir.
5. **Gün sonu ayrı sorgular arasında değişebilirdi.** Satış, iptal/iade ve kapanış aynı transaction içinde okunur; MySQL’de kasa işlemleriyle aynı firma kilidi alınır. Kısmi iade ve önceki gün satışının bugünkü iadesi rapora doğru yansır.
6. **Kart uyarısı güçlendirildi.** Kasa kart tutarının yalnız satış kaydı olduğunu, banka POS cihazında ayrıca tahsil edilmesi gerektiğini gösterir. İade ekranı ve fişte de banka iadesi ayrıca belirtilir. Yazılım bankadan onay aldı veya para transfer etti iddiasında bulunmaz.

## Doğrulanan senaryolar

| Kontrol | Yazılım sonucu |
|---|---|
| İki farklı kasiyer aynı son ürünü eşzamanlı satıyor | Bir 201, bir 409; stok 0, tek satış ve tek çıkış hareketi |
| Aynı satış çift gönderiliyor / başarılı yanıt kaybolmuş varsayılarak tekrar isteniyor | Aynı satış ve fiş numarası; stok ikinci defa düşmüyor |
| Aynı anahtar farklı ödeme gövdesi veya başka kasiyerle kullanılıyor | 409; yeni satış yok |
| Yenileme sonrası bekleyen gövde/anahtar | Saklama simülasyonu özgün gövdeyi ve anahtarı aynen geri getiriyor |
| Eşzamanlı iki iade / aynı kısmi iadeyi tekrar gönderme | Miktar aşımı reddediliyor; aynı anahtar tek iade kaydı oluşturuyor |
| Satılan miktardan fazla iade / iptalden sonra tekrar iade | 409, stok değişmiyor |
| Yetkisiz indirim, fiyat değiştirme, iptal, iade | Sunucuda 403; kullanıcı rolü veritabanından doğrulanıyor |
| Yarım kuruş, bölünmüş ödeme, para üstü, indirimli üç parça iade | Tam kuruş sonuçları; toplam iade özgün ödemeye eşit |
| Fiş 58/80/58 mm yeniden alınıyor | GET, yeni satış ve stok hareketi yok; metin HTML kaçışlı |
| Satış + iptal + kısmi iade ve ödeme kırılımı | Net = satış − iptal − iade = net nakit + net kart |
| Eski gün satışı bugün iade ediliyor | Bugünkü raporda satış 0, iade ve nakit çıkışı gösteriliyor |
| Kasa kapanışı | Kasa farkı kalıcı kaydediliyor; kapanmış gün yeni işlem almıyor |

Testler gerçek uygulama API’si ve izole SQLite test veritabanı üzerinde çalışır. Yanıt kaybı senaryosu başarılı ilk yanıt kullanılmadan tekrar istekle simüle edilir; fiziksel ağ kablosu kesilmesi denenmedi. Yenileme saklama davranışı ayrı otomatik testle doğrulandı. Test raporu audit/retail-critical-regression-results.json içinde; üretim derlemesi başarılı.

## Değişen dosyalar

- backend/src/services/retailDailyService.js — kullanıcıya bağlı tekrar gönderim, stok koşulu, kuruş ve iade hesapları.
- backend/src/services/retailReportingService.js — tutarlı transaction raporu ve sayısal kullanıcı karşılaştırması.
- frontend/src/pages/RetailPos.jsx — bekleyen satış kurtarma, aynı kuruş önizlemesi ve kart açıklaması.
- shared/retailMoney.mjs / retailMoney.test.mjs — sepet kuruş hesabı.
- shared/pendingSale.mjs / pendingSale.test.mjs — işlem saklama/kurtarma.
- backend/tests/retailCritical.test.js — eşzamanlı satış/iade, tekrar, yetki, para, fiş ve rapor testleri.

## Fiziksel cihaz ve dış sistemde bekleyenler

- Gerçek USB/Bluetooth HID okuyucu: hızlı/tekrarlı okuma, cihaz sonlandırıcısı, bağlantı kesilip tekrar bağlanma.
- Gerçek termal yazıcı: 58/80 mm sürücü ayarları, kesici, Türkçe karakterler, çıktı ve yeniden yazdırma. Yazdırma penceresi açılması teslim/çıktı kanıtı değildir.
- Banka cihazı: gerçek kart tahsilatı, iptal ve iade; mevcut yazılım bir banka entegrasyonu değildir.
- Gerçek MySQL: kilit/transaction uygulaması kaynakta incelendi; eşzamanlılık testi SQLite üzerinde yapıldı. MySQL üretimi seçilecekse aynı testler gerçek sunucuda çalıştırılmalıdır.
- Fiş satış bilgi fişidir; mali yazarkasa veya resmî e-belge yerine geçmez.
