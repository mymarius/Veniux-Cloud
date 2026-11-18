import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Camera, ClipboardList, MapPin, MessageCircle, Percent, Search, X } from 'lucide-react';
import api from '../../../api/client';
import BarcodeCamera from '../../../components/BarcodeCamera';
import { readSessionUser } from '../../../lib/sessionUser';
import { criticalKey, idsOf, newItems, whatsappLink, wholesalerText } from '../../../lib/sectorHub.mjs';
import { EmptyState, MobileTop, money } from '../mobileKit';
import { NotifyButton, PackGate, errorText, notify, usePolling } from './SectorKit';
import { sectorPath, useSurface } from './SectorSurface';

const isBoss = () => ['admin', 'manager'].includes(readSessionUser().role);

// "3 numara vida var mı?": tek kutuda ara, ölçü ve kategori düğmeleriyle daralt, raf ve koridor bilgisini saniyesinde gör.
export function MobileProductSearch() {
  const { desktop } = useSurface();
  const [q, setQ] = useState(''), [size, setSize] = useState(''), [category, setCategory] = useState(''), [material, setMaterial] = useState('');
  const [facets, setFacets] = useState({ sizes: [], categories: [], materials: [] }), [result, setResult] = useState(null), [error, setError] = useState(''), [camera, setCamera] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const [s, f] = await Promise.all([api.get('/sector/hardware/search', { params: { q, size, category, material } }), api.get('/sector/hardware/facets', { params: { q } })]);
        if (id !== seq.current) return;
        setResult(s.data); setFacets(f.data); setError('');
      } catch (e) { if (id === seq.current) setError(errorText(e, 'Arama yapılamadı.')); }
    }, 250);
    return () => clearTimeout(timer);
  }, [q, size, category, material]);
  const reset = () => { setQ(''); setSize(''); setCategory(''); setMaterial(''); };
  return <div className="vm">
    <MobileTop title="Ürün Ara" flat right={<span style={{ display: 'flex', gap: 8 }}>{isBoss() && <Link to={sectorPath(desktop, '/m/toplu-fiyat')} className="vm-iconbtn" aria-label="Toplu fiyat değişikliği"><Percent size={20} /></Link>}<Link to={sectorPath(desktop, '/m/kritik')} className="vm-iconbtn" aria-label="Kritik stok"><AlertTriangle size={20} /></Link></span>} />
    <PackGate pack="hardware"><div className="vm-body" style={{ marginTop: 0, paddingTop: 16 }}>
      <div className="vm-search"><Search size={18} />
        <input type="search" autoFocus placeholder="örn. 3 numara vida" value={q} onChange={e => setQ(e.target.value)} aria-label="Ürün ara" />
        {(q || size || category || material) && <button type="button" aria-label="Temizle" className="vm-iconbtn" style={{ width: 30, height: 30, background: 'none', color: 'var(--vm-muted)' }} onClick={reset}><X size={16} /></button>}
        <button type="button" aria-label="Kamerayla barkod oku" className="vm-iconbtn" style={{ width: 34, height: 34, background: 'var(--vm-brand)' }} onClick={() => setCamera(v => !v)}><Camera size={17} /></button></div>
      {camera && <div style={{ marginBottom: 12 }}><BarcodeCamera onCode={code => { setQ(code); setCamera(false); }} onClose={() => setCamera(false)} /></div>}
      {facets.sizes.length > 0 && <div role="group" aria-label="Ölçü" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
        {facets.sizes.map(s => <button key={s.value} type="button" className={'vm-btn ' + (size.toLowerCase() === s.value.toLowerCase() ? '' : 'soft')} style={{ width: 'auto', minHeight: 38, padding: '0 14px', flex: 'none' }} aria-pressed={size.toLowerCase() === s.value.toLowerCase()} onClick={() => setSize(size.toLowerCase() === s.value.toLowerCase() ? '' : s.value)}>{s.value} <small>({s.count})</small></button>)}</div>}
      {facets.categories.length > 1 && <div role="group" aria-label="Kategori" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
        {facets.categories.map(c => <button key={c.value} type="button" className={'vm-btn ' + (category.toLowerCase() === c.value.toLowerCase() ? '' : 'ghost')} style={{ width: 'auto', minHeight: 34, padding: '0 12px', flex: 'none', fontSize: 13 }} aria-pressed={category.toLowerCase() === c.value.toLowerCase()} onClick={() => setCategory(category.toLowerCase() === c.value.toLowerCase() ? '' : c.value)}>{c.value}</button>)}</div>}
      {(facets.materials || []).length > 1 && <div role="group" aria-label="Malzeme" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
        {facets.materials.map(m => <button key={m.value} type="button" className={'vm-btn ' + (material.toLowerCase() === m.value.toLowerCase() ? '' : 'ghost')} style={{ width: 'auto', minHeight: 34, padding: '0 12px', flex: 'none', fontSize: 13 }} aria-pressed={material.toLowerCase() === m.value.toLowerCase()} onClick={() => setMaterial(material.toLowerCase() === m.value.toLowerCase() ? '' : m.value)}>{m.value}</button>)}</div>}
      {error && <p role="alert" className="vm-err">{error}</p>}
      {!result && !error && <p role="status" className="vm-note">Aranıyor…</p>}
      {result && (result.items.length === 0
        ? <EmptyState icon={<Search size={34} />} title="Ürün bulunamadı" text="Farklı bir yazım veya ölçü deneyin." />
        : <><p className="vm-note" role="status">{result.total} ürün{result.total > result.items.length ? ' (ilk ' + result.items.length + ' gösteriliyor, aramayı daraltın)' : ''}</p>
          {result.items.map(item => <ProductCard key={item.id} item={item} onSaved={() => setQ(v => v + '')} />)}</>)}
    </div></PackGate>
  </div>;
}

