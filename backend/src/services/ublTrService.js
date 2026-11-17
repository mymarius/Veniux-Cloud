// UBL-TR 1.2 fatura XML üreticisi (e-Fatura ve e-Arşiv). Yalnızca iç taslaktan taslak XML üretir; imzalamaz ve göndermez.
// Tutarlar tam kuruş olarak gelir ve ondalıklı yazıya yalnızca burada çevrilir. Üretilen XML resmî GİB şematron
// denetiminden geçirilmemiştir: entegratörün test ortamında doğrulanmadan canlıya gönderilmemelidir.

const NS = {
  '': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  ext: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance'
};
// UN/ECE birim kodları
const UNIT = { adet: 'C62', pcs: 'C62', kg: 'KGM', g: 'GRM', gr: 'GRM', litre: 'LTR', lt: 'LTR', l: 'LTR', metre: 'MTR', m: 'MTR', koli: 'BX', paket: 'PA' };
const PROFILE = { E_FATURA: 'TICARIFATURA', E_ARSIV: 'EARSIVFATURA' };
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const money = cents => {
  if (!Number.isSafeInteger(cents)) fail('Tutar tam kuruş olmalı.');
  const sign = cents < 0 ? '-' : '', abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};
// Birim fiyat: kuruş hassasiyetinden fazla olabilir, en çok 4 ondalık
const unitPrice = (netCents, quantity) => {
  const q = Number(quantity);
  if (!(q > 0)) fail('Satır miktarı sıfırdan büyük olmalı.');
  const [whole, frac] = (netCents / 100 / q).toFixed(4).split('.');
  let d = frac;
  while (d.length > 2 && d.endsWith('0')) d = d.slice(0, -1);
  return `${whole}.${d}`;
};
const qty = value => String(Number(Number(value).toFixed(6)));
const isTax = v => /^\d{10}$/.test(String(v || '')) || /^\d{11}$/.test(String(v || ''));

