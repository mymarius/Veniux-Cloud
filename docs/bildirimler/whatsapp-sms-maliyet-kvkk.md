# WhatsApp, SMS ve e-posta bildirimleri: maliyet, kısıtlar, izin (9 Kasım 2026)

**Hukuki görüş değildir.** Kesin karar için bir avukata veya mali müşavire danışın.

## 1. Veniux'ta ne var
| Özellik | Kanal | Maliyet | Not |
|---|---|---|---|
| Siparişi tedarikçiye gönderme | E-posta (PDF ekli) | Sunucunun SMTP hesabı; ek ücret yok | Yanıt adresi firmanın e-postası. Gönderim kullanıcı tıklayınca yapılır. |
| Siparişi tedarikçiye gönderme | WhatsApp (`wa.me` bağlantısı) | Ücretsiz | Kullanıcının kendi WhatsApp'ı hazır mesajla açılır; gönderimi kullanıcı yapar. PDF'i elle eklemek gerekir. |
| Kritik stok, miat, sayım farkı özeti | E-posta | Ek ücret yok | Firma e-postası ve izni onaylanmış ek alıcılar. |
| Aynı özet | SMS (Netgsm) | Paket fiyatına göre | Yalnız patron telefonu. |
| Aynı özet | WhatsApp (mevcut bağlı oturum) | Ücretsiz | **Risk:** bkz. madde 3. |

Gönderimi sınırlayan kurallar: Her uyarı her kanaldan bir kez gider. 10 dakikada bir tek özet mesaj gönderilir. Sessiz saatler (varsayılan 22:00-08:00) uygulanır. Kanal başına günlük özet sınırı var (varsayılan 3).

## 2. SMS maliyeti (Netgsm, resmî fiyat sayfası)
Netgsm'in [toplu SMS fiyat sayfası](https://www.netgsm.com.tr/fiyatlar/toplu-sms), KDV ve ÖİV dahil:
- 500 SMS: 198 TL (adedi ~0,40 TL); 1.000 SMS: 370 TL (~0,37 TL); 10.000 SMS: 1.699 TL (~0,17 TL)
- Yeni abone paketi: 10.000 SMS 899 TL (~0,09 TL)
- Paket dışı tek SMS (T-1 tarifesi): 0,42 TL

Adet başı fiyatları ben hesapladım. Fiyatlar değişebilir; satın almadan önce sayfadan bakın.
**Örnek hesap:** Günde en çok 3 özet SMS gönderilirse ayda ~90 SMS gider. 500'lük paketle bu aylık ~36 TL eder.
Netgsm ayrıca başlık (gönderici adı) onayı istiyor; SMS bu onay gelmeden gönderilemez. Bu belgeyi gerektiriyor olabilir, doğrulamadım.

**API uyarısı:** Netgsm'in artık bir REST v2 API'si var (`https://api.netgsm.com.tr/sms/rest/v2`, HTTP Basic kimlik doğrulama). Bu bilgi üçüncü taraf istemci kütüphanelerinden; örneğin [go-netgsm](https://pkg.go.dev/github.com/YusufDrymz/go-netgsm). Veniux şu an eski XML adresini (`/sms/send/xml`) kullanıyor. XML adresinin hâlâ açık olup olmadığını doğrulayamadım. Ücretsiz deneme kredisi için resmî bir bilgi bulamadım. İlk gerçek SMS denemesi paket alındıktan sonra yapılabilir.

## 3. WhatsApp seçenekleri
**a) Resmî WhatsApp Business Platform (Cloud API):** Meta, gönderilen şablon mesaj başına ücret alıyor.
- Türkiye için "utility" (bilgilendirme) şablonu, üçüncü taraf kaynaklara göre 1 Ekim 2026'dan beri mesaj başı **~0,0009 USD**. Pazarlama şablonu ~0,0109 USD. ([Flowcall](https://www.flowcall.co/blog/whatsapp-business-api-pricing), [wsmartsender](https://wsmartsender.com/whatsapp-api-pricing/turkey), [SleekFlow](https://sleekflow.io/en-us/blog/whatsapp-business-price))
- Meta'nın [fiyat sayfası](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), Türkiye utility ücretinin 1 Nisan 2026'da düşürüldüğünü yazıyor. **Meta'nın kendi fiyat tablosunu açıp rakamı doğrulayamadım.**
- **Gerekenler:** Meta işletme hesabı ve doğrulaması, ayrı bir telefon numarası, onaylı mesaj şablonları. Bir çözüm ortağı (BSP) kullanılırsa ayrıca abonelik ücreti çıkar.
- **Önerim:** Bildirim hacmi düşük olduğu için (günde birkaç özet) maliyet çok düşük kalır, ama kurulum işi yüksek. Firma kurulduktan sonra ikinci aşama olarak eklenebilir.

