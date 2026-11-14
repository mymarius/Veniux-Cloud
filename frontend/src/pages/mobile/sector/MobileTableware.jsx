import { Fragment, useEffect, useState } from 'react';
import { AlertTriangle, Barcode, Camera, Check, Gift, MessageCircle, Plus, Printer, Search, Trash2 } from 'lucide-react';
import BarcodeCamera from '../../../components/BarcodeCamera';
import { whatsappLink } from '../../../lib/sectorHub.mjs';
import api from '../../../api/client';
import { readSessionUser } from '../../../lib/sessionUser';
import { pickPrinter } from '../../../lib/sectorHub.mjs';
import { bluetoothSupported, connectPrinter, printBytes } from '../../../lib/bluetoothPrinter';
import { encodeLabel } from '../../../lib/escpos.mjs';
import { parsePrice } from '../../../lib/mobileHub.mjs';
import { EmptyState, MobileTop, money } from '../mobileKit';
import { PackGate, errorText, useAsync } from './SectorKit';

const isBoss = () => ['admin', 'manager'].includes(readSessionUser().role);

// Ürün arama kutusu (takım parçası ve fiyat güncelleme için): ad, barkod veya ürün kodu.
function ProductPicker({ onPick, placeholder = 'Ürün adı veya barkod' }) {
  const [q, setQ] = useState(''), [list, setList] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setList([]); return undefined; }
    let live = true; const t = setTimeout(() => api.get('/products', { params: { search: q.trim() } }).then(r => { const rows = Array.isArray(r.data) ? r.data : r.data?.data || []; if (live) setList(rows.slice(0, 8)); }).catch(() => live && setList([])), 250);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  return <div><label className="vm-search"><Search size={18} /><input value={q} placeholder={placeholder} aria-label={placeholder} onChange={e => setQ(e.target.value)} /></label>
    {list.length > 0 && <div className="vm-list" style={{ marginBottom: 10 }}>{list.map(p => <button key={p.id} type="button" className="vm-row" onClick={() => { onPick(p); setQ(''); setList([]); }}><span className="grow">{p.name}<small>{p.barcode || p.sku} · {money(p.sale_price)}</small></span><Plus size={18} /></button>)}</div>}</div>;
}

