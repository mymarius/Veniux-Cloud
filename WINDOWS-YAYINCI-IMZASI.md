# Veniux Windows yayıncı imzası

15 Ekim 2026 kontrolü: 2.4.25 kurulum dosyası `NotSigned`; mevcut kullanıcı sertifika deposunda kod imzalama sertifikası bulunmadı. Kullanıcı sertifika ve Microsoft Store geliştirici hesabı olmadığını belirtti.

SmartScreen uyarısı kod içinde kapatılamaz. Doğrulanmış yayıncı imzası gerekir; yeni imzalı dosyalarda da itibar oluşana kadar uyarı çıkabilir. Kendi oluşturduğumuz sertifika genel kullanıcılarda güven sağlamaz.

## Hazırlanan dağıtım yolu

`desktop/electron-builder.signed.config.cjs`, imza kimliği yoksa veya imza oluşturulamazsa dağıtımı durdurur. Kurulum ve uygulama dosyalarını SHA-256 ve zaman damgasıyla imzalamak üzere hazırlanmıştır. Mevcut imzasız yerel inceleme paketleri imzalı olarak tanıtılmamalıdır.

Güvenilir sağlayıcıdan kod imzalama sertifikası edinildikten sonra Windows sertifika deposundaki kimlik `VENIUX_SIGNING_SUBJECT` veya `VENIUX_SIGNING_THUMBPRINT` ile seçilir. Desteklenen sertifika dosyası için `CSC_LINK` ve gerekiyorsa `CSC_KEY_PASSWORD` kullanılır. Gizli anahtarlar ve parolalar depoya veya uygulamaya eklenmez.

Standart `npm run dist` imzalı yapılandırmayı kullanır ve sertifika olmadan durur. Yalnız yerel inceleme için `npm run dist:preview` ayrıdır. Doğrudan derleme: `electron-builder --config electron-builder.signed.config.cjs --win` (desktop dizininden; mevcut yerel sunucu paketleme değişkenleri de gerekir).

Son kontrol: `desktop/verify-release-signature.ps1 -Installer <kurulum.exe> -Application <Veniux Cloud.exe>`. İki dosyada da geçerli imza ve zaman damgası doğrulanmalıdır. İmzadan sonra dosyalar değiştirilmez.

Diğer yol Microsoft Store dağıtımıdır. Bunun için geliştirici hesabı, yayıncı kimliği doğrulaması ve mağaza başvurusu gerekir. Bu çalışma sırasında satın alma veya mağaza başvurusu yapılmadı.

Kaynaklar:
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
- https://www.electron.build/v26/docs/features/code-signing/code-signing-win/
