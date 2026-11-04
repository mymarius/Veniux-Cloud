const pool = require('../../../config/database');
const { fetchSafely } = require('../safeDownload');
const { normalizeSearch } = require('../normalize');
const { allowedHosts } = require('../providers/TitckListProvider');

// TİTCK "Kontrole Tabi İlaç Listeleri" (Kırmızı / Yeşil reçete) ile reçete türünü tamamlar.
// Listeler PDF olarak yayımlanır ve ilaç adı + etken madde (ATC adı) içerir; barkod yoktur.
// Eşleştirme kuralı (yanlış işaretlemeyi önlemek için temkinli):
//   • Tek etken maddeli ilaç: etken madde listedekiyle birebir aynıysa işaretlenir.
//   • Kombine ilaç: etken maddeyi içermesi + marka adının listede geçmesi gerekir.
// Kırmızı, Yeşil'e göre önceliklidir. Manuel / elle düzenlenmiş kayıtlara dokunulmaz.

const PAGE = () => process.env.MEDICINE_TITCK_CONTROLLED_PAGE || 'https://www.titck.gov.tr/faaliyetalanlari/ilac/uyusturucu-ve-psikotrop-maddeler';
const RED = 'Kırmızı reçete', GREEN = 'Yeşil reçete', NONE = 'Kontrole tabi değil';
const LISTS = [[RED, /k[ıi]rm[ıi]z[ıi]\s+re[çc]ete/i], [GREEN, /ye[şs]il\s+re[çc]ete/i]];

async function discoverPdfs() {
  const { buffer, finalUrl } = await fetchSafely(PAGE(), { allowedHosts: allowedHosts(), maxBytes: 5 * 1024 * 1024, timeoutMs: 30000 });
  const html = buffer.toString('utf8');
  const anchors = [...html.matchAll(/<a[^>]+href\s*=\s*["']([^"']+\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(m => ({ href: m[1].replace(/&amp;/g, '&'), text: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }));
  return LISTS.map(([type, pattern]) => {
    const found = anchors.find(a => pattern.test(a.text) || pattern.test(decodeURIComponent(a.href)));
    return found ? { type, url: new URL(found.href, finalUrl).toString() } : { type, url: null };
  });
}

// PDF satırları: aynı y koordinatındaki metinler bir satırdır. "ATC ADI" başlığının
// x konumu etken madde sütununu belirler; solundakiler ilaç adıdır.
async function extractRows(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, verbosity: 0 }).promise;
  const rows = [];
  let substanceX = null;
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    const lines = new Map();
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      lines.set(y, [...(lines.get(y) || []), { x: item.transform[4], s: item.str.trim() }]);
    }
    for (const parts of lines.values()) {
      const header = parts.find(part => /^ATC\s+ADI$/i.test(part.s));
      if (header) { substanceX = header.x; continue; }
      if (substanceX === null) continue;
      const substance = parts.filter(part => Math.abs(part.x - substanceX) <= 60 && !/^\d+\s*kutu/i.test(part.s)).map(part => part.s).join(' ');
      const name = parts.filter(part => part.x < substanceX - 60).map(part => part.s).join(' ');
      if (name && substance && /[a-zçğıöşü]/i.test(substance)) rows.push({ name, substance });
    }
  }
  return rows;
}

// Listelerde etken maddeler çoğunlukla İngilizce (INN) yazılır; katalog Türkçedir.
const INN_TR = {
  morphine: 'morfin', 'morphine hcl': 'morfin hidroklorur', 'morphine sulfate': 'morfin sulfat', codeine: 'kodein', 'codeine phosphate': 'kodein fosfat',
  methylphenidate: 'metilfenidat', 'methylphenidate hcl': 'metilfenidat hidroklorur', oxycodone: 'oksikodon', 'oxycodone hcl': 'oksikodon hidroklorur',
  hydromorphone: 'hidromorfon', 'hydromorphone hcl': 'hidromorfon hidroklorur', pethidine: 'petidin', 'pethidine hcl': 'petidin hidroklorur',
  fentanyl: 'fentanil', 'fentanyl citrate': 'fentanil sitrat', remifentanil: 'remifentanil', 'remifentanil hcl': 'remifentanil hidroklorur',
  alfentanil: 'alfentanil', sufentanil: 'sufentanil', 'sodium oxybate': 'sodyum oksibat', ethylmorphine: 'etilmorfin',
  'esketamin hidroklorur': 'esketamin', methadone: 'metadon', buprenorphine: 'buprenorfin', tapentadol: 'tapentadol'
};
// Marka sayılmayacak genel ilk kelimeler
const NOT_BRANDS = new Set(['hazir', 'sodyum', 'sodium', 'kombine', 'ilac', 'enjektor', 'ampul', 'flakon', 'tablet', 'kapsul', 'oral', 'iv', 'im']);
const brandOf = normalizedName => {
  const first = (normalizedName || '').split(' ')[0];
  return first && first.length >= 3 && !NOT_BRANDS.has(first) && !/^\d/.test(first) ? first : null;
};

