# Phase2 sonrası yayın engelleri — 15 Ekim 2026

## Kritik

Bu tur doğrulanan680 geçerli testte açık başarısızlık yok. Önceki56 vaka kaldırılmış modül sözleşmesiydi; tek tek güncellendi, test atlanmadı. Bu sonuç bağımsız sızma testi veya bütün olası açıkların yokluğu sertifikası değildir. Üretime erişim/değişiklik ve gerçek DB migration yapılmadı.

## Lansman öncesi zorunlu

- Windows yayıncı imzası: sertifika/Store hesabı yok; mevcut NSIS kurulum imzasız. Ücretsiz yöntemle SmartScreen’in kesin kalkması vaat edilemez. Satın alma veya Store başvurusu bu tur yapılmadı.
- Temiz Windows VM’de kurulum, güncelleme, yarım güncelleme ve kaldırma/veri koruma kabulü. İzole productionRuntime alt süreç testi bu VM kabulünün yerine geçmez.
- Gerçek kurulumdan ayrı diske şifreli yedek/anahtar saklama ve bağımsız ortama geri dönüş tatbikatı. İzole backupRecovery testleri geçti; müşterinin üretim yedeği geri yüklenmedi. Merkezi lisans modundaki otomatik zamanlayıcı sınırları korunuyor; sınırsız offline/otomatik yedek sözü yok.
- Yayın öncesi mevcut site/ayar yedeği, dosya değişim ve geri dönüş listesi, açık yayın onayı. Bu görevde üretim yayını yasak ve yapılmadı.
- Dönüşüm ölçümünü aktif diye sunmadan önce gerçek GA4 mülkü, yetkili hesap, rıza/veri aktarımı değerlendirmesi, CSP/etiket kurulumu ve DebugView kabulü. Mevcut köprü Google kodu yüklemiyor; gerçek verinin alındığı iddia edilemez.
- Google performansı raporlanmadan önce gerçek Search Console mülkü/TXT ve sitemap gönderimi. Şablon hazır; erişim yok. Bu, lisanslı programı teknik olarak açma koşulu değil, büyüme ölçümü koşuludur.

## Gerçek cihaz bekleyen

Android kamera/fener, QR eşleştirme, HID/seri okuyucu, el terminali; gerçek Windows sürücülü termal/A4 yazıcı, kağıt ölçüsü, barkod yeniden okuma, kopma/yeniden bağlanma, fiziksel baskı tekrar engeli. Yazıcı kuyruğuna teslim fiziksel kağıt çıktısı değildir. Ayrıntı: docs/hardware/REAL_DEVICE_TEST_PLAN.md.

## Lansman sonrası iyileştirme

-500KB üstü frontend chunk’larını gerçek ölçümle bölmek; yeni Lighthouse/alan CWV ölçümü. Bu tur390px mobil taşma kontrolü performans puanı değildir.
- Gerçek28gün arama/sorgu/dönüşüm verisiyle title/CTA ve içerik iyileştirmesi. Trafik garantisi yok.
- İş ortaklığına özel yönetim paneli/durum/not/takipSLA’sı: yeni ortaklık talepleri mevcut özel görüşme kuyruğuna kaydolur; tam partner CRM’i değildir.
- Kullanıcı onaylı gerçek ekran kayıtları ve seçilmiş firmalara bireysel iletişim. Taslaklar hazır; paylaşım, mesaj, başvuru yapılmadı.

Lisans: mandatoryLicense/moduleAccess/mobilePairing testleri geçti; internet yokken merkezi doğrulama kapanır, sahip hesabı için istisna eklenmedi. Güvenlik: tenant/rol/kayıt bütünlüğü testleri geçti; üretim topolojisi ve dış sistemler ayrıca değerlendirilir.
