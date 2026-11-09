# Sektör sayfaları, yardım merkezi, destek ve 90 günlük içerik planı (9 Kasım 2026)

Sayfa metinleri: `website-php/sector-pages.php` (taslak; siteye bağlı değil, yayında görünmez).
Kural: Yalnız üründe gerçekten olanı yaz (SEO-ALTYAPISI.md). Uydurma müşteri, yorum, puan veya rakam yok.

---

## 1. Sektör sayfaları: başlık, alt başlık, 5 fayda

### Market — `/market-stok-ve-kasa-programi`
**Başlık:** Market için kasa ve stok, tek ekranda.
**Alt başlık:** Barkodu okutun, satışı kapatın; stok, kampanya ve veresiye kendiliğinden güncellensin.
1. Barkodlu hızlı satış: nakit, kart, parçalı ve veresiye ödeme aynı ekranda.
2. Kampanyalar kasada kendiliğinden uygulanır: “3 al 2 öde”, yüzde indirim, tarih aralığı.
3. Tartılı ürün etiketleri (manav, şarküteri) barkoddan ağırlık veya fiyatla okunur.
4. Kritik stok ve miadı yaklaşan ürün uyarısı; isterseniz e-posta veya SMS ile.
5. İnternet kesilse de yerel kurulumda satış devam eder; yedekler otomatik alınır.

### Kırtasiye — `/kirtasiye-stok-programi`
**Başlık:** Kırtasiyede binlerce ürün, karışmadan.
**Alt başlık:** Okul sezonunda kasa hızlansın, raf boşalmadan sipariş hazır olsun.
1. Küçük ve çok çeşitli ürünler barkodla ya da adla saniyeler içinde bulunur.
2. Sezon kampanyaları tarih aralığıyla kurulur, sezon bitince kendiliğinden durur.
3. Okul ve kurumlara veresiye satış; vade hatırlatması ve tahsilat kaydı.
4. Satın alma siparişi PDF olarak hazırlanır, tedarikçiye e-posta veya WhatsApp ile gider.
5. En çok satanlar ve satılmayan (ölü) stok raporu ile rafı doğru doldurursunuz.

### Hırdavat / nalbur — `/hirdavat-stok-programi`
**Başlık:** Hırdavatta “var mı?” sorusuna anında cevap.
**Alt başlık:** Koli, paket ve adet karışmasın; hangi raf ve depoda ne kaldığını bilin.
1. Koli ve paket barkodları: koli barkodu okutulunca içindeki adet kadar işlenir, stok adet olarak doğru kalır.
2. Kiloyla satılan ürünler (çivi, vida) tartılı ürün olarak satılabilir.
3. Birden çok depo ve şube; depolar arası transfer toplam stoğu şişirmez.
4. Ustalara ve firmalara veresiye: limit, vade ve ekstre.
5. Kritik stok uyarısı ve tedarikçiye tek tıkla sipariş belgesi.

### Kafe / büfe — `/kafe-hizli-satis-programi`
**Başlık:** Tezgâhta hızlı satış, akşam net rapor.
**Alt başlık:** Ürün görsellerine dokunarak satın; hangi saatte ne sattığınızı görün.
1. Görselli hızlı satış ekranı: barkodsuz ürünler bir dokunuşla sepete.
2. Sadakat kartı: her alışverişte puan, sonraki alışverişte indirim.
3. Saat bazlı yoğunluk raporu ile personeli doğru saate planlayın.
4. Kasiyer bazlı satış ve gün sonu raporu.
5. Paketli ürün (içecek, atıştırmalık) stoğu barkodla takip edilir.

> **Sınır, sayfada açıkça yazılmalı:** Masa/adisyon takibi ve reçeteden malzeme düşme yok. Sayfa tezgâhtan satış yapan işletmeleri hedeflemeli. Masa servisi vaat edilirse iade ve şikâyet riski oluşur.

### Eczane — `/eczane-yan-urun-stok` (**karar gerekiyor**)
**Başlık:** Eczanenin ilaç dışı rafları için stok takibi.
**Alt başlık:** Dermokozmetik ve medikal ürünlerde son kullanma tarihi, kampanya ve kritik stok, tek yerde.
1. Son kullanma tarihi lot bazında; yaklaşan ürün için uyarı.
2. Dermokozmetik kampanyaları kasada kendiliğinden uygulanır.
3. Sadakat kartıyla düzenli müşteriye puan.
4. Kritik stok uyarısı ve tedarikçiye sipariş belgesi.
5. Satılmayan ürün raporu ile bağlı kalan sermayeyi görün.

