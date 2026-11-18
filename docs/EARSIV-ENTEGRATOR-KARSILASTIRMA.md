# E-Arşiv / E-Fatura entegratör karşılaştırması (18 Kasım 2026)

Amaç: müşterilerin 2027'de e-arşiv fatura kesmesi gerektiğinde Veniux'tan tek tıkla göndermesi.
Veniux'un kendisi özel entegratör **olamaz** (GİB lisansı, bilgi sistemleri denetimi ve 2026 kılavuzunda TÜRKAK onaylı ISO 27001 şartı konuşuluyor; resmî metinden teyit edilmeli). Bu yüzden lisanslı bir entegratöre bağlanırız.

## Bugün kodda ne var
- `backend/src/services/edocumentService.js`: sağlayıcı arayüzü (`provider.test`, `provider.taxpayer`, isteğe bağlı `provider.send`), şifreli bağlantı bilgisi, taslak oluşturma, olay kaydı.
- `ublTrService.js`: satıştan UBL-TR XML taslağı (resmî numara yok, "TASLAK" damgalı).
- Tek hazır sağlayıcı: **Uyumsoft** (bağlantı testi ve mükellef sorgusu). **Gönderme yok**, `VENIUX_EDOCUMENT_LIVE=1` olmadan da kapalı.
- Yani eksik olan: gerçek gönderme, resmî numara serisi, durum takibi (GİB'e iletildi/reddedildi), PDF/iptal.

## Adaylar (kaynaklar özel/üçüncü taraf; karar için her firmadan teklif ve dokümantasyon şart)
| Firma | Bildiğimiz | Eksik/Belirsiz |
|---|---|---|
| **Uyumsoft** | GİB'in ilk lisanslı entegratörlerinden (2013) ([Uyumsoft](https://uyumsoft.com/haber/ozel-entegratorun-5-adimda-katkisi-nedir)); kodda zaten bağlı | Sandbox ve ortaklık koşulları belgelenmemiş |
| **Nilvera** | Açık geliştirici sitesi: e-Fatura/e-Arşiv gönderme, taslak uçları ([Nilvera API](https://developer.nilvera.com/api/e-arsiv-api/e-fatura-goenderme)); topluluk SDK'ları var | Ortaklık ve genel kontör fiyatı yayımlı değil; teklif gerekir |
| **Veriban** | API odaklı, REST uyumlu diye anılıyor | Sandbox ve fiyat bilgisi bulunamadı |
| **Foriba / Sovos** | Test portalı var ([Sovos dokümanı](https://docs.sovos.com/indirect-tax/indirect-tax-products/einvoicing/compliance-network/country-setup-guides/turkey/about-compliance-in-turkey)); kurumsal ağırlıklı | Küçük işletme için ağır/pahalı olabilir |
| EDM, İzibiz, Paraşüt vb. | Lisanslı listede anılıyorlar ([BirFatura listesi](https://birfatura.com/ozel-entegrator-firmalari/)) | Teknik bilgi bulunamadı |

Fiyat ipucu (yalnız bir ortak kampanyası, genel fiyat değil): Nilvera 500 kontör 1.312 TL, 1.000 kontör 2.375 TL, kontör süresi 24 ay ([ideasoft](https://www.ideasoft.com.tr/yardim/e-fatura-ve-e-arsiv-ile-fatura-kesme/)).

## Önerilen yol
1. **Uyumsoft'u koru** (zaten bağlı) ve **Nilvera'yı ikinci sağlayıcı** olarak ekle. Müşteri hangisiyle anlaştıysa onu seçer; sağlayıcı arayüzü bunu zaten taşıyor.
2. Şirket kurulunca iki firmaya aynı soruları yaz (aşağıda) ve teklif karşılaştır.
3. Kodda: `provider.send` (UBL-TR gönder, resmî numara serisi, durum sorgusu, iptal/iade) önce sandbox'ta, sonra canlıda. Canlı bayrağı yalnız denenmiş müşteride açılır.

## Entegratörlere soracaklarımız
1. Yazılım ortaklığı (ISV/bayi) programı var mı? Tek ana hesap mı, müşteri başına ayrı sözleşme mi?
2. Sandbox/test ortamı ve test mükellefi nasıl veriliyor, ücreti var mı?
3. Fatura/kontör fiyatı, paket süresi, aylık sabit ücret; küçük işletme için en düşük paket?
4. API: REST mı SOAP mu, UBL-TR XML kabul ediyor mu, numara serisini kim üretiyor, PDF/HTML görünüm, iptal, durum geri bildirimi (webhook/sorgu)?
5. e-Arşiv'de "kâğıt yerine elektronik" ve "internet satışı" tipleri, 2027 basit usul mükellefleri için özel kolaylık var mı?
6. Müşteri başvurusu (mükellef kaydı, mali mühür/GİB portal) süreci kaç gün; Veniux bunu kolaylaştırabilir mi?
7. Hizmet seviyesi, kesinti bildirimi, veri saklama süresi, KVKK/veri işleme sözleşmesi.

## Doğrulanması gerekenler (resmî kaynak)
- 2027'de hangi mükellefin hangi tarihte e-arşive geçtiği: GİB 589 sıra no.lu VUK tebliği (muhasebeciyle teyit).
- Özel entegratör ISO 27001 şartı ve güncel kılavuz: ebelge.gib.gov.tr.
- YN ÖKC'den e-belge (593 sıra no.lu tebliğ) ve yazılım tarafının rolü: GİB YN ÖKC teknik rehberi.
