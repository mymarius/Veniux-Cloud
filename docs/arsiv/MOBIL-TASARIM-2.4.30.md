# Mobil ortak tasarım — Android 2.4.30

15 Ekim 2026

Mobil girişinde html üzerinde data-mobile işaretlenir; ortak mobil tasarım yalnız Android/companion yüzeyinde uygulanır. Masaüstü tasarımına uygulanmaz. Bu sayede uygulama gövdesinin dışında portalla açılan menü ve diyaloglar da aynı tasarımı kullanır.

Ortak Manrope yazısı, lacivert üst menü, Veniux logosu, mavi işlemler ve turuncu seçim vurgusu; tutarlı form alanları, kartlar, alt gezinme, ayar sekmeleri, mobil işlem pencereleri ve açık/koyu tema eklendi. Ana ekranın renkli modül ikonları mavi/turuncu palete alındı. Telefonlarda iki, tablette üç sütun kullanılır. Yeni ağır bağımlılık veya sürekli dekoratif animasyon eklenmedi.

CRM görev, personel ve aday müşteri filtreleri telefonda satırlara bölünür; geniş tablolar kendi kapsayıcılarında kaydırılabilir. Ürün formundaki eski İngilizce metin ve ilaç örneği kaldırıldı; Türkçe genel ürün metinleri kullanılır. İşlem, izin, lisans ve sunucu sözleşmeleri değiştirilmedi. Sponsor kutusu yeniden eklenmedi.

Doğrulama: yalıtılmış ve lisanslı örnek işletme ile ürün/depo, stok hareketleri, mal kabul, toplama, sevkiyat, transfer, sayım, rapor, satın alma, tedarikçi, bildirim, veri aktarımı, CRM alt sayfaları, saha/bayi, kasa, barkod, terminal, asistan ve ayarlar açıldı. Ayarların 14 sekmesi açıldı. CRM'de saptanan üç taşma düzeltildi. Son 390px kontrollerinde CRM görev/personel/aday, saha/bayi, kasa, ürün ve ayarlar ekranlarında belge taşması yok. 320px ana ekran/ürün/görev/ayar kontrolleri ve 768px tablet ana ekran kontrolü geçti. Ürün formu açılıp kapatıldı; gerçek kayıt oluşturulmadı. Açık/koyu tema, alt panel ve menü görselleri incelendi.

Derleme ve Android APK v2/v3 imza kontrolü başarılı. APK içinde yeni tasarım sistemi doğrulandı. Android 2.4.30 yayımlandı; indirilen dosyanın tam SHA256 ve boyutu yerel dosyayla eşleşti. Uygulama boyutu: 3.199.371 bayt.

Sınır: Görsel kontroller tarayıcıdaki mobil önizlemede ve sentetik verilerle yapıldı. Fiziksel telefon/emülatör bağlı değildi; donanım kamerası, fener, gerçek klavye ve ağ eşleştirmesi bu turda denenmedi. Platform yöneticisine özel ekranlar işletme yöneticisi rolüyle sınanmadı. Telefondaki kurulu uygulama uzaktan güncellenmedi; yeni APK'nın kurulması gerekir.

Ayrıntılı denetim: .local/mobile-professional-audit.json
