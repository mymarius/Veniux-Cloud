# 1 Ocak 2027 planı (18 Kasım – 31 Aralık 2026)

Hedef: şirket kurulduğunda ilk müşterilere sorunsuz satılabilen, imzalı, yedekli ve desteklenebilir bir ürün.
Kural: yeni büyük özellik 20 Aralık'ta durur; son 11 gün yalnız test, düzeltme ve yayın.

## A. Şirket ve yasal (sizin işiniz, ürünü bloke eder)
| İş | Neden önemli | Zamanlama |
|---|---|---|
| Limited şirket kuruluşu (MERSİS, ticaret sicil, vergi levhası, banka hesabı) | Sertifika, iyzico, e-belge entegratörü ve sözleşmeler şirket adına istenir | Kasım sonu başvuru, 1 Ocak kuruluş |
| Marka tescili "Veniux" (Türk Patent) | Logo ve ad zaten kullanılıyor | Aralık |
| KVKK: aydınlatma metni, VERBİS gereği kontrolü, işleyen sıfatıyla sözleşme | Müşteri verisi saklıyoruz | Aralık |
| Kullanım sözleşmesi + mesafeli satış + iade koşulları (online mağaza) | Satış öncesi şart | Aralık |
| Yasal sayfalarda kişisel Gmail yerine destek@veniux.com | Şirket görüntüsü | Hemen (ben yaparım) |
| Posta kayıtları (SPF/DKIM/DMARC, Cloudflare) | E-postalar spam'e düşmesin | Hemen (siz Cloudflare'e girince) |

## B. Ürün: 1 Ocak'a kadar bitmesi gerekenler
1. **Pilot müşteri (pide restoranı):** deneme listesi `docs/RESTORAN-DENEME-LISTESI.md`; bulgular tek listede toplanır, aynı hafta düzeltilir.
2. **Kod imzalama:** sertifika şirket adına alınır (kuruluştan sonra); yayın aracı imzalı derlemeyi destekliyor.
3. **Performans:** Android ve Windows'ta yavaş ekranların ölçümü (adb/CDP), 510 KB CSS'in sadeleştirilmesi, zayıf cihazda efekt kapatma.
4. **Windows animasyonlarının kaldırılması** ve **Windows + Android tasarım yenilemesi** (kapsam: kasa, ana sayfa, stok, raporlar, ayarlar; önce ekran listesi onayı).
5. **E-Arşiv/E-Fatura (2027):** basit usul mükelleflerinde 2027'den itibaren e-arşiv zorunluluğu geliyor (kaynaklar aşağıda). Taslak XML hazır; gerçek gönderim için **özel entegratör anlaşması** gerekiyor. Aralık başında entegratör seçilir (API'si ve fiyatı karşılaştırılır), sandbox bağlantısı yapılır.
6. **Yazarkasa (YN ÖKC):** cihaz üreticisi/yazılım entegrasyonu GİB teknik rehberine bağlı; ilk müşteriler cihazlarını kendileri kullanıyor, Q1 2027 işi.
7. **Bildirimler (Firebase):** sunucu ve Android hazır, canlıya almak için Firebase ayar dosyası gerekiyor.
8. **Online mağaza:** iyzico ödeme (şirket gerekir) ve özel alan adı; sandbox denemesi şirket kurulunca.
9. **business.veniux.com emekliliği** ve bulut stage temizliği (Plesk).

## C. Sağlamlık (her hafta tekrarlanır)
- Tam testler (SQLite + MySQL), yedekten geri yükleme denemesi, canlı sağlık kontrolü.
- Yük ve çevrimdışı senaryo denemesi: 10 cihaz eş zamanlı kasa, internet kesilince satış, geri gelince eşitleme.
- Güvenlik gözden geçirmesi (kimlik, yetki, dosya yükleme, yedek şifreleme) ve bağımlılık güncellemeleri.
- Destek süreci: canlı destek, WhatsApp, sorun kayıt şablonu, SLA metni.
- Müşteri ilk gün rehberi ve kurulum videosu güncel mi?

## D. Haftalık takvim
| Hafta | Odak |
|---|---|
| 1 (18–24 Kas) | Pilot restoran denemesi; performans ölçümü; yasal sayfa e-postaları; şirket başvurusu |
| 2 (25 Kas–1 Ara) | Pilot bulguları; animasyon kaldırma; Windows tasarım ekran listesi |
| 3 (2–8 Ara) | Windows tasarım yenileme (kasa, ana sayfa); entegratör seçimi |
| 4 (9–15 Ara) | Android tasarım; e-arşiv sandbox bağlantısı; sertifika başvurusu |
| 5 (16–22 Ara) | Son özellikler (20 Aralık'ta dondurma); yük/çevrimdışı testleri; güvenlik turu |
| 6 (23–31 Ara) | Yalnız düzeltme; son sürüm, imzalı yayın, site ve bulut güncelleme; yedek geri yükleme provası |

## E. Risk ve bağımlılıklar
- **Şirket kurulmadan** sertifika, iyzico ve entegratör anlaşması tamamlanmaz; bu yüzden takvimde ilk sırada.
- **E-arşiv süresi dar:** 1 Ocak'ta zorunluluk başlıyorsa müşteriler fatura ister; entegratör seçilmezse "yakında" diye söylenir.
- **Tek kişi/tek asistan** ile 6 haftada tasarım yenileme + entegrasyon çakışır: tasarım yenilemeyi kasa ve ana sayfayla sınırlamak önerilir.
- Pilot sonuçları planı değiştirebilir; her hafta başı bu dosya güncellenir.