// Takımlar: parça eksilince "6 kişilik setin 2 bıçağı eksik, tekli sat veya takviye yap" uyarısı.
export function MobileSets() {
  const sets = useAsync(async () => (await api.get('/sector/tableware/sets')).data, []);
  const [form, setForm] = useState(null), [message, setMessage] = useState('');
  const start = () => setForm({ name: '', target_sets: 2, items: [] });
  const save = async () => {
    try { await api.post('/sector/tableware/sets', { name: form.name, target_sets: Number(form.target_sets), items: form.items.map(i => ({ product_id: i.id, quantity: Number(i.quantity) })) }); setForm(null); setMessage('Takım kaydedildi.'); sets.reload(); }
    catch (e) { setMessage(errorText(e, 'Takım kaydedilemedi.')); }
  };
  const remove = async s => { if (!window.confirm(s.name + ' silinsin mi? Parça stokları değişmez.')) return; try { await api.delete('/sector/tableware/sets/' + s.id); sets.reload(); } catch (e) { setMessage(errorText(e, 'Silinemedi.')); } };
  const data = sets.data;
  return <div className="vm">
    <MobileTop title="Takımlar" flat />
    <PackGate pack="tableware"><div className="vm-body" style={{ marginTop: 0, paddingTop: 16 }}>
      {sets.error && <p role="alert" className="vm-err">{sets.error}</p>}
      {message && <p role="status" className="vm-note">{message}</p>}
      {data?.alerts.length > 0 && <section className="vm-card" role="alert" style={{ borderColor: 'var(--vm-accent)' }}><b style={{ display: 'flex', gap: 6, alignItems: 'center' }}><AlertTriangle size={18} /> Eksik parça uyarıları</b>
        {data.alerts.map((a, i) => <p key={i} style={{ margin: '8px 0 0', fontSize: 14 }}>{a.message}</p>)}</section>}
      {data && data.sets.length === 0 && !form && <EmptyState icon={<Check size={34} />} title="Takım tanımlı değil" text="Çatal-bıçak veya yemek takımı tanımlayın; parça azalınca uyarı alın." />}
      {data?.sets.map(s => <section key={s.id} className="vm-card" aria-label={s.name}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{s.name}</b><span style={{ color: s.ok ? 'var(--vm-good)' : 'var(--vm-bad)', fontWeight: 700 }}>{s.complete_sets} / {s.target_sets} takım</span></div>
        <dl className="vm-kv" style={{ marginTop: 8 }}>{s.parts.map(p => <Fragment key={p.product_id}><dt>{p.name} (takımda {p.per_set})</dt><dd style={{ color: p.missing > 0 ? 'var(--vm-bad)' : undefined }}>{p.stock}{p.missing > 0 ? ' · ' + p.missing + ' eksik' : ''}</dd></Fragment>)}</dl>
        {s.barcode ? <p className="vm-note" style={{ marginTop: 6 }}><Barcode size={14} /> Kasada takım barkodu <b>{s.barcode}</b> · takım fiyatı <b>{money(s.sale_price)}</b>{s.list_price > s.sale_price ? ' (parça parça ' + money(s.list_price) + ')' : ''}</p>
          : <p className="vm-note" style={{ marginTop: 6 }}>Parçaların toplam fiyatı {money(s.list_price)}. Kasada tek barkodla satmak için takım barkodu verin.</p>}
        {isBoss() && <SetSale set={s} onSaved={() => sets.reload()} />}
        {isBoss() && <button type="button" className="vm-btn ghost" style={{ minHeight: 38, marginTop: 8 }} onClick={() => remove(s)}><Trash2 size={16} /> Takımı sil</button>}</section>)}
      {isBoss() && !form && <button type="button" className="vm-btn" onClick={start}><Plus size={18} /> Yeni takım</button>}
      {form && <section className="vm-card"><h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Yeni takım</h2>
        <label className="vm-search"><input value={form.name} maxLength={120} placeholder="Takım adı (örn. 6 kişilik yemek takımı)" aria-label="Takım adı" onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label className="vm-note">Rafta bulunması istenen takım sayısı
          <div className="vm-search" style={{ marginTop: 4 }}><input type="number" min={1} max={1000} value={form.target_sets} aria-label="Hedef takım sayısı" onChange={e => setForm({ ...form, target_sets: e.target.value })} /></div></label>
        <ProductPicker placeholder="Parça ekle (bıçak, çatal, tabak…)" onPick={p => !form.items.some(i => i.id === p.id) && setForm({ ...form, items: [...form.items, { id: p.id, name: p.name, quantity: 6 }] })} />
        {form.items.map(i => <div key={i.id} className="vm-price-in"><span style={{ flex: 1 }}>{i.name}</span><input type="number" min={1} aria-label={i.name + ' takımdaki adet'} style={{ maxWidth: 90 }} value={i.quantity} onChange={e => setForm({ ...form, items: form.items.map(x => x.id === i.id ? { ...x, quantity: e.target.value } : x) })} />
          <button type="button" className="vm-iconbtn" style={{ background: 'none', color: 'var(--vm-muted)' }} aria-label="Parçayı çıkar" onClick={() => setForm({ ...form, items: form.items.filter(x => x.id !== i.id) })}><Trash2 size={18} /></button></div>)}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}><button type="button" className="vm-btn ghost" onClick={() => setForm(null)}>Vazgeç</button><button type="button" className="vm-btn" disabled={form.name.trim().length < 2 || !form.items.length} onClick={save}>Kaydet</button></div></section>}
    </div></PackGate>
  </div>;
}


