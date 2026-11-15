# Veniux Online Mağaza: kapsam ve plan

Hazırlandı: 15 Kasım 2026. Amaç: her işletmenin, Veniux'taki ürün ve stoğuyla çalışan **kendi online mağazasını** açabilmesi.
Başka bir e-ticaret yazılımıyla (ikas vb.) entegrasyon değil; benzer özellikler Veniux'un içinde olacak. Henüz kod yazılmadı.

## 1. Veniux'un güçlü tarafı
Online mağaza ayrı bir yazılım olmayacak: **stok, kasa ve online sipariş aynı stok havuzunu kullanır.** Kasadan satılan ürün online mağazada
anında azalır, online sipariş depodan düşer. İkinci bir sistemde stok eşitleme derdi yoktur. Çoklu depo, lot/miat, sektör
paketleri (koli, takım, porsiyon) de mağaza tarafında kullanılabilir.

## 2. Özellik haritası (ikas türü bir platformda beklenenler ve bizdeki durum)
| Özellik | Bugün Veniux'ta | Plan |
|---|---|---|
| Ürün, kategori, fiyat, stok | Var | Mağazada gösterilir |
| **Ürün görseli ve açıklaması** | **Yok** (ürün tablosunda görsel/açıklama alanı yok) | Faz 1 |
| **Vitrin (ürün listesi, ürün sayfası, arama, kategori)** | Yok | Faz 1 |
| **Sepet ve sipariş** | Yok | Faz 1 |
| **Sipariş yönetimi (yeni → hazırlanıyor → kargoda → teslim, iptal)** | Yok (restoran siparişi ayrı) | Faz 1 |
| Ödeme: kapıda, havale/EFT, mağazadan teslim | Yok | Faz 1 |
| Stok düşüşü / iptalde geri | Var (restoranda), ortak mantık | Faz 1 |
| Müşteri kaydı | Var (CRM) | Siparişten otomatik müşteri |
| Sipariş bildirimi (e-posta, SMS) | Altyapı var (Netgsm SMS, e-posta) | Faz 1 (işletmeye), Faz 2 (müşteriye) |
| Paylaşım bağlantısı, QR | Yok | Faz 1 |
| Temel SEO (başlık, açıklama, site haritası) | Veniux sitesinde var | Faz 1 |
| Kampanya / indirim | Var (kasada) | Faz 2: indirim kodu, sepette kampanya |
| Kargo: ücret kuralları, takip no girişi | Yok | Faz 2 |
| Varyant (beden, renk) | Kısmen (kasada) | Faz 2 |
| Müşteri hesabı, sipariş sorgulama | Yok | Faz 2 |
| Özel alan adı, tema/görünüm seçenekleri | Yok | Faz 2 |
| **Kredi kartı ile online ödeme** | Yok | **Faz 3 (şirket gerekli)** |
| Kargo firması entegrasyonu | Yok | Faz 3 |
| e-Arşiv fatura | Yok | Faz 3 (mali müşavir, şirket) |
| Pazaryeri ve diğer kanal bağlantıları | Kısmen (Trendyol, denenmedi) | Faz 3 |

## 3. Fazlar

### Faz 1: Online mağaza ve sipariş (şirket gerekmez)
- İşletme panelinde **"Online Mağaza"**: mağaza adı, kısa açıklama, logo, iletişim (e-posta; WhatsApp düğmesi istenirse, numara sayfada yazılmaz), teslimat seçenekleri, kapıda/havale/mağazadan teslim, minimum sepet ve kargo ücreti, havale IBAN notu.
- **Ürüne görsel ve açıklama** ekleme (görsel yükleme, boyutlandırma, sınır).
- **Herkese açık vitrin:** `app.veniux.com/magaza/<mağaza-adı>`: kategori, arama, ürün sayfası, sepet, sipariş formu (ad, telefon, adres, not). Telefondan rahat kullanılacak şekilde.
- **Sipariş gelince:** stok düşer, işletmeye bildirim (e-posta, uygulamada), sipariş listesinde "Yeni". Durumlar: yeni, hazırlanıyor, kargoda/hazır, teslim edildi, iptal (iptalde stok geri gelir).
- **Güvenlik:** başka işletmenin ürünü görünmez/sipariş edilemez, her işletme yalnız kendi siparişlerini görür; sipariş uçlarında istek sınırı ve tekrar gönderim koruması; sahte sipariş için bal küpü alanı (Turnstile gelince eklenir).
- **Yeni veritabanı tabloları** (mağaza ayarı, sipariş, sipariş kalemi, ürün görseli, ürün açıklaması): bulut şeması 022 olur; yalnız ekleme, canlı veri korunur.
- Kapsam dışı: online kart ödemesi, kargo entegrasyonu, fatura.

### Faz 2: Satışı büyütenler
İndirim kodu, kargo ücret kuralları ve takip numarası, ürün varyantı, müşteri hesabı ve sipariş sorgulama, özel alan adı (ör. `magaza.firmaadi.com`), vitrin renk ve düzen seçenekleri, müşteriye sipariş SMS/e-postası.

### Faz 3: Şirket ve sözleşme gerektirenler
Kredi kartı ödemesi (iyzico, PayTR gibi sağlayıcı ve şirket/VKN gerekir), kargo firmaları, e-Arşiv, pazaryeri bağlantıları. Bunlar için şirket ve mali müşavir önkoşul.

## 4. Hukuki konular (kodlamadan önce netleşmeli)
Online satış yapan işletme (bizim müşterimiz) **mesafeli satış** kurallarına tabidir: ön bilgilendirme, cayma hakkı, sipariş onay bildirimi, KVKK aydınlatması. Biz **şablon metin** sağlarız (işletme düzenler), ama metinlerin yeterliliği için avukat/mali müşavir görüşü gerekir. Veniux bu verilerde **veri işleyen** olur; KVKK ve gizlilik metnimizin buna göre güncellenmesi gerekir.

## 5. Kararlar (bekleyen)
1. Adres: `app.veniux.com/magaza/<ad>` ile başlayıp özel alan adını Faz 2'ye bırakmak.
2. Faz 1'de online kart ödemesi olmadan başlamak (kapıda ödeme, havale/EFT, mağazadan teslim).
3. Önce hangi sektörlerde denenecek (öneri: market/kırtasiye/züccaciye gibi ürün satanlar; restoran için ayrı "QR menü + paket sipariş").
4. Görsel yüklemede dosya boyutu sınırı (öneri: ürün başına 5 görsel, her biri en çok 2 MB, otomatik küçültme).

## 6. Tahmini sıra
Şema ve tablolar → mağaza ayarı ve sipariş uçları + testler → ürün görseli/açıklaması → herkese açık vitrin → panelde sipariş yönetimi → telefonda ve masaüstünde deneme → bulut dağıtımı (şema 022) → pilot işletme.