// Listeden etken madde ve marka kümeleri
function buildIndex(rows) {
  const substances = new Set(), brands = new Set();
  for (const { name, substance } of rows) {
    const key = normalizeSearch(substance);
    if (key && !/kombine/.test(key)) { substances.add(key); if (INN_TR[key]) substances.add(INN_TR[key]); }
    const brand = brandOf(normalizeSearch(name));
    if (brand) brands.add(brand);
  }
  return { substances, brands, size: substances.size };
}

// Tek etken maddeli ilaçta etken madde birebir eşleşirse ya da marka listede geçiyorsa işaretlenir.
function classify(medicine, index) {
  const ingredient = medicine.normalized_ingredient || '';
  if (ingredient && index.substances.has(ingredient)) return true;
  const brand = brandOf(medicine.normalized_name);
  return Boolean(brand && index.brands.has(brand));
}

async function updateIds(type, ids) {
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400);
    await pool.query(`UPDATE medicines SET prescription_type = $1, updated_at = CURRENT_TIMESTAMP WHERE id IN (${chunk.map((_, j) => `$${j + 2}`).join(',')})`, [type, ...chunk]);
  }
}

async function apply(indexes) {
  const marked = { [RED]: [], [GREEN]: [] };
  // Kayıtlar parça parça okunur; tüm tablo belleğe alınmaz.
  for (let offset = 0; ; offset += 2000) {
    const rows = (await pool.query(`SELECT id, normalized_name, normalized_ingredient FROM medicines WHERE source <> 'manual' AND manual_override = 0 ORDER BY id LIMIT 2000 OFFSET ${offset}`)).rows;
    if (!rows.length) break;
    for (const m of rows) {
      if (indexes[RED] && classify(m, indexes[RED])) marked[RED].push(m.id);
      else if (indexes[GREEN] && classify(m, indexes[GREEN])) marked[GREEN].push(m.id);
    }
  }
  // Önce önceki sınıflandırma sıfırlanır (fiyat listesinden gelen türlere dokunulmaz), sonra işaretlenir.
  await pool.query(
    `UPDATE medicines SET prescription_type = $1 WHERE source <> 'manual' AND manual_override = 0 AND (prescription_type IS NULL OR prescription_type IN ($2, $3, $1))`,
    [NONE, RED, GREEN]
  );
  await updateIds(GREEN, marked[GREEN]);
  await updateIds(RED, marked[RED]);
  return { red: marked[RED].length, green: marked[GREEN].length };
}

async function enrich() {
  const sources = await discoverPdfs();
  const indexes = {}, lists = [];
  for (const { type, url } of sources) {
    if (!url) { lists.push({ type, error: 'Listenin bağlantısı TİTCK sayfasında bulunamadı.' }); continue; }
    const { buffer } = await fetchSafely(url, { allowedHosts: allowedHosts(), maxBytes: 20 * 1024 * 1024, timeoutMs: 60000 });
    const rows = await extractRows(buffer);
    indexes[type] = buildIndex(rows);
    lists.push({ type, url, products: rows.length, substances: indexes[type].size, brands: indexes[type].brands.size });
  }
  if (!Object.keys(indexes).length) throw new Error('Kontrole tabi ilaç listelerine ulaşılamadı.');
  return { lists, ...(await apply(indexes)) };
}

module.exports = { enrich, extractRows, buildIndex, classify, RED, GREEN, NONE };
