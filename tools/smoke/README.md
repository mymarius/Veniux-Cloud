# Duman testi (iş akışı denemeleri)

Yerel sunucuda (demo hesapla) çekirdek iş akışlarını baştan sona API ile oynatır ve her adımı denetler.
Sürümden önce çalıştırın; "HATA" satırı varsa yayınlamayın.

```
set VENIUX_SMOKE_PASSWORD=<demo hesap parolası>
node tools/smoke/akis-stok-siparis-kasa.mjs
node tools/smoke/akis-transfer-sayim-yetki.mjs
node tools/smoke/akis-kasiyer.mjs
node tools/smoke/akis-hirdavat-zuccaciye.mjs
```

Ortam: `VENIUX_SMOKE_BASE` (varsayılan `http://127.0.0.1:3000/api`), `VENIUX_SMOKE_EMAIL`.

Güvenlik: yalnızca şirket adı "Veniux Demo" ile başlayan işletmede çalışır. Ürün, kullanıcı, sipariş ve satış
kaydı oluşturur; gerçek müşteri hesabında çalıştırmayın.

Akışlar:
- `akis-stok-siparis-kasa`: ürün, tedarikçi, sipariş, rafsız teslim, stok, satış, iade, gün sonu.
- `akis-transfer-sayim-yetki`: stok girişi/çıkışı, transfer, sayım, kasiyer yetki kısıtları.
- `akis-kasiyer`: yeni kasiyer, depo atama, kasiyer satışı, varsayılan kısıtlar.
- `akis-hirdavat-zuccaciye`: toplu fiyat (önizleme ve uygulama), kırık/fire, çeyiz listesi, takım.