// Birimler: "1 koli = 200 adet" gibi. Koli barkodu verilirse kasada okutunca koli fiyatıyla satılır, stoktan 200 adet düşer.
function UnitEditor({ item, onSaved }) {
  const [rows, setRows] = useState((item.units || []).map(u => ({ unit: u.unit, factor: String(u.factor), barcode: u.barcode || '', price: u.custom_price != null ? String(u.custom_price) : '' }))), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [camera, setCamera] = useState(null);
  const base = item.unit || 'adet';
  const set = (i, k, v) => setRows(list => list.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const save = async () => {
    setBusy(true); setMessage('');
    try { const r = await api.put(`/sector/hardware/products/${item.id}/units`, { units: rows.filter(r => r.unit.trim()).map(r => ({ unit: r.unit, factor: r.factor, barcode: r.barcode.trim() || null, price: r.price.trim() || null })) }); onSaved(r.data.units); setMessage('Birimler kaydedildi.'); }
    catch (e) { setMessage(errorText(e, 'Birimler kaydedilemedi.')); } finally { setBusy(false); }
  };
  return <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 8 }}>
    <p className="vm-note">Temel birim: <b>{base}</b>. Her satır için "1 birim kaç {base}" yazın. Koli barkodu kasada okutulunca o birim fiyatıyla satılır; özel fiyat boşsa adet fiyatı x adet kullanılır.</p>
    <datalist id={'units-' + item.id}>{['koli', 'paket', 'kutu', 'düzine', 'deste', 'makara', 'top', 'rulo', 'çuval', 'set'].map(u => <option key={u} value={u} />)}</datalist>
    {rows.map((r, i) => <div key={i} style={{ display: 'grid', gap: 6, padding: 8, border: '1px dashed var(--vm-line)' }}>
      <div className="vm-price-in"><input list={'units-' + item.id} aria-label="Birim adı" placeholder="koli" maxLength={20} value={r.unit} onChange={e => set(i, 'unit', e.target.value)} />
        <input aria-label={'1 ' + (r.unit || 'birim') + ' kaç ' + base} inputMode="decimal" placeholder={'kaç ' + base} style={{ maxWidth: 110 }} value={r.factor} onChange={e => set(i, 'factor', e.target.value)} />
        <button type="button" className="vm-iconbtn" style={{ background: 'none', color: 'var(--vm-muted)' }} aria-label="Birimi çıkar" onClick={() => setRows(list => list.filter((_, j) => j !== i))}><X size={18} /></button></div>
      <div className="vm-price-in"><input aria-label={(r.unit || 'Birim') + ' barkodu'} placeholder="Koli barkodu (isteğe bağlı)" maxLength={64} value={r.barcode} onChange={e => set(i, 'barcode', e.target.value)} />
        <button type="button" className="vm-iconbtn" style={{ background: 'var(--vm-brand)' }} aria-label="Barkodu kamerayla oku" onClick={() => setCamera(i)}><Camera size={16} /></button></div>
      <div className="vm-price-in"><input aria-label={(r.unit || 'Birim') + ' özel fiyatı'} inputMode="decimal" placeholder={'Özel fiyat (boşsa ' + money(item.sale_price * (Number(String(r.factor).replace(',', '.')) || 0)) + ')'} value={r.price} onChange={e => set(i, 'price', e.target.value)} /></div>
      {r.unit && Number(String(r.factor).replace(',', '.')) > 0 && <span className="vm-note">1 {r.unit} = {String(r.factor).replace('.', ',')} {base} · {r.price.trim() ? money(Number(r.price.replace(',', '.'))) + ' (liste ' + money(item.sale_price * Number(String(r.factor).replace(',', '.'))) + ')' : money(item.sale_price * Number(String(r.factor).replace(',', '.')))}</span>}
      {camera === i && <BarcodeCamera onCode={code => { set(i, 'barcode', code); setCamera(null); }} onClose={() => setCamera(null)} />}
    </div>)}
    {rows.length < 6 && <button type="button" className="vm-btn ghost" onClick={() => setRows(list => [...list, { unit: '', factor: '', barcode: '', price: '' }])}>+ Birim ekle</button>}
    {message && <p role="status" className="vm-note">{message}</p>}
    <button type="button" className="vm-btn" disabled={busy} onClick={save}>Birimleri kaydet</button>
  </div>;
}

