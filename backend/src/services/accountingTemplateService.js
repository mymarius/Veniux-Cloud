// Muhasebe programının kendi şablonunu (CSV veya Excel) Veniux paketindeki verilerle doldurur.
// Şablonun sütun adlarını Veniux bilmez: kullanıcı her sütunu bir Veniux alanına ya da sabit değere eşler.
const XLSX = require('xlsx');

const MAX_TEMPLATE_BYTES = 2 * 1024 * 1024, MAX_ROWS = 50000;
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const FORMULA_START = /^[=+\-@\t\r]/;

function decode(buffer) {
  let text = buffer.toString('utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  return text;
}
function detectDelimiter(line) {
  const counts = [';', '\t', ','].map(char => [char, line.split(char).length - 1]).sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ';';
}
function parseCsv(text, delimiter) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false; } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else cell += char;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(entry => entry.some(value => String(value).trim() !== ''));
}
function csvCell(value, delimiter) {
  const text = value === null || value === undefined ? '' : String(value);
  return text.includes('"') || text.includes('\r') || text.includes('\n') || text.includes(delimiter) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

// { kind, delimiter?, headers, headerRow } ya da hata
function readTemplate(filename, buffer, headerRowOverride) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) fail('Şablon dosyası boş.');
  if (buffer.length > MAX_TEMPLATE_BYTES) fail('Şablon dosyası 2 MB sınırını aşıyor.');
  const ext = String(filename || '').toLowerCase().match(/\.(csv|txt|xlsx|xls)$/)?.[1];
  if (!ext) fail('Şablon .csv, .xlsx veya .xls olmalı.');
  if (ext === 'csv' || ext === 'txt') {
    const text = decode(buffer), delimiter = detectDelimiter(text.split(/\r?\n/, 1)[0] || '');
    const rows = parseCsv(text, delimiter);
    if (!rows.length) fail('Şablonda başlık satırı bulunamadı.');
    return { kind: 'csv', delimiter, headers: rows[0].map(value => String(value).trim()), headerRow: 0 };
  }
  let workbook;
  try { workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: false, cellHTML: false }); } catch { fail('Excel şablonu okunamadı.'); }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet || !sheet['!ref']) fail('Şablonda başlık satırı bulunamadı.');
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const rowHeaders = r => { const headers = []; for (let c = range.s.c; c <= range.e.c; c += 1) { const cell = sheet[XLSX.utils.encode_cell({ r, c })]; headers.push(cell && cell.v !== undefined ? String(cell.v).trim() : ''); } return headers; };
  // Başlık satırı: kullanıcı belirttiyse o (1'den başlar); yoksa ilk 15 satırda en çok dolu hücresi olan ilk satır (üstteki başlık/açıklama satırlarını atlar).
  let headerRow = -1;
  if (Number.isInteger(headerRowOverride) && headerRowOverride >= 1) headerRow = range.s.r + headerRowOverride - 1;
  else { let best = 0; for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 14); r += 1) { const count = rowHeaders(r).filter(Boolean).length; if (count > best) { best = count; headerRow = r; } } }
  if (headerRow < range.s.r || headerRow > range.e.r) fail('Başlık satırı bulunamadı.');
  const headers = rowHeaders(headerRow);
  if (!headers.some(Boolean)) fail('Seçilen satırda başlık yok.');
  return { kind: 'xlsx', headers, headerRow, headerRowNumber: headerRow - range.s.r + 1, firstColumn: range.s.c, workbook, sheetName: workbook.SheetNames[0] };
}

function readPackage(content) {
  const rows = parseCsv(decode(Buffer.from(String(content || ''), 'utf8')), ';');
  if (rows.length < 2) fail('Pakette aktarılacak satır yok.');
  return { header: rows[0], rows: rows.slice(1) };
}

function cleanMapping(mapping, templateHeaders, packageHeader) {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) fail('Sütun eşlemesi gerekli.');
  const out = [];
  templateHeaders.forEach((name, index) => {
    const entry = name ? mapping[name] : null;
    if (!entry) return out.push(null);
    if (typeof entry.value === 'string') return out.push({ value: entry.value.slice(0, 200) });
    if (typeof entry.field === 'string') {
      const at = packageHeader.indexOf(entry.field);
      if (at < 0) fail(`"${name}" için seçilen alan bu pakette yok: ${entry.field}`);
      const as = ['number', 'number_dot', 'date_dmy', 'date_slash'].includes(entry.as) ? entry.as : 'text';
      return out.push({ at, as });
    }
    return out.push(null);
  });
  if (!out.some(Boolean)) fail('En az bir sütunu eşleyin.');
  return out;
}

// Paketteki metin hücresi formül sayılmasın diye başına tek tırnak konmuştur; Excel dosyasında metin türü yazıldığından tırnak gereksizdir.
const unquote = value => (typeof value === 'string' && value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value);
const toNumber = value => { const parsed = Number(String(value).replace(/\./g, '').replace(',', '.')); return Number.isFinite(parsed) && String(value).trim() !== '' ? parsed : null; };

function fill({ filename, buffer, mapping, content, headerRow }) {
  const template = readTemplate(filename, buffer, headerRow), pack = readPackage(content);
  if (pack.rows.length > MAX_ROWS) fail('Paket çok büyük.');
  const map = cleanMapping(mapping, template.headers, pack.header);
  const values = pack.rows.map(row => map.map(entry => {
    if (!entry) return { text: '' };
    if (entry.value !== undefined) return { text: entry.value };
    const raw = row[entry.at] ?? '';
    if (entry.as === 'number' || entry.as === 'number_dot') { const n = toNumber(raw); return n === null ? { text: unquote(raw) } : { number: n, dot: entry.as === 'number_dot' }; }
    if (entry.as === 'date_dmy' || entry.as === 'date_slash') { const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw)); return d ? { text: entry.as === 'date_dmy' ? `${d[3]}.${d[2]}.${d[1]}` : `${d[3]}/${d[2]}/${d[1]}` } : { text: raw }; }
    return { text: raw };
  }));
  if (template.kind === 'csv') {
    const lines = [template.headers.map(name => csvCell(name, template.delimiter)).join(template.delimiter)];
    for (const row of values) lines.push(row.map(cell => csvCell(cell.number !== undefined ? cell.dot ? String(cell.number) : String(cell.number).replace('.', ',') : cell.text, template.delimiter)).join(template.delimiter));
    return { name: 'veniux-sablon.csv', type: 'text/csv; charset=utf-8', content: Buffer.from('﻿' + lines.join('\r\n') + '\r\n', 'utf8') };
  }
  const sheet = template.workbook.Sheets[template.sheetName];
  let lastRow = template.headerRow;
  values.forEach((row, i) => {
    const r = template.headerRow + 1 + i; lastRow = r;
    row.forEach((cell, j) => {
      const address = XLSX.utils.encode_cell({ r, c: template.firstColumn + j });
      if (cell.number !== undefined) sheet[address] = { t: 'n', v: cell.number };
      else if (cell.text !== '') sheet[address] = { t: 's', v: unquote(cell.text) };
    });
  });
  const range = XLSX.utils.decode_range(sheet['!ref']);
  range.e.r = Math.max(range.e.r, lastRow); sheet['!ref'] = XLSX.utils.encode_range(range);
  return { name: 'veniux-sablon.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: XLSX.write(template.workbook, { type: 'buffer', bookType: 'xlsx' }) };
}

module.exports = { readTemplate, readPackage, fill, parseCsv, MAX_TEMPLATE_BYTES };
