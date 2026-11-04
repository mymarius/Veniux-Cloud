# Merkezi API, lisanslar ve masaüstü güncellemeleri

## Bu bilgisayardaki yerel kurulum

Proje kökündeki `Start-Local.ps1` API'yi arka planda başlatır. Panel ve API aynı adrestedir: `http://127.0.0.1:3000`. Sağlık kontrolü `/health`, yönetim paneli `/admin/api` adresindedir. Var olan platform yöneticisi hesabınızla giriş yapın. Yerel sunucu yalnızca bu bilgisayardan erişilebilir; SQLite verileri korunur. Günlükler `.local/api.log` ve `.local/api-error.log` dosyalarındadır. Bilgisayar yeniden başladığında betiği tekrar çalıştırın.

Yerel masaüstü sürümü için `desktop/Pack-Local.ps1` kullanın (önce desktop bağımlılıklarını `npm ci` ile kurun). Bu sürümün API ve güncelleme adresi aynı bilgisayardaki sunucudur. Başka bilgisayarlara dağıtmak için erişilebilir HTTPS sunucu adresiyle yeniden paketleyin.

API panelinde işletmenin Ayrıntılar alanından paket atayın. Üretilen VNX lisans kodu burada görünür; müşteri bu kodu uygulamanın lisans ekranına girer. Aynı alanda modülleri değiştirebilir, lisansı askıya alabilir veya iptal edebilirsiniz. Çevrimiçi istemci her 5 dakikada doğrulama yapar. Operasyon API'leri her istekte işletmenin lisansını kontrol eder.

## Sunucu yapılandırması

- API sunucusunu HTTPS üzerinden yayınlayın. Ön yüzde `VITE_API_URL=https://SUNUCU/api` tanımlayıp yeniden derleyin. Tarayıcı aynı sunucuda barınıyorsa `/api` kullanılabilir.
- `JWT_SECRET` için güçlü bir değer ve `CORS_ORIGIN` için izin verilen ön yüz adreslerini tanımlayın.
- `LICENSE_PRIVATE_KEY_PATH` ve `LICENSE_PUBLIC_KEY_PATH` sunucuya özel, kalıcı RSA anahtarlarını göstermelidir. Üretimde depodaki geliştirme anahtarlarını kullanmayın. Özel anahtar müşteriye dağıtılmaz.
- Çevrimdışı kullanım için public key PEM'i ön yüzün `VITE_LICENSE_PUBLIC_KEY` değerine satır sonları `\n` olarak ekleyin. Bu anahtar yoksa yalnızca çevrimiçi doğrulama kullanılabilir. Çevrimdışı kullanım imza, cihaz kimliği, lisans bitişi ve imzalı tolerans süresiyle sınırlandırılır.
- `UPDATE_STORAGE_DIR` kalıcı güncelleme klasörü olabilir; boşsa `backend/storage/updates` kullanılır. Ters proxy dosya yükleme sınırını en az kurulum dosyası boyutuna göre ayarlayın; API üst sınırı 500 MB'dir.

## Masaüstü sürümü hazırlama ve yayımlama

Önce frontend ortamında gerçek `VITE_API_URL` adresini tanımlayın. Desktop paketleme ortamında `VENIUX_UPDATE_URL=https://SUNUCU/api/updates/` tanımlayın. `desktop` klasöründe `npm ci` ve `npm run dist` çalıştırın. Windows üretim sürümünü uygun kod imzalama sertifikasıyla paketleyin. URL paketleme sırasında uygulamaya yazılır; mevcut eski kurulumlar için bu bağlantıyı içeren ilk yeni sürümü dağıtmak gerekir.

API panelindeki Masaüstü güncellemeleri alanında derlemenin EXE dosyasını, blockmap dosyasını ve en son aynı derlemeye ait latest.yml dosyasını yükleyin. Dosya adlarını değiştirmeyin. Aynı EXE adı üzerine yazılamaz; yeni sürüm numarası ve dosya adı kullanın. Manifest yalnızca yüklenmiş ve boyut/SHA-512 özeti eşleşen EXE dosyalarıyla yayımlanır. Uygulama açılışta ve dört saatte bir kontrol eder, arka planda indirir ve kullanıcı uygulamayı kapattığında kurar.

Güncellemeler genel dağıtım adresinden indirilir; yükleme ve lisans yönetimi yalnızca platform yöneticilerine açıktır. API panelindeki bağlantı testleri mevcut sunucuyu denetler; sunucuya dağıtım ve gerçek Windows güncellemesi ayrıca doğrulanmalıdır.

Kaynak: https://www.electron.build/docs/features/auto-update/
