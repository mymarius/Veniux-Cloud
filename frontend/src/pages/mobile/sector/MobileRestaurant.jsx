import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, ChefHat, Minus, Plus, Utensils, X } from 'lucide-react';
import api from '../../../api/client';
import { DELIVERY_LABELS, TYPE_LABELS, cartAdd, cartCount, cartNote, cartPayload, cartRemoveOne, cartTotal, feedMessage, itemAmount, kitchenNew, kitchenTicket, productQty, waitLevel, waitMinutes } from '../../../lib/sectorHub.mjs';
import { EmptyState, MobileTop, money } from '../mobileKit';
import { NotifyButton, PackGate, beep, errorText, notify, useAsync, usePolling } from './SectorKit';
import { sectorPath, useSurface } from './SectorSurface';

const STORE_KEY = 'vx-m-store';
const storedWarehouse = () => { try { return Number(localStorage.getItem(STORE_KEY)) || undefined; } catch { return undefined; } };

// Garson modu: masaya yanaş, masayı seç, ürüne dokun, gönder. Sipariş anında mutfağa düşer ve stok o an azalır.
const isBoss = () => { try { return ['admin', 'manager'].includes(JSON.parse(localStorage.getItem('user') || '{}').role); } catch { return false; } };
const pill = { width: 'auto', minHeight: 38, padding: '0 14px', flex: 'none' };
const num = v => Number(String(v ?? '').replace(',', '.'));
function printTicket(order) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true'); frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.appendChild(frame);
  frame.contentDocument.open(); frame.contentDocument.write(kitchenTicket(order)); frame.contentDocument.close();
  setTimeout(() => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } finally { setTimeout(() => frame.remove(), 1500); } }, 150);
}

// Seçenek seçimi: ürünün tanımlı seçenekleri (kaşarlı +20 ₺, acılı...) işaretlenip sepete eklenir.
function OptionSheet({ product, onAdd, onClose }) {
  const [picked, setPicked] = useState([]);
  const toggle = o => setPicked(list => (list.some(x => x.name === o.name) ? list.filter(x => x.name !== o.name) : [...list, o]));
  const price = product.price + picked.reduce((t, o) => t + o.price, 0);
  return <div className="vm-sheet-back" role="dialog" aria-modal="true" aria-label={product.name + ' seçenekleri'} onClick={onClose}><div className="vm-sheet" onClick={e => e.stopPropagation()}>
    <h3 style={{ margin: '0 0 10px' }}>{product.name}</h3>
    <div style={{ display: 'grid', gap: 8 }}>{product.options.map(o => { const on = picked.some(x => x.name === o.name); return <button key={o.name} type="button" aria-pressed={on} className={'vm-btn ' + (on ? '' : 'ghost')} style={{ justifyContent: 'space-between' }} onClick={() => toggle(o)}><span>{on ? '✓ ' : ''}{o.name}</span><span>{o.price ? '+' + money(o.price) : 'ücretsiz'}</span></button>; })}</div>
    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}><button type="button" className="vm-btn ghost" onClick={onClose}>Vazgeç</button><button type="button" className="vm-btn" onClick={() => onAdd(picked)}>Ekle · {money(price)}</button></div>
  </div></div>;
}

