# Donanım test rehberi — gerçek cihaz testleri

Bu testler **yapılmadı**. Hiçbiri `REAL_DEVICE_VERIFIED` değil. Her bölüm: gereken şey, adımlar, geçme ölçütü, sonucu nereye yazacağın. Sonuçları `docs/release-2027-01-01/PROGRESS.md` "Gerçek test" sütununa, tarih ve cihaz modeliyle ekle.

## 1. Windows kasa bilgisayarı — uzun süreli kullanım
Gerekli: Veniux 2.4.114+ kurulu, bir deneme işletmesi, buluta bağlı mağaza anahtarı.
1. Ayarlar → Barkod okuyucular ve kasa → Mağaza–bulut eşitleme: anahtarı gir, **Şimdi gönder**.
2. 8 saat kasayı açık bırak; her saat 5 satış yap (nakit/kart karışık).
3. İnterneti 15 dakika kes, 10 satış yap, geri aç.
4. Bilgisayarı satış yarım kalmışken yeniden başlat; program açılınca eşitlemenin sürdüğünü kontrol et.
5. Geçti: bulutta satış sayısı ve toplamı yerel rapora eşit; yinelenen yok; Ayarlar → Tanılama "Hızlı tarama" temiz.

## 2. Tartı (CAS, Mettler Toledo, Dibal/Bizerba, genel)
Gerekli: tartı + USB-seri adaptör, Windows program (Web Serial: Chrome/Edge veya masaüstü).
1. Terazi panelinde modeli ve baud hızını seç (çoğu: 9600, 8N1), **Teraziyi bağla**.
2. **Teşhis** bölümünü aç: gelen satırları ve "okundu/okunamadı" durumunu gör.
3. Boş tartı, 500 g, 1,250 kg, taşan ağırlık, dara, sıfırla, kararsız (hareket ettirerek).
4. Kabloyu çıkar-tak.
5. Teşhis satırlarını **Panoya kopyala** ile kopyala ve bana gönder. Okunamayan satır varsa protokol düzeltmesi yaparım.
6. Geçti: kararlı ağırlık satışa doğru miktarla düşüyor; kablo çıkınca "koptu" uyarısı, takılınca yeniden bağlanıyor.
Bilinen: Toledo "SI" yoklamalı, CAS sürekli akış varsayıldı; gerçek cihazın el sıkışması ve satır sonu doğrulanmadı.

## 3. Zebra Android el terminali (DataWedge)
Gerekli: Zebra TC21/TC26 vb., Veniux Android 2.4.114+.
1. DataWedge'de profil: uygulama `com.veniux.companion`, Intent output → action `com.veniux.companion.SCAN`, kategori `android.intent.category.DEFAULT`, teslim "Broadcast intent".
2. Uygulamayı aç, tetiğe bas; barkod alanına düşüyor mu?
3. Aynı barkodu hızla iki kez okut (yinelenen tarama).
4. Uygulamayı arka plana al/ön plana getir; cihazı yeniden başlat.
5. İnterneti kapat, tara.
Geçti: her tarama bir kez işleniyor, arka plan/yeniden başlatma sonrası profil çalışıyor.
Emülatörle (cihazsız): `adb shell am broadcast -a com.veniux.companion.SCAN --es com.symbol.datawedge.data_string 8690123456789`.

## 4. Yeni nesil ÖKC
**Şirket ve üretici onayı olmadan başlama.** Gerekli: cihaz, üretici SDK/dokümanı, GİB teknik rehberi, yetkili servis. Mevcut kod yalnız simülatör sürücüsü; hiçbir marka sürücüsü yok (`docs/ECR-SURUCU-REHBERI.md`).
1. Üreticiden geliştirici dokümanı ve test cihazı al.
2. Sürücüyü rehberdeki sözleşmeye göre yaz; önce `RecordedTransport` ile kayıtlı çerçevelerle sına.
3. Test fişi: **mali değeri olmayan test modu** ile.
Geçti: fiş numarası ve Z numarası dönüyor; bağlantı kopmasında "belirsiz" durumu cihazdan sorgulanıyor.

## 5. Fiş yazıcısı (ESC/POS)
1. Kasa → Yazıcı ayarlarında 58/80 mm seç, Tanılama → "Deneme fişi yazdır".
2. Türkçe/Azerbaycanca karakterleri (ç ğ ı ö ş ü ə) kontrol et; metin kesilmesi, kağıt kesme ve çekmece komutu.
Geçti: karakterler doğru, kesim ve çekmece çalışıyor. Not: `ə` yazıcı kod sayfasına bağlı; kodda ASCII'ye (`e`) indirgeniyor.

## 6. Barkod okuyucu (USB HID / Bluetooth)
1. Kasa barkod alanına odaklan, EAN-13 ve EAN-8 oku.
2. Sonlandırıcı (Enter/Tab) ayarını Teşhis → Barkod okuyucu testi ile doğrula.
Geçti: her tarama bir kez, öndeki sıfır korunuyor.
