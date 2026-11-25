# Engeller: benden (hesap sahibinden) gerekenler — 25 Kasım 2026

Bu liste, kodla çözülemeyen ve gerçek hesap, cihaz, ücret ya da yasal yetki isteyen işleri içerir. Hiçbiri uydurulmadı; her biri için hangi testin bağlı olduğu yazıldı. Şu an şirket yok, müşteri yok; bu yüzden birçok madde **şirket kuruluşuna** bağlı.

## A. Ücretsiz ve senin yapabileceğin
| Ne | Neden | Test nasıl yapılır | Adım |
|---|---|---|---|
| Paraşüt deneme hesabı → "Excel şablonunu indir" (müşteri/tedarikçi, ürün, satış faturası) | Gerçek şablon sütunlarını doğrulamak | İndirilen dosyayı `.local/templates/` altına koy; şablonla doldurma testi gerçek dosyayla çalışır | Paraşüt'te deneme aç, İçe/Dışa aktar → İçeri aktar → Excel şablonunu indir. Şablon: https://www.parasut.com/kullanim-kilavuzu/mevcut-verilerin-parasute-aktarilmasi |
| Android emülatörü (Android Studio) | DataWedge sahte intent denemesi | `adb shell am broadcast` ile `com.veniux.companion.SCAN` | Android Studio kur, AVD oluştur (ücretsiz) |
| Yeni site hesabıyla uygulamaya giriş | Giriş birleştirmenin canlı denemesi | veniux.com'da yeni hesap, e-posta doğrulaması, app.veniux.com'da aynı bilgilerle giriş | 2 dakika |
| Bir Azerbaycanlı tanıdık | Çeviri okuması | `docs/release-2027-01-01/AZ_REVIEW.md` listesi (ileride üretilecek) | Çeviri dosyasını göster |
| Google/Plesk dışı: Chrome'da Claude eklentisi oturumu | Canlı ekran kontrolü | — | Eklentiyi açık tut |

## B. Ücretli olabilecek
| Ne | Neden | Ücretsiz alternatif | Not |
|---|---|---|---|
| Barcode Lookup API anahtarı | Ücretli barkod sağlayıcısını gerçek anahtarla denemek | Open Food Facts ücretsiz | https://www.barcodelookup.com/api |
| e-Belge entegratörü sözleşmesi (Uyumsoft, Nilvera vb.) | Gerçek e-Arşiv/e-Fatura gönderimi | Yok (yasal) | Şirket + mali mühür/e-imza gerekir. Karşılaştırma: `docs/EARSIV-ENTEGRATOR-KARSILASTIRMA.md` |
| Kod imzalama sertifikası | SmartScreen uyarısını kaldırmak | Yok | Şirket adına alınır |
| ÖKC marka SDK'sı | Gerçek yazarkasa entegrasyonu | Yok | Üretici geliştirici programı (Ingenico, Beko, Hugin, Pavo…) |
| Pazaryeri satıcı hesabı | Gerçek sipariş/stok denemesi | Trendyol stage (ücretsiz, hesap ister) | bkz. C |

## C. Fiziksel donanım gerektiren
| Ne | Test | Rehber |
|---|---|---|
| Windows kasa bilgisayarı (uzun süre açık) | Eşitleme, kasa bellek, yedek | `HARDWARE_TEST_GUIDE.md` §1 |
| Tartı (CAS/Toledo/Dibal/Bizerba) + USB-seri kablo | Gerçek çıktı satırları | `HARDWARE_TEST_GUIDE.md` §2 (Teşhis ekranı satırlarını kopyalayıp gönder) |
| Zebra Android el terminali | DataWedge intent | `HARDWARE_TEST_GUIDE.md` §3 |
| Yeni nesil ÖKC | Mali fiş | `HARDWARE_TEST_GUIDE.md` §4 |
| Fiş yazıcısı (ESC/POS, 58/80 mm) | Fiş ve etiket çıktısı | `HARDWARE_TEST_GUIDE.md` §5 |
| Barkod okuyucu (USB HID) | Klavye gibi okuma | `HARDWARE_TEST_GUIDE.md` §6 |

## D. Yasal / kurumsal
| Ne | Neden | Adım |
|---|---|---|
| Limited şirket (MERSİS, vergi levhası, banka) | Sertifika, iyzico, e-belge, sözleşmeler şirket adına | Kuruluş başvurusu |
| e-Belge yetkisi (özel entegratör anlaşması, mali mühür/e-imza) | Gerçek belge gönderimi **sadece** senin açık iznin ve yetkinle | Entegratör seç, sözleşme |
| Mali cihaz onayı / üretici erişimi | Yeni nesil ÖKC | Üreticiyle görüş, GİB teknik rehberi |
| Merchant hesapları (iyzico, Trendyol, Hepsiburada, N11) | Gerçek ödeme/sipariş | Şirket kurulunca başvur |
| Hizmet sözleşmesi ve KVKK metinleri avukat incelemesi | Ücretli satış öncesi | Avukata göster |

## Test sırasında üretimde **yapılmayacaklar**
Gerçek ödeme, gerçek e-belge gönderimi, gerçek pazaryeri siparişi, gerçek ÖKC fişi, gerçek müşteri verisiyle test. Bunların hepsi için açık yetkilendirme gerekir; yetki gelene kadar yalnız mock/simülatör/sandbox kullanılır.
