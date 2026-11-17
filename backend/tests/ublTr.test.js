const { DOMParser } = require('@xmldom/xmldom');
const { buildInvoiceXml, money } = require('../src/services/ublTrService');

const UUID = '3f2a7c9e-4b1d-4e8a-9c55-0a1b2c3d4e5f';
const seller = { name: 'Örnek Market & Ticaret Ltd.', tax_number: '1234567890', tax_office: 'Kadıköy', address: 'Moda Cad. 5', city: 'İstanbul', district: 'Kadıköy' };
// 2 adet x 100,00 +%20 ; 1,5 kg x 40,00 +%10 (kuruş hesabı)
const draft = {
  currency: 'TRY',
  lines: [
    { name: 'Ayran & Süt "özel"', quantity: 2, unit: 'adet', net_cents: 20000, vat_rate: 20, vat_cents: 4000, total_cents: 24000 },
    { name: 'Un', quantity: 1.5, unit: 'kg', net_cents: 6000, vat_rate: 10, vat_cents: 600, total_cents: 6600 }
  ],
  tax_totals: { groups: [{ rate: 10, base_cents: 6000, vat_cents: 600, total_cents: 6600 }, { rate: 20, base_cents: 20000, vat_cents: 4000, total_cents: 24000 }], unknown_total_cents: 0 },
  total_cents: 30600
};
const base = { draft, document_type: 'E_ARSIV', seller, uuid: UUID, number: 'TSL2026000000001', issued_at: new Date('2026-11-17T09:30:15Z') };
const parse = xml => { const errors = []; const doc = new DOMParser({ onError: (l, m) => errors.push(m) }).parseFromString(xml, 'text/xml'); return { doc, errors }; };
const arr = c => Array.from({ length: c.length }, (_, i) => c[i]);
const text = (doc, tag) => arr(doc.getElementsByTagName(tag)).map(n => n.textContent);

test('para yazımı tam kuruştan ondalığa çevrilir, kayan nokta kullanılmaz', () => {
  expect(money(0)).toBe('0.00'); expect(money(5)).toBe('0.05'); expect(money(123456)).toBe('1234.56'); expect(money(-250)).toBe('-2.50');
  expect(() => money(1.5)).toThrow('tam kuruş');
});

test('e-Arşiv XML iyi biçimli, profil/UUID/tarih ve özel karakterler doğru', () => {
  const xml = buildInvoiceXml(base);
  const { doc, errors } = parse(xml);
  expect(errors).toEqual([]);
  expect(text(doc, 'cbc:ProfileID')).toEqual(['EARSIVFATURA']);
  expect(text(doc, 'cbc:UUID')).toEqual([UUID]);
  expect(text(doc, 'cbc:IssueDate')[0]).toBe('2026-11-17');
  expect(text(doc, 'cbc:IssueTime')).toEqual(['09:30:15']);
  expect(text(doc, 'cbc:LineCountNumeric')).toEqual(['2']);
  expect(xml).toContain('Ayran &amp; Süt &quot;özel&quot;');
  expect(xml).toContain('Örnek Market &amp; Ticaret Ltd.');
});

test('toplamlar satırlarla ve KDV özetiyle tutar; alıcı belirtilmeyen e-Arşivde nihai tüketici', () => {
  const { doc } = parse(buildInvoiceXml(base));
  const top = doc.getElementsByTagName('cac:LegalMonetaryTotal')[0];
  const get = t => top.getElementsByTagName(t)[0].textContent;
  expect(get('cbc:LineExtensionAmount')).toBe('260.00');
  expect(get('cbc:TaxExclusiveAmount')).toBe('260.00');
  expect(get('cbc:TaxInclusiveAmount')).toBe('306.00');
  expect(get('cbc:PayableAmount')).toBe('306.00');
  expect(text(doc, 'cbc:TaxAmount')[0]).toBe('46.00');
  expect(text(doc, 'cbc:Percent').sort()).toEqual(['10', '10', '20', '20']);
  const ids = text(doc, 'cbc:ID');
  expect(ids).toContain('1234567890'); expect(ids).toContain('11111111111');
  expect(text(doc, 'cbc:InvoicedQuantity')).toEqual(['2', '1.5']);
  const units = arr(doc.getElementsByTagName('cbc:InvoicedQuantity')).map(n => n.getAttribute('unitCode'));
  expect(units).toEqual(['C62', 'KGM']);
  expect(text(doc, 'cbc:PriceAmount')).toEqual(['100.00', '40.00']);
});

test('e-Fatura alıcısız olamaz; alıcı VKN ile yazılır, TCKN gerçek kişi olur', () => {
  expect(() => buildInvoiceXml({ ...base, document_type: 'E_FATURA' })).toThrow('alıcı');
  const firm = buildInvoiceXml({ ...base, document_type: 'E_FATURA', receiver: { name: 'Alıcı AŞ', tax_number: '9876543210', tax_office: 'Çankaya', address: 'X' } });
  expect(text(parse(firm).doc, 'cbc:ProfileID')).toEqual(['TICARIFATURA']);
  const person = buildInvoiceXml({ ...base, receiver: { name: 'Ayşe Yılmaz', tax_number: '12345678901' } });
  expect(person).toContain('schemeID="TCKN"'); expect(person).toContain('<cbc:FirstName>Ayşe</cbc:FirstName>'); expect(person).toContain('<cbc:FamilyName>Yılmaz</cbc:FamilyName>');
});

test('tutarsız ya da eksik veri reddedilir', () => {
  const bad = patch => () => buildInvoiceXml({ ...base, ...patch });
  expect(bad({ draft: { ...draft, lines: [] } })).toThrow('en az bir satır');
  expect(bad({ draft: { ...draft, lines: [{ ...draft.lines[0], vat_cents: 1 }, draft.lines[1]] } })).toThrow('eşleşmiyor');
  expect(bad({ draft: { ...draft, total_cents: 30601 } })).toThrow('KDV özeti');
  expect(bad({ draft: { ...draft, tax_totals: { ...draft.tax_totals, unknown_total_cents: 100 } } })).toThrow('KDV bilgisi eksik');
  expect(bad({ seller: { ...seller, tax_number: '123' } })).toThrow('Vergi numarası');
  expect(bad({ uuid: 'x' })).toThrow('UUID');
  expect(bad({ number: 'TSL123' })).toThrow('Fatura numarası');
  expect(bad({ document_type: 'FIS' })).toThrow('Belge türü');
  expect(bad({ issued_at: new Date('x') })).toThrow('tarih');
});

test('birim fiyat tek kuruşluk kırıntıda en çok dört ondalık yazılır', () => {
  const d = { ...draft, lines: [{ name: 'Üçlü', quantity: 3, unit: 'adet', net_cents: 1000, vat_rate: 20, vat_cents: 200, total_cents: 1200 }], tax_totals: { groups: [{ rate: 20, base_cents: 1000, vat_cents: 200, total_cents: 1200 }], unknown_total_cents: 0 }, total_cents: 1200 };
  expect(text(parse(buildInvoiceXml({ ...base, draft: d })).doc, 'cbc:PriceAmount')).toEqual(['3.3333']);
});
