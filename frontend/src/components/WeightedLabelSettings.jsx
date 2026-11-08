import { useEffect, useState } from 'react';
import api from '../api/client';

// Terazi etiketi barkod şemaları. Şablonlar örnektir; terazinizin etiket ayarıyla karşılaştırıp düzenleyin.
// Kaynak: CAS ve Digi kılavuzlarındaki yaygın düzen: 2 haneli bayrak + 5 haneli ürün kodu + 5 haneli değer + kontrol hanesi.
// Digi "tip 20": değerden önce fiyat kontrol hanesi (PCD) vardır; GS1 Genel Şartname 7.9.3 yöntemiyle denetlenir.
// Bayrak (önek) terazide ayarlanır; aşağıdaki değerler örnektir.
const TEMPLATES = {
  weight: { label: 'Ağırlıklı: bayrak + 5 hane kod + 5 hane gram', rule: { prefix: '27', length: 13, productStart: 2, productLength: 5, valueStart: 7, valueLength: 5, divisor: 1000, kind: 'weight', checkDigit: true } },
  price: { label: 'Fiyatlı: bayrak + 5 hane kod + 5 hane kuruş', rule: { prefix: '28', length: 13, productStart: 2, productLength: 5, valueStart: 7, valueLength: 5, divisor: 100, kind: 'price', checkDigit: true } },
  pricePcd: { label: 'Fiyatlı, fiyat kontrol haneli (Digi tip 20): bayrak + 5 hane kod + 1 + 4 hane kuruş', rule: { prefix: '28', length: 13, productStart: 2, productLength: 5, valueStart: 8, valueLength: 4, divisor: 100, kind: 'price', checkDigit: true, priceCheckAt: 7 } },
};
const FIELDS = [['prefix', 'Önek'], ['length', 'Barkod uzunluğu'], ['productStart', 'Ürün kodu başlangıcı (0’dan)'], ['productLength', 'Ürün kodu uzunluğu'], ['valueStart', 'Değer başlangıcı'], ['valueLength', 'Değer uzunluğu']];
const errorOf = (e, fallback) => e.response?.data?.error || fallback;
const number = value => (value === '' ? '' : Number(value));