> **Neden karar gerekiyor:** Eczane modülü 13 Ekim 2026'da üründen çıkarıldı. Sitedeki eczane tanıtımları bilerek kaldırıldı; `/eczane-stok-takibi` adresi genel stok sayfasına yönleniyor. Bu sayfa yalnız ilaç dışı ürünleri anlatıyor ve "İTS, MEDULA, reçete yok" uyarısı taşıyor. Önerim: ilaç dışı ürün satışından gelen talep görülene kadar yayınlamayın.

---

## 2. Anahtar kelime önerileri
Bunlar aday listesidir. **Arama hacmini ve rekabeti doğrulamadım;** yayından önce ücretsiz araçlarla (Google Search Console, Google Trends, Google arama önerileri) kontrol edin. Her sayfa tek bir ana niyete odaklanmalı; aynı kelime iki sayfada hedeflenmemeli.

| Sayfa | Ana kelime | Destek kelimeleri |
|---|---|---|
| Market | market programı | market stok takip programı, bakkal kasa programı, barkodlu satış programı, market veresiye programı, tartılı ürün barkod okuma |
| Kırtasiye | kırtasiye programı | kırtasiye stok takibi, kırtasiye kasa programı, kırtasiye barkod programı, kırtasiye veresiye |
| Hırdavat | hırdavat programı | nalbur stok programı, hırdavat stok takibi, nalbur kasa programı, yapı market stok programı |
| Kafe | kafe kasa programı | büfe satış programı, kafe hızlı satış, kahve dükkanı kasa programı, kafe stok takibi |
| Eczane (taslak) | eczane dermokozmetik stok takibi | eczane yan ürün stok, medikal ürün stok takibi |

Uzun kuyruk (rehber yazısı için): “barkod okuyucu nasıl bağlanır”, “stok sayımı nasıl yapılır”, “veresiye defteri nasıl tutulur”, “3 al 2 öde kampanyası nasıl kurulur”, “kritik stok seviyesi nasıl belirlenir”.

---

## 3. Kurulum videosu senaryoları (her biri ~60 sn)
Ortak kurallar:
- Gerçek arayüz kullanılır, ama sentetik örnek işletmeyle; müşteri verisi görünmez.
- Seslendirme Türkçedir; ekranda büyük altyazı olur.
- Son 5 saniyede tek çağrı: “veniux.com’dan indirin”.

**Video 1: İndir, kur, ilk giriş (Windows)**
| Süre | Görüntü | Ses / altyazı |
|---|---|---|
| 0-5 | Logo, boş kasa | “Veniux’u bir dakikada kuralım.” |
| 5-20 | veniux.com → Program indir → kurulum | “Programı indirin, kurulumu açın, ileri deyin.” |
| 20-35 | İlk açılış: yerel/bulut seçimi | “İnternet kesildiğinde de çalışsın istiyorsanız ‘bu bilgisayarda’ seçin.” |
| 35-50 | Firma adı, yönetici hesabı | “Firma adınızı ve yönetici hesabınızı oluşturun.” |
| 50-60 | Panel açılır | “Hazırsınız. Sıradaki videoda ilk ürünü ekliyoruz.” |

**Video 2: İlk ürün ve barkod**
| Süre | Görüntü | Ses |
|---|---|---|
| 0-10 | Ürünler → Yeni ürün | “Ürün eklemenin en hızlı yolu barkodu okutmak.” |
| 10-30 | Barkod okutulur, ad ve fiyat girilir | “Barkod, ad, satış ve alış fiyatı. Hepsi bu.” |
| 30-45 | Stok girişi: 24 adet | “Raftaki miktarı girin.” |
| 45-60 | Excel ile toplu aktarım düğmesi | “Çok ürününüz varsa Excel listenizi tek seferde aktarın.” |

