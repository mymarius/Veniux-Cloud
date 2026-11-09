# İki aşamalı doğrulama, işlem kaydı ve saklama süresi (9 Kasım 2026)

**Hukuki görüş değildir.** "[DOĞRULA]" işaretli maddeleri bir avukat veya mali müşavirle kontrol edin.

## 1. İşlem kaydı (kim, neyi, ne zaman)
- Kritik işlemler (kullanıcı, yetki, stok, satış iptali, ayar, yedek, giriş) `audit_logs` tablosuna yazılıyor. Bu zaten vardı.
- **Yeni: değiştirildiği anlaşılan kayıt.** Her kayıt, bir öncekine sunucu sırrıyla imzalanmış bir zincirle bağlanır (HMAC-SHA256). Biri veritabanında bir kaydı değiştirir, siler veya araya kayıt eklerse Güvenlik > "Kayıtları doğrula" bunu gösterir.
- **Sınırlar (açıkça):**
  - Kayıt, yazıldıktan en geç ~1 dakika sonra zincire bağlanır; bu aralıktaki değişiklik yakalanmaz.
  - Sunucu sırrını da ele geçiren biri zinciri baştan yazabilir.
  - "Silinemez" demek veritabanı sahibine karşı mümkün değildir; doğru ifade "silinirse veya değiştirilirse fark edilir". Düzenli yedekler zincirin dışarıdaki kanıtıdır.
- **Destek erişimi:** Veniux destek ekibi bir firmanın verisine girerse bu, o firmanın kendi işlem kaydına `support.access` olarak yazılır.

## 2. İki aşamalı doğrulama seçenekleri
| Yöntem | Durum | Maliyet | Güvenlik | Not |
|---|---|---|---|---|
| Doğrulama uygulaması (Google Authenticator, Microsoft Authenticator vb.) | **Var** | Ücretsiz | Yüksek | İnternetsiz çalışır. 10 kurtarma kodu verilir; aynı kod tekrar kullanılamaz; yanlış denemede geçici kilit uygulanır. |
| E-posta kodu | Yok | Ücretsiz (SMTP ile) | Orta | E-posta hesabı ele geçirilirse ikinci adım da gider. İstenirse eklenebilir. |
| SMS kodu | Yok | Her girişte ~0,17-0,40 TL (Netgsm paket fiyatı) | Orta | SIM kopyalama riski var; başlık onayı gerekir. Önermiyorum. |

**Öneri:** Yönetici ve müdür hesaplarında uygulama ile 2FA kullanılsın. Güvenlik ayarında "Yöneticiler için zorunlu" seçeneği var. Açan yönetici önce kendi hesabında 2FA'yı kurmuş olmalı; böylece kendini kilitlemez. Zorunluluk açıkken 2FA'sı olmayan yönetici yalnız kurulum ekranına girebilir.

**Kasiyer ekranı için öneri:** Her girişte 2FA istemek kasada pratik değil (sıra, eldiven, paylaşılan cihaz). Bunun yerine şunlar zaten var:
- Kasiyer rolü dar yetkiyle çalışır; indirim, iade, iptal ve fiyat değişikliği ayrıca açılmazsa yapılamaz.
- Kasa ekranında "Kilitle" düğmesi var.
- Oturum süresi vardiyaya göre (8 saat) seçilebilir.
- Yeni cihazdan girişte kayıt ve e-posta oluşur; tanınmayan cihaz Güvenlik sayfasından kaldırılır ve oturum kapanır.

İleride yapılabilecek: kasiyere 4-6 haneli PIN ile hızlı kilit açma. Henüz yok.

## 3. Parola, oturum, cihaz
- **Parola:** "Güçlü şifre" ayarı en az 8 karakter, büyük harf ve rakam ister. Önerim açık tutulması.
- **Oturum süresi:** 15 dakika ile 7 gün arasında seçilebilir. Önerim: yönetici bilgisayarı için 8-24 saat, kasa için vardiya kadar.
- **Cihazlar:**
  - Masaüstü ve el terminali eşleştirmesi zaten vardı.
  - Yeni: Her kullanıcı giriş yaptığı cihazları görür (ör. "Chrome · Windows"). Yeni bir cihazdan girişte işlem kaydı ve e-posta oluşur.
  - Cihaz listeden kaldırılınca tüm oturumlar kapanır.
  - IP adresi cihaz listesinde saklanmaz; tarayıcı kimliğinin yalnız geri çevrilemez özeti tutulur.

## 4. KVKK açısından saklama süresi
- KVKK sabit bir süre belirlemiyor. Kişisel veri, işlendiği amaç için gerekli süre boyunca tutulur, sonra silinir, yok edilir veya anonimleştirilir (6698 sayılı Kanun, md. 4 ve 7).
- **Veniux'ta:** İşlem kayıtlarının saklama süresi 1-10 yıl arasında seçilebilir; varsayılan **2 yıl**. Süresi dolanlar günde bir kez otomatik silinir. Silme işleminin kendisi de kayda geçer ve zincir bir kontrol noktasından devam eder.
- **Neden 2 yıl:** Yetkisiz işlem şikayetleri ve iç denetim için makul bir süre. Bu benim önerim, mevzuattan gelen bir zorunluluk değil.
- **[DOĞRULA]:** Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik, saklama-imha politikası hazırlamakla yükümlü veri sorumluları için periyodik imha süresini en fazla 6 ay olarak düzenliyor. Firmanızın bu yükümlülük kapsamında olup olmadığına (VERBİS) danışmanınız bakmalı.
- **[DOĞRULA]:** Satış ve fatura kayıtları Vergi Usul Kanunu gereği daha uzun süre (genelde 5 yıl) saklanır. Veniux bu kayıtları otomatik silmez.

## 5. Güvenlik sayfasındaki "Verileriniz nerede, kim görebilir?" metni
Sade metin Güvenlik sayfasına eklendi. Bu metin KVKK aydınlatma metni değildir; aydınlatma metnini veri sorumlusu olarak firma hazırlar.