// Açık adisyon: kalemler, ikram/indirim/servis, masa taşıma-birleştirme, hesap bölme, mutfak fişi, ödeme.
function OrderPanel({ order, tables, onChanged, onClosed }) {
  const boss = isBoss();
  const [mode, setMode] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [selected, setSelected] = useState([]), [split, setSplit] = useState({ cash: '', card: '' }), [form, setForm] = useState({ percent: '', amount: '', reason: '' });
  const act = async (fn, after) => { setBusy(true); setMessage(''); try { const r = await fn(); after ? after(r) : onChanged(); setMode(null); setSelected([]); } catch (e) { setMessage(errorText(e, 'İşlem yapılamadı.')); } finally { setBusy(false); } };
  const base = `/sector/restaurant/orders/${order.id}`;
  const live = order.items.filter(i => i.status !== 'cancelled');
  const comped = new Set(order.comped || []);
  const pay = (body, items) => act(async () => (await api.post(items ? base + '/pay-items' : base + '/close', items ? { ...body, item_ids: items } : body)).data, r => { onClosed(r, Boolean(items)); });
  const selectedTotal = live.filter(i => selected.includes(i.id) && !comped.has(i.id)).reduce((t, i) => t + itemAmount(i), 0);
  const payButtons = items => { const total = items ? selectedTotal : order.total; return <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 8, marginTop: 8 }}>
    <button type="button" className="vm-btn" disabled={busy || (items && !items.length)} onClick={() => pay({ payment_method: 'cash' }, items)}>Nakit · {money(total)}</button>
    <button type="button" className="vm-btn" disabled={busy || (items && !items.length)} onClick={() => pay({ payment_method: 'card' }, items)}>Kart · {money(total)}</button>
    {!items && <><div className="vm-price-in"><input inputMode="decimal" aria-label="Nakit tutar" placeholder="Nakit" value={split.cash} onChange={e => setSplit(v => ({ ...v, cash: e.target.value }))} /><input inputMode="decimal" aria-label="Kart tutar" placeholder="Kart" value={split.card} onChange={e => setSplit(v => ({ ...v, card: e.target.value }))} /></div>
      <button type="button" className="vm-btn ghost" disabled={busy || (!split.cash && !split.card)} onClick={() => pay({ payments: { cash: num(split.cash || 0), card: num(split.card || 0) } })}>Nakit + kart ile kapat</button></>}
    <button type="button" className="vm-btn ghost" onClick={() => { setMode(null); setSelected([]); }}>Vazgeç</button></div>; };
  const adjLabel = a => a.kind === 'comp' ? 'İkram: ' + (order.items.find(i => i.id === a.item_id)?.name || 'kalem') : a.kind === 'service' ? 'Servis %' + a.percent : 'İndirim ' + (a.percent != null ? '%' + a.percent : money(a.amount));
  const others = (tables || []).filter(t => t.active && t.id !== order.table_id);
  return <section className="vm-card" aria-label="Adisyon">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><b>Adisyon #{order.id}</b><b style={{ fontSize: 20 }}>{money(order.total)}</b></div>
    <div className="vm-list" style={{ marginTop: 8 }}>{live.map(i => <label key={i.id} className="vm-row" style={{ alignItems: 'flex-start', gap: 8 }}>
      {mode === 'split' && <input type="checkbox" checked={selected.includes(i.id)} aria-label={i.name + ' öde'} onChange={e => setSelected(list => e.target.checked ? [...list, i.id] : list.filter(x => x !== i.id))} />}
      <span className="grow">{i.quantity}× {i.name}{i.options?.length > 0 && <small>+ {i.options.map(o => o.name + (o.price ? ' ' + money(o.price) : '')).join(', ')}</small>}{i.note && <small>Not: {i.note}</small>}{comped.has(i.id) && <small style={{ color: 'var(--vm-good)' }}>İkram</small>}</span>
      <b style={{ textDecoration: comped.has(i.id) ? 'line-through' : undefined }}>{money(itemAmount(i))}</b>
      {mode === 'comp' && !comped.has(i.id) && <button type="button" className="vm-btn soft" style={{ width: 'auto', minHeight: 32, padding: '0 10px' }} disabled={busy || !form.reason.trim()} onClick={() => act(() => api.post(base + '/adjustments', { kind: 'comp', item_id: i.id, reason: form.reason }))}>İkram et</button>}
    </label>)}</div>
    {(order.adjustments || []).length > 0 && <div style={{ marginTop: 6 }}>{order.adjustments.map(a => <div key={a.id} className="vm-note" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>{adjLabel(a)}{a.reason ? ' · ' + a.reason : ''}</span>{boss && <button type="button" className="vm-iconbtn" style={{ background: 'none', color: 'var(--vm-muted)' }} aria-label={adjLabel(a) + ' kaldır'} onClick={() => act(() => api.delete(base + '/adjustments/' + a.id))}><X size={16} /></button>}</div>)}</div>}
    {message && <p role="alert" className="vm-err">{message}</p>}
    {!mode && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
      <button type="button" className="vm-btn" style={pill} onClick={() => setMode('close')}>Hesabı kapat</button>
      {live.length > 1 && <button type="button" className="vm-btn soft" style={pill} onClick={() => setMode('split')}>Hesabı böl</button>}
      {order.type === 'masa' && others.length > 0 && <button type="button" className="vm-btn soft" style={pill} onClick={() => setMode('move')}>Masa taşı / birleştir</button>}
      <button type="button" className="vm-btn ghost" style={pill} onClick={() => printTicket(order)}>Mutfak fişi</button>
      {boss && <><button type="button" className="vm-btn ghost" style={pill} onClick={() => setMode('comp')}>İkram</button><button type="button" className="vm-btn ghost" style={pill} onClick={() => setMode('discount')}>İndirim</button><button type="button" className="vm-btn ghost" style={pill} onClick={() => setMode('service')}>Servis ücreti</button></>}
    </div>}
    {mode === 'close' && payButtons(null)}
    {mode === 'split' && <><p className="vm-note">Ödenecek kalemleri işaretleyin; kalanlar masada açık kalır.</p>{payButtons(selected)}</>}
    {mode === 'move' && <div style={{ marginTop: 8 }}><p className="vm-note">Boş masaya taşınır; dolu masayı seçerseniz iki hesap birleşir.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{others.map(t => <button key={t.id} type="button" className={'vm-btn ' + (t.open_order_id ? 'soft' : 'ghost')} style={pill} disabled={busy} onClick={() => act(() => t.open_order_id ? api.post(base + '/merge', { target_order_id: t.open_order_id }) : api.post(base + '/move', { table_id: t.id }), () => onClosed({ moved: t.name }, false))}>{t.name}{t.open_order_id ? ' (birleştir)' : ''}</button>)}</div>
      <button type="button" className="vm-btn ghost" style={{ marginTop: 8 }} onClick={() => setMode(null)}>Vazgeç</button></div>}
    {mode === 'comp' && <div style={{ marginTop: 8 }}><input className="vm-input" style={{ width: '100%' }} placeholder="İkram açıklaması (zorunlu)" aria-label="İkram açıklaması" maxLength={120} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /><p className="vm-note">Açıklamayı yazıp kalemin yanındaki "İkram et" düğmesine basın.</p><button type="button" className="vm-btn ghost" onClick={() => setMode(null)}>Vazgeç</button></div>}
    {mode === 'discount' && <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 8 }}><div className="vm-price-in"><input inputMode="decimal" placeholder="Yüzde (%)" aria-label="İndirim yüzdesi" value={form.percent} onChange={e => setForm(f => ({ ...f, percent: e.target.value, amount: '' }))} /><input inputMode="decimal" placeholder="veya tutar (₺)" aria-label="İndirim tutarı" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value, percent: '' }))} /></div>
      <input className="vm-input" placeholder="Açıklama (zorunlu)" aria-label="İndirim açıklaması" maxLength={120} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
      <button type="button" className="vm-btn" disabled={busy || !form.reason.trim() || (!form.percent && !form.amount)} onClick={() => act(() => api.post(base + '/adjustments', form.percent ? { kind: 'discount', percent: num(form.percent), reason: form.reason } : { kind: 'discount', amount: num(form.amount), reason: form.reason }))}>İndirimi uygula</button><button type="button" className="vm-btn ghost" onClick={() => setMode(null)}>Vazgeç</button></div>}
    {mode === 'service' && <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 8 }}><div style={{ display: 'flex', gap: 8 }}>{[5, 10, 15].map(p => <button key={p} type="button" className="vm-btn soft" style={pill} disabled={busy} onClick={() => act(() => api.post(base + '/adjustments', { kind: 'service', percent: p }))}>%{p}</button>)}</div><button type="button" className="vm-btn ghost" onClick={() => setMode(null)}>Vazgeç</button></div>}
  </section>;
}

