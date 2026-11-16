// Terazi seri portundan gelen metin satırını {weight, unit, stable} çerçevesine çevirir.
// Hiçbir ağ/kimlik verisi içermez; yalnız ağırlık satırı ayrıştırılır.
export const MODELS = {
  generic: { label: 'Genel (ASCII satır)', baud: 9600 },
  cas: { label: 'CAS (ST,GS,  1.245 kg)', baud: 9600 },
  toledo: { label: 'Mettler Toledo (SICS: S S 1.245 kg)', baud: 9600, request: 'SI\r\n', pollMs: 300 },
  dibal: { label: 'Dibal / Bizerba (sürekli akış)', baud: 9600 }
};

const UNITS = { kg: 'kg', g: 'g', gr: 'g' };
const NUMBER = /(-?\d{1,7}(?:[.,]\d{1,6})?)\s*(kg|gr|g)\b/i;

function numberFrom(text) {
  const m = NUMBER.exec(text);
  if (!m) return null;
  const unit = UNITS[m[2].toLowerCase()];
  const weight = Number(m[1].replace(',', '.'));
  return Number.isFinite(weight) ? { weight, unit } : null;
}

// Döndürür: { weight (sayı), unit ('kg'|'g'), stable (bool) } ya da null (ağırlık satırı değil).
export function parseScaleLine(model, line) {
  const text = String(line || '').replace(/[\x00-\x1f]+/g, ' ').trim();
  if (!text) return null;
  if (model === 'cas') {
    // "ST,GS,  1.245 kg" kararlı, "US,GS, ..." kararsız
    const head = /^(ST|US)\s*,/.exec(text);
    const n = numberFrom(text);
    return head && n ? { ...n, stable: head[1] === 'ST' } : null;
  }
  if (model === 'toledo') {
    // "S S 1.245 kg" kararlı, "S D 1.245 kg" kararsız; "S I" meşgul, "S +"/"S -" taşma
    const m = /^S\s+([SD])\s+/.exec(text);
    const n = numberFrom(text);
    return m && n ? { ...n, stable: m[1] === 'S' } : null;
  }
  // generic ve dibal: satırda bir kg/g değeri; "?" ya da "M"/"US" işareti varsa kararsız
  const n = numberFrom(text);
  if (!n) return null;
  const unstable = /(^|\s)(US|D|M|\?)(\s|,|$)/.test(text) || /\?/.test(text);
  return { ...n, stable: !unstable };
}

// Parçalı gelen veriyi satırlara böler (\r, \n veya \r\n ayırıcı). Satır sınırı 128 karakterdir.
export class LineFramer {
  constructor(onLine) { this.buffer = ''; this.onLine = onLine; }
  feed(chunk) {
    this.buffer += chunk;
    const parts = this.buffer.split(/\r\n|\r|\n/);
    this.buffer = parts.pop();
    if (this.buffer.length > 128) this.buffer = '';
    for (const part of parts) if (part) this.onLine(part);
  }
  reset() { this.buffer = ''; }
}