// Takımın kasada okutulan barkodu ve takım fiyatı. Okutulunca parçalar stoktan düşer, toplam takım fiyatıdır.
function SetSale({ set, onSaved }) {
  const [open, setOpen] = useState(false), [code, setCode] = useState(set.barcode || ''), [price, setPrice] = useState(set.sale_price != null ? String(set.sale_price).replace('.', ',') : ''), [message, setMessage] = useState(''), [camera, setCamera] = useState(false);
  const save = async () => { try { await api.put(`/sector/tableware/sets/${set.id}/sale`, { barcode: code.trim(), price }); setMessage('Kaydedildi.'); setOpen(false); onSaved(); } catch (e) { setMessage(errorText(e, 'Kaydedilemedi.')); } };
  const clear = async () => { try { await api.put(`/sector/tableware/sets/${set.id}/sale`, { barcode: null }); setCode(''); setPrice(''); onSaved(); } catch (e) { setMessage(errorText(e, 'Kaldırılamadı.')); } };
  if (!open) return <><button type="button" className="vm-btn soft" style={{ minHeight: 38, marginTop: 8 }} onClick={() => setOpen(true)}><Barcode size={16} /> {set.barcode ? 'Takım barkodunu düzenle' : 'Kasada takım olarak sat'}</button>{message && <p role="status" className="vm-note">{message}</p>}</>;
  return <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 6 }}>
    <div className="vm-price-in"><input aria-label="Takım barkodu" placeholder="Takım barkodu" maxLength={64} value={code} onChange={e => setCode(e.target.value)} /><button type="button" className="vm-iconbtn" style={{ background: 'var(--vm-brand)' }} aria-label="Barkodu kamerayla oku" onClick={() => setCamera(v => !v)}><Camera size={16} /></button></div>
    {camera && <BarcodeCamera onCode={c => { setCode(c); setCamera(false); }} onClose={() => setCamera(false)} />}
    <div className="vm-price-in"><input aria-label="Takım fiyatı" inputMode="decimal" placeholder={'Takım fiyatı (parça parça ' + money(set.list_price) + ')'} value={price} onChange={e => setPrice(e.target.value)} /></div>
    <p className="vm-note">Takım fiyatı parçalara liste fiyatı oranında dağıtılır; tek parça iade edilebilir.</p>
    {message && <p role="alert" className="vm-err">{message}</p>}
    <div style={{ display: 'flex', gap: 8 }}><button type="button" className="vm-btn ghost" onClick={() => setOpen(false)}>Vazgeç</button>{set.barcode && <button type="button" className="vm-btn ghost" onClick={clear}>Kaldır</button>}<button type="button" className="vm-btn" disabled={!code.trim() || !price.trim()} onClick={save}>Kaydet</button></div></div>;
}

const STORE_KEY = 'vx-m-store';
const storeId = async () => { try { const v = Number(localStorage.getItem(STORE_KEY)); if (v) return v; } catch { /* yok */ } const r = (await api.get('/warehouses')).data; return (Array.isArray(r) ? r : r?.data || [])[0]?.id; };
const REASONS = [['kirik', 'Kırık'], ['musteri', 'Müşteri kırdı'], ['tedarikci', 'Tedarikçiden hasarlı'], ['fire', 'Fire / kayıp']];

