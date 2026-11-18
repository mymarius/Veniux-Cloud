# Pide restoranı deneme listesi

Restoran yalnız banka kart cihazını (POS) veriyor. Bu cihaz Veniux'a bağlı değil: kasiyer tutarı cihaza elle yazar,
Veniux'ta yalnız "Kart" ödemesini kaydeder. Cihaz, listede görünmeyecek; bu hata değil.

## Hazırlık (denemeden önce, bizde)
- [ ] Telefona veya bilgisayara Veniux kurulu, restoran hesabı açık (sektör: pide/restoran)
- [ ] Menü: pide çeşitleri, içecekler, fiyatlar girilmiş
- [ ] Masa listesi girilmiş (ör. Masa 1–10, paket)
- [ ] İnternet yoksa da açılıyor mu? (telefon/bilgisayar çevrimdışı denemesi)

## Restoranda (tek banka POS ile)
1. [ ] Masa aç, 2–3 ürün ekle, ürünü çıkar/geri ekle
2. [ ] Hesabı kapat, **Nakit** öde, para üstü doğru mu?
3. [ ] Başka masada hesabı kapat, **Kart** seç: Veniux'ta toplam tutarı oku, aynı tutarı banka POS'a elle yaz, kartı okut, Veniux'ta "Kart" ile kapat
4. [ ] **Bölünmüş ödeme**: yarısı nakit, yarısı kart
5. [ ] Bir satışı **iade** et (nakit ve kart yoluyla)
6. [ ] Gün sonu raporu: nakit ve kart toplamları, banka POS gün sonu (z-raporu) ile **aynı mı?**
7. [ ] Aynı anda iki cihazdan (telefon + bilgisayar) giriş: masa durumu eşleşiyor mu?

## Dikkat
- Banka POS tutarı ile Veniux tutarı elle yazıldığı için farklı olabilir: gün sonunda kart toplamları karşılaştırılır.
- Yazarkasa/ÖKC ve fiş yazıcısı bu denemede yok: fiş Veniux'tan basılmaz, resmî fiş POS'tan çıkar.
- Sorun çıkarsa ekran görüntüsü + saat not edilir.

## Sonuç
Karşılaştırma farkı yoksa ve kasiyer ek yardım istemeden akışı bitirdiyse deneme başarılı sayılır.
