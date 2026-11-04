// TİTCK ürün adlarından doz, farmasötik form ve paket bilgisini çıkarır.
// Adlar standart biçimdedir: "<AD> <DOZ> <FORM>, <PAKET>"
//   "ONADRON 0.75 MG TABLET, 100 TABLET" → doz "0.75 MG", form "Tablet", paket "100 TABLET"
// Yalnızca kesin kalıplar kullanılır; emin olunamayan alan boş bırakılır.

// Uzun / özel ifadeler önce denenir (ör. "FİLM KAPLI TABLET", "TABLET"ten önce).
const FORMS = [
  ['FİLM KAPLI TABLET', 'Film kaplı tablet'], ['ENTERİK KAPLI TABLET', 'Enterik kaplı tablet'], ['EFERVESAN TABLET', 'Efervesan tablet'],
  ['AĞIZDA DAĞILAN TABLET', 'Ağızda dağılan tablet'], ['DİLALTI TABLET', 'Dilaltı tablet'], ['UZATILMIŞ SALIMLI TABLET', 'Uzatılmış salımlı tablet'],
  ['DEĞİŞTİRİLMİŞ SALIMLI TABLET', 'Değiştirilmiş salımlı tablet'], ['KONTROLLÜ SALIMLI TABLET', 'Kontrollü salımlı tablet'], ['ÇİĞNEME TABLETİ', 'Çiğneme tableti'],
  ['FİLM TABLET', 'Film tablet'], ['DRAJE', 'Draje'], ['TABLET', 'Tablet'],
  ['SERT KAPSÜL', 'Sert kapsül'], ['YUMUŞAK KAPSÜL', 'Yumuşak kapsül'], ['ENTERİK KAPSÜL', 'Enterik kapsül'], ['KAPSÜL', 'Kapsül'],
  ['İNFÜZYON İÇİN ÇÖZELTİ', 'İnfüzyonluk çözelti'], ['İNFÜZYONLUK ÇÖZELTİ', 'İnfüzyonluk çözelti'], ['ENJEKSİYONLUK ÇÖZELTİ', 'Enjeksiyonluk çözelti'],
  ['ENJEKSİYONLUK SÜSPANSİYON', 'Enjeksiyonluk süspansiyon'], ['ENJEKSİYONLUK TOZ', 'Enjeksiyonluk toz'], ['LİYOFİLİZE TOZ', 'Liyofilize toz'],
  ['ORAL ÇÖZELTİ', 'Oral çözelti'], ['ORAL SÜSPANSİYON', 'Oral süspansiyon'], ['ORAL DAMLA', 'Oral damla'],
  ['GÖZ DAMLASI', 'Göz damlası'], ['KULAK DAMLASI', 'Kulak damlası'], ['BURUN DAMLASI', 'Burun damlası'], ['BURUN SPREYİ', 'Burun spreyi'],
  ['GÖZ MERHEMİ', 'Göz merhemi'], ['İNHALASYON TOZU', 'İnhalasyon tozu'], ['İNHALASYON ÇÖZELTİSİ', 'İnhalasyon çözeltisi'], ['İNHALER', 'İnhaler'],
  ['NEBÜLİZASYON', 'Nebülizasyon çözeltisi'], ['AEROSOL', 'Aerosol'], ['SPREY', 'Sprey'],
  ['İRİGASYON ÇÖZELTİSİ', 'İrigasyon çözeltisi'], ['IRIGASYON ÇÖZELTİSİ', 'İrigasyon çözeltisi'],
  ['ŞURUP', 'Şurup'], ['SÜSPANSİYON', 'Süspansiyon'], ['EMÜLSİYON', 'Emülsiyon'], ['ÇÖZELTİSİ', 'Çözelti'], ['ÇÖZELTİ', 'Çözelti'],
  ['SOLÜSYONU', 'Solüsyon'], ['SOLÜSYON', 'Solüsyon'], ['SOLUSYONU', 'Solüsyon'], ['SOLUSYON', 'Solüsyon'], ['DAMLA', 'Damla'],
  ['KREM', 'Krem'], ['MERHEM', 'Merhem'], ['POMAD', 'Pomad'], ['JEL', 'Jel'], ['LOSYON', 'Losyon'], ['ŞAMPUAN', 'Şampuan'], ['GARGARA', 'Gargara'],
  ['SUPOZİTUVAR', 'Supozituvar'], ['OVÜL', 'Ovül'], ['VAJİNAL TABLET', 'Vajinal tablet'], ['TRANSDERMAL FLASTER', 'Transdermal flaster'], ['FLASTER', 'Flaster'],
  ['ŞASE', 'Şase'], ['GRANÜL', 'Granül'], ['TOZ', 'Toz'], ['PASTİL', 'Pastil'], ['AMPUL', 'Ampul'], ['FLAKON', 'Flakon'], ['KALEM', 'Kalem'],
  ['KARTUŞ', 'Kartuş'], ['KULLANIMA HAZIR ENJEKTÖR', 'Kullanıma hazır enjektör'], ['ENJEKTÖR', 'Enjektör']
];