**Video 3: İlk satış**
| Süre | Görüntü | Ses |
|---|---|---|
| 0-10 | Kasa → Vardiyayı aç | “Güne vardiyayı açarak başlayın.” |
| 10-30 | 3 ürün okutulur, kampanya indirimi görünür | “Okutun; kampanya varsa kendiliğinden düşer.” |
| 30-45 | Ödeme: kart / nakit, para üstü | “Ödemeyi seçin, para üstü hesaplanır.” |
| 45-60 | Fiş önizleme, stok düşmüş | “Fiş hazır, stok güncellendi.” |

**Video 4: Kampanya ve sadakat**
- Ayarlar → Kampanya ekle (“3 al 2 öde”) → Sadakat kartı oluştur → Kasada kart okut → Puan kazanıldı.

**Video 5: Yedek ve güvenlik**
- Yedek ayarı (ikinci konum) → Kurtarma kodu → İki aşamalı doğrulama → “Kayıtları doğrula”.

**Sektör kısa kesitleri (15-20 sn):**
- Market: tartılı etiket okutma.
- Kırtasiye: sezon kampanyası.
- Hırdavat: koli/adet birimi.
- Kafe: görselli hızlı satış.

---

## 4. Yardım merkezi yapısı
```
Yardım merkezi
├─ Başlarken: indirme ve kurulum · yerel mi bulut mu · ilk ürün · ilk satış · kullanıcı ekleme
├─ Kasa: vardiya · ödeme türleri · iade/iptal · indirim yetkisi · fiş · gün sonu
├─ Stok ve depo: ürün kartı · barkod · birimler (koli/adet) · tartılı ürün · sayım · transfer · lot/SKT
├─ Satın alma: sipariş taslağı · tedarikçiye PDF/e-posta/WhatsApp · mal kabul
├─ Müşteri: veresiye · vade hatırlatması · sadakat kartı · kampanyalar
├─ Raporlar: gün sonu · brüt kâr · en çok satan · kasiyer · saatlik · ölü stok · şube
├─ Entegrasyonlar: Trendyol · e-belge · muhasebe aktarımı · ÖKC (pilot)
├─ Bildirimler: uyarı türleri · e-posta/SMS/WhatsApp · sessiz saatler
├─ Güvenlik ve yedek: roller · 2FA · cihazlar · işlem kaydı · yedekten dönme
└─ Hesap ve paket: paketler · limitler · fatura · lisans
```
Her makale aynı düzende olur: tek cümlelik amaç, 3-6 adım, sık hata, ilgili video, ilgili makale. Makaleler mevcut `organic-guides.php` biçimiyle sitede yayımlanabilir.

## 5. Yeni SSS (sitedekilerle çakışmayanlar)
1. **İnternet kesilince satış durur mu?** Yerel (bu bilgisayarda) kurulumda durmaz. Bulut kurulumda satış için internet gerekir. Bağlantı satış sırasında koparsa sepet saklanır; bağlantı gelince aynı satış yeniden denenir ve iki kez kaydedilmez.
2. **Verilerim nerede tutuluyor?** Yerel kurulumda bu bilgisayarda, bulutta Veniux sunucusunda firmanıza ayrılmış alanda. Güvenlik sayfasında ayrıntısı var.
3. **Kampanya kasada nasıl uygulanır?** Ürün okutulunca uygun kampanya kendiliğinden düşer; her ürüne en çok indirim veren tek kampanya uygulanır.
4. **Veresiye limitini aşan satış yapılır mı?** Hayır. Limit müşteri kartında tanımlanır; limiti aşan veresiye satış reddedilir. Veresiye satış yalnız yönetici veya müdür yetkisiyle yapılır.
5. **Kaç kullanıcı ve şube açabilirim?** Paketinize göre. Limit dolunca yeni kullanıcı veya depo eklenemez; pasif kullanıcı yer tutmaz.
6. **Yazarkasa (ÖKC) ile çalışır mı?** Token ÖKC entegrasyonu pilot aşamasındadır. Satış fişi yasal olarak ÖKC’den kesilir; Veniux bilgi fişi basar.
7. **Trendyol stoğum otomatik güncellenir mi?** Evet; dakikada bir değişen stok gönderilir, siparişler 5 dakikada bir çekilir.
8. **Kafe için masa takibi var mı?** Hayır. Tezgâhtan satış için uygundur.
9. **Yedekten nasıl geri dönerim?** Ayarlar > Yedek > Yedekten geri yükle. Geri dönüşten önce mevcut veri ayrıca saklanır.
10. **Eczane ilaç satışı yapılır mı?** Hayır. İlaç, reçete, İTS ve MEDULA işlemleri Veniux’ta yoktur.