**b) Şu an koddaki yöntem (WhatsApp Web oturumu, `whatsapp-web.js`):** Ücretsiz, ama gayriresmî bir kütüphane. WhatsApp'ın kullanım koşulları gayriresmî ve otomatik istemcileri yasaklıyor; numara engellenebilir. Bu koşul metnini bu turda yeniden okumadım; genel bilgime dayanıyor. Yalnız işletmenin kendi patronuna, düşük hacimde kullanılması riski azaltır ama ortadan kaldırmaz.

**c) `wa.me` bağlantısı (tedarikçiye sipariş):** Ücretsiz ve koşullara uygun, çünkü mesajı kişi kendisi gönderiyor. Tedarikçi gönderimi için bunu seçtim.

## 4. İzin, İYS ve KVKK
- **İYS (İleti Yönetim Sistemi):** İYS yalnız ticari elektronik iletileri, yani reklam, kampanya ve tanıtımı kapsıyor. Hizmet gereği gönderilen bilgilendirmeler (kargo, fatura gibi) kapsam dışı sayılıyor ([Mailsoftly özeti](https://mailsoftly.com/tr/blog/iys-nedir-ileti-yonetim-sistemi/), [birfatura](https://birfatura.com/ileti-yonetim-sistemi-nedir-iys-nedir/)). Bunlar blog kaynakları; asıl metin [Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik](https://www.lexpera.com.tr/mevzuat/yonetmelikler/ticari-iletisim-ve-ticari-elektronik-iletiler-hakkinda-yonetmelik). **Değerlendirmem:** Stok ve sayım uyarıları işletmenin kendi yetkililerine giden iç bildirimler; reklam içermiyor. Bu yüzden ticari ileti sayılmaları beklenmez. Doğrulanmadı.
- **Tedarikçiye sipariş:** Ticari bir ilişkinin gereği olan iş yazışması; reklam değil.
- **Kampanya ve sadakat:** Müşteriye kampanya duyurusu (SMS veya WhatsApp) **ticari ileti olur**; İYS kaydı ve onay gerekir. Veniux şu an müşteriye toplu mesaj göndermiyor. Bu özellik eklenirse İYS entegrasyonu şart.
- **KVKK (kodda yapılanlar):**
  - Bildirimler yalnız ürün ve stok bilgisi içeriyor; müşteri kişisel verisi gönderilmiyor.
  - Alıcılar işletmenin kendi yetkilileri. Ek e-posta alıcısı eklemek için yönetici "kişileri bilgilendirdim ve izinlerini aldım" onayını vermek zorunda. Onay zamanı ve onaylayan kişi kaydediliyor; değişiklik denetim kaydına yazılıyor.
  - Sadakat kartı müşteri adı ve telefonu tutuyor. Bunun için kasada müşteriye aydınlatma metni gösterilmeli. Metni siz (veya avukatınız) hazırlamalısınız; uygulamada henüz yok.
  - SMS sağlayıcısı (Netgsm) ve WhatsApp (Meta), aktarılan verinin işleyicisi ya da alıcısı olur. Meta yurt dışında olduğu için yurt dışına aktarım kuralları gündeme gelir. Aydınlatma metninde bunlar belirtilmeli.