function party(p, { buyerFallback = false } = {}) {
  const tax = String(p?.tax_number || '').trim();
  const scheme = tax.length === 11 ? 'TCKN' : 'VKN';
  const id = isTax(tax) ? tax : buyerFallback ? '11111111111' : '';
  if (!id) fail('Vergi numarası (10 haneli VKN veya 11 haneli TCKN) gerekli.');
  const name = String(p?.name || (buyerFallback ? 'Nihai Tüketici' : '')).trim();
  if (!name) fail('Taraf adı gerekli.');
  const person = id.length === 11 && scheme === 'TCKN';
  const parts = name.split(/\s+/);
  return `<cac:Party>
   <cac:PartyIdentification><cbc:ID schemeID="${person ? 'TCKN' : 'VKN'}">${esc(id)}</cbc:ID></cac:PartyIdentification>
   ${person ? '' : `<cac:PartyName><cbc:Name>${esc(name)}</cbc:Name></cac:PartyName>`}
   <cac:PostalAddress>
    <cbc:StreetName>${esc(p?.address || '-')}</cbc:StreetName>
    <cbc:CitySubdivisionName>${esc(p?.district || '-')}</cbc:CitySubdivisionName>
    <cbc:CityName>${esc(p?.city || '-')}</cbc:CityName>
    <cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country>
   </cac:PostalAddress>
   ${p?.tax_office ? `<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>${esc(p.tax_office)}</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
   ${person ? `<cac:Person><cbc:FirstName>${esc(parts.slice(0, -1).join(' ') || parts[0])}</cbc:FirstName><cbc:FamilyName>${esc(parts.length > 1 ? parts.at(-1) : '-')}</cbc:FamilyName></cac:Person>` : ''}
  </cac:Party>`;
}

function validate(draft) {
  if (!draft || !Array.isArray(draft.lines) || !draft.lines.length) fail('Faturada en az bir satır olmalı.');
  const sum = key => draft.lines.reduce((n, l) => n + l[key], 0);
  for (const l of draft.lines) {
    for (const k of ['net_cents', 'vat_cents', 'total_cents']) if (!Number.isSafeInteger(l[k]) || l[k] < 0) fail('Satır tutarları tam kuruş olmalı.');
    if (!Number.isInteger(l.vat_rate) || l.vat_rate < 0 || l.vat_rate > 100) fail('Satır KDV oranı geçersiz.');
    if (l.net_cents + l.vat_cents !== l.total_cents) fail('Satırda KDV hariç tutar ile KDV toplamı eşleşmiyor.', 409);
  }
  const groups = draft.tax_totals?.groups;
  if (!Array.isArray(groups) || !groups.length) fail('KDV özeti eksik.', 409);
  if (draft.tax_totals.unknown_total_cents) fail('KDV bilgisi eksik satır var; fatura hazırlanamadı.', 409);
  const gBase = groups.reduce((n, g) => n + g.base_cents, 0), gVat = groups.reduce((n, g) => n + g.vat_cents, 0);
  if (gBase !== sum('net_cents') || gVat !== sum('vat_cents') || gBase + gVat !== draft.total_cents) fail('KDV özeti satır toplamlarıyla eşleşmiyor.', 409);
  return { net: gBase, vat: gVat, total: gBase + gVat };
}

// seller: { name, tax_number, tax_office, address, city, district }  receiver: aynı biçim (e-Arşivde boş olabilir)
function buildInvoiceXml({ draft, document_type, seller, receiver = null, uuid, number, issued_at = new Date(), note = '' }) {
  const profile = PROFILE[document_type];
  if (!profile) fail('Belge türü e-Fatura veya e-Arşiv olmalı.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(uuid || ''))) fail('Belge UUID kimliği geçersiz.');
  if (!/^[A-Z0-9]{3}\d{13}$/.test(String(number || ''))) fail('Fatura numarası 3 harf/rakam + 13 rakam olmalı (örn. VNX2026000000001).');
  if (!(issued_at instanceof Date) || Number.isNaN(issued_at.getTime())) fail('Düzenleme tarihi geçersiz.');
  const totals = validate(draft);
  const isArsiv = document_type === 'E_ARSIV';
  if (!isArsiv && !receiver) fail('e-Fatura için alıcı bilgisi gerekli.');
  const iso = issued_at.toISOString(), date = iso.slice(0, 10), time = iso.slice(11, 19);
  const currency = esc(draft.currency || 'TRY');
  const sellerXml = party(seller);
  const buyerXml = party(receiver || draft.customer || null, { buyerFallback: isArsiv });

  const taxSub = draft.tax_totals.groups.map(g => `<cac:TaxSubtotal>
    <cbc:TaxableAmount currencyID="${currency}">${money(g.base_cents)}</cbc:TaxableAmount>
    <cbc:TaxAmount currencyID="${currency}">${money(g.vat_cents)}</cbc:TaxAmount>
    <cbc:Percent>${g.rate}</cbc:Percent>
    <cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>
   </cac:TaxSubtotal>`).join('\n   ');

  const lines = draft.lines.map((l, i) => `<cac:InvoiceLine>
   <cbc:ID>${i + 1}</cbc:ID>
   <cbc:InvoicedQuantity unitCode="${UNIT[String(l.unit || 'adet').toLowerCase()] || 'C62'}">${qty(l.quantity)}</cbc:InvoicedQuantity>
   <cbc:LineExtensionAmount currencyID="${currency}">${money(l.net_cents)}</cbc:LineExtensionAmount>
   <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${money(l.vat_cents)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
     <cbc:TaxableAmount currencyID="${currency}">${money(l.net_cents)}</cbc:TaxableAmount>
     <cbc:TaxAmount currencyID="${currency}">${money(l.vat_cents)}</cbc:TaxAmount>
     <cbc:Percent>${l.vat_rate}</cbc:Percent>
     <cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>
   </cac:TaxTotal>
   <cac:Item><cbc:Name>${esc(l.name || 'Ürün')}</cbc:Name></cac:Item>
   <cac:Price><cbc:PriceAmount currencyID="${currency}">${unitPrice(l.net_cents, l.quantity)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`).join('\n  ');

  const nsAttrs = Object.entries(NS).map(([k, v]) => `xmlns${k ? ':' + k : ''}="${v}"`).join(' ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice ${nsAttrs}>
 <ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>
 <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
 <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
 <cbc:ProfileID>${profile}</cbc:ProfileID>
 <cbc:ID>${esc(number)}</cbc:ID>
 <cbc:CopyIndicator>false</cbc:CopyIndicator>
 <cbc:UUID>${esc(String(uuid).toLowerCase())}</cbc:UUID>
 <cbc:IssueDate>${date}</cbc:IssueDate>
 <cbc:IssueTime>${time}</cbc:IssueTime>
 <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
 ${note ? `<cbc:Note>${esc(note)}</cbc:Note>` : ''}
 <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
 <cbc:LineCountNumeric>${draft.lines.length}</cbc:LineCountNumeric>
 ${isArsiv ? `<cac:AdditionalDocumentReference><cbc:ID>ELEKTRONIK</cbc:ID><cbc:IssueDate>${date}</cbc:IssueDate><cbc:DocumentTypeCode>ELEKTRONIK</cbc:DocumentTypeCode></cac:AdditionalDocumentReference>` : ''}
 <cac:AccountingSupplierParty>${sellerXml}</cac:AccountingSupplierParty>
 <cac:AccountingCustomerParty>${buyerXml}</cac:AccountingCustomerParty>
 <cac:TaxTotal>
  <cbc:TaxAmount currencyID="${currency}">${money(totals.vat)}</cbc:TaxAmount>
  ${taxSub}
 </cac:TaxTotal>
 <cac:LegalMonetaryTotal>
  <cbc:LineExtensionAmount currencyID="${currency}">${money(totals.net)}</cbc:LineExtensionAmount>
  <cbc:TaxExclusiveAmount currencyID="${currency}">${money(totals.net)}</cbc:TaxExclusiveAmount>
  <cbc:TaxInclusiveAmount currencyID="${currency}">${money(totals.total)}</cbc:TaxInclusiveAmount>
  <cbc:PayableAmount currencyID="${currency}">${money(totals.total)}</cbc:PayableAmount>
 </cac:LegalMonetaryTotal>
 ${lines}
</Invoice>
`.replace(/\n\s*\n/g, '\n');
}

module.exports = { buildInvoiceXml, money, esc };
