// Discord bağlantı önizlemesi için sayfa başına 1200×630 görsel üretir (site renkleri ve yazı tipi).
// Kullanım: node tools/site/make-embed-images.cjs   → website-php/assets/embed-<ad>-v1.jpg
const p = require('../../backend/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const A = path.resolve(__dirname, '../../website-php/assets').split(path.sep).join('/');
const pages = [
  ['home', 'Ürün bitmeden haberiniz olsun.', 'Stok, depo ve kasa; Windows ve Android üzerinde tek yerde.', 'sector-market-v1.jpg', 'STOK · DEPO · KASA'],
  ['market-stok-ve-kasa-programi', 'Market için kasa ve stok, tek ekranda.', 'Barkodu okutun, satışı kapatın; stok ve kampanya kendiliğinden güncellensin.', 'sector-market-v1.jpg', 'MARKET'],
  ['kirtasiye-stok-programi', 'Kırtasiyede binlerce ürün, karışmadan.', 'Okul sezonunda kasa hızlansın, raf boşalmadan sipariş hazır olsun.', 'sector-kirtasiye-v1.jpg', 'KIRTASİYE'],
  ['hirdavat-stok-programi', 'Hırdavatta “var mı?” sorusuna anında cevap.', 'Koli, paket ve adet karışmasın; hangi rafta ne kaldığını bilin.', 'sector-hirdavat-v1.jpg', 'HIRDAVAT'],
  ['kafe-hizli-satis-programi', 'Tezgâhta hızlı satış, akşam net rapor.', 'Ürün görsellerine dokunarak satın; hangi saatte ne sattığınızı görün.', 'sector-kafe-v1.jpg', 'KAFE VE BÜFE'],
  ['zuccaciye-barkod-programi', 'Züccaciyede takım eksilmeden haberiniz olsun.', 'Setin parçası azalınca uyarı alın, fiyat değişince etiketi yeniden basın.', 'sector-zuccaciye-v1.jpg', 'ZÜCCACİYE'],
  ['pide-restoran-programi', 'Pidecide masa, adisyon ve malzeme tek ekranda.', 'Porsiyon satılınca malzeme stoktan düşsün, gün sonunda neyin gittiğini görün.', 'sector-pide-v1.jpg', 'PİDE VE RESTORAN'],
];
const html = (title, sub, shot, tag) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Archivo;src:url("file:///${A}/archivo-latin-wdth-normal.woff2");font-weight:100 900;font-stretch:62% 125%}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#f4eee2;font-family:Archivo,Arial,sans-serif;color:#17263a;position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(#e6dcc8 1px,transparent 1px),linear-gradient(90deg,#e6dcc8 1px,transparent 1px);background-size:40px 40px;opacity:.55}
.bar{position:absolute;left:0;right:0;bottom:0;height:74px;background:#17263a;display:flex;align-items:center;justify-content:space-between;padding:0 56px;color:#fff;font-weight:600;font-size:26px}
.bar b{color:#ff8a3d;font-weight:800}
.tag{position:absolute;left:56px;top:48px;background:#cf4b06;color:#fff;font:800 20px/1 Archivo;letter-spacing:.14em;padding:10px 16px}
.brand{position:absolute;right:56px;top:48px;font:800 30px/1 Archivo;font-stretch:75%;letter-spacing:.02em}
.brand i{color:#cf4b06;font-style:normal}
h1{font-weight:800;font-stretch:75%;font-size:66px;line-height:1;letter-spacing:-.01em}
h1:after{content:'';display:block;width:92px;height:8px;background:#cf4b06;margin-top:22px}
.left{position:absolute;left:56px;top:118px;width:530px;height:410px;display:flex;flex-direction:column;justify-content:center}.sub{margin-top:22px;font-size:25px;line-height:1.38;color:#3b4a5e}
.shot{position:absolute;left:622px;top:118px;width:520px;height:410px;border:3px solid #17263a;background:#fff;box-shadow:14px 14px 0 #cf4b06;transform:rotate(1.6deg);overflow:hidden}
.shot img{width:100%;height:100%;object-fit:cover;object-position:left top;display:block}
</style><div class="grid"></div><div class="tag">${tag}</div><div class="brand">veniux<i>.</i></div>
<div class="left"><h1>${title}</h1><p class="sub">${sub}</p></div>
<div class="shot"><img src="file:///${A}/${shot}"></div>
<div class="bar"><span>veniux.com</span><span><b>Demo isteyin</b> →</span></div>`;
// Diğer sayfalar: başlık, açıklama ve ekran görseli yerel siteden (php -S 127.0.0.1:8123 router.php) okunur.
const auto = [
  ['fiyatlandirma', 'FİYATLAR'], ['program-indir', 'PROGRAMI İNDİR'], ['stok-yonetimi', 'STOK YÖNETİMİ'], ['depo-yonetimi', 'DEPO YÖNETİMİ'],
  ['lot-miat-takibi', 'LOT VE MİAT'], ['market-pos', 'MARKET VE POS'], ['yapay-zeka', 'OPERASYON ASİSTANI'], ['barkodlu-stok-takibi', 'BARKODLU TAKİP'],
  ['son-kullanma-tarihi-takibi', 'SON KULLANMA TARİHİ'], ['el-terminali-depo-yonetimi', 'EL TERMİNALİ'], ['sayim-farki-nasil-bulunur', 'REHBER'],
  ['telefonu-barkod-okuyucu-olarak-kullanma', 'REHBER'], ['barkodlu-stoga-gecis-kontrol-listesi', 'REHBER'], ['sunucu-kurulumu', 'KURULUM'], ['demo', 'DEMO'],
];
const clip = (t, n) => (t.length <= n ? t : t.slice(0, n - 1).replace(/[\s,;.]+\S*$/, '') + '…');
// Elle yazılmış kısa başlıklar ve sayfaya uygun ekran görüntüsü (yoksa sayfanın kendi başlığı/açıklaması kullanılır).
const manual = {
  'fiyatlandirma': ['Paketleri karşılaştırın.', 'Başlangıç, İşletme ve Kurumsal; 3 aylık ve yıllık fiyatlar.', 'sector-market-v1.jpg'],
  'program-indir': ['Windows ve Android için indirin.', 'Kurulumu birkaç dakikada yapın, kendiliğinden güncellensin.', 'product-overview-v1.webp'],
  'stok-yonetimi': ['Stok bitmeden haberiniz olsun.', 'Barkodlu takip, giriş-çıkış geçmişi, kritik seviye uyarısı ve sipariş önerisi.', 'product-stock-v1.jpg'],
  'depo-yonetimi': ['Depolarınız ve şubeleriniz tek ekranda.', 'Şube bazlı stok, transfer ve sayım kayıtları.', 'product-warehouse-v4.jpg'],
  'lot-miat-takibi': ['Son kullanma tarihi kaçmasın.', 'Lot bazlı takip, yaklaşan ürünler için uyarı.', 'product-lot-v4.jpg'],
  'market-pos': ['Barkodu okutun, satış tamam.', 'Hızlı kasa; stok her satışta kendiliğinden düşer.', 'sector-market-v1.jpg'],
  'yapay-zeka': ['Sorunuzu yazın, asistan cevaplasın.', 'Stok, satış ve sipariş sorularını konuşur gibi sorun.', 'sector-market-v1.jpg'],
  'demo': ['Demoyu birlikte deneyelim.', 'Kendi ürünlerinizle, sizin işletmenize göre.', 'sector-market-v1.jpg'],
};
async function fromSite() {
  const out = [];
  for (const [slug, tag] of auto) {
    const res = await fetch('http://127.0.0.1:8123/' + slug);
    if (!res.ok) { console.log('atlandı', slug, res.status); continue; }
    const h = await res.text();
    const get = re => (h.match(re) || [])[1] || '';
    const dec = t => t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
    const title = dec(get(/<title>([^<]*)</)).replace(/\s*[|:]\s*Veniux( Cloud)?$/i, '');
    const desc = dec(get(/property="og:description" content="([^"]*)"/));
    const img = get(/property="og:image" content="[^"]*\/assets\/(product-[a-z]+-v\d\.(?:jpg|webp))"/) || 'sector-market-v1.jpg';
    const m = manual[slug];
    out.push(m ? [slug, m[0], m[1], m[2], tag] : [slug, clip(title, 62), clip(desc, 110), img, tag]);
  }
  return out;
}
(async () => {
  pages.push(...await fromSite());
  const b = await p.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const g = await b.newPage(); await g.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  for (const [slug, title, sub, shot, tag] of pages) {
    const tmp = path.join(os.tmpdir(), 'veniux-embed-' + slug + '.html');
    fs.writeFileSync(tmp, html(title, sub, shot, tag));
    await g.goto('file:///' + tmp.split(path.sep).join('/'), { waitUntil: 'networkidle0' });
    await g.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 400));
    await g.screenshot({ path: `${A}/embed-${slug}-v1.jpg`, type: 'jpeg', quality: 88 });
    console.log('ok', slug);
  }
  await b.close();
})();
