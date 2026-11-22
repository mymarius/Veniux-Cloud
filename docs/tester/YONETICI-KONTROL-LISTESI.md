# Tester programı: yönetici kontrol listesi (riskleri azaltmak için)

Bu liste, tester programını başlatmadan ve yürütürken uygulanacak adımları verir. Amaç riski mümkün olan en düşük düzeye indirmektir; sıfıra indirmek mümkün değildir, kalan riskler en altta yazılıdır.

## A. Başlamadan önce (bir kez)
- [ ] `TESTER-SOZLESMESI-TASLAK.md` içindeki [köşeli] alanları doldur; **bir avukata göster** (özellikle madde 5, 8, 9). Şirket kurulana kadar sözleşmede taraf olarak kendini yaz, kuruluştan sonra devir maddesi (11) geçerli.
- [ ] İletişim kanalı belirle (güvenlik bildirimi için ayrı e-posta; panel e-postası `destek@veniux.com` olabilir).
- [ ] Panel → Ayarlar → Destek → departmanlara şunu ekle: `hata|Hata bildirimi` (anahtar|ad biçimi).
- [ ] Tester listesi için tablo aç: ad, e-posta, onay tarihi, lisans bitişi, kritik hata sayısı.

## B. Her tester için (5 dakika)
1. Tester sözleşmesini e-postayla gönder, **"Okudum, kabul ediyorum" yanıtını al** ve sakla.
2. Panel → Müşteriler → Yeni: işletme adı "TESTER – Ad Soyad", e-posta, **not: TESTER**. Site hesabı şifresi **boş bırak** (şifreyi sen belirleme).
3. Panel → Siparişler → Yeni: müşteri, paket **Pro**, **özel tutar 0**, not "Tester 90 gün". Sipariş kendiliğinden onaylanır, lisans açılır.
4. Lisansı aç: **cihaz sınırı 1**, bitiş tarihi **+90 gün** (Lisans → Ayarlar).
5. Anahtarı (`VNX-…`) ve rehberi tester'a **tek e-postayla** gönder.
6. İlk gün, tester kurulum yaptı mı diye sor.

## C. Yürütürken
- [ ] Hata bildirimlerini tabloya (T-001…) yaz, 1 iş günü içinde yanıtla.
- [ ] Güvenlik bildirimlerini **herkese açık yerde tartışma**; yalnız özel kanaldan yürüt.
- [ ] Kritik hata düzeltilince tester'a haber ver ve ödülü tabloya işle (kredi **1 Ocak 2027'den sonra** tanımlanır).
- [ ] Haftalık: kaç hata, kaçı yeniden üretildi, kaçı düzeltildi.
- [ ] 90. günde lisansı kapat (panel: Lisans → İptal) veya paket geçişi teklif et.
- [ ] Bir tester sözleşmeyi ihlal ederse lisansı kapat (Lisans → İptal) ve ödüllerini iptal et (madde 10.2).

## D. Riskleri azaltan ayarlar (zaten var ya da bu liste ile sağlanır)
| Risk | Önlem |
|---|---|
| Gerçek müşteri verisi girilmesi | Rehber 1. bölüm + sözleşme 3.2; destek paketi verileri maskeler |
| Lisans paylaşımı | Cihaz sınırı 1, anahtar kişiye özel, iptal edilebilir |
| Ödül suistimali | "İlk bildiren" + "yeniden üretilebilir" kuralı, karar sende |
| Para ödülü / vergi sorunu | Yalnız ürün kredisi, şirketleşme sonrası |
| Güvenlik açığının açığa çıkması | Özel bildirim şartı + iyi niyet koruması (madde 7) |
| Veri kaybı | Sözleşme 9.1 + rehber (yedek, paralel kullanım) |
| Ölçüm kirliliği (gelir/müşteri sayısı) | Müşteri adı "TESTER –", not "TESTER", 0 ₺ siparişler |
| Gerçek IBAN'lı e-posta karışıklığı | 0 ₺ siparişte ödeme istenmez, rehberde açıklı |
| Kişisel veri (KVKK) | Sözleşme madde 5 + EK aydınlatma, otomatik yükleme yok |

## E. Kalan riskler (sıfırlanamaz, bilerek kabul edilen)
- **Yasal risk:** Metinler avukat onayından geçmedikçe tam güvence vermez.
- **Erken sürüm hatası:** Gerçek bir hata tester'ın bilgisayarında sorun çıkarabilir; sözleşme sorumluluğu sınırlar ama ortadan kaldırmaz.
- **Destek yükü:** Çok kişi alınırsa zaman alır; ilk dalgayı 8–12 kişiyle sınırla.
- **İtibar:** Tester deneyimi kötü olursa konuşulur; bu yüzden ilk 12 görev (rehber) ve hızlı yanıt önemli.