// Paket ve motor: müşteri, telefon, adres ve kurye.
function DeliveryForm({ order, onSaved }) {
  const [form, setForm] = useState({ customer_name: '', phone: '', address: '', courier: '', note: '' }), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = async () => { setBusy(true); setMessage(''); try { await api.put(`/sector/restaurant/orders/${order.order_id}/delivery`, form); onSaved(); } catch (e) { setMessage(errorText(e, 'Teslimat bilgisi kaydedilemedi.')); } finally { setBusy(false); } };
  return <section className="vm-card" aria-label="Teslimat bilgisi"><b>Teslimat bilgisi</b>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 8, marginTop: 8 }}>
      <input className="vm-input" placeholder="Müşteri adı" aria-label="Müşteri adı" maxLength={80} value={form.customer_name} onChange={set('customer_name')} />
      <input className="vm-input" inputMode="tel" placeholder="Telefon" aria-label="Telefon" maxLength={20} value={form.phone} onChange={set('phone')} />
      <textarea className="vm-input" rows={2} placeholder={order.type === 'motor' ? 'Adres (zorunlu)' : 'Adres'} aria-label="Adres" maxLength={300} value={form.address} onChange={set('address')} />
      {order.type === 'motor' && <input className="vm-input" placeholder="Kurye" aria-label="Kurye" maxLength={60} value={form.courier} onChange={set('courier')} />}
      <input className="vm-input" placeholder="Not (zil çalışmıyor, kapıda ödeme...)" aria-label="Teslimat notu" maxLength={200} value={form.note} onChange={set('note')} />
      {message && <p role="alert" className="vm-err">{message}</p>}
      <button type="button" className="vm-btn" disabled={busy} onClick={save}>Kaydet</button></div></section>;
}

