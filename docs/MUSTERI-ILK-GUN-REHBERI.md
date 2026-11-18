# Veniux Cloud · Market ve bakkal için ilk gün rehberi

Bu rehber, programı ilk kez kuracak market/bakkal sahibi içindir. Yalnız stok ve satış takibi içindir; yazarkasa, e-Fatura ve e-İrsaliye bu sürümde yoktur.

## 1. Kurulum (5 dakika)
1. Size verilen **Veniux-Setup** dosyasını çift tıklayın.
2. Windows "Windows bilgisayarınızı korudu" derse **Ek bilgi → Yine de çalıştır**'ı seçin. (Program henüz imzalı değil, bu uyarı normaldir.)
3. Kurulum sihirbazını **İleri** ile bitirin. Masaüstünde **Veniux Cloud** kısayolu oluşur.
4. Programı açın, size verilen **lisans anahtarını** (VNX ile başlar) girin ve ilk kurulum adımlarını tamamlayın.

> Güncelleme çıkınca program kendisi indirir. Kurulum sırasında program birkaç dakika kapalı kalabilir; bu normaldir, bitince kısayoldan yeniden açın.

## 2. Ürünlerinizi girin
- Menüden **Hızlı ürün ekle**'yi açın. Barkod okuyucunuzla ürünü okutun, adını, satış fiyatını ve mevcut miktarını yazın.
- Elinizde ürün listesi (Excel/CSV) varsa **Veri Aktarımı → Ürünleri içe aktar** ile hepsini bir seferde yükleyebilirsiniz.
- Kiloyla satılan ürünlerde birim olarak **kg** seçin.

## 3. Kasayı açın ve satış yapın
1. Menüden **Market Kasası**'nı açın. İlk kez açarken **başlangıç nakdini** girip vardiyayı açın.
2. Ürünün barkodunu okutun. Barkod yoksa **Ürün bul**'a adını yazıp seçin.
3. Adedi değiştirmek için **+ / −** düğmelerini kullanın.
4. **Ödeme al**'a basın, **Nakit** ya da **Kart**'ı seçin, tutarı girin ve **Ödemeyi kaydet**'e basın. Fiş numarası ekranın altında görünür.
5. Yanlış bir şey yaparsanız **Diğer → Satış / iade**'den satışı bulup iade edebilirsiniz.

## 4. Gün sonu
- **Diğer → Satış / iade → Gün sonu**: O günün satış adedi, brüt/net satış, nakit ve kart toplamları görünür.
- Kâr raporunu aynı ekrandan **CSV** veya **Excel** olarak indirebilirsiniz.
- Gün bitince **Vardiya**'dan kasayı kapatın.

## 5. Yedekleme (çok önemli, 5 dakikanızı ayırın)
Verileriniz (ürünler, satışlar, stok) bilgisayarınızdadır. Bilgisayar bozulursa ya da çalınırsa yedeğiniz yoksa her şey gider. Program bunu sizin için otomatik yapar, ama **iki şeyi sizin yapmanız gerekir**:

1. **İkinci bir yedek konumu seçin.** Program her gün şifreli bir yedek alır (son 7 günü, 4 haftayı ve 12 ayı saklar). Bu yedekler bilgisayarınızın içindedir. Bilgisayar bozulursa bunlar da gider.
   - **Ayarlar → Sistem → Yedekleme ve geri yükleme** ekranında **İkinci yedek konumu** alanında **Klasör seç**'e basın.
   - Takılı bir **harici disk veya USB bellek** seçin (örneğin `E:\Veniux-Yedek`). Program her yedeğin bir kopyasını oraya yazar.
   - Disk takılı değilse ekranın üstünde sarı bir **"Yedekleme uyarısı"** çıkar. Diski takın, uyarı kaybolur.
2. **Kurtarma kodunu bir kâğıda yazıp saklayın.** Aynı ekranda **Kurtarma kodunu göster** düğmesi vardır. Yedekler bu kodla açılır. Bilgisayarınız bozulursa yeni bilgisayarda yedeği bu kodla geri yüklersiniz. Kod yoksa yedek açılamaz. Kodu bilgisayarınıza değil, **kâğıda veya telefonunuza** yazın.

**Geri yükleme:** Yeni ya da onarılmış bilgisayarda programı kurun, aynı ekranda **Harici kopyadan geri yükle**'yi seçin, kurtarma kodunu yazın ve diskteki `veniux-yedek-….vnxsecure` dosyasını gösterin.

Yedeklerin gerçekten açılabildiğini program kendisi de denemektedir (her açılışta, 14 günde bir). Açılamazsa ekranda kırmızı uyarı çıkar. Bu uyarıyı görürseniz bize haber verin.

## 6. Sık karşılaşılanlar
| Durum | Ne yapmalı |
|---|---|
| Yeni kasiyer giriş yapınca "Depo erişiminiz atanmamış" görüyor | **Ayarlar > Kullanıcılar** bölümünde kasiyerin yanındaki kalkan simgesine basın, çalışacağı depoyu seçip kaydedin. Güvenlik için yeni kullanıcıya hiçbir depo kendiliğinden verilmez |
| Kasiyer indirim, iade veya vardiya açamıyor | Bunlar varsayılan olarak kapalıdır. **Ayarlar > Barkod okuyucular ve kasa > Kasiyer işlem yetkileri** bölümünden yönetici açar |
| Siparişi teslim alırken raf istemiyor musunuz | Raf tanımlamadıysanız "Rafsız (genel depo)" seçili bırakın; mal depoya girer |
| Barkod okutunca ürün bulunamıyor | **Ürün bul**'dan adıyla arayın, ürünün barkodunu ürün kartına ekleyin |
| Stok yanlış görünüyor | **Stok Sayımı** menüsünden sayım yapın |
| Program güncellenirken kayboldu | Birkaç dakika bekleyin, sonra masaüstü kısayolundan açın |

## 7. Destek
Sorun yaşarsanız ne yaptığınızı ve ekranda ne gördüğünüzü bize yazın. Mümkünse ekran görüntüsü ekleyin.

---
*Not: Bu rehber, programın gördüğümüz hâline göre hazırlandı. Lisans ve ilk kurulum adımları sürüme göre küçük farklar gösterebilir.*
