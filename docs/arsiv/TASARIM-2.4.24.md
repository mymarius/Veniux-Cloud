# Veniux 2.4.24 tasarım düzenlemesi

Masaüstü ve Android ortak arayüzü logonun mavi/turuncu kimliğine göre düzenlendi.

- Koyu mavi ana menü, turuncu seçili öğe vurgusu ve daha belirgin işlem bağlantıları.
- Sistem yazı tipleri; harici font isteği yok. Eski görünüm ayarlarının varsayılan font ve rengi geri değiştirmesi giderildi.
- Ortak kart, tablo, form, odak göstergesi ve boşluk düzeni.
- Mobil ana ekranda barkod işlemi, alt gezinme ve modül kartları yeniden biçimlendirildi.
- Mobil koyu temada açıklama ve bağlantı kontrastları düzeltildi.
- Karşılama alanında gereksiz e-posta tekrarı kaldırıldı.

## Doğrulama

Üretim derlemesi başarılı. İzole, örnek verili işletmede 1366×900 masaüstü ve 390×844 mobil ana ekranlar incelendi; yatay taşma görülmedi. Mobil açık/koyu tema denetlendi. Gerçek cihazda kurulum ve kapsamlı tüm ekran testi bu kontrolün kapsamında değildir. Mevcut büyük parça boyutu derleyici uyarısı sürmektedir; ölçülmüş hız artışı iddia edilmez.

Ekran görüntüleri `.local/veniux-desktop-brand.png`, `.local/veniux-mobile-brand.png` ve `.local/veniux-mobile-brand-dark.png` altındadır. Kurulum paketleri yeni 2.4.24 sürümüne aittir; kurulu uygulama kendiliğinden değiştirilmez.