function ProductCard({ item: initial }) {
  const [item, setItem] = useState(initial);
  const [size, setSize] = useState(item.size || ''), [saved, setSaved] = useState(''), [open, setOpen] = useState(null);
  const [details, setDetails] = useState({ diameter: item.details?.diameter || '', length: item.details?.length || '', material: item.details?.material || '', finish: item.details?.finish || '', equiv: item.details?.equiv || '' });
  const empty = item.stock_total <= 0;
  const saveSize = async () => { try { await api.put('/sector/hardware/products/' + item.id + '/attributes', { size: size.trim() || null, ...Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v.trim() || null])) }); setItem(v => ({ ...v, size: size.trim() || null, details: Object.fromEntries(Object.entries(details).map(([k, x]) => [k, x.trim() || null])) })); setSaved('Kaydedildi'); } catch (e) { setSaved(errorText(e, 'Kaydedilemedi')); } };
  const qtyText = n => String(Math.round(n * 1000) / 1000).replace('.', ',');
  return <section className="vm-card" aria-label={item.name}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ minWidth: 0 }}><b>{item.name}</b><div className="vm-note">{item.sku}{item.size ? ' · ' + item.size : ''}{item.fragile ? ' · kırılgan' : ''}</div></div>
      <div style={{ textAlign: 'right' }}><div style={{ fontSize: 24, fontWeight: 800, color: empty ? 'var(--vm-bad)' : 'var(--vm-text)' }}>{qtyText(item.stock_total)}</div><div className="vm-note">{item.unit || 'adet'} · {money(item.sale_price)}</div></div>
    </div>
    {item.details && [item.details.diameter && 'Çap ' + item.details.diameter, item.details.length && 'Boy ' + item.details.length, item.details.material, item.details.finish].filter(Boolean).length > 0 && <p className="vm-note" style={{ marginTop: 4 }}>{[item.details.diameter && 'Çap ' + item.details.diameter, item.details.length && 'Boy ' + item.details.length, item.details.material, item.details.finish].filter(Boolean).join(' · ')}</p>}
    {item.stock_text && <p style={{ margin: '6px 0 0', fontWeight: 700 }}>{item.stock_text}</p>}
    {item.equivalents?.length > 0 && <div style={{ marginTop: 8, padding: 8, border: '2px dashed var(--vm-accent)' }}><b style={{ fontSize: 13 }}>{empty ? 'Bitti · stoktaki muadili:' : 'Muadilleri:'}</b>{item.equivalents.map(e => <div key={e.id} className="vm-note" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{e.name}</span><span>{qtyText(e.stock)} {e.unit || 'adet'} · {money(e.sale_price)}</span></div>)}</div>}
    {item.units?.length > 0 && <p className="vm-note" style={{ marginTop: 4 }}>{item.units.map(u => `1 ${u.unit} = ${qtyText(u.factor)} ${item.unit || 'adet'} · ${money(u.price)}${u.custom_price != null && u.custom_price !== u.list_price ? ' (liste ' + money(u.list_price) + ')' : ''}`).join('  |  ')}</p>}
    {item.locations.length > 0
      ? <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>{item.locations.map(l => <div key={l.location_id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><MapPin size={16} style={{ flex: 'none', color: 'var(--vm-brand)' }} />
        <span><b>Koridor {l.aisle}</b> · Raf {l.rack} · Kat {l.shelf} <span className="vm-note">({l.zone}) {l.quantity} {item.unit || 'adet'}</span>{l.tags.map(t => <em key={t} style={{ marginLeft: 6, fontStyle: 'normal', fontSize: 11, background: '#165da41a', color: 'var(--vm-brand)', borderRadius: 6, padding: '2px 6px' }}>{t}</em>)}</span></div>)}</div>
      : null}
    {item.stock.length > 1 && <p className="vm-note" style={{ marginTop: 6 }}>{item.stock.map(s => s.warehouse_name + ': ' + (s.text || qtyText(s.quantity) + ' ' + (item.unit || 'adet'))).join(' · ')}</p>}
    {isBoss() && <div style={{ marginTop: 8 }}><div style={{ display: 'flex', gap: 8 }}><button type="button" className="vm-btn soft" style={{ minHeight: 38 }} aria-expanded={open === 'size'} onClick={() => setOpen(v => (v === 'size' ? null : 'size'))}>Ölçü ve muadil</button><button type="button" className="vm-btn soft" style={{ minHeight: 38 }} aria-expanded={open === 'units'} onClick={() => setOpen(v => (v === 'units' ? null : 'units'))}>Koli / birimler{item.units?.length ? ' (' + item.units.length + ')' : ''}</button></div>
      {open === 'size' && <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 6 }}>
        <input className="vm-input" aria-label="Ölçü özeti" placeholder="Ölçü özeti: M4x30, 8 mm, 1/2 inç" value={size} maxLength={40} onChange={e => setSize(e.target.value)} />
        <div className="vm-price-in"><input aria-label="Çap" placeholder="Çap (8 mm)" maxLength={40} value={details.diameter} onChange={e => setDetails(d => ({ ...d, diameter: e.target.value }))} /><input aria-label="Uzunluk" placeholder="Boy (40 mm)" maxLength={40} value={details.length} onChange={e => setDetails(d => ({ ...d, length: e.target.value }))} /></div>
        <div className="vm-price-in"><input aria-label="Malzeme" list="hw-materials" placeholder="Malzeme" maxLength={40} value={details.material} onChange={e => setDetails(d => ({ ...d, material: e.target.value }))} /><input aria-label="Kaplama" list="hw-finishes" placeholder="Kaplama" maxLength={40} value={details.finish} onChange={e => setDetails(d => ({ ...d, finish: e.target.value }))} /></div>
        <datalist id="hw-materials">{['Çelik', 'Paslanmaz', 'Pirinç', 'Alüminyum', 'Naylon', 'Plastik', 'Ahşap', 'Bakır'].map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="hw-finishes">{['Galvaniz', 'Çinko', 'Krom', 'Nikel', 'Siyah', 'Boyalı', 'Ham'].map(v => <option key={v} value={v} />)}</datalist>
        <input className="vm-input" aria-label="Muadil grubu" placeholder="Muadil grubu kodu (örn. DUBEL-8)" maxLength={40} value={details.equiv} onChange={e => setDetails(d => ({ ...d, equiv: e.target.value }))} />
        <p className="vm-note">Aynı muadil grubu kodunu verdiğiniz ürünler, biri bittiğinde birbirinin yerine önerilir. Kod yoksa aynı kategori ve ölçüdekiler önerilir.</p>
        <button type="button" className="vm-btn" onClick={saveSize}>Kaydet</button></div>}
      {open === 'units' && <UnitEditor item={item} onSaved={units => setItem(v => ({ ...v, units, stock_text: null }))} />}
      {saved && <p role="status" className="vm-note">{saved}</p>}</div>}
  </section>;
}


