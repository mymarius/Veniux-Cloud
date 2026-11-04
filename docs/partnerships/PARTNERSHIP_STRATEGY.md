# İş ortaklığı altyapı tasarımı

Mevcut businessRoutes /partners saha/bayi müşteri kaydıdır; herkese açık iş ortaklığı başvurusu değildir. Mevcut iletişim formunu partner CRM’i gibi raporlamayın. Bu tur tasarım hazırlandı, başvuru servisi kodlanmadı.

Türler: donanım entegratörü, barkod/el terminali satıcısı, ERP çözüm ortağı, bayi, teknoloji, referans yönlendirme. Başvuru: firma2–160, yetkili2–100, geçerli e-posta≤254, opsiyonel HTTPS web adresi≤500, sektör≤120, partner_type allowlist, açıklama50–3000, KVKK aydınlatma sürümü ve ayrı gerekli izin alanı. Gereksiz kimlik/vergi belgesi ilk aşamada alınmaz.

Yazma tasarımı: mevcut PHP ön denetleyicide özel endpoint; CSRF+honey+IP/session rate limit, gövde sınırı, XSS kaçışı, web kökü dışında atomik kayıt; hata halinde başarı mesajı yok. ID random128bit; ham kişisel veri loglanmaz. E-postada yalnız sınırlı bildirim, ayrıntı yetkili panelde.

Durum makinesi: new→reviewing→meeting→accepted/rejected. Kabul/ret kalıcı denetim kaydıyla; gerekirse reviewing’e dönüş gerekçeli. Notlar ve follow_up_at yalnız yetkili yönetici; müşterinin tenant yönetici rolü genel başvuruları göremez. Başvuru sahibine otomatik kabul/garanti yok. Güncelleme CSRF+oturum+rol+optimistic revision kontrolü. İç notlar başvurana sızmaz.

Test kabulü: rol/anonim IDOR0, geçersiz tür422, yanlış CSRF403, limit429, eşzamanlı durum çatışması409, özel dosya HTTP404, makbuz tekrarında duplicate0, kabul maili yalnız açık yetkili işlemle. Saklama/silme ve veri sorumlusu metni üretimden önce belirlenir.

Ortaklık sunum akışı: hedef işletme problemi→Veniux demo→doğrulanmış kapsam→cihaz test planı→destek sorumluluğu→ticari şart taslağı→pilot kabulü. Hostimux mevcut sponsor tanıtımıdır; doğrulanmamış cihaz iş ortaklığı logoları eklenmez.