## 6. Destek kanalları, çalışma saatleri, yanıt süresi sözü (öneri; siz onaylayın)
Tek kişilik ve sıfır sermayeli başlangıç için tutulabilecek, gerçekçi bir söz:

| Kanal | Ne için | Maliyet |
|---|---|---|
| E-posta: `destek@veniux.com` | Her konu; kayıt tutulur | Hosting e-posta kutusu (çoğu hosting pakete dahil; kendi paketinizde kontrol edin) |
| WhatsApp (`wa.me` bağlantısı, işletme numarası) | Hızlı soru, ekran görüntüsü | Ücretsiz (WhatsApp Business uygulaması) |
| Yardım merkezi ve videolar | Kendi kendine çözüm | Ücretsiz |
| Uzaktan bağlantı (müşterinin onayıyla) | Kurulum, aktarım | Ücretsiz araçlar; her oturumu müşteri başlatır |

**Çalışma saatleri:** Hafta içi 09:00–18:00, Cumartesi 10:00–14:00 (Türkiye saati). Resmî tatillerde kapalı.

**Yanıt süresi sözü (iş saatleri içinde):**
| Öncelik | Örnek | İlk yanıt |
|---|---|---|
| Acil | Kasa satış yapamıyor, giriş yapılamıyor | 2 saat |
| Normal | Rapor, ayar, aktarım sorusu | 1 iş günü |
| Öneri | Yeni özellik isteği | 3 iş günü |

- Söz “ilk yanıt” içindir, “çözüm süresi” değildir. Tutamayacağınız bir söz vermeyin; ilk ay gerçek sürelerinizi ölçüp sonra güncelleyin.
- Sitedeki yasal metinde iletişim adresi olarak kişisel Gmail adresiniz geçiyor. `destek@veniux.com` ve `kvkk@veniux.com` açılınca değiştirilmeli (bunu daha önce de not etmiştik).

## 7. İlk 90 günlük içerik takvimi
Kapasite varsayımı: haftada 1 makale ve 1 kısa video. Daha fazlasını sözlemeyin.

| Hafta | Site / yardım merkezi | Video / sosyal | Hedef |
|---|---|---|---|
| 1 | Market sayfası (görselle yayın) | Video 1: indir-kur | Temel sayfa |
| 2 | Rehber: barkod okuyucu nasıl bağlanır | Video 2: ilk ürün | Uzun kuyruk |
| 3 | Kırtasiye sayfası | Video 3: ilk satış | Sektör |
| 4 | Rehber: stok sayımı nasıl yapılır | Market kesiti: tartılı etiket | Uzun kuyruk |
| 5 | Hırdavat sayfası | Hırdavat kesiti: koli/adet | Sektör |
| 6 | Rehber: veresiye defteri nasıl tutulur | Video 4: kampanya ve sadakat | Uzun kuyruk |
| 7 | Kafe sayfası (sınırları açık) | Kafe kesiti: hızlı satış | Sektör |
| 8 | Rehber: “3 al 2 öde” kampanyası | Kırtasiye kesiti: sezon kampanyası | Uzun kuyruk |
| 9 | SSS sayfası güncellemesi (bölüm 5) | Video 5: yedek ve güvenlik | Güven |
| 10 | Rehber: kritik stok seviyesi belirleme | Rapor ekranları turu | Uzun kuyruk |
| 11 | Rehber: Trendyol stok eşitleme | Trendyol kısa tanıtım | Entegrasyon |
| 12 | 90 gün değerlendirmesi: Search Console’da hangi sayfa gösterim aldı | — | Ölçüm |
| 13 | En çok gösterim alan sayfayı genişlet | En çok izlenen videonun devamı | Ölçüm |

Okul sezonu (Ağustos–Eylül) bu 90 günün dışında kalıyor. Kırtasiye kampanya içeriği Temmuz’da yeniden öne alınmalı.

## 8. Doğrulanmayanlar
- Anahtar kelimelerin arama hacmi ve rekabeti.
- Hosting paketinizin e-posta kutusu sunup sunmadığı.
- Sektör sayfaları için gerçek ekran görüntüleri henüz alınmadı; sayfalar görselsiz yayınlanmamalı.