const STORE_KEY = 'vx-m-store';
// Kritik stoktan satın alma taslağı: tedarikçi başına taslak sipariş, koliye yuvarlanmış miktar. Stok değişmez.
function OrderDraft() {
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), [error, setError] = useState(''), [stores, setStores] = useState([]), [store, setStore] = useState('');
  const key = useRef(null);
  useEffect(() => {
    api.get('/warehouses').then(r => {
      const list = (Array.isArray(r.data) ? r.data : r.data?.data || []).filter(w => !w.warehouse_type || w.warehouse_type === 'NORMAL');
      setStores(list);
      let saved; try { saved = Number(localStorage.getItem(STORE_KEY)) || undefined; } catch { saved = undefined; }
      setStore(String(list.find(w => w.id === saved)?.id || (list.length === 1 ? list[0].id : '')));
    }).catch(() => {});
  }, []);
  const create = async () => {
    setBusy(true); setError('');
    const warehouse = Number(store);
    try {
      if (!warehouse) throw Object.assign(new Error('Siparişin gireceği mağaza/depoyu seçin.'), { response: { data: { error: 'Siparişin gireceği mağaza/depoyu seçin.' } } });
      key.current = key.current || 'kritik-' + warehouse + '-' + Date.now();
      setResult((await api.post('/sector/hardware/critical/order', { warehouse_id: warehouse }, { headers: { 'Idempotency-Key': key.current } })).data);
    } catch (e) { setError(errorText(e, 'Sipariş taslağı oluşturulamadı.')); } finally { setBusy(false); }
  };
  if (result) return <section className="vm-card" role="status"><b><ClipboardList size={16} /> {result.orders.length} taslak sipariş hazır</b>
    {result.orders.map(o => <div key={o.order_id} className="vm-note" style={{ marginTop: 6 }}>{o.order_no}: {o.lines.map(l => l.name + ' ' + (l.pack ? l.pack.count + ' ' + l.pack.unit + ' (' + l.quantity + ')' : l.quantity)).join(', ')}</div>)}
    {result.skipped.length > 0 && <p className="vm-err" style={{ marginTop: 6 }}>Tedarikçisi olmadığı için eklenmedi: {result.skipped.map(s => s.name).join(', ')}</p>}
    <p className="vm-note" style={{ marginTop: 6 }}>Taslaklar Satın Alma Siparişleri ekranında; onaylayıp tedarikçiye gönderebilirsiniz.</p></section>;
  return <>{error && <p role="alert" className="vm-err">{error}</p>}
    {stores.length > 1 && <select className="vm-input" aria-label="Siparişin gireceği mağaza" value={store} onChange={e => { setStore(e.target.value); key.current = null; }} style={{ marginBottom: 8 }}><option value="">Siparişin gireceği mağaza/depo…</option>{stores.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}
    <button type="button" className="vm-btn soft" style={{ marginBottom: 10 }} disabled={busy} onClick={create}><ClipboardList size={18} /> {busy ? 'Hazırlanıyor…' : 'Satın alma taslağı oluştur'}</button></>;
}