// Garson modu: masaya yanaş, masayı seç, ürüne dokun, gönder. Sipariş anında mutfağa düşer ve stok o an azalır.
export function MobileWaiter() {
  const tables = useAsync(async () => (await api.get('/sector/restaurant/tables')).data.items, []);
  const menu = useAsync(async () => (await api.get('/sector/restaurant/menu')).data, []);
  const [closed, setClosed] = useState(null), [choosing, setChoosing] = useState(null), [order, setOrder] = useState(null), [delivered, setDelivered] = useState(false);
  const [target, setTarget] = useState(null), [cart, setCart] = useState(() => new Map()), [category, setCategory] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(null);
  const categories = useMemo(() => [...new Set((menu.data?.items || []).map(i => i.category))], [menu.data]);
  const shown = (menu.data?.items || []).filter(i => !category || i.category === category);
  const loadOrder = async id => { if (!id) { setOrder(null); return; } const list = (await api.get('/sector/restaurant/orders')).data.items; setOrder(list.find(o => o.id === id) || null); };
  const choose = t => { setTarget(t); setCart(new Map()); setSent(null); setClosed(null); setMessage(''); setCategory(''); setDelivered(false); loadOrder(t.type === 'masa' ? t.open_order_id : null).catch(() => setOrder(null)); };
  const refresh = async () => { const list = await tables.reload(); const t = (list || tables.data || []).find(x => x.id === target?.id); await loadOrder(t?.open_order_id).catch(() => setOrder(null)); };
  const submit = async () => {
    setBusy(true); setMessage('');
    try {
      const body = { order_type: target.type, items: cartPayload(cart), warehouse_id: storedWarehouse() };
      if (target.type === 'masa') body.table_id = target.id;
      const r = (await api.post('/sector/restaurant/orders', body)).data;
      setSent({ ...r, type: target.type }); setCart(new Map());
      if (target.type === 'masa') { await tables.reload(); await loadOrder(r.order_id); }
    } catch (e) { setMessage(errorText(e, 'Sipariş gönderilemedi.')); } finally { setBusy(false); }
  };
  const tap = p => (p.options?.length ? setChoosing(p) : setCart(c => cartAdd(c, p)));
  return <div className="vm" style={{ paddingBottom: target ? 150 : 104 }}>
    <MobileTop title={target ? target.label : 'Garson'} flat back="/m" onBack={target ? () => setTarget(null) : undefined} />
    <PackGate pack="restaurant"><div className="vm-body" style={{ marginTop: 0, paddingTop: 14 }}>
      {tables.error && <p role="alert" className="vm-err">{tables.error}</p>}
      {!target && <>
        <div className="vm-label" style={{ marginTop: 0 }}><span>Masalar</span></div>
        <div className="vm-modgrid">{(tables.data || []).filter(t => t.active).map(t => <button key={t.id} type="button" className="vm-mod" style={{ cursor: 'pointer', textAlign: 'left', borderColor: t.open_order_id ? 'var(--vm-accent)' : undefined }} onClick={() => choose({ type: 'masa', id: t.id, label: t.name, open_order_id: t.open_order_id })}>
          <i className={t.open_order_id ? 'vm-tone-orange' : 'vm-tone-blue'}><Utensils size={22} /></i><b>{t.name}</b><span className="vm-note">{t.open_order_id ? 'Açık · ' + money(t.open_total) : 'Boş'}</span></button>)}</div>
        {tables.data?.length === 0 && <EmptyState icon={<Utensils size={34} />} title="Masa tanımlı değil" text="Önce Restoran ayarlarından masa ekleyin ya da aşağıdan paket/motor siparişi girin." />}
        <div className="vm-label"><span>Masasız</span></div>
        <div style={{ display: 'flex', gap: 10 }}><button type="button" className="vm-btn soft" onClick={() => choose({ type: 'paket', label: 'Paket servisi' })}>Paket</button><button type="button" className="vm-btn soft" onClick={() => choose({ type: 'motor', label: 'Motor kurye' })}>Motor</button></div></>}
      {target && <>
        {sent && <section className="vm-card" role="status" style={{ borderColor: 'var(--vm-good)' }}><b style={{ color: 'var(--vm-good)' }}><Check size={16} /> Sipariş mutfağa gitti · {money(sent.total)}</b>
          {sent.shortages.length > 0 && <p className="vm-err" role="alert" style={{ marginTop: 6 }}>Stok yetersiz: {sent.shortages.flatMap(s => s.missing.map(m => m.name)).join(', ')} (siparişe devam edilir, stok eksiye düşmez).</p>}
          <button type="button" className="vm-btn ghost" style={{ marginTop: 8 }} onClick={() => setTarget(null)}>Masalara dön</button></section>}
        {sent && sent.type !== 'masa' && !delivered && <DeliveryForm order={sent} onSaved={() => setDelivered(true)} />}
        {delivered && <p className="vm-note" role="status">Teslimat bilgisi kaydedildi. Esnaf panelindeki "Paket ve motor" listesinden takip edilir.</p>}
        {closed && <section className="vm-card" role="status" style={{ borderColor: 'var(--vm-good)' }}><b style={{ color: 'var(--vm-good)' }}><Check size={16} /> {closed.moved ? 'Adisyon ' + closed.moved + ' masasına geçti' : 'Ödendi · ' + money(closed.total) + ' (' + [closed.cash > 0 ? 'nakit ' + money(closed.cash) : '', closed.card > 0 ? 'kart ' + money(closed.card) : ''].filter(Boolean).join(' + ') + ')'}</b>
          {closed.split_from && <p className="vm-note">Kalan hesap masada açık: {money(closed.remaining_total)}</p>}
          {closed.warning && <p className="vm-err" role="alert" style={{ marginTop: 6 }}>{closed.warning}</p>}<button type="button" className="vm-btn ghost" style={{ marginTop: 8 }} onClick={() => { setClosed(null); if (!closed.split_from) setTarget(null); }}>{closed.split_from ? 'Tamam' : 'Masalara dön'}</button></section>}
        {order && !(closed && !closed.split_from) && <OrderPanel order={order} tables={tables.data} onChanged={() => refresh().catch(() => {})} onClosed={(r, partial) => { setClosed(r); if (partial) refresh().catch(() => {}); else { setOrder(null); tables.reload(); } }} />}
        {menu.data && !menu.data.configured && <p className="vm-note">Menü işaretlenmemiş: tüm satış ürünleri gösteriliyor. Restoran ayarlarından menüyü seçebilirsiniz.</p>}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
          <button type="button" className={'vm-btn ' + (!category ? '' : 'ghost')} style={pill} onClick={() => setCategory('')}>Tümü</button>
          {categories.map(c => <button key={c} type="button" className={'vm-btn ' + (category === c ? '' : 'ghost')} style={pill} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <div className="vm-modgrid">{shown.map(p => { const n = productQty(cart, p.id); return <div key={p.id} className="vm-mod" style={{ minHeight: 96, justifyContent: 'space-between', borderColor: n ? 'var(--vm-brand)' : undefined }}>
          <button type="button" style={{ all: 'unset', cursor: 'pointer', display: 'block' }} aria-label={p.name + ' ekle'} onClick={() => tap(p)}><b style={{ fontSize: 15 }}>{p.name}</b><div className="vm-note">{money(p.price)}{p.options?.length ? ' · seçenekli' : ''}</div></button>
          {n > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><button type="button" className="vm-iconbtn" style={{ background: '#165da41a', color: 'var(--vm-brand)', width: 36, height: 36 }} aria-label={p.name + ' azalt'} onClick={() => setCart(c => cartRemoveOne(c, p.id))}><Minus size={16} /></button><b aria-live="polite">{n}</b>
            <button type="button" className="vm-iconbtn" style={{ background: 'var(--vm-brand)', width: 36, height: 36 }} aria-label={p.name + ' artır'} onClick={() => tap(p)}><Plus size={16} /></button></div>}</div>; })}</div></>}
    </div></PackGate>
    {choosing && <OptionSheet product={choosing} onClose={() => setChoosing(null)} onAdd={opts => { setCart(c => cartAdd(c, choosing, 1, opts)); setChoosing(null); }} />}
    {target && cart.size > 0 && <div className="vm-sheet-back" style={{ background: 'none', pointerEvents: 'none', alignItems: 'flex-end' }}><div className="vm-sheet" style={{ pointerEvents: 'auto', boxShadow: '0 -8px 30px #0003', padding: '12px 16px calc(env(safe-area-inset-bottom,0px) + 14px)' }}>
      <div style={{ maxHeight: 140, overflow: 'auto', marginBottom: 8 }}>{[...cart.values()].map(l => <div key={l.key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: 14 }}><b>{l.quantity}×</b><span style={{ flex: 1 }}>{l.name}{l.options.length > 0 && <small style={{ display: 'block', color: 'var(--vm-muted)' }}>+ {l.options.join(', ')}</small>}</span>
        <input aria-label={l.name + ' notu'} placeholder="not" maxLength={120} value={l.note} onChange={e => setCart(c => cartNote(c, l.key, e.target.value))} style={{ width: 90, border: '1px solid var(--vm-line)', borderRadius: 6, padding: '4px 6px', background: 'var(--vm-card)', color: 'var(--vm-text)' }} /></div>)}</div>
      {message && <p role="alert" className="vm-err">{message}</p>}
      <button type="button" className="vm-btn" disabled={busy} onClick={submit}>Mutfağa gönder · {cartCount(cart)} kalem · {money(cartTotal(cart))}</button></div></div>}
  </div>;
}

// Mutfak ekranı: yeni kalem gelince ötmeye başlar, hazır olunca dokunulur. Bekleyen süre renklenir.
export function MobileKitchen() {
  const [orders, setOrders] = useState([]), [muted, setMuted] = useState(false), [fresh, setFresh] = useState(0), [error, setError] = useState('');
  const known = useRef(null), ring = useRef(null);
  const load = async () => {
    const next = (await api.get('/sector/restaurant/orders', { params: { status: 'kitchen' } })).data.items;
    const diff = kitchenNew(known.current, next);
    if (known.current !== null && diff.fresh > 0) { setFresh(f => f + diff.fresh); if (!muted) beep(3); notify('Yeni sipariş', diff.fresh + ' yeni kalem mutfakta'); }
    known.current = diff.ids; setOrders(next); setError('');
  };
  usePolling(() => load().catch(e => setError(errorText(e, 'Mutfak listesi alınamadı.'))), 3000);
  const done = async (order, item) => { try { await api.patch(`/sector/restaurant/orders/${order.id}/items/${item.id}`, { status: 'ready' }); await load(); } catch (e) { setError(errorText(e, 'Güncellenemedi.')); } };
  return <div className="vm">
    <MobileTop title="Mutfak" flat right={<button type="button" className="vm-iconbtn" aria-label={muted ? 'Sesi aç' : 'Sesi kapat'} aria-pressed={muted} onClick={() => { setMuted(m => !m); if (muted) beep(1); }}><Bell size={20} style={{ opacity: muted ? 0.4 : 1 }} /></button>} />
    <PackGate pack="restaurant"><div className="vm-body" style={{ marginTop: 0, paddingTop: 14 }}>
      {error && <p role="alert" className="vm-err">{error}</p>}
      {fresh > 0 && <button type="button" ref={ring} className="vm-btn soft" style={{ marginBottom: 10 }} onClick={() => setFresh(0)}>{fresh} yeni kalem geldi · tamam</button>}
      {orders.length === 0 ? <EmptyState icon={<ChefHat size={34} />} title="Bekleyen sipariş yok" text="Yeni sipariş gelince ekran ötmeye başlar. Ekranı açık tutun." /> :
        orders.map(o => { const mins = waitMinutes(o.created_at), level = waitLevel(mins); return <section key={o.id} className="vm-card" aria-label={'Sipariş ' + o.id} style={{ borderColor: level === 'late' ? 'var(--vm-bad)' : level === 'warn' ? 'var(--vm-accent)' : undefined, borderWidth: level === 'ok' ? 1 : 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ fontSize: 17 }}>{o.table || TYPE_LABELS[o.type]}</b><span style={{ fontWeight: 700, color: level === 'late' ? 'var(--vm-bad)' : level === 'warn' ? 'var(--vm-accent)' : 'var(--vm-muted)' }}>{mins} dk</span></div>
          {o.note && <p className="vm-note">{o.note}</p>}
          {o.items.map(i => <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--vm-line)' }}>
            <span style={{ flex: 1, fontSize: 17 }}><b>{i.quantity}×</b> {i.name}{i.options?.length > 0 && <small style={{ display: 'block', fontWeight: 700 }}>+ {i.options.map(o => o.name).join(', ')}</small>}{i.note && <small style={{ display: 'block', color: 'var(--vm-accent)' }}>{i.note}</small>}{i.shortfall && <small style={{ display: 'block', color: 'var(--vm-bad)' }}>Stok eksik: {i.shortfall.map(s => s.name).join(', ')}</small>}</span>
            <button type="button" className="vm-btn" style={{ width: 'auto', minHeight: 46, padding: '0 16px' }} onClick={() => done(o, i)}><Check size={18} /> Hazır</button></div>)}</section>; })}
    </div></PackGate>
  </div>;
}

