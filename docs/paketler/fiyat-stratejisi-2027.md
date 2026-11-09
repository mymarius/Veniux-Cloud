# Veniux fiyat stratejisi ve fiyatlandırma sayfası (9 Kasım 2026, öneri)

**Okuma kuralı:** Kendi hesapladığım her rakamın yanında **[hesap]**, senin verdiğin rakamların yanında **[senin verin]**, doğrulanmamış pazar rakamlarının yanında **[DOĞRULA]** yazıyor. Pazar referanslarını ben doğrulamadım; yayından ve görüşmeden önce rakiplerin kendi fiyat sayfalarından bugünkü fiyatı kontrol et.

---

## 0. Önce eksik listesinin düzeltilmesi (fiyat savunmasını değiştiriyor)
| Senin "eksik" dediğin | Koddaki gerçek durum | Fiyatta nasıl anlatılır |
|---|---|---|
| Çevrimdışı çalışma | Masaüstünün yerel kurulumu internetsiz çalışıyor; lisans 72 saat internetsiz geçerli. Bulut kurulumda çevrimdışı satış yok. | "Yerel kurulumda internet kesilse de satış sürer" denebilir. Bulut için söylenmez. |
| Pazaryeri | Trendyol (stok, fiyat, sipariş, iade, komisyon raporu) hazır, ama **henüz yayında değil**. | Yayınlanınca İşletme ve üstünün farkı olur. Yayından önce satılmaz. |
| e-Fatura | Uyumsoft entegrasyonu kodda var. Canlı gönderim ayarla kapalı; gerçek hesapla denenmedi. | "Pilot / yakında" denebilir. Pakete dahil diye satılmaz. |
| iOS | Yok. | Android ve Windows var diye anlatılır. |
| Referans müşteri | Az **[senin verin]**. | Fiyatı aşırı yükseltmemenin en güçlü sebebi bu. |

---

## 1. Fiyat analizi: taslağının eleştirisi

### Mevcut, senin taslağın ve önerim (yıllık)
| Paket | Mevcut (KDV hariç) | Taslağın (KDV hariç) | Önerim (KDV hariç) | Önerim (KDV dahil) |
|---|---|---|---|---|
| Başlangıç | 2.990 | 3.990 (+%33) | **3.490 (+%17)** | 4.188 |
| İşletme | 5.990 | 7.990 (+%33) | **8.990 (+%50)** | 10.788 |
| Kurumsal | 11.990 | 24.990 (+%108) | **29.990'dan başlayan (+%150)** | 35.988'den |

Kaynak: mevcut ve taslak fiyatlar **[senin verin]**; KDV %20; yüzdeler **[hesap]**.

### Birim maliyetler (KDV hariç, paket sınırı dolu varsayımıyla) **[hesap]**
| Paket | Kullanıcı başı: mevcut → öneri | Depo başı: mevcut → öneri |
|---|---|---|
| Başlangıç (5 kişi, 1 depo) | 598 → 698 | 2.990 → 3.490 |
| İşletme (15 kişi, 3 depo) | 399 → 599 | 1.997 → 2.997 |
| Kurumsal (250 kişi, 50 depo) | 48 → 120 | 240 → 600 |

### Değerlendirme
- **En çok düşük kalan paket Kurumsal; açık ara.** Sınırı dolu bir Kurumsal müşteri, kullanıcı başına yılda ~48 ₺ ödüyor **[hesap]**. Taslağındaki 24.990 bile kullanıcı başına 100 ₺. 50 depolu bir işletme için bu, depo başına yılda 500 ₺ eder; böyle bir işletmenin bütçe ölçeğiyle uyumsuz. Logo Cloud Standard (43.900 ₺ **[DOĞRULA]**) gibi kurumsal ürünlerin altında kalmak doğru, ama yarısının da altında kalmak gereksiz. Önerim: 29.990+KDV'den "başlayan" fiyat ve 10 depo üstünde teklif. Kurumsal müşteri az sayıdadır; her biri görüşmeyle fiyatlanmalı.
- **İşletme ikinci sırada.** Bu oturumda İşletme'ye veresiye, sadakat, gelişmiş raporlar, asistan ve şube karşılaştırması eklendi; Trendyol da yayınlanınca buraya girecek. 3 şubeli bir market için 8.990 ₺, orta market aralığının (3.600-12.000 ₺ **[senin verin, DOĞRULA]**) üst-ortasında kalıyor. Çok şube ve pazaryeri farkı bunu savunur. Taslağındaki 7.990 da savunulabilir; ama Başlangıç ile farkı yalnız 4.000 ₺ olduğu için İşletme'ye geçiş kararını zayıflatmıyor, aynı zamanda değerini de göstermiyor.
- **Başlangıç'ı taslağından biraz düşük tutmanı öneririm (3.490).** Sebepler:
  - Küçük market yazılımlarının üst sınırı 3.600 ₺ civarı **[senin verin, DOĞRULA]**; 3.990 bu aralığın dışına çıkıyor.
  - Referans müşterin az. Başlangıç senin giriş kapın; burada itiraz almak, en çok kazanacağın paketlere hiç ulaşamamak demek.
  - Başlangıç'ta kasa, depo, lot/miat ve uyarılar zaten var; bu fiyatta "değerli ama ulaşılabilir" görünür.