// Toplu zam/indirim: önce önizleme, sonra onay. Kategori, tedarikçi veya aramayla daraltılır; koli fiyatları da güncellenir.
export function MobileBulkPrice() {
  const [form, setForm] = useState({ q: '', category: '', mode: 'percent', value: '', rounding: '0.05', target: 'sale' }), [preview, setPreview] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState([]);
  useEffect(() => { api.get('/sector/hardware/facets', { params: { q: '' } }).then(r => setCategories(r.data.categories.map(c => c.value))).catch(() => {}); }, []);
  const body = () => ({ q: form.q, category: form.category, [form.mode]: form.value, rounding: Number(form.rounding), target: form.target });
  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setPreview(null); };
  const run = async apply => {
    setBusy(true); setMessage('');
    try { const r = (await api.post('/sector/hardware/prices/bulk', apply ? { ...body(), apply: true, expected_count: preview.changed } : body())).data; if (apply) { setMessage(r.changed + ' ürünün fiyatı değişti.'); setPreview(null); } else setPreview(r); }
    catch (e) { setMessage(errorText(e, 'İşlem yapılamadı.')); } finally { setBusy(false); }
  };
  return <div className="vm">
    <MobileTop title="Toplu Fiyat" flat back="/m/urun-ara" />
    <PackGate pack="hardware"><div className="vm-body" style={{ marginTop: 0, paddingTop: 16, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 10 }}>
      <p className="vm-note">Toptancı zammını tek seferde yansıtın. Önce önizlemeyi görün, sonra onaylayın. Koliye özel fiyatlar da aynı oranla değişir.</p>
      <select className="vm-input" aria-label="Kategori" value={form.category} onChange={set('category')}><option value="">Kategori seçin (veya aramayla daraltın)</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
      <input className="vm-input" aria-label="Ürün araması" placeholder="Arama (örn. vida, galvaniz)" value={form.q} onChange={set('q')} />
      <div className="vm-price-in"><select aria-label="Değişiklik türü" value={form.mode} onChange={set('mode')}><option value="percent">Yüzde (%)</option><option value="amount">Tutar (₺)</option></select>
        <input aria-label="Değer" inputMode="decimal" placeholder={form.mode === 'percent' ? 'örn. 12 veya -5' : 'örn. 2,50'} value={form.value} onChange={set('value')} /></div>
      <div className="vm-price-in"><select aria-label="Yuvarlama" value={form.rounding} onChange={set('rounding')}><option value="0.01">Kuruşa yuvarla</option><option value="0.05">0,05 ₺</option><option value="0.1">0,10 ₺</option><option value="0.5">0,50 ₺</option><option value="1">1 ₺</option></select>
        <select aria-label="Hangi fiyat" value={form.target} onChange={set('target')}><option value="sale">Satış fiyatı</option><option value="purchase">Alış fiyatı</option></select></div>
      <button type="button" className="vm-btn soft" disabled={busy || !form.value || (!form.category && !form.q.trim())} onClick={() => run(false)}>Önizle</button>
      {message && <p role="status" className="vm-note">{message}</p>}
      {preview && <section className="vm-card"><b>{preview.changed} ürün değişecek</b>{preview.skipped > 0 && <span className="vm-note"> · {preview.skipped} ürün aynı kalıyor</span>}
        <div className="vm-list" style={{ marginTop: 8 }}>{preview.items.slice(0, 50).map(i => <div key={i.id} className="vm-row"><span className="grow">{i.name}<small>{i.category}</small></span><span className="vm-note" style={{ textDecoration: 'line-through' }}>{money(i.before)}</span><b>{money(i.after)}</b></div>)}</div>
        {preview.items.length > 50 && <p className="vm-note">… ve {preview.changed - 50} ürün daha</p>}
        {preview.sets_to_review?.length > 0 && <div role="alert" className="vm-err" style={{ marginTop: 8 }}><b>Takım fiyatlarını gözden geçirin</b> (zamdan sonra otomatik değişmez):{preview.sets_to_review.map(t => <div key={t.id}>{t.name}: takım {money(t.set_price)}, parçalar toplamı {money(t.parts_total_after)}</div>)}</div>}
        {preview.unit_prices_kept > 0 && <p className="vm-note" style={{ marginTop: 6 }}>{preview.unit_prices_kept} ürünün koliye özel fiyatı değişmeden kalacak.</p>}
        <button type="button" className="vm-btn" style={{ marginTop: 10 }} disabled={busy || !preview.changed} onClick={() => run(true)}>{preview.changed} ürüne uygula</button></section>}
    </div></PackGate>
  </div>;
}