// Esnafın cebi: gün sonu özeti (kaç pide, kaç motor) ve siparişi girildiği anda titreyen "sipariş geldi" uyarısı.
export function MobileOwner() {
  const { desktop } = useSurface();
  const summary = useAsync(async () => (await api.get('/sector/restaurant/summary')).data, []);
  const [feed, setFeed] = useState([]), [banner, setBanner] = useState('');
  const last = useRef(0);
  usePolling(async () => {
    const r = (await api.get('/sector/restaurant/feed', { params: { after_id: last.current } })).data;
    if (last.current && r.items.length) { setBanner(feedMessage(r.items)); notify('Sipariş geldi', feedMessage(r.items)); beep(2); setFeed(f => [...r.items, ...f].slice(0, 30)); summary.reload(); }
    last.current = r.latest_id;
  }, 4000);
  const data = summary.data;
  return <div className="vm">
    <MobileTop title="Esnaf Paneli" flat />
    <PackGate pack="restaurant"><div className="vm-body" style={{ marginTop: 0, paddingTop: 14 }}>
      {banner && <section className="vm-card" role="status" style={{ borderColor: 'var(--vm-accent)', background: '#dc6d2c14' }}><b><Bell size={16} /> {banner}</b> <button type="button" className="vm-btn ghost" style={{ minHeight: 34, marginTop: 6 }} onClick={() => setBanner('')}>Tamam</button></section>}
      {summary.error && <p role="alert" className="vm-err">{summary.error}</p>}
      {data && <>
        <section className="vm-card"><div className="vm-note">Bugün ({data.date})</div><div className="vm-money">{money(data.revenue)}</div><div className="vm-note">{data.orders} sipariş · {data.open_orders} açık</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>{data.by_type.map(t => <div key={t.type} style={{ flex: 1, background: 'var(--vm-bg)', borderRadius: 8, padding: 8, textAlign: 'center' }}><b style={{ fontSize: 20 }}>{t.orders}</b><div className="vm-note">{TYPE_LABELS[t.type]}</div><div className="vm-note">{money(t.revenue)}</div></div>)}</div></section>
        <div className="vm-label"><span>Bugün ne gitti?</span></div>
        {data.products.length === 0 ? <p className="vm-note">Henüz sipariş yok.</p> : <div className="vm-list">{data.products.map(p => <div key={p.product_id} className="vm-row"><span className="grow">{p.name}</span><b>{p.quantity}</b><span className="vm-note" style={{ minWidth: 80, textAlign: 'right' }}>{money(p.revenue)}</span></div>)}</div>}</>}
      <Deliveries />
      {feed.length > 0 && <><div className="vm-label"><span>Gelen siparişler</span></div><div className="vm-list">{feed.map(f => <div key={f.order_id} className="vm-row"><span className="grow">{f.table || TYPE_LABELS[f.type]}<small>{f.text}</small></span><b>{money(f.total)}</b></div>)}</div></>}
      <div style={{ marginTop: 14 }}><NotifyButton /></div>
      <Link to={sectorPath(desktop, '/m/restoran-ayar')} className="vm-btn ghost" style={{ marginTop: 10 }}>Masa, menü ve reçete ayarları</Link>
    </div></PackGate>
  </div>;
}