- **Paraşüt karşılaştırması:** Paraşüt bir ön muhasebe ürünü (11.280 ₺+KDV **[senin verin, DOĞRULA]**). Veniux muhasebenin yerine geçmiyor; kıyas fiyat tavanı değil, "işletme sahibi bir yazılıma bu kadarını ödemeye alışkın" bilgisidir. İşletme paketinin buna yakın olması kabul edilebilir bir işaret.

---

## 2. Paket yapısı: özellik dağılımı
Amaç: İşletme ve Kurumsal'ın fiyatı yalnız sınırla değil, **para kazandıran veya kaybı önleyen** özelliklerle savunulsun. Tablo uygulamadaki gerçek paket kurallarıyla uyumlu (e9ed7ec). "Öneri" sütunundaki değişiklikler kodda henüz yok.

| Özellik | Başlangıç | İşletme | Kurumsal | Durum |
|---|---|---|---|---|
| Kasa / POS (barkod, nakit, kart, parçalı) | ✓ 1 kasa | ✓ 3 kasa | ✓ 50 kasa | Kodda böyle |
| Kampanyalar | ✓ | ✓ | ✓ | Kodda böyle |
| Ürün, barkod, stok, mal kabul, sayım | ✓ | ✓ | ✓ | Kodda böyle |
| Lot ve miat (SKT) | ✓ | ✓ | ✓ | Kodda böyle |
| Kritik stok, miat, sayım farkı, kayıp şüphesi uyarısı (uygulama içi) | ✓ | ✓ | ✓ | Kodda böyle |
| Uyarıların e-posta/SMS/WhatsApp ile iletimi | ✓ | ✓ | ✓ | Kodda böyle. **Öneri:** İşletme+'ya taşı |
| Sipariş önerisi + tedarikçiye PDF/e-posta | ✓ | ✓ | ✓ | Kodda böyle. Kalsın: Başlangıç'ın en güçlü değeri |
| Veresiye / cari, vade hatırlatması | — | ✓ | ✓ | Kodda böyle |
| Sadakat kartı | — | ✓ | ✓ | Kodda böyle |
| Kâr/zarar, kasiyer, saatlik rapor | — | ✓ | ✓ | Kodda böyle |
| İşletme asistanı | — | ✓ | ✓ | Kodda böyle |
| Depolar arası transfer, şube karşılaştırması | (tek depo) | ✓ | ✓ | Kodda böyle |
| Trendyol entegrasyonu | — | ✓ | ✓ | **Öneri** (yayından sonra kodda kısıtlanmalı) |
| Şube bazlı erişim (şube müdürü) | — | ✓ | ✓ | Kodda tüm paketlerde; tek depoda anlamsız |
| İşlem kaydı bütünlük kontrolü, 2FA zorunluluğu | ✓ | ✓ | ✓ | Güvenlik herkese açık kalmalı |
| Destek | E-posta + WhatsApp, 1 iş günü | + öncelikli, acil kasa sorunu 2 saat | + kurulum görüşmesi, veri aktarım desteği, yıllık değerlendirme | **Öneri** (bölüm 6 ile uyumlu) |

**İlke:** Güvenlik, yedek ve temel stok doğruluğu hiçbir pakette kısıtlanmaz. Kısıtlanan şeyler büyüme özellikleri (çok şube, veresiye, pazaryeri, analiz) ve hizmet seviyesidir.

---