const { normalizeSearch } = require('./normalize');
const FOLDED_FORMS = FORMS.map(([pattern, label]) => [normalizeSearch(pattern), label]);

// "500 MG", "0,75 MG", "100MG/5ML", "% 0,4", "%5", "1000 IU", "40 MG/ML", "875/125 MG"
const UNIT = '(?:MG|MCG|µG|G|GR|IU|İU|IÜ|ME|Mİ|MİLYON IU|MMOL|MEQ|ML|U|ÜNİTE|ÜNITE)';
const NUM = '\\d+(?:[.,]\\d+)?';
const PER = `(?:\\s?/\\s?(?:${NUM}\\s?)?${UNIT}|\\s?/\\s?DOZ)?`;
const DOSE = new RegExp(`(%\\s?${NUM}(?:\\s?\\+\\s?%?\\s?${NUM})*|${NUM}(?:\\s?/\\s?${NUM})*\\s?${UNIT}${PER}(?:\\s?\\+\\s?${NUM}\\s?${UNIT}${PER})*)`, 'u');
// Virgülsüz adlarda sondaki adet ifadesi: "PAROL 500 MG 20 TABLET" → "20 TABLET"
const TRAILING_PACK = /(?:^|\s)(\d+\s(?:FİLM\s)?(?:TABLET|KAPSÜL|ADET|AMPUL|FLAKON|ŞASE|DRAJE|SUPOZİTUVAR|OVÜL|FLASTER|KALEM))$/u;

function parseProductName(name) {
  const result = { dosage: null, pharmaceuticalForm: null, packageSize: null };
  if (!name) return result;
  const text = String(name).toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ').trim();

  // Paket: son virgülden sonraki, rakamla başlayan bölüm ("20 TABLET", "250 ML SETLİ")
  const comma = text.lastIndexOf(',');
  let head = text;
  if (comma > 0) {
    const tail = text.slice(comma + 1).trim();
    if (/^\d/.test(tail) && tail.length <= 60) { result.packageSize = tail; head = text.slice(0, comma); }
  }
  if (!result.packageSize) {
    const trailing = head.match(TRAILING_PACK);
    if (trailing) { result.packageSize = trailing[1]; head = head.slice(0, head.length - trailing[1].length).trim(); }
  }

  const dose = head.match(DOSE);
  if (dose) result.dosage = dose[1].replace(/\s+/g, ' ').replace(/%\s/g, '%').trim();

  // Form önce adın gövdesinde, bulunamazsa paket ifadesinde aranır ("20 FİLM TABLET").
  // Karşılaştırma Türkçe karaktersiz yapılır: "ÇÖZELTİSİ" ve "COZELTISI" aynı sayılır.
  const findForm = value => { const folded = ` ${normalizeSearch(value)} `; return FOLDED_FORMS.find(([pattern]) => folded.includes(` ${pattern} `))?.[1] || null; };
  result.pharmaceuticalForm = findForm(head) || (result.packageSize ? findForm(result.packageSize) : null);
  return result;
}

module.exports = { parseProductName };