// Paket ve motor: bugünkü teslimatlar, teslim edilmeyenler önce; durum tek dokunuşla ilerler.
function Deliveries() {
  const list = useAsync(async () => (await api.get('/sector/restaurant/deliveries')).data.items, []);
  const [message, setMessage] = useState('');
  usePolling(() => list.reload(), 15000);
  const next = { waiting: 'on_way', on_way: 'delivered' };
  const advance = async o => { try { await api.put(`/sector/restaurant/orders/${o.id}/delivery`, { ...o.delivery, status: next[o.delivery.status] }); setMessage(''); list.reload(); } catch (e) { setMessage(errorText(e, 'Durum güncellenemedi.')); } };
  const items = list.data || [];
  if (!items.length) return null;
  return <><div className="vm-label"><span>Paket ve motor</span></div>
    {message && <p role="alert" className="vm-err">{message}</p>}
    <div className="vm-list">{items.map(o => <div key={o.id} className="vm-row" style={{ alignItems: 'flex-start' }}><span className="grow"><b>#{o.id} · {TYPE_LABELS[o.type]}</b> {o.delivery?.customer_name || ''}
      <small>{o.delivery?.address || 'Adres yok'}{o.delivery?.phone ? ' · ' + o.delivery.phone : ''}{o.delivery?.courier ? ' · kurye ' + o.delivery.courier : ''}</small>
      <small>{o.items.filter(i => i.status !== 'cancelled').map(i => i.quantity + '× ' + i.name).join(', ')} · {money(o.total)}</small></span>
      {o.delivery && next[o.delivery.status] ? <button type="button" className="vm-btn soft" style={{ width: 'auto', minHeight: 34, padding: '0 10px' }} onClick={() => advance(o)}>{o.delivery.status === 'waiting' ? 'Yola çıktı' : 'Teslim edildi'}</button> : <span className="vm-note">{o.delivery ? DELIVERY_LABELS[o.delivery.status] : 'Bilgi yok'}</span>}</div>)}</div></>;
}