// Kritik stok: "3 numara vida bitiyor, toptancıya yaz". Uygulama açıkken yeni uyarı gelince telefon titrer.
export function useCriticalWatcher(enabled) {
  const [data, setData] = useState(null);
  const seen = useRef(null);
  usePolling(async () => {
    const next = (await api.get('/sector/hardware/critical')).data;
    if (seen.current !== null) {
      const fresh = newItems(seen.current, next.items, criticalKey);
      if (fresh.length) notify('Kritik stok', fresh.length === 1 ? fresh[0].message : fresh.length + ' ürün azaldı veya bitti.');
    }
    seen.current = idsOf(next.items, criticalKey); setData(next);
  }, 60000, enabled);
  return data;
}

export function MobileCritical() {
  const [enabled] = useState(true);
  const data = useCriticalWatcher(enabled);
  const phone = data?.items.find(i => i.supplier?.phone)?.supplier.phone;
  return <div className="vm">
    <MobileTop title="Kritik Stok" flat />
    <PackGate pack="hardware"><div className="vm-body" style={{ marginTop: 0, paddingTop: 16 }}>
      <NotifyButton />
      {!data && <p role="status" className="vm-note">Yükleniyor…</p>}
      {data && (data.items.length === 0
        ? <EmptyState icon={<AlertTriangle size={34} />} title="Raflar dolu" text="Asgari stok düzeyinin altına inen ürün yok." />
        : <>
          <p className="vm-note" role="status" style={{ marginTop: 10 }}>{data.count} ürün kritik seviyede, {data.empty} tanesi bitti. Liste dakikada bir yenilenir.</p>
          <a className="vm-btn" style={{ margin: '10px 0' }} target="_blank" rel="noopener noreferrer" href={whatsappLink(phone, wholesalerText(data.items))}><MessageCircle size={18} /> Toptancıya yaz (WhatsApp)</a>
          {isBoss() && <OrderDraft />}
          <div className="vm-list">{data.items.map(i => <div key={i.id} className="vm-row"><AlertTriangle size={20} style={{ color: i.empty ? 'var(--vm-bad)' : 'var(--vm-accent)' }} />
            <span className="grow">{i.name}<small>{i.message}{i.supplier ? ' · ' + i.supplier.name : ''}</small></span>
            {i.supplier?.phone && <a href={whatsappLink(i.supplier.phone, wholesalerText([i]))} target="_blank" rel="noopener noreferrer" aria-label={i.name + ' için ' + i.supplier.name + ' kişisine yaz'}><MessageCircle size={20} /></a>}</div>)}</div></>)}
    </div></PackGate>
  </div>;
}