## 3. Ek kullanım fiyatları (yıllık, KDV hariç) **[hesap; öneri]**
| Ek | Başlangıç | İşletme | Kurumsal | Gerekçe |
|---|---|---|---|---|
| Ek kullanıcı | Yok (İşletme'ye geçiş) | 390 ₺ | Teklif | İşletme'nin kullanıcı başı ~599 ₺; ek kullanıcı daha ucuz olmalı ama sınırsız büyümeyi pahalı tutmalı |
| Ek depo/şube | Yok | 1.990 ₺ | Teklif | İşletme'nin depo başı ~2.997 ₺; 3 ek depo (5.970 ₺) Kurumsal'a geçişi düşündürmeli |
| Ek cihaz (el terminali, telefon) | 290 ₺ | 290 ₺ | Teklif | Cihaz desteği düşük maliyetli; engel olmasın |
| Ek kasa | 990 ₺ | 990 ₺ | Dahil | Kasa doğrudan gelir üretir |

Başlangıç'ta ek kullanıcı ve depo satmamak bilinçli bir tercih: Başlangıç + 2 depo, İşletme'den pahalıya gelmeli ki müşteri doğru pakete geçsin. **Kodda ek kullanım henüz yok;** şimdilik lisans sınırlarını elle yükselterek teklif edilir.

---

## 4. Ödeme dönemleri ve yenileme
- **3 aylık fiyat** = yıllık / 4 × 1,25. Yıllık ödemeyi ~%20 avantajlı yapar ("yıllıkta ~2,5 ay bedava" etkisi).
  - Başlangıç: 1.090+KDV (1.310) **[hesap]**
  - İşletme: 2.810+KDV (3.370) **[hesap]**
  - Kurumsal: yalnız yıllık veya teklif.
  - Şu an 3 aylık ile yıllık farkı ~%32 **[hesap: 1.188×4=4.752 / 3.588]**; bu fazla. Fark büyükse müşteri 3 aylıkta "cezalandırıldığını" hisseder.
- **Yıllık ödemeye teşvik:**
  - Yıllıkta 12 ay fiyat sabitlemesi.
  - Ücretsiz kurulum görüşmesi ve Excel ürün aktarımına yardım (zamanını sınırla, ör. 1 saat).
  - 3 aylıktan yıllığa geçişte ödenen son dönemin mahsubu.
- **Yenileme politikası (sözleşme/teklif metni önerisi; hukukçuya göster [DOĞRULA]):**
  > “Paket bedeli sözleşme süresi boyunca sabittir. Yenilemede bedel, en fazla son 12 aylık TÜFE değişimi (TÜİK) oranında güncellenebilir. Güncel bedel yenileme tarihinden en az 30 gün önce yazılı olarak bildirilir. Paket içeriği daraltılmaz; yeni eklenen özelliklerin ek bedeli ayrıca teklif edilir.”

  Tavan olarak TÜFE yazmak güven verir; daha az artırma hakkın da saklı kalır.

---

## 5. Mevcut müşteriler
- **Fiyat garantisi:** Mevcut müşteri, sözleşme sonuna kadar eski fiyattan devam eder. İlk yenilemede artış en fazla TÜFE kadar olur ya da yeni fiyatın %80'i uygulanır; hangisi düşükse o. Bu artışın tamamı ikinci yenilemede uygulanır.
- **Neden:** Az müşterin var ve her biri referans. Erken müşteriyi korumak, satış görüşmesinde "ilk müşterilerimizi koruyoruz" cümlesini doğru kılar.
- **Geçiş mesajı (taslak):**
  > Merhaba [Ad Bey/Hanım], Veniux’u ilk kullanan işletmelerden biri olduğunuz için teşekkür ederiz. [Tarih] itibarıyla yeni müşteriler için paket fiyatlarımız değişiyor. Sizin mevcut sözleşmeniz [bitiş tarihi]’ne kadar aynı bedelle devam ediyor. İlk yenilemenizde artış [en fazla TÜFE / yeni fiyatın %80’i] ile sınırlı olacak. Bu dönemde eklenen kampanya, sadakat, şube raporları ve uyarı iletimi paketinize dahil. Sorunuz olursa bu numaradan bize yazabilirsiniz.

---

## 6. İlk 10 görüşmede test planı
- **Yöntem:** Fiyatı söylemeden önce müşterinin sorununu ve bugünkü maliyetini konuş. Sonra üç paketi birlikte göster; en çok İşletme'yi anlat ("çoğu işletme burada başlıyor" deme; doğrulanmış değil).
- **Her görüşmede kaydet (basit tablo):** sektör, şube/kasa sayısı, bugün ne kullanıyor ve ne ödüyor, ilk tepki (sessizlik / pazarlık / ret / "tamam"), en çok ilgilendiği özellik, kapanış sonucu.
- **Yorum:**

| Duyduğun | Anlamı |
|---|---|
| “Bu özellik bende yok, gerek yok” / “Tek kasam var, şube yok” | Yanlış paket; fiyat değil. Başlangıç'a yönlendir. |
| “Şu programa X veriyorum” (X sizden az) | Gerçek fiyat itirazı. Not al: X kaç, o program ne yapıyor? |
| “Taksit olur mu? / 3 aylık başlayalım” | Fiyat kabul, nakit akışı sorunu; fiyat doğru. |
| “Bir düşüneyim” ve sonra cevap yok | Belirsiz; çoğunlukla değer anlaşılmamıştır. |
| İndirim istemeden kabul | Fiyat muhtemelen düşük. |
| e-Fatura / iOS soruyor | Eksik özellik itirazı; fiyattan bağımsız kaydet. |

- **Karar kuralı (10 görüşme sonunda):**
  - 10 görüşmeden 7+ itirazsız kabul ederse fiyat düşük; bir sonraki 10 görüşmede İşletme'yi ~%10 artır.
  - 6+ görüşme fiyat yüzünden kaybedilirse (özellik eksikliği değil) Başlangıç'ı veya İşletme'yi ~%10 düşür.
  - Arada kalırsa fiyatı koru, anlatımı düzelt.
  - 10 görüşme istatistik değil, yön göstergesidir.
- **Ne zaman yeniden güncellenir:**
  - Her büyük eksik kapandığında (Trendyol yayını, canlı e-Fatura) İşletme fiyatı gözden geçirilir; yeni müşteriler için +%10-15 makul.
  - İlk 3 referans müşteriden yazılı izinli görüş alındığında Kurumsal "başlayan" fiyatı netleşir.
  - En geç 6 ayda bir TÜFE gözden geçirmesi.

---

## 7. Fiyatlandırma sayfası metni (veniux.com/fiyatlandirma)

**Başlık:** Kasanız, stoğunuz ve şubeleriniz için tek fiyat.
**Alt başlık:** Kasa ve depo her pakette. İşletmeniz büyüdükçe şube, veresiye, sadakat ve analiz eklenir. Fiyatlar yıllık ve KDV dahildir; teklifle başlarız, online ödeme yoktur.

**Değer paragrafı (stok kaybı):**
> Rafta görünüp sistemde olmayan, sistemde görünüp rafta olmayan her ürün, ya kaçan bir satış ya da bağlanmış bir paradır. Son kullanma tarihi geçen ürün çöpe gider; sayılmayan fark ay sonunda “nereye gitti” sorusuna dönüşür. Veniux bu farkları ay sonunda değil, oluştuğu gün gösterir: kritik stok, yaklaşan miat, sayım farkı ve kayıp şüphesi uyarısı her pakette vardır. Kaybın ne kadar azalacağı işletmenize bağlıdır; biz yalnız ölçebileceğiniz bir yer veriyoruz.

(Bilinçli olarak yüzde veya TL rakamı yok: doğrulanmış bir veri olmadan “kaybı %X azaltır” denmemeli.)

**Paketler:**
- **Başlangıç — 4.188 ₺/yıl (KDV dahil).** *Kimin için:* Tek kasası ve tek deposu olan market, kırtasiye, büfe. *Açıklama:* Barkodlu kasa, kampanya, stok, lot ve miat, sipariş önerisi ve kayıp uyarıları. 1 depo, 5 kullanıcı, 3 cihaz, 1 kasa.
- **İşletme — 10.788 ₺/yıl (KDV dahil).** *Kimin için:* 2-3 şubesi olan, veresiye çalışan veya müşteri sadakatine önem veren işletme. *Açıklama:* Başlangıç'taki her şey, artı veresiye ve vade hatırlatması, sadakat kartı, kâr/kasiyer/saatlik raporlar, işletme asistanı, şube karşılaştırması ve öncelikli destek. 3 depo, 15 kullanıcı, 10 cihaz, 3 kasa.
- **Kurumsal — 35.988 ₺/yıl'dan başlayan (KDV dahil).** *Kimin için:* Çok şubeli zincirler ve büyük depolar. *Açıklama:* İşletme'deki her şey, 50 depo, 250 kullanıcı, 100 cihaz, kurulum ve veri aktarımı desteği. 10 şube üstü için teklif.

**Özellik tablosu:** Bölüm 2'deki tablonun "Durum" sütunu çıkarılmış ve yalnız yayındaki özellikleri gösteren hali. Trendyol ve e-Fatura yayından önce tabloya girmez.

**Ek kullanım:** Ek kullanıcı 468 ₺, ek depo 2.388 ₺, ek cihaz 348 ₺, ek kasa 1.188 ₺ (yıllık, KDV dahil, İşletme için) **[hesap: bölüm 3 × 1,2]**.

**Dahil olmayanlar:** Donanım (barkod okuyucu, yazıcı, terazi, el terminali), barındırma, özel veri aktarımı, yazarkasa (ÖKC) cihazı.

**SSS:**
1. **Hangi paket bana uygun?** Tek kasa ve tek depoysanız Başlangıç. Şubeniz, veresiyeniz veya sadakat kartınız varsa İşletme.
2. **3 aylık ödeyebilir miyim?** Evet; Başlangıç ve İşletme’de 3 aylık seçenek var. Yıllık ödeme yaklaşık %20 daha avantajlıdır.
3. **Fiyat yenilemede artar mı?** Sözleşme süresince sabittir. Yenilemede en fazla son 12 aylık TÜFE kadar güncellenebilir ve 30 gün önce bildirilir.
4. **Paket değiştirebilir miyim?** Evet. Kalan sürenin bedeli yeni teklifte mahsup edilir.
5. **İnternet kesilince ne olur?** Bilgisayara kurulan (yerel) sürümde satış devam eder. Bulut sürümde internet gerekir.
6. **e-Fatura var mı?** Entegrasyon hazırlık aşamasında; canlı kullanıma açıldığında duyuracağız.
7. **iPhone uygulaması var mı?** Şu an Windows ve Android var; iPhone sürümü yok.
8. **Ödeme nasıl yapılır?** Teklif ve havale ile. Sitede kart ile ödeme yoktur; kayıt olmak ücretli lisansı kendiliğinden açmaz.

---

## 8. İtiraz yanıtları
**“Çok pahalı.”**
> Anlıyorum. Neye göre pahalı olduğunu sorabilir miyim, bugün ne kullanıyorsunuz? [Dinle.] Bu bedel ayda yaklaşık [paket/12] ₺ ediyor. Ayda bir koli son kullanma tarihi geçen ürünü ya da sayımda kaybolan birkaç ürünü önlemek bunu karşılayabilir; ama bunu sizin rakamlarınızla birlikte hesaplayalım. İhtiyacınız tek kasaysa Başlangıç’la başlayabilirsiniz.

**“X programı daha ucuz.”**
> Doğru olabilir; X’in fiyatını ve içinde neler olduğunu birlikte bakalım. Şunları soruyorum: kasa ve depo aynı programda mı, şubeler arası transfer ve şube karşılaştırması var mı, son kullanma ve sayım farkı uyarısı var mı, internet kesilince satış sürüyor mu? Bunlar sizin için önemli değilse X sizin için doğru seçim olabilir; önemliyse fark buradan geliyor.

**“Ücretsiz programlar var.”**
> Var, ve küçük bir dükkân için yeterli olabilir. Ücretsiz programlarda genelde yedeğin, desteğin ve verinin sorumluluğu sizde kalır. Veniux’ta otomatik yedek, kurtarma, yetki ve işlem kaydı, bir soru olduğunda ulaşabileceğiniz destek var. Kasada bir gün satış yapamamanın maliyeti, yıllık bedelden fazla olabilir.

(Rakip hakkında doğrulamadığın bir şeyi söyleme; yalnız soru sor.)

---

## Nihai fiyat önerisi (tek tablo)
| Paket | Yıllık KDV hariç | Yıllık KDV dahil | 3 aylık KDV hariç | 3 aylık KDV dahil | Sınırlar (depo / kullanıcı / cihaz / kasa) |
|---|---|---|---|---|---|
| Başlangıç | 3.490 ₺ | 4.188 ₺ | 1.090 ₺ | 1.308 ₺ | 1 / 5 / 3 / 1 |
| İşletme | 8.990 ₺ | 10.788 ₺ | 2.810 ₺ | 3.372 ₺ | 3 / 15 / 10 / 3 |
| Kurumsal | 29.990 ₺'den | 35.988 ₺'den | — (yıllık/teklif) | — | 50 / 250 / 100 / 50 |
| Ek kullanıcı (İşletme) | 390 ₺ | 468 ₺ | — | — | — |
| Ek depo (İşletme) | 1.990 ₺ | 2.388 ₺ | — | — | — |
| Ek cihaz | 290 ₺ | 348 ₺ | — | — | — |
| Ek kasa | 990 ₺ | 1.188 ₺ | — | — | — |

Tüm rakamlar **[hesap]**: senin taslağından ve mevcut fiyatlardan türettiğim öneriler, pazar araştırması değil. KDV %20. 3 aylık = yıllık/4 × 1,25, 10'a yuvarlandı; KDV dahil 3 aylık rakamlar bu yuvarlanmış tutarın ×1,2'sidir.
**Bu fiyatlar sitede uygulanmadı.** Onaylarsan `website-php/pricing.php` ve sayfa metnini bu tabloya göre güncellerim.
