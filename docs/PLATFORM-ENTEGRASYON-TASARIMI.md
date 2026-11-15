# Platform siparişleri (Yemeksepeti, Getir, Trendyol) için entegrasyon temeli

Hazırlandı: 15 Kasım 2026. **Kod yazılmadı, bilerek.** Platformların API sözleşmeleri, alan adları ve onay süreçleri
elimizde yok; bunları tahminle kodlamak sonradan çöpe gider. Burada yalnızca (1) neyin hazır olduğu, (2) şirket
kurulunca ne sırayla ilerleneceği, (3) kod yazılırken uyulacak tasarım yazılı. Başvuru metinleri:
`docs/PLATFORM-BASVURU-METINLERI.md`.

## 1. Bugün hazır olanlar (Veniux içinde)
- **Paket ve motor siparişi:** `restaurant_orders` (`order_type` = `paket` | `motor`) ve `restaurant_deliveries` (müşteri adı, telefon, adres, kurye, durum). Mutfak ekranı ve esnaf paneli bunları zaten gösterir.
- **Sipariş anında stok düşer, iptalde geri gelir:** çok katlı reçete dahil (`restaurantService.createOrder`). Yetersiz stok siparişi engellemez, kalemde "eksik" işaretlenir.
- **Menüde porsiyon durumu:** `menu()` her ürün için `available` ve `stock_state` (`ok` / `low` / `out` / `untracked`) döndürür. Platformda "ürünü kapat" için hazır veri kaynağı.
- **Gizli bilgi saklama:** mağaza eşitlemesindeki `seal` / `unseal` ve `store_sync_config` deseni, platform API şifreleri için aynen kullanılabilir.
- **Tekrar gönderime dayanıklılık:** satışlarda `Idempotency-Key` kalıbı var; dış sipariş için `platform + dış sipariş no` anahtarı olacak.

## 2. Şirket kurulunca sırayla
0. **Önkoşul:** vergi mükellefiyeti (VKN), kurumsal e-posta, pilot restoran (platformlarda mağazası olan, kabul eden).
1. Üç platforma başvuru metinleri gönderilir; hangisi önce dönerse onunla başlanır. **API dokümanı ve test ortamı gelmeden kod yazılmaz.**
2. Pilot restoran, kendi mağazası için API bilgilerini (kullanıcı adı, şifre, mağaza kimliği) güvenli kanaldan iletir.
3. Aşağıdaki aşamalar sırayla yapılır, her biri ayrı yayınlanır.

## 3. Aşamalar
| Aşama | Ne yapar | Risk |
|---|---|---|
| **A. Sadece okuma** | Platformdan yeni siparişleri çeker (yoklama ya da webhook), `paket`/`motor` siparişi olarak mutfağa düşürür. Veniux'tan platforma hiçbir şey yazmaz. | Düşük: yanlış gelen sipariş yalnızca mutfakta görünür |
| **B. Durum geri bildirimi** | "Kabul edildi", "hazırlanıyor", "hazır" durumlarını platforma bildirir. | Orta: yanlış durum müşteriyi etkiler; önce test ortamı |
| **C. Menü ve stok eşitleme** | Stok biten ürünü platformda kapatır, gelince açar (`stock_state` üzerinden). Fiyat ve menü ayrı karar. | Orta: yanlış kapatma satış kaybettirir |
| **D. Raporlama** | Platform bazında satış ve komisyon özeti. | Düşük |

## 4. Veri modeli önerisi (yeni tablo gerekecek, bulut şeması 022 olur)
- `restaurant_channels`: `tenant_id`, `platform`, `store_ref`, `credentials` (mühürlü), `enabled`, `last_poll_at`, `last_error`.
- `restaurant_channel_items`: platformdaki ürün kodu/adı ↔ Veniux `product_id` eşlemesi (eşlenmemiş kalem siparişi bloklamaz, "eşleşmedi" uyarısıyla düşer).
- `restaurant_orders`: `source` (`platform:yemeksepeti` …) ve `external_ref`; `(tenant_id, source, external_ref)` benzersiz, aynı sipariş ikinci kez gelirse yeni kayıt açılmaz.
- Şema değişikliği **eklemelidir** (yalnız yeni tablo/sütun); mevcut canlı veriye dokunulmaz. Dağıtım adımları: `cloud-deploy` notu (veritabanı yedeği, upgradeAdditive, kayıt, yeniden başlatma).

## 5. Kurallar (kod yazılırken)
- Platform API şifresi **loglanmaz**, ekrana geri verilmez, yalnız mühürlü saklanır.
- Her platform için **ayrı adaptör**: `normalize(dış sipariş) → { dış_no, müşteri, adres, kalemler[{kod, ad, adet, not}], not, ödeme_tipi }`. Çekirdek sipariş mantığı platformu bilmez.
- **Gerçek müşteri verisi** (ad, telefon, adres) yalnızca o işletmenin kaydında durur, başka işletmeyle karışmaz (mevcut firma ayrımı testleri bu uçları da kapsamalı).
- Bağlantı koparsa esnaf panelinde görünür uyarı ("Yemeksepeti 15 dk'dır yanıt vermiyor"); sessiz kalmaz.
- Test: platformun kayıtlı örnek yanıtlarıyla **simülatör adaptörü**; gerçek hesapta ilk deneme pilot restoranda, kapalı saatte.
- Platform kuralı değişirse yalnız o adaptör etkilenir.

## 6. Henüz bilinmeyenler (başvuru yanıtlarıyla netleşir)
- Her platformda yazılım firması olarak entegrasyon yolu var mı, yoksa yalnız restoran bazlı mı?
- Sipariş akışı yoklama mı, webhook mı? Hız sınırı ve kimlik doğrulama biçimi?
- Test ortamı var mı? Sözleşme veya komisyon koşulu?
- Entegrasyon için ek sertifikasyon veya onay süreci?

## 7. Bu kapsamın dışında kalanlar
Yazarkasa (ÖKC) entegrasyonu ayrı bir projedir (GMP-3, cihaz ve üretici desteği gerekir); e-Adisyon/e-Fatura da öyle.
Bkz. `docs/MALI-UYUM-NOTU.md`.
