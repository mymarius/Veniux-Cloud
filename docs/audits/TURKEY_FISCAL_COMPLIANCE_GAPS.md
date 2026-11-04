# Türkiye mali entegrasyon boşlukları

Tarih: 18–19 Ekim 2026 (testler18 Ekim, rapor kapanışı19 Ekim). Yerel, izole test; üretim yayını, gerçek ödeme, canlı DB işlemi ve müşteri kaydı değişikliği yapılmadı.

Bu rapor bir sertifika değildir. PASS yalnız belirtilen çalıştırılmış kontrolün sonucudur. BLOCKED / NOT TESTED başarıya katılmaz. Kaynak incelemesi, cihaz veya canlı hizmet kabulünün yerine geçmez.

Bu teknik boşluk analizidir; vergi mükellefiyeti/istisna kararı veya mevzuat uygunluk belgesi değildir. İşletmeye uygulanacak yükümlülük mali müşavir, yetkili cihaz üreticisi ve gerekli entegratörle doğrulanmalıdır.

## Gerçek ürün durumu

| Alan | Durum / kanıt | Gerekli kabul |
|---|---|---|
| POS satış bilgi fişi | Tamamlandı ve yazılım kapsamıyla doğrulandı; `backend/src/services/retailReceipt.js:13`: açıkça mali fiş yerine geçmediği yazıyor | 58/80 mm fiziksel baskı ayrı; bunu mali fiş diye sunma |
| KDV hesap/snapshot | 19 test PASS, indirim/kısmi iade/kuruş; bu hesap doğruluğu mali cihaz onayı değildir | İşletme ürün/vergi sınıfları ve güncel oranlar mali müşavir tarafından atanmalı |
| ÖKC / YN ÖKC | Kısmen: generic adapter/journal; varsayılan profiles boş. `backend/src/services/retailExternalService.js:9` | Onaylı üretici/model/protokol, SDK sözleşmesi, üretici testleri ve yetkili kabul |
| Banka ödeme terminali | Eksik gerçek sürücü; 'kart' alanı yerel kayıt, provizyon alınmıyor | Banka/ödeme sağlayıcı test ortamı; çekim, belirsiz işlem, iade, iptal ve gün sonu |
| e-Fatura/e-Arşiv | İç JSON taslak, sent_to_gib=false. `backend/src/services/retailExternalService.js:33` | UBL-TR, imza/mali mühür, durum yaşam döngüsü, gönderim/yanıt, saklama/ibraz; uygun resmî yöntem veya yetkili özel entegratör kabulü |
| Mali gün sonu | Yerel satış/shift raporu, bank_reconciled=false | Cihaz/banka raporuyla mutabakat; yerel raporu resmî Z raporu diye adlandırma |

## Bulgular

| ID / önem | Dosya/satır / tekrar üretme | Çözüm |
|---|---|---|
| FISC-01 P1 satış engeli | `backend/src/services/retailExternalService.js:9`; configured=false, receipt mali uyarısı; yazılım fişi üretildiğinde resmî belge oluşmuyor | Hedef işletmenin yükümlülüğünü ve mevcut onaylı cihazıyla birlikte çalışma modelini yazılı belirle |
| FISC-02 P1 satış engeli | `backend/src/services/retailExternalService.js:33`; internal_draft/sent_to_gib=false; test adaptörü GİB hesabı değil | Resmî teknik kılavuzla belge doğrulama + sandbox + entegratör/üretici kabulü |
| FISC-03 P1 satış engeli | `backend/src/services/retailExternalService.js:41`; TX-01 / TX-02, yerel journal bank_reconciled=false | Üretici/banka yanıtı ve mali işlem kimliğiyle idempotent uçtan uca mutabakat; riskli ödeme akışı değişiklikleri için ayrı onay |

## Resmî kaynaklar

18 Ekim 2026 tarihinde resmî kaynaklar kontrol edildi. GİB'in YN ÖKC rehberi ve SSS'si yükümlülük ve üretici bağlantı usullerini açıklıyor; belirli bir entegrasyonun VENIUX tarafından onaylandığına kanıt değil:

- [GİB YN ÖKC SSS](https://ynokc.gib.gov.tr/Home/SSS) — harici donanım/yazılım ve GMP-3 bağlantı kuralları.
- [GİB YN ÖKC kullanım rehberi duyurusu](https://ynokc.gib.gov.tr/Home/DuyuruDetay/11135).
- [GİB e-Fatura Özel Entegrasyon Kılavuzu v1.12](https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/e-Fatura_Uygulamasi_Ozel_Entegrasyon_Kilavuzu_v1.12.pdf).
- [GİB özel entegrasyon/e-Arşiv düzenlemesi](https://gib.gov.tr/mevzuat/kanun/434/teblig/7980).

Fiziksel cihaz, resmî test hesabı ve entegratör erişimi yok. Bu görevde mali entegrasyon kodu, gerçek tahsilat veya GİB gönderimi yapılmadı.
