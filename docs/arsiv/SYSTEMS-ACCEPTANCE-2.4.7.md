# Veniux 2.4.7 sistem kabulü — 12 Ekim 2026

## Tamamlanan düzeltmeler
- MySQL bakım düğmesi artık SQLite PRAGMA/getDb çağırmaz; platform yöneticisi için InnoDB tablolarının ANALYZE istatistiklerini günceller. Günlük uygulama root hesabı kullanmaz.
- MySQL veri boyutu information_schema üzerinden ölçülür. SQLite journal modu MySQL için uygulanmaz. Node heap yüzdesi fiziksel RAM yüzdesi gibi adlandırılmaz.
- Sabit %100 şema eşitliği, ölçülmemiş çift yazma ve anında rollback iddiaları kaldırıldı.
- Masaüstü sunucusu özel AppData integrations.env dosyasındaki izinli hizmet ayarlarını yükler. DB/JWT/lisans adresi bu dosyayla değiştirilemez. Önceden tanımlanmış NVIDIA ve Gemini ayarları buraya aktarıldı; installer'a konmadı.
- Yeni yerel kurulumda trigger sahibinin silinmesi engellendi. Başlangıç root kimliği korunur ve yerel TCP bootstrap hesabı kurulum sonrasında girişe kilitlenir. Mevcut kurulumdaki daha önce onarılan sınırlı kural hesabının yetkileri değiştirilmedi.
- Manuel otomasyon ve zamanlanmış kontroller merkezi sunucudan doğrulanmış paket haklarını kullanır. Zamanlanmış otomasyon yalnız saklanan cihaz lisansı merkezden yeniden doğrulanırsa ve ilgili firma ayarı açıksa çalışır. Çevrimdışı lisans geçişi yoktur.
- Stok özetinde gereksiz altı sıfırlı miktar gösterimi düzeltildi.
- Kullanıcının bildirim numarası yalnız yerel bildirim alıcısına kaydedildi; şirket ve otomasyon API yanıtlarında açık numara bulunmaz. WhatsApp mesaj kimliği uygulama içi rastgele referanstır; numara içermez. Geçici kurulum kodu ve test fixture'larındaki kişisel numara kaldırıldı.
- Kullanıcının tercihiyle ücretli SMS kapalı, mevcut WhatsApp kanalı seçili. Eşleştirme kullanıcı tarafından yapılmalıdır.

## Gerçekten çalıştırılanlar
| Kontrol | Sonuç |
|---|---|
| Backend SQLite regresyonu | 70 suite, 633 test geçti |
| Masaüstü bağlantı ve özel ayar güvenliği | 9 test geçti |
| WhatsApp telefon gizliliği ve tenant kapsamı | 5 mock test geçti; gerçek gönderim değildir |
| NVIDIA sohbet sağlayıcısı | Kişisel veri içermeyen gerçek istek geçti |
| Google kadın ses profili | Gerçek WAV üretimi geçti; bir ilk bağlantı denemesi başarısız oldu, tekrar testi geçti |
| Yeni, ayrı MariaDB örneği | Bootstrap, kullanıcı trigger'ları, lisanslı giriş, boyut/mod, ANALYZE API, gizli telefon yanıtları ve AI otomasyon çalıştırması geçti |

Test MySQL örneği farklı port ve farklı veri dizinindedir. Müşteri stok/satış kayıtları test edilmek için değiştirilmedi. Yeni sahip hesabı ve lisans korundu.

## Bekleyen kabul
- Gerçek WhatsApp QR eşleştirmesi ve yalnız sahibine test mesajı. API gönderim kabulü teslimat teyidi değildir.
- Kurulu programda sesin kullanıcı tarafından duyulması ve tüm sayfaların görsel kontrolü.
- Harici yazıcı, barkod okuyucu, IoT cihazları ve gerçek sağlayıcı entegrasyonları ayrı ekipman/erişim gerektirir; tümünün canlı kabulü yapılmış sayılmaz.
- SQLite testlerinin geçmesi bütün MySQL iş akışlarının canlı kabul edildiği anlamına gelmez. Bu turdaki MySQL kabulü tablodaki kapsamla sınırlıdır.
- Dağıtımda otomatik güncelleme feed'i ve kod imzası hâlâ yoktur.

“Tüm eksikler giderildi” veya “bütün harici sistemler canlı çalışıyor” iddiası yoktur. Sırlar ve kişisel numara raporda yer almaz.

## Kurulum doğrulaması
2.4.7 mevcut program üzerine kuruldu; installer çıkış kodu 0. Kurulu app.asar sürümü 2.4.7 olarak okundu. Kurulu local-server ve settingsController son kaynakla birebir eşleşti; özel hizmet ayarı yükleyicisi ve şifreli lisans okuyucusu bulundu. Paketlenmiş Node/sunucuyla ayrı MariaDB API kabulü de geçti. Gerçek kullanıcı arayüzündeki ses ve WhatsApp teslimatı hâlâ yukarıdaki bekleyen kapsamdadır.
