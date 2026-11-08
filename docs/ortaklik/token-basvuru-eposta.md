# Token entegrasyon başvurusu (gönderilecek e-posta taslağı)

**Kime:** okc.entegrasyon@tokeninc.com
**Konu:** Veniux – Token X Connect Cloud entegrasyon başvurusu ve test erişimi talebi

---

Merhaba,

Veniux (veniux.com), market ve depolar için stok, depo ve kasa yazılımıdır. Windows ve Android'de çalışır; müşteri verisi müşterinin kendi bilgisayarında veya bulut sunucumuzda tutulabilir. Kasa satışlarımızı Token yeni nesil ÖKC cihazlarına **Token X Connect Cloud (kablosuz)** üzerinden göndermek istiyoruz.

Geliştirici dokümanınızı ve herkese açık Postman koleksiyonunuzu inceledik ve entegrasyonun ilk sürümünü hazırladık:
- `POST /v1/auth/token` ile oturum,
- `GET /v1/fiscal-parameters` ile KDV bölümlerinin eşleştirilmesi,
- `POST /v1/instant-basket` ile kasadan anlık sepet gönderimi (fiyat kuruş, miktar ×1000, taxPercent),
- `GET /v1/basket/{basketID}` ve `BASKET_COMPLETED` bildirimiyle sonucun alınması,
- aynı sepetin iki kez ödenmesini önleyen tekil basketID kullanımı.

Testleri şimdilik dokümandaki örnek yanıtlarla yaptık. Gerçek ortamda doğrulamak için desteğinize ihtiyacımız var:

1. **Test ortamı:** Test client-id / client-secret ve test ortamının adresleri (Postman'deki TEST_AUTH_URL ve TEST_BASKET_URL değerleri).
2. **Test cihazı veya simülatör:** Geliştirme için ödünç test cihazı ya da simülatör (xci.devtokeninc.com) üzerinden test imkânı.
3. **Sepet durumları:** Sepet ayrıntısındaki `result.status` alanının alabileceği değerler ve anlamları.
4. **İptal ve iade:** Bulut üzerinden fiş iptali ve iade yapılabiliyor mu? Yapılamıyorsa önerdiğiniz yöntem nedir?
5. **Z raporu:** Z raporu servisinin canlı adresi ve kimlik doğrulama yöntemi.
6. **IP izni:** Test ve canlı ortam için IP izin listesi gerekiyorsa hangi bilgileri iletmemiz gerekir?
7. **Koşullar:** Yazılım çözüm ortaklarına yönelik koşullar. Henüz yeni bir girişimiz; **ücretsiz geliştirme ve pilot dönemi** imkânınız varsa çok memnun oluruz. Pilot için Token cihazı kullanan bir market müşterisiyle başlamayı planlıyoruz.

Bilgi formunuzu doldurmaya ve tanışma toplantısına hazırız.

Teşekkürler,
[Ad Soyad]
Veniux – veniux.com
[Telefon]

---

**Göndermeden önce:**
- [Ad Soyad] ve [Telefon] alanlarını doldurun.
- Kendi e-posta hesabınızdan gönderin. Bu taslağı ben göndermedim, sizin göndermeniz gerekiyor.
- Yanıtta gelecek test kimlik bilgilerini sohbete yazmayın. Bilgiler gelince ayarları güvenle girmeniz için bir araç hazırlanacak.