// Kırık / fire: ürünü seç, adet ve sebep; stoktan düşer, maliyeti raporlanır. Yönetici son 30 günün kaybını görür.
export function MobileBreakage() {
  const [product, setProduct] = useState(null), [qty, setQty] = useState('1'), [reason, setReason] = useState('kirik'), [note, setNote] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const report = useAsync(async () => (isBoss() ? (await api.get('/sector/tableware/breakage', { params: { days: 30 } })).data : null), []);
  const save = async () => {
    setBusy(true); setMessage('');
    try { const r = (await api.post('/sector/tableware/breakage', { product_id: product.id, warehouse_id: await storeId(), quantity: qty, reason, note })).data; setMessage(`${r.name}: ${r.quantity} adet ${r.reason.toLocaleLowerCase('tr-TR')} olarak stoktan düşüldü (maliyet ${money(r.cost)}).`); setProduct(null); setQty('1'); setNote(''); report.reload(); }
    catch (e) { setMessage(errorText(e, 'Kaydedilemedi.')); } finally { setBusy(false); }
  };
  const r = report.data;
  return <div className="vm">
    <MobileTop title="Kırık / Fire" flat />
    <PackGate pack="tableware"><div className="vm-body" style={{ marginTop: 0, paddingTop: 16, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 10 }}>
      {!product ? <ProductPicker placeholder="Kırılan ürünü ara" onPick={setProduct} />
        : <section className="vm-card"><b>{product.name}</b><div className="vm-note">{product.barcode || product.sku}</div>
          <div role="group" aria-label="Sebep" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{REASONS.map(([k, label]) => <button key={k} type="button" aria-pressed={reason === k} className={'vm-btn ' + (reason === k ? '' : 'ghost')} style={{ width: 'auto', minHeight: 36, padding: '0 12px', fontSize: 13 }} onClick={() => setReason(k)}>{label}</button>)}</div>
          <div className="vm-price-in" style={{ marginTop: 8 }}><input aria-label="Adet" inputMode="numeric" value={qty} onChange={e => setQty(e.target.value)} style={{ maxWidth: 90 }} /><input aria-label="Not" placeholder="Not (isteğe bağlı)" maxLength={200} value={note} onChange={e => setNote(e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><button type="button" className="vm-btn ghost" onClick={() => setProduct(null)}>Vazgeç</button><button type="button" className="vm-btn" disabled={busy || !(Number(qty.replace(',', '.')) > 0)} onClick={save}>Stoktan düş</button></div></section>}
      {message && <p role="status" className="vm-note">{message}</p>}
      {r && <section className="vm-card"><b>Son {r.days} gün: {money(r.total_cost)} kayıp</b>
        {r.reasons.length === 0 ? <p className="vm-note">Kayıt yok.</p> : <div className="vm-list" style={{ marginTop: 8 }}>{r.reasons.map(x => <div key={x.reason} className="vm-row"><span className="grow">{x.reason}</span><span className="vm-note">{x.quantity} adet</span><b>{money(x.cost)}</b></div>)}</div>}
        {r.products.length > 0 && <><p className="vm-note" style={{ marginTop: 8 }}>En çok kırılanlar</p>{r.products.slice(0, 5).map(x => <div key={x.product_id} className="vm-note" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{x.name}</span><span>{x.quantity} · {money(x.cost)}</span></div>)}</>}</section>}
    </div></PackGate>
  </div>;
}

// Çeyiz / düğün listesi: müşteri istediklerini seçer, misafirler aldıkça mağaza listeden düşer; WhatsApp ile paylaşılır.
export function MobileRegistries() {
  const [status, setStatus] = useState('open'), [open, setOpen] = useState(null), [form, setForm] = useState(null), [message, setMessage] = useState('');
  const lists = useAsync(async () => (await api.get('/sector/tableware/registries', { params: { status } })).data.items, [status]);
  const sets = useAsync(async () => (await api.get('/sector/tableware/sets')).data.sets, []);
  const load = async id => { try { setOpen((await api.get('/sector/tableware/registries/' + id)).data); setMessage(''); } catch (e) { setMessage(errorText(e, 'Liste açılamadı.')); } };
  const act = async (fn, ok) => { try { await fn(); if (ok) setMessage(ok); await load(open.id); lists.reload(); } catch (e) { setMessage(errorText(e, 'İşlem yapılamadı.')); } };
  const create = async () => { try { const r = (await api.post('/sector/tableware/registries', form)).data; setForm(null); lists.reload(); load(r.id); } catch (e) { setMessage(errorText(e, 'Liste oluşturulamadı.')); } };
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return <div className="vm">
    <MobileTop title={open ? open.title : 'Çeyiz Listeleri'} flat onBack={open ? () => setOpen(null) : undefined} back="/m" />
    <PackGate pack="tableware"><div className="vm-body" style={{ marginTop: 0, paddingTop: 16, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 10 }}>
      {message && <p role="status" className="vm-note">{message}</p>}
      {!open && !form && <>
        <div role="group" aria-label="Durum" style={{ display: 'flex', gap: 8 }}>{[['open', 'Açık'], ['closed', 'Kapanmış']].map(([k, l]) => <button key={k} type="button" aria-pressed={status === k} className={'vm-btn ' + (status === k ? '' : 'ghost')} style={{ width: 'auto', minHeight: 36, padding: '0 14px' }} onClick={() => setStatus(k)}>{l}</button>)}</div>
        {lists.data?.length === 0 && <EmptyState icon={<Gift size={34} />} title="Liste yok" text="Gelin-damat veya çeyiz için liste açın; misafirler aldıkça listeden düşün." />}
        {lists.data?.map(l => <button key={l.id} type="button" className="vm-card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => load(l.id)}><b>{l.title}</b><div className="vm-note">{l.owner_name || ''}{l.event_date ? ' · ' + l.event_date.split('-').reverse().join('.') : ''} · {l.completed}/{l.items} kalem tamam</div></button>)}
        {isBoss() && <button type="button" className="vm-btn" onClick={() => setForm({ title: '', owner_name: '', phone: '', event_date: '', note: '' })}><Plus size={18} /> Yeni liste</button>}</>}
      {form && <section className="vm-card" style={{ display: 'grid', gap: 8 }}><b>Yeni çeyiz / düğün listesi</b>
        <input className="vm-input" aria-label="Liste adı" placeholder="Ayşe & Mehmet çeyiz listesi" maxLength={120} value={form.title} onChange={set('title')} />
        <input className="vm-input" aria-label="Liste sahibi" placeholder="Liste sahibi" maxLength={120} value={form.owner_name} onChange={set('owner_name')} />
        <div className="vm-price-in"><input aria-label="Telefon" inputMode="tel" placeholder="Telefon" maxLength={20} value={form.phone} onChange={set('phone')} /><input aria-label="Tarih" type="date" value={form.event_date} onChange={set('event_date')} /></div>
        <div style={{ display: 'flex', gap: 8 }}><button type="button" className="vm-btn ghost" onClick={() => setForm(null)}>Vazgeç</button><button type="button" className="vm-btn" disabled={form.title.trim().length < 2} onClick={create}>Oluştur</button></div></section>}
      {open && <>
        <section className="vm-card"><div className="vm-note">{open.owner_name || ''}{open.phone ? ' · ' + open.phone : ''}{open.event_date ? ' · ' + open.event_date.split('-').reverse().join('.') : ''}</div>
          <b>Kalan: {money(open.remaining_total)}</b>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <a className="vm-btn soft" style={{ width: 'auto', minHeight: 38, padding: '0 12px' }} target="_blank" rel="noopener noreferrer" href={whatsappLink(open.phone, open.share_text)}><MessageCircle size={16} /> WhatsApp ile paylaş</a>
            {isBoss() && open.status === 'open' && <button type="button" className="vm-btn ghost" style={{ width: 'auto', minHeight: 38, padding: '0 12px' }} onClick={() => act(() => api.put('/sector/tableware/registries/' + open.id, { ...open, status: 'closed' }), 'Liste kapatıldı.')}>Listeyi kapat</button>}</div></section>
        <div className="vm-list">{open.items.map(i => { const done = i.bought >= i.wanted; return <div key={i.id} className="vm-row" style={{ alignItems: 'center' }}><span className="grow" style={{ textDecoration: done ? 'line-through' : undefined }}>{i.name}<small>{i.bought}/{i.wanted} alındı{i.price ? ' · ' + money(i.price) : ''}</small></span>
          {open.status === 'open' && !done && <button type="button" className="vm-btn soft" style={{ width: 'auto', minHeight: 34, padding: '0 10px' }} onClick={() => act(() => api.post(`/sector/tableware/registries/${open.id}/items/${i.id}/bought`, { quantity: 1 }), i.name + ' alındı olarak işaretlendi.')}>Alındı +1</button>}
          {open.status === 'open' && i.bought > 0 && <button type="button" className="vm-iconbtn" style={{ background: 'none', color: 'var(--vm-muted)' }} aria-label={i.name + ' alındı işaretini geri al'} onClick={() => act(() => api.post(`/sector/tableware/registries/${open.id}/items/${i.id}/bought`, { quantity: -1 }))}>−1</button>}
          {isBoss() && open.status === 'open' && i.bought === 0 && <button type="button" className="vm-iconbtn" style={{ background: 'none', color: 'var(--vm-muted)' }} aria-label={i.name + ' listeden çıkar'} onClick={() => act(() => api.delete(`/sector/tableware/registries/${open.id}/items/${i.id}`))}><Trash2 size={16} /></button>}</div>; })}</div>
        {isBoss() && open.status === 'open' && <section className="vm-card"><b>Listeye ekle</b>
          {(sets.data || []).length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>{sets.data.map(st => <button key={st.id} type="button" className="vm-btn ghost" style={{ width: 'auto', minHeight: 34, padding: '0 10px', fontSize: 13 }} onClick={() => act(() => api.post(`/sector/tableware/registries/${open.id}/items`, { set_id: st.id, wanted: 1 }), st.name + ' eklendi.')}>+ {st.name}</button>)}</div>}
          <ProductPicker placeholder="Ürün ekle (tencere, bardak…)" onPick={p => act(() => api.post(`/sector/tableware/registries/${open.id}/items`, { product_id: p.id, wanted: 1 }), p.name + ' eklendi.')} /></section>}</>}
    </div></PackGate>
  </div>;
}

// Hassas raf konumu: her rafa "üst raf, kırılgan bölge, vitrin" gibi etiket; çırak yanlış yere koymasın.
export function MobileShelfTags() {
  const presets = useAsync(async () => (await api.get('/sector/tableware/tags')).data.presets, []);
  const locations = useAsync(async () => (await api.get('/sector/tableware/locations')).data.items, []);
  const [message, setMessage] = useState('');
  const toggle = async (loc, tag) => {
    const tags = loc.tags.includes(tag) ? loc.tags.filter(t => t !== tag) : [...loc.tags, tag];
    try { await api.put('/sector/tableware/locations/' + loc.id + '/tags', { tags }); setMessage(''); locations.reload(); } catch (e) { setMessage(errorText(e, 'Etiket kaydedilemedi.')); }
  };
  return <div className="vm">
    <MobileTop title="Raf Etiketleri" flat />
    <PackGate pack="tableware"><div className="vm-body" style={{ marginTop: 0, paddingTop: 16 }}>
      <p className="vm-note">Kırılgan ürünler yalnız "Kırılgan bölge" veya "Vitrin" etiketli rafa konur; alt raf ve ağır ürün rafı uyarı verir.</p>
      {message && <p role="alert" className="vm-err">{message}</p>}
      {locations.data?.length === 0 && <EmptyState icon={<Check size={34} />} title="Raf konumu yok" text="Depo ayarlarından raf konumları tanımlandığında burada görünür." />}
      {locations.data?.map(loc => <section key={loc.id} className="vm-card" aria-label={loc.code}>
        <b>{loc.code}</b> <span className="vm-note">{loc.zone} · Koridor {loc.aisle} · Raf {loc.rack} · Kat {loc.shelf}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{(presets.data || []).map(t => <button key={t} type="button" disabled={!isBoss()} aria-pressed={loc.tags.includes(t)} className={'vm-btn ' + (loc.tags.includes(t) ? '' : 'ghost')} style={{ width: 'auto', minHeight: 36, padding: '0 12px', fontSize: 13 }} onClick={() => toggle(loc, t)}>{t}</button>)}</div></section>)}
    </div></PackGate>
  </div>;
}

// Hızlı fiyat etiketi: ürünü seç, yeni fiyatı yaz; fiyat güncellenir ve etiket dükkandaki yazıcıya gider.
export function MobilePriceLabel() {
  const [product, setProduct] = useState(null), [price, setPrice] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(null);
  const [btMessage, setBtMessage] = useState('');
  const printBluetooth = async () => {
    setBtMessage('');
    try { const printer = await connectPrinter(); await printBytes(encodeLabel({ name: product.name, price: done.updated.price, barcode: product.barcode || product.sku, unit: product.unit })); setBtMessage(printer.name + ' yazıcısına gönderildi.'); }
    catch (e) { setBtMessage(e.message || 'Bluetooth yazdırma başarısız.'); }
  };
  const submit = async () => {
    const value = parsePrice(price);
    if (value === null) { setMessage('Geçerli bir fiyat yazın (örn. 149,90).'); return; }
    setBusy(true); setMessage(''); setDone(null);
    try {
      const updated = (await api.post('/sector/tableware/price-label', { product_id: product.id, price: value })).data;
      let printed = false, note = '';
      try {
        const printer = pickPrinter((await api.get('/labels/stations')).data);
        if (!printer) note = 'Çevrimiçi etiket yazıcısı bulunamadı; fiyat güncellendi, etiketi Etiket Yazdır ekranından basabilirsiniz.';
        else { await api.post('/labels/jobs', { ...printer, options: { profile: 'raf-100x40', design: 'signature', origin: '', unitInfo: '', effectiveDate: '' }, lines: [{ product_id: product.id, expected_price: value, quantity: 1 }] }, { headers: { 'Idempotency-Key': crypto.randomUUID() } }); printed = true; }
      } catch (e) { note = 'Fiyat güncellendi ama etiket kuyruğa alınamadı: ' + errorText(e, 'yazıcı hatası'); }
      setDone({ updated, printed, note });
    } catch (e) { setMessage(errorText(e, 'Fiyat güncellenemedi.')); } finally { setBusy(false); }
  };
  return <div className="vm">
    <MobileTop title="Fiyat Etiketi" flat />
    <PackGate pack="tableware"><div className="vm-body" style={{ marginTop: 0, paddingTop: 16 }}>
      {!isBoss() && <p role="alert" className="vm-err">Fiyat değiştirmeyi yalnız yönetici ve müdür yapar.</p>}
      {!product ? <ProductPicker onPick={p => { setProduct(p); setPrice(String(p.sale_price ?? '').replace('.', ',')); setDone(null); }} />
        : <section className="vm-card"><b>{product.name}</b><div className="vm-note">{product.barcode || product.sku} · şimdiki fiyat {money(product.sale_price)}</div>
          <div className="vm-price-in"><input inputMode="decimal" aria-label="Yeni fiyat" value={price} onChange={e => setPrice(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} /><button type="button" className="vm-btn" style={{ width: 'auto', padding: '0 16px' }} disabled={busy || !isBoss()} onClick={submit}><Printer size={16} /> Güncelle ve bas</button></div>
          <button type="button" className="vm-btn ghost" style={{ minHeight: 38 }} onClick={() => { setProduct(null); setDone(null); setMessage(''); }}>Başka ürün</button></section>}
      {message && <p role="alert" className="vm-err">{message}</p>}
      {done && <section className="vm-card" role="status"><b style={{ color: 'var(--vm-good)' }}><Check size={16} /> {done.updated.changed ? 'Fiyat güncellendi: ' + money(done.updated.previous_price) + ' → ' + money(done.updated.price) : 'Fiyat zaten ' + money(done.updated.price)}</b>
        <p className="vm-note" style={{ marginTop: 6 }}>{done.printed ? 'Etiket yazıcıya gönderildi.' : done.note}</p>
        {bluetoothSupported() && <button type="button" className="vm-btn soft" style={{ marginTop: 8 }} onClick={printBluetooth}><Printer size={16} /> Bluetooth yazıcıya bas</button>}
        {btMessage && <p role="status" className="vm-note">{btMessage}</p>}</section>}
    </div></PackGate>
  </div>;
}
