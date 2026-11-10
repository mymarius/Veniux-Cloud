# Mağaza–bulut eşitleme: öneri (karar bekliyor, kod yok)

Amaç: bilgisayara kurulan Veniux (mağaza) ile bulut sürümü aynı işletmenin verisini birlikte kullanabilsin.

## Bugünkü durum (koddan)
- Mağaza yerel SQLite, bulut MySQL kullanıyor. İki veri seti birbirinden **bağımsız**; aralarında yalnız lisans bağı var (`cloud_license_bindings`). Aktarım, eşitleme veya "son değişiklik" izi yok (ürün, stok, satış tablolarında sürüm/değişiklik sayacı yok).
- Yeniden kullanılabilir parçalar: `Idempotency-Key` ile güvenli tekrar gönderim, cihaz kimliği ve kasa-gün fiş numarası (`pos_devices`, `pos_sale_meta`), çevrimdışı satış kuyruğu (aynı satış iki kez kaydedilmez) ve "stok açığına rağmen kabul + uyuşmazlık listesi" kuralı.
- Kimlikler: SQLite'ta ve MySQL'de otomatik artan sayılar ayrı üretiliyor; iki tarafın kayıt numaraları **çakışır**. Eşleme için her kayda kalıcı bir dış kimlik (UUID) gerekir.

## Öneri: üç aşama, ilk ikisi yeterli olabilir
1. **Mağaza → bulut, yalnız okuma (raporlama).** Mağazada tamamlanan satış, iade, vardiya ve gider kayıtları buluta tek yönlü yüklenir (UUID + cihaz kimliği ile, tekrar gönderim güvenli). Bulut bunları "mağaza kaynaklı" kayıt olarak gösterir; bulut stoğunu **değiştirmez**. Sahibi uzaktan tüm şubelerin cirosunu görür. Risk düşük, mevcut kuyruk mantığı büyük ölçüde yeter.
2. **Bulut → mağaza, ürün ve fiyat listesi.** Yeni ürün, barkod ve fiyat değişikliği buluttan mağazaya iner. Yönlü ve çakışması kolay (son değişiklik kazanır, kayıtlı kullanıcı ve zaman damgasıyla).
3. **İki yönlü stok.** En zor kısım: aynı ürünün stoğu iki yerde değişince çakışma. **Önermiyorum**: stok her konumda (mağaza veya bulut deposu) o konumun kendi kaydında kalsın, toplam görünüm raporda hesaplansın.

## Kararlar (sizden)
- Stok yetkisi: her konum kendi stoğunun sahibi mi? (Önerim: evet.)
- Ürün ve fiyat yönü: yalnız bulut → mağaza mı, yoksa mağazadan da ürün eklenebilsin mi?
- Bir işletmenin kaç mağazası olacak ve mağazalar birbirinin satışını görebilmeli mi?
- Bağlantı güvenliği: her mağaza cihazı için ayrı anahtar (iptal edilebilir) önerilir.

## Riskler ve notlar
- Çifte sayım: aynı satışın hem mağaza hem bulut raporunda görünmesi; dış kimlik ve "kaynak" alanıyla önlenir.
- Saat farkı: kayıt zamanı cihaz saatidir; sunucu alınma zamanını ayrı tutar (çevrimdışı satışta olduğu gibi).
- Gönderim yarıda kalırsa kuyruktan devam eder; kayıp olmaması için "sunucu işledi" onayı gelmeden silinmez.
- Bulutta şema yükseltmesi gerekir (yeni tablolar), bu Plesk girişiyle ve önce yedekle yapılır.
- Kapsam büyük: Aşama 1 tek başına bir sürüm, Aşama 2 ayrı bir sürümdür.

## İlk adım
Kararlar netleşirse Aşama 1 (satış, iade, vardiya yükleme) ile başlanır; sitedeki "yapım aşamasında" satırı ancak bu aşama canlıda doğrulanınca "bugün var" olur.