export default function WeightedLabelSettings() {
  const [config, setConfig] = useState(null), [rules, setRules] = useState([]), [busy, setBusy] = useState(false), [note, setNote] = useState(null);
  const [sample, setSample] = useState(''), [preview, setPreview] = useState(null);
  const load = async () => { const { data } = await api.get('/scanner/settings'); setConfig(data); setRules(data.weighted || []); };
  useEffect(() => { load().catch(() => setNote({ error: true, text: 'Terazi ayarları alınamadı.' })); }, []);
  const change = (i, key, value) => setRules(rules.map((r, n) => n === i ? { ...r, [key]: value } : r));
  const save = async () => {
    setBusy(true); setNote(null);
    try { await api.put('/scanner/settings', { ...config, weighted: rules.map(r => ({ ...r, prefix: String(r.prefix), ...Object.fromEntries(FIELDS.slice(1).map(([k]) => [k, Number(r[k])])), divisor: Number(r.divisor) })) }); await load(); setNote({ text: 'Terazi ayarları kaydedildi.' }); }
    catch (e) { setNote({ error: true, text: errorOf(e, 'Kaydedilemedi.') }); } finally { setBusy(false); }
  };
  const test = async e => {
    e.preventDefault(); setPreview(null);
    try { const { data } = await api.post('/scanner/weighted-preview', { barcode: sample, weighted: rules }); setPreview({ ok: true, ...data }); }
    catch (err) { setPreview({ ok: false, text: errorOf(err, 'Etiket çözülemedi.') }); }
  };
  const detect = async () => {
    setPreview(null);
    try { const { data } = await api.post('/scanner/weighted-detect', { barcode: sample }); setPreview({ detect: data }); }
    catch (err) { setPreview({ ok: false, text: errorOf(err, 'Etiket çözülemedi.') }); }
  };
  const use = rule => { setRules([...rules.filter(r => r.prefix !== rule.prefix), rule]); setNote({ text: 'Şema eklendi. Kaydet\'e basmayı unutmayın.' }); };
  if (!config) return note ? <p role="alert" className="text-sm text-red-700">{note.text}</p> : null;
  return <section className="veniux-card p-5 space-y-4" aria-label="Terazi etiketi">
    <div><h2 className="font-semibold">Terazi etiketi (manav, kasap, şarküteri)</h2>
      <p className="text-sm text-slate-500">Bayrak (önek) terazinizin barkod ayarında yazar; çoğu terazide 2 hanedir. Terazinin bastığı barkodun hangi kısmının ürün kodu, hangi kısmının ağırlık veya fiyat olduğunu tanımlayın. Şablonlar örnektir; terazinizin etiket ayarıyla karşılaştırın ve aşağıda bir etiket okutarak deneyin.</p></div>
    {rules.map((r, i) => <fieldset key={i} className="rounded-xl border p-3 grid sm:grid-cols-3 gap-3" disabled={busy}>
      <legend className="text-sm font-semibold px-1">Şema {i + 1}</legend>
      {FIELDS.map(([key, label]) => <label key={key} className="text-sm">{label}<input className="block w-full" value={r[key] ?? ''} inputMode="numeric" onChange={e => change(i, key, key === 'prefix' ? e.target.value : number(e.target.value))} /></label>)}
      <label className="text-sm">Değer türü<select className="block w-full" value={r.kind} onChange={e => change(i, 'kind', e.target.value)}><option value="weight">Ağırlık</option><option value="price">Fiyat</option></select></label>
      <label className="text-sm">Bölen<select className="block w-full" value={r.divisor} onChange={e => change(i, 'divisor', Number(e.target.value))}><option value={1000}>1000 (gram → kg / kuruş binde)</option><option value={100}>100 (kuruş → TL)</option><option value={10000}>10000</option><option value={1}>1</option></select></label>
      <label className="text-sm flex items-center gap-2 mt-5"><input type="checkbox" checked={r.checkDigit !== false} onChange={e => change(i, 'checkDigit', e.target.checked)} />Kontrol hanesini denetle</label>
      <button type="button" className="btn-soft sm:col-span-3 justify-self-start" onClick={() => setRules(rules.filter((_, n) => n !== i))}>Şemayı kaldır</button>
    </fieldset>)}
    <div className="flex flex-wrap gap-2">
      {Object.entries(TEMPLATES).map(([key, t]) => <button key={key} type="button" className="btn-soft" disabled={busy || rules.length >= 20} onClick={() => setRules([...rules, { ...t.rule }])}>+ {t.label}</button>)}
      <button type="button" className="btn-primary" disabled={busy} onClick={save}>Kaydet</button>
    </div>
    <form className="rounded-xl border p-3 space-y-2" onSubmit={test}>
      <label className="text-sm block">Deneme: bir terazi etiketini okutun veya barkod numarasını yazın<input className="block w-full font-mono" value={sample} onChange={e => setSample(e.target.value)} placeholder="2700123012500" inputMode="numeric" /></label>
      <div className="flex flex-wrap gap-2"><button className="btn-soft" disabled={!sample.trim()}>Çöz</button><button type="button" className="btn-primary" disabled={!sample.trim()} onClick={detect}>Otomatik bul</button></div>
      {preview?.detect && <div className="space-y-2" role="status">
        {preview.detect.candidates.filter(c => c.product).length === 0 ? <p className="text-sm text-amber-700">Bu etiket hiçbir ürünle eşleşmedi. Etiketteki ürün kodu büyük olasılıkla {[...new Set(preview.detect.candidates.map(c => c.product_code).filter(Boolean))].join(' veya ')}; bu kodu ürün kartında “Terazi kodu” alanına yazıp tekrar deneyin.</p>
          : <p className="text-sm">Etiketin üzerinde yazan ağırlık ve tutarla aynı olanı seçin:</p>}
        {preview.detect.candidates.filter(c => c.product).map(c => <div key={c.label} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
          <span className="flex-1">{c.label} → <b>{c.product.name}</b> · {Number(c.quantity).toLocaleString('tr-TR', { maximumFractionDigits: 3 })} {c.product.unit} · {Number(c.line_total).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
          <button type="button" className="btn-soft" onClick={() => use(c.rule)}>Bunu kullan</button>
        </div>)}
      </div>}
      {preview && !preview.detect && <p role="status" className={preview.ok ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>
        {preview.ok ? (preview.product ? `${preview.product.name} · ${Number(preview.quantity).toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${preview.product.unit} · ${Number(preview.line_total).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}` : `Etiket çözüldü ama ürün kodu ${preview.product_code || ''} hiçbir ürünle eşleşmedi. Ürün kartında terazi kodunu girin.`) : preview.text}
      </p>}
      <p className="text-xs text-slate-500">Deneme kaydedilmemiş şemayla yapılır; satış ve stok değişmez.</p>
    </form>
    {note && <p role={note.error ? 'alert' : 'status'} className={note.error ? 'text-sm font-semibold text-red-700' : 'text-sm font-semibold text-emerald-700'}>{note.text}</p>}
  </section>;
}
