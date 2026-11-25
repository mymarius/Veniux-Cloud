import { useState } from 'react';
import api from '../../api/client';

// Muhasebe programından indirdiğiniz şablonu (CSV/Excel) seçersiniz, her sütunu bir Veniux alanına eşlersiniz, Veniux şablonu doldurur.
// Eşleme bu tarayıcıda şablon adıyla hatırlanır; sunucuya yalnız doldurma sırasında gider.
const FIELD_NAMES = {
  fis_no: 'Fiş no', tarih: 'Tarih', urun: 'Ürün', miktar: 'Miktar', birim: 'Birim', kdv_haric: 'KDV hariç tutar', kdv_orani: 'KDV oranı', kdv: 'KDV tutarı',
  toplam: 'Toplam', hesap_kodu: 'Hesap kodu', odeme_turu: 'Ödeme türü', tutar: 'Tutar', belge_no: 'Belge no', asil_fis_no: 'Asıl fiş no', tur: 'Tür',
  siparis_no: 'Sipariş no', siparis_tarihi: 'Sipariş tarihi', tedarikci: 'Tedarikçi', vergi_no: 'Vergi no', alinan_miktar: 'Alınan miktar',
  birim_fiyat: 'Birim fiyat', kdv_bilgisi: 'KDV bilgisi', hareket_no: 'Hareket no', depo_no: 'Depo no', referans: 'Referans', cari_kodu: 'Cari kodu',
  unvan: 'Ünvan', adres: 'Adres',
};
const NUMERIC = new Set(['miktar', 'kdv_haric', 'kdv_orani', 'kdv', 'toplam', 'tutar', 'alinan_miktar', 'birim_fiyat']);
const storeKey = (name, type) => `veniux.accountingTemplate.${type}.${name}`;
const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* hatırlama isteğe bağlı */ } };
const toBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(new Error('Dosya okunamadı.'));
  reader.readAsDataURL(file);
});

export default function AccountingTemplate({ item, onClose }) {
  const [file, setFile] = useState(null), [data, setData] = useState(''), [info, setInfo] = useState(null);
  const [headerRow, setHeaderRow] = useState(''), [rows, setRows] = useState({}), [busy, setBusy] = useState(false), [note, setNote] = useState(null);
  const fail = e => setNote({ error: true, text: e.response?.data?.error || e.message || 'İşlem tamamlanamadı.' });

  const load = async (nextFile, nextRow) => {
    setBusy(true); setNote(null);
    try {
      const base64 = nextFile === file && data ? data : await toBase64(nextFile);
      const { data: result } = await api.post('/accounting-exports/template/headers', { filename: nextFile.name, type: item.export_type, data: base64, header_row: nextRow || undefined });
      setFile(nextFile); setData(base64); setInfo(result); setHeaderRow(String(result.header_row || 1));
      const saved = read(storeKey(nextFile.name, item.export_type));
      setRows(saved && typeof saved === 'object' ? Object.fromEntries(result.headers.filter(h => saved[h]).map(h => [h, saved[h]])) : {});
    } catch (e) { setInfo(null); fail(e); } finally { setBusy(false); }
  };
  const setRow = (header, patch) => setRows(current => ({ ...current, [header]: { ...(current[header] || {}), ...patch } }));
  const mapping = () => Object.fromEntries(Object.entries(rows).map(([header, row]) => {
    if (row.kind === 'value') return [header, { value: row.value || '' }];
    if (row.kind === 'field' && row.field) return [header, { field: row.field, as: row.number ? 'number' : undefined }];
    return [header, null];
  }).filter(([, entry]) => entry));
  const download = async () => {
    setBusy(true); setNote(null);
    try {
      const body = mapping();
      const response = await api.post(`/accounting-exports/${item.id}/template`, { filename: file.name, data, mapping: body, header_row: Number(headerRow) || undefined }, { responseType: 'blob' });
      write(storeKey(file.name, item.export_type), rows);
      const url = URL.createObjectURL(response.data), link = document.createElement('a');
      link.href = url; link.download = file.name.replace(/\.[^.]+$/, '') + '-veniux' + (info.kind === 'xlsx' ? '.xlsx' : '.csv'); link.click(); URL.revokeObjectURL(url);
      setNote({ text: 'Dosya indirildi.' });
    } catch (e) {
      let text = 'Dosya hazırlanamadı.';
      try { text = JSON.parse(await e.response.data.text()).error || text; } catch { /* yanıt metin değil */ }
      setNote({ error: true, text });
    } finally { setBusy(false); }
  };

  return <div className="mt-3 space-y-3 rounded border border-slate-200 p-3 text-sm" aria-label="Şablonla indir">
    <div className="flex items-center justify-between"><strong>Kendi şablonunuzla indir</strong><button type="button" className="btn-soft" onClick={onClose}>Kapat</button></div>
    <p className="text-slate-500">Muhasebe programınızdan indirdiğiniz içe aktarma şablonunu (CSV veya Excel) seçin, her sütunu bir Veniux alanına eşleyin. Bu programlarla henüz denenmedi: aktarmadan önce küçük bir dosyayla deneyin.</p>
    <input type="file" accept=".csv,.txt,.xlsx,.xls" disabled={busy} onChange={e => { const chosen = e.target.files?.[0]; if (chosen) load(chosen); }} />
    {info?.kind === 'xlsx' && <label className="block">Başlık satırı (üstte açıklama satırı varsa değiştirin)
      <input className="ml-2 w-20" type="number" min="1" value={headerRow} onChange={e => setHeaderRow(e.target.value)} onBlur={() => file && load(file, Number(headerRow))} /></label>}
    {info && <div className="space-y-2">
      <div className="grid gap-2">{info.headers.map((header, index) => header ? <div key={index} className="grid sm:grid-cols-[1fr_1.4fr_auto] gap-2 items-center">
        <span className="font-medium">{header}</span>
        <span className="flex gap-2">
          <select aria-label={`${header} eşlemesi`} value={rows[header]?.kind === 'value' ? '__value' : (rows[header]?.field || '')} onChange={e => {
            const v = e.target.value;
            if (v === '__value') setRow(header, { kind: 'value', field: '', number: false });
            else if (!v) setRow(header, { kind: '', field: '' });
            else setRow(header, { kind: 'field', field: v, number: NUMERIC.has(v) });
          }}>
            <option value="">Boş bırak</option>
            {info.fields.map(f => <option key={f} value={f}>{FIELD_NAMES[f] || f}</option>)}
            <option value="__value">Sabit değer…</option>
          </select>
          {rows[header]?.kind === 'value' && <input aria-label={`${header} sabit değeri`} value={rows[header]?.value || ''} maxLength={200} onChange={e => setRow(header, { value: e.target.value })} />}
        </span>
        <label className="flex items-center gap-1 text-xs">{rows[header]?.kind === 'field' && <><input type="checkbox" checked={!!rows[header]?.number} onChange={e => setRow(header, { number: e.target.checked })} />Sayı</>}</label>
      </div> : null)}</div>
      <button type="button" className="btn-primary" disabled={busy || !Object.keys(mapping()).length} onClick={download}>Doldurulmuş dosyayı indir</button>
    </div>}
    {note && <p role={note.error ? 'alert' : 'status'} className={note.error ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700'}>{note.text}</p>}
  </div>;
}
