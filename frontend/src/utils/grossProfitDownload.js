const invalid = () => { throw new Error('İndirilen dosya boş veya geçersiz. Raporu yenileyip tekrar deneyin.'); };
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc32 = bytes => {
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
// Our endpoint writes XLSX with compression disabled. Validate every ZIP entry,
// including CRC and central/local directory agreement, before offering a file.
function validateWorkbook(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = n => view.getUint16(n, true), u32 = n => view.getUint32(n, true);
  const end = bytes.length - 22;
  if (end < 0 || u32(end) !== 0x06054b50 || u16(end + 20) !== 0 || u16(end + 4) || u16(end + 6)) invalid();
  const count = u16(end + 10), offset = u32(end + 16), size = u32(end + 12);
  if (!count || u16(end + 8) !== count || offset + size !== end) invalid();
  const names = new Set(), decoder = new TextDecoder('utf-8', { fatal: true });
  let pos = offset;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || u32(pos) !== 0x02014b50 || u16(pos + 10) !== 0 || u16(pos + 8) & 1) invalid();
    const len = u32(pos + 24), local = u32(pos + 42), nameLen = u16(pos + 28);
    if (u32(pos + 20) !== len || pos + 46 + nameLen > end || local + 30 > offset || u32(local) !== 0x04034b50) invalid();
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
    const localNameLen = u16(local + 26), start = local + 30 + localNameLen + u16(local + 28);
    if (names.has(name) || u16(local + 8) !== 0 || u16(local + 6) !== u16(pos + 8) || u32(local + 18) !== len || u32(local + 22) !== len || start + len > offset || decoder.decode(bytes.subarray(local + 30, local + 30 + localNameLen)) !== name) invalid();
    const body = bytes.subarray(start, start + len);
    if (crc32(body) !== u32(pos + 16) || u32(local + 14) !== u32(pos + 16)) invalid();
    if (name.endsWith('.xml')) {
      const xml = decoder.decode(body);
      if (typeof DOMParser !== 'undefined' && new DOMParser().parseFromString(xml, 'application/xml').querySelector('parsererror')) invalid();
    }
    names.add(name);
    pos += 46 + nameLen + u16(pos + 30) + u16(pos + 32);
  }
  if (pos !== end || !['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'].every(n => names.has(n))) invalid();
}
export async function validateReportDownload(response, format, expected) {
  const headers = response.headers || {}, header = key => headers.get?.(key) ?? headers[key.toLowerCase()];
  const type = String(header('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (type !== (format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) invalid();
  if (header('X-Report-Fingerprint') !== expected.fingerprint) throw new Error('Rapor değişti. Raporu yenileyip tekrar indirin.');
  const filename = `brut-kar_${expected.from}_${expected.to}.${format}`;
  if (!String(header('Content-Disposition') || '').includes(`filename="${filename}"`)) invalid();
  const blob = response.data;
  if (!(blob instanceof Blob) || !blob.size) invalid();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  try {
    if (format === 'xlsx') validateWorkbook(bytes);
    else {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (bytes[0] !== 0xef || bytes[1] !== 0xbb || bytes[2] !== 0xbf || !text.startsWith('"Tarih";"Ürün";"Barkod";') || !text.includes('\r\n"TOPLAM";') || !text.includes(`"Başlangıç tarihi";"${expected.from}"`) || !text.includes(`"Bitiş tarihi";"${expected.to}"`)) invalid();
    }
  } catch { invalid(); }
  return { blob, filename };
}
