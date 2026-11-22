# WhatsApp bildirimi kurulum adımları (resmî Cloud API)

Kod hazır: `backend/src/services/whatsappCloudService.js`. Üç ayar girildiğinde uyarı özeti ve otomatik kontrol özeti WhatsApp'tan gider. Hiçbir ayar yoksa kod sessizce kapalı kalır (e-posta ve SMS etkilenmez).

## Gerekli üç değer (hepsini sen Meta'dan alırsın, sohbete yazma)
| Ayar | Nereden |
|---|---|
| `WHATSAPP_CLOUD_TOKEN` | Meta İşletme Ayarları → Sistem Kullanıcıları → yeni kullanıcı → token üret (`whatsapp_business_messaging` ve `whatsapp_business_management` izni, **süresiz**) |
| `WHATSAPP_CLOUD_PHONE_ID` | WhatsApp Manager → API Kurulumu → "Telefon numarası kimliği" |
| `WHATSAPP_CLOUD_TEMPLATE` | Onaylanmış şablonun adı (aşağıda) |
İsteğe bağlı: `WHATSAPP_CLOUD_LANGUAGE` (varsayılan `tr`).

## Adımlar
1. **developers.facebook.com** → Uygulama oluştur → tür "Business" → ürün olarak **WhatsApp** ekle.
2. Meta İşletme hesabı aç (veya var olanı seç). **Test aşaması için doğrulama gerekmez:** Meta bir test numarası ve geçici token verir; en çok 5 alıcıya (kendi numaran) mesaj atabilirsin. Önce bununla dene.
3. **Gerçek numara:** Cloud API'ye bağlanan numara aynı anda normal WhatsApp uygulamasında kullanılamaz. 0552 464 35 18 müşteri iletişimi için kalacağından **ayrı bir numara (yeni hat)** kullan.
4. **İşletme doğrulaması** (gerçek müşterilere göndermek için): ticaret unvanı, vergi levhası, alan adı e-postası. Şirket 1 Ocak 2027'de kurulunca yapılır; o zamana kadar test numarası yeterli.
5. **Şablon oluştur** (WhatsApp Manager → Mesaj şablonları): kategori **Utility (Hizmet)**, dil Türkçe, ad `veniux_bildirim`, gövde tek değişkenli:
   `Veniux bildirimi: {{1}}`
   Meta genelde dakikalar-saatler içinde onaylar. Reklam dili kullanma, yoksa "Marketing" sayılır ve pahalı olur.
6. **Ayarları sunucuya ekle** (sen yap, token gizli kalsın): Plesk → app.veniux.com → `cloud-private/install.env` dosyasına üç satırı ekle, Node.js sayfasından **Restart App**. Sonra bana "girdim" de; ben canlı bir deneme mesajı akışını doğrularım.
7. Alıcı numarası: işletme sahibinin telefonu (Ayarlar → Bildirimler). Alıcı daha önce işletmenin numarasına yazmadıysa yalnız şablon gider; bu yüzden şablon şart.

## Maliyet ve sınırlar
- Türkiye utility şablonu mesaj başı yaklaşık 0,0009 USD (Meta'nın kendi tablosunda doğrulanmadı, üçüncü kaynaklar). Günde 3 özetle aylık kuruşlar mertebesinde.
- Gönderim sınırları zaten kodda: 10 dakikada bir özet, günde 3, sessiz saat 22:00–08:00.
- Müşteriye kampanya mesajı bu kapsamda değildir (İYS ve onay gerekir), şu an yok.

## Yapılmamış / sınırlar
- Teslim durumu (okundu/iletildi) izlenmiyor; yanıt yalnız Meta'nın isteği kabul ettiğini gösterir.
- Panelden (veniux.com/panel) müşteriye WhatsApp ile fatura/lisans bildirimi şu an e-postadır; ihtiyaç olursa aynı servis panele bağlanabilir.