// Ürün seçenekleri düzenleyicisi: "Kaşarlı +20 ₺" gibi; istenirse seçenek bir malzemeyi stoktan düşer.
function OptionEditor({ product, onDone }) {
  const [rows, setRows] = useState((product.options || []).map(o => ({ name: o.name, price: String(o.price) }))), [message, setMessage] = useState('');
  const save = async () => { try { await api.put(`/sector/restaurant/menu/${product.id}/options`, { options: rows.filter(r => r.name.trim()).map(r => ({ name: r.name.trim(), price: Number(String(r.price || 0).replace(',', '.')) })) }); onDone(true); } catch (e) { setMessage(errorText(e, 'Seçenekler kaydedilemedi.')); } };
  return <section className="vm-card" style={{ marginTop: 12 }}><b>{product.name} seçenekleri</b>
    <p className="vm-note">Garson ürüne dokununca bu seçenekler çıkar. Fiyat 0 ise ücretsiz seçenektir (acılı, az pişmiş…).</p>
    {rows.map((r, i) => <div key={i} className="vm-price-in"><input aria-label="Seçenek adı" placeholder="Seçenek (örn. Kaşarlı)" maxLength={40} value={r.name} onChange={e => setRows(list => list.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /><input aria-label="Ek fiyat" inputMode="decimal" placeholder="+₺" style={{ maxWidth: 90 }} value={r.price} onChange={e => setRows(list => list.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
      <button type="button" className="vm-iconbtn" style={{ background: 'none', color: 'var(--vm-muted)' }} aria-label="Seçeneği çıkar" onClick={() => setRows(list => list.filter((_, j) => j !== i))}><X size={18} /></button></div>)}
    {rows.length < 20 && <button type="button" className="vm-btn ghost" onClick={() => setRows(list => [...list, { name: '', price: '0' }])}><Plus size={16} /> Seçenek ekle</button>}
    {message && <p role="alert" className="vm-err">{message}</p>}
    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}><button type="button" className="vm-btn ghost" onClick={() => onDone(false)}>Vazgeç</button><button type="button" className="vm-btn" onClick={save}>Kaydet</button></div></section>;
}

// Ayarlar: masa ekle, menüyü seç, reçete tanımla (pide başına hamur, kaşar… stoktan düşecek malzemeler).
export function MobileRestaurantSetup() {
  const tables = useAsync(async () => (await api.get('/sector/restaurant/tables')).data.items, []);
  const menu = useAsync(async () => (await api.get('/sector/restaurant/menu')).data, []);
  const recipes = useAsync(async () => (await api.get('/sector/restaurant/recipes')).data.items, []);
  const [options, setOptions] = useState(null);
  const [name, setName] = useState(''), [message, setMessage] = useState(''), [edit, setEdit] = useState(null), [q, setQ] = useState(''), [found, setFound] = useState([]);
  const run = async (fn, ok) => { try { await fn(); setMessage(ok || ''); } catch (e) { setMessage(errorText(e, 'İşlem başarısız.')); } };
  const search = async value => { setQ(value); if (value.trim().length < 2) { setFound([]); return; } try { const r = await api.get('/products', { params: { search: value.trim() } }); setFound((Array.isArray(r.data) ? r.data : r.data?.data || []).slice(0, 6)); } catch { setFound([]); } };
  const recipeFor = id => recipes.data?.find(r => r.product_id === id);
  return <div className="vm">
    <MobileTop title="Restoran Ayarları" flat back="/m/esnaf" />
    <PackGate pack="restaurant"><div className="vm-body" style={{ marginTop: 0, paddingTop: 14 }}>
      {message && <p role="status" className="vm-note">{message}</p>}
      <div className="vm-label" style={{ marginTop: 0 }}><span>Masalar</span></div>
      <div className="vm-price-in"><input value={name} maxLength={30} placeholder="Masa adı (örn. Masa 5, Bahçe 2)" aria-label="Yeni masa adı" onChange={e => setName(e.target.value)} /><button type="button" className="vm-btn" style={{ width: 'auto', padding: '0 16px' }} disabled={!name.trim()} onClick={() => run(async () => { await api.post('/sector/restaurant/tables', { name }); setName(''); tables.reload(); }, 'Masa eklendi.')}>Ekle</button></div>
      <p className="vm-note">{(tables.data || []).map(t => t.name).join(' · ') || 'Henüz masa yok.'}</p>
      <div className="vm-label"><span>Menü ve reçete</span></div>
      <p className="vm-note">Menüde görünecek ürünleri seçin. "Seçenek" ile kaşarlı, acılı gibi seçimleri ve ek fiyatlarını tanımlayın. "Reçete" ile porsiyon başına stoktan düşecek malzemeleri tanımlayın; hamur gibi ara ürünün de kendi reçetesi olabilir. Reçete yoksa ürünün kendisi düşer.</p>
      <div className="vm-list">{(menu.data?.items || []).map(p => <div key={p.id} className="vm-row vm-menu-row"><span className="grow">{p.name}<small>{p.category} · {money(p.price)}{recipeFor(p.id) ? ' · reçete: ' + recipeFor(p.id).ingredients.map(i => i.name + ' ' + i.quantity).join(', ') : ''}</small></span>
        <button type="button" className="vm-btn ghost" style={{ width: 'auto', minHeight: 36, padding: '0 10px' }} onClick={() => setOptions(p)}>Seçenek{p.options?.length ? ' (' + p.options.length + ')' : ''}</button>
        <button type="button" className="vm-btn soft" style={{ width: 'auto', minHeight: 36, padding: '0 12px' }} onClick={() => setEdit({ id: p.id, name: p.name, ingredients: (recipeFor(p.id)?.ingredients || []).map(i => ({ ingredient_id: i.ingredient_id, name: i.name, quantity: i.quantity })) })}>Reçete</button>
        <button type="button" className="vm-iconbtn" style={{ background: 'none', color: 'var(--vm-muted)' }} aria-label={p.name + ' menüden çıkar'} onClick={() => run(async () => { await api.put('/sector/restaurant/menu/' + p.id, { menu: false }); menu.reload(); }, 'Menüden çıkarıldı.')}><X size={18} /></button></div>)}</div>
      <div className="vm-label"><span>Menüye ürün ekle</span></div>
      <label className="vm-search"><input value={q} placeholder="Ürün ara" aria-label="Menüye eklenecek ürün" onChange={e => search(e.target.value)} /></label>
      {found.map(p => <button key={p.id} type="button" className="vm-row" style={{ background: 'var(--vm-card)' }} onClick={() => run(async () => { await api.put('/sector/restaurant/menu/' + p.id, { menu: true }); setQ(''); setFound([]); menu.reload(); }, p.name + ' menüye eklendi.')}><span className="grow">{p.name}<small>{money(p.sale_price)}</small></span><Plus size={18} /></button>)}
      {options && <OptionEditor key={options.id} product={options} onDone={ok => { setOptions(null); if (ok) { setMessage('Seçenekler kaydedildi.'); menu.reload(); } }} />}
      {edit && <section className="vm-card" style={{ marginTop: 12 }}><b>{edit.name} reçetesi (1 porsiyon)</b>
        {edit.ingredients.map(i => <div key={i.ingredient_id} className="vm-price-in"><span style={{ flex: 1 }}>{i.name}</span><input type="number" step="0.01" min="0" aria-label={i.name + ' miktarı'} style={{ maxWidth: 100 }} value={i.quantity} onChange={e => setEdit({ ...edit, ingredients: edit.ingredients.map(x => x.ingredient_id === i.ingredient_id ? { ...x, quantity: e.target.value } : x) })} /><button type="button" className="vm-iconbtn" style={{ background: 'none', color: 'var(--vm-muted)' }} aria-label="Malzemeyi çıkar" onClick={() => setEdit({ ...edit, ingredients: edit.ingredients.filter(x => x.ingredient_id !== i.ingredient_id) })}><X size={18} /></button></div>)}
        <label className="vm-search"><input placeholder="Malzeme ekle (hamur, kaşar, kıyma…)" aria-label="Malzeme ara" onChange={async e => { const v = e.target.value; if (v.trim().length < 2) { setFound([]); return; } try { const r = await api.get('/products', { params: { search: v.trim() } }); setFound((Array.isArray(r.data) ? r.data : r.data?.data || []).slice(0, 5).map(p => ({ ...p, __ingredient: true }))); } catch { setFound([]); } }} /></label>
        {found.filter(p => p.__ingredient).map(p => <button key={p.id} type="button" className="vm-row" style={{ background: 'var(--vm-card)' }} onClick={() => { if (!edit.ingredients.some(i => i.ingredient_id === p.id)) setEdit({ ...edit, ingredients: [...edit.ingredients, { ingredient_id: p.id, name: p.name, quantity: 1 }] }); setFound([]); }}><span className="grow">{p.name}<small>{p.unit}</small></span><Plus size={18} /></button>)}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}><button type="button" className="vm-btn ghost" onClick={() => setEdit(null)}>Vazgeç</button><button type="button" className="vm-btn" onClick={() => run(async () => { await api.put('/sector/restaurant/recipes/' + edit.id, { ingredients: edit.ingredients.map(i => ({ ingredient_id: i.ingredient_id, quantity: Number(i.quantity) })) }); setEdit(null); recipes.reload(); }, 'Reçete kaydedildi.')}>Kaydet</button></div></section>}
    </div></PackGate>
  </div>;
}
