import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, ChefHat, Minus, Plus, Utensils, X } from 'lucide-react';
import api from '../../../api/client';
import { TYPE_LABELS, cartAdd, cartCount, cartNote, cartPayload, cartTotal, feedMessage, kitchenNew, waitLevel, waitMinutes } from '../../../lib/sectorHub.mjs';
import { EmptyState, MobileTop, money } from '../mobileKit';
import { NotifyButton, PackGate, beep, errorText, notify, useAsync, usePolling } from './SectorKit';

const STORE_KEY = 'vx-m-store';
const storedWarehouse = () => { try { return Number(localStorage.getItem(STORE_KEY)) || undefined; } catch { return undefined; } };

// Garson modu: masaya yanaş, masayı seç, ürüne dokun, gönder. Sipariş anında mutfağa düşer ve stok o an azalır.
export function MobileWaiter() {
  const tables = useAsync(async () => (await api.get('/sector/restaurant/tables')).data.items, []);
  const menu = useAsync(async () => (await api.get('/sector/restaurant/menu')).data, []);
  const [target, setTarget] = useState(null), [cart, setCart] = useState(() => new Map()), [category, setCategory] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(null);
  const categories = useMemo(() => [...new Set((menu.data?.items || []).map(i => i.category))], [menu.data]);
  const shown = (menu.data?.items || []).filter(i => !category || i.category === category);
  const choose = t => { setTarget(t); setCart(new Map()); setSent(null); setMessage(''); setCategory(''); };
  const submit = async () => {
    setBusy(true); setMessage('');
    try {
      const body = { order_type: target.type, items: cartPayload(cart), warehouse_id: storedWarehouse() };
      if (target.type === 'masa') body.table_id = target.id;
      const r = (await api.post('/sector/restaurant/orders', body)).data;
      setSent(r); setCart(new Map()); tables.reload();
    } catch (e) { setMessage(errorText(e, 'Sipariş gönderilemedi.')); } finally { setBusy(false); }
  };
  const qtyOf = id => cart.get(id)?.quantity || 0;
  return <div className="vm" style={{ paddingBottom: target ? 150 : 104 }}>
    <MobileTop title={target ? target.label : 'Garson'} flat back="/m" onBack={target ? () => setTarget(null) : undefined} />
    <PackGate pack="restaurant"><div className="vm-body" style={{ marginTop: 0, paddingTop: 14 }}>
      {tables.error && <p role="alert" className="vm-err">{tables.error}</p>}
      {!target && <>
        <div className="vm-label" style={{ marginTop: 0 }}><span>Masalar</span></div>
        <div className="vm-modgrid">{(tables.data || []).filter(t => t.active).map(t => <button key={t.id} type="button" className="vm-mod" style={{ cursor: 'pointer', textAlign: 'left', borderColor: t.open_order_id ? 'var(--vm-accent)' : undefined }} onClick={() => choose({ type: 'masa', id: t.id, label: t.name })}>
          <i className={t.open_order_id ? 'vm-tone-orange' : 'vm-tone-blue'}><Utensils size={22} /></i><b>{t.name}</b><span className="vm-note">{t.open_order_id ? 'Açık · ' + money(t.open_total) : 'Boş'}</span></button>)}</div>
        {tables.data?.length === 0 && <EmptyState icon={<Utensils size={34} />} title="Masa tanımlı değil" text="Önce Restoran ayarlarından masa ekleyin ya da aşağıdan paket/motor siparişi girin." />}
        <div className="vm-label"><span>Masasız</span></div>
        <div style={{ display: 'flex', gap: 10 }}><button type="button" className="vm-btn soft" onClick={() => choose({ type: 'paket', label: 'Paket servisi' })}>Paket</button><button type="button" className="vm-btn soft" onClick={() => choose({ type: 'motor', label: 'Motor kurye' })}>Motor</button></div></>}
      {target && <>
        {sent && <section className="vm-card" role="status" style={{ borderColor: 'var(--vm-good)' }}><b style={{ color: 'var(--vm-good)' }}><Check size={16} /> Sipariş mutfağa gitti · {money(sent.total)}</b>
          {sent.shortages.length > 0 && <p className="vm-err" role="alert" style={{ marginTop: 6 }}>Stok yetersiz: {sent.shortages.flatMap(s => s.missing.map(m => m.name)).join(', ')} (siparişe devam edilir, stok eksiye düşmez).</p>}
          <button type="button" className="vm-btn ghost" style={{ marginTop: 8 }} onClick={() => setTarget(null)}>Masalara dön</button></section>}
        {menu.data && !menu.data.configured && <p className="vm-note">Menü işaretlenmemiş: tüm satış ürünleri gösteriliyor. Restoran ayarlarından menüyü seçebilirsiniz.</p>}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
          <button type="button" className={'vm-btn ' + (!category ? '' : 'ghost')} style={{ width: 'auto', minHeight: 38, padding: '0 14px', flex: 'none' }} onClick={() => setCategory('')}>Tümü</button>
          {categories.map(c => <button key={c} type="button" className={'vm-btn ' + (category === c ? '' : 'ghost')} style={{ width: 'auto', minHeight: 38, padding: '0 14px', flex: 'none' }} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <div className="vm-modgrid">{shown.map(p => <div key={p.id} className="vm-mod" style={{ minHeight: 96, justifyContent: 'space-between', borderColor: qtyOf(p.id) ? 'var(--vm-brand)' : undefined }}>
          <button type="button" style={{ all: 'unset', cursor: 'pointer', display: 'block' }} aria-label={p.name + ' ekle'} onClick={() => setCart(c => cartAdd(c, p))}><b style={{ fontSize: 15 }}>{p.name}</b><div className="vm-note">{money(p.price)}</div></button>
          {qtyOf(p.id) > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><button type="button" className="vm-iconbtn" style={{ background: '#165da41a', color: 'var(--vm-brand)', width: 36, height: 36 }} aria-label={p.name + ' azalt'} onClick={() => setCart(c => cartAdd(c, p, -1))}><Minus size={16} /></button><b aria-live="polite">{qtyOf(p.id)}</b>
            <button type="button" className="vm-iconbtn" style={{ background: 'var(--vm-brand)', width: 36, height: 36 }} aria-label={p.name + ' artır'} onClick={() => setCart(c => cartAdd(c, p))}><Plus size={16} /></button></div>}</div>)}</div></>}
    </div></PackGate>
    {target && cart.size > 0 && <div className="vm-sheet-back" style={{ background: 'none', pointerEvents: 'none', alignItems: 'flex-end' }}><div className="vm-sheet" style={{ pointerEvents: 'auto', boxShadow: '0 -8px 30px #0003', padding: '12px 16px calc(env(safe-area-inset-bottom,0px) + 14px)' }}>
      <div style={{ maxHeight: 120, overflow: 'auto', marginBottom: 8 }}>{[...cart.values()].map(l => <div key={l.product_id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: 14 }}><b>{l.quantity}×</b><span style={{ flex: 1 }}>{l.name}</span>
        <input aria-label={l.name + ' notu'} placeholder="not" maxLength={120} value={l.note} onChange={e => setCart(c => cartNote(c, l.product_id, e.target.value))} style={{ width: 90, border: '1px solid var(--vm-line)', borderRadius: 6, padding: '4px 6px', background: 'var(--vm-card)', color: 'var(--vm-text)' }} /></div>)}</div>
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
            <span style={{ flex: 1, fontSize: 17 }}><b>{i.quantity}×</b> {i.name}{i.note && <small style={{ display: 'block', color: 'var(--vm-accent)' }}>{i.note}</small>}{i.shortfall && <small style={{ display: 'block', color: 'var(--vm-bad)' }}>Stok eksik: {i.shortfall.map(s => s.name).join(', ')}</small>}</span>
            <button type="button" className="vm-btn" style={{ width: 'auto', minHeight: 46, padding: '0 16px' }} onClick={() => done(o, i)}><Check size={18} /> Hazır</button></div>)}</section>; })}
    </div></PackGate>
  </div>;
}

// Esnafın cebi: gün sonu özeti (kaç pide, kaç motor) ve siparişi girildiği anda titreyen "sipariş geldi" uyarısı.
export function MobileOwner() {
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
      {feed.length > 0 && <><div className="vm-label"><span>Gelen siparişler</span></div><div className="vm-list">{feed.map(f => <div key={f.order_id} className="vm-row"><span className="grow">{f.table || TYPE_LABELS[f.type]}<small>{f.text}</small></span><b>{money(f.total)}</b></div>)}</div></>}
      <div style={{ marginTop: 14 }}><NotifyButton /></div>
      <Link to="/m/restoran-ayar" className="vm-btn ghost" style={{ marginTop: 10 }}>Masa, menü ve reçete ayarları</Link>
    </div></PackGate>
  </div>;
}

// Ayarlar: masa ekle, menüyü seç, reçete tanımla (pide başına hamur, kaşar… stoktan düşecek malzemeler).
export function MobileRestaurantSetup() {
  const tables = useAsync(async () => (await api.get('/sector/restaurant/tables')).data.items, []);
  const menu = useAsync(async () => (await api.get('/sector/restaurant/menu')).data, []);
  const recipes = useAsync(async () => (await api.get('/sector/restaurant/recipes')).data.items, []);
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
      <p className="vm-note">Menüde görünecek ürünleri seçin. "Reçete" ile pide başına stoktan düşecek malzemeleri tanımlayın; reçete yoksa ürünün kendisi düşer.</p>
      <div className="vm-list">{(menu.data?.items || []).map(p => <div key={p.id} className="vm-row"><span className="grow">{p.name}<small>{p.category} · {money(p.price)}{recipeFor(p.id) ? ' · reçete: ' + recipeFor(p.id).ingredients.map(i => i.name + ' ' + i.quantity).join(', ') : ''}</small></span>
        <button type="button" className="vm-btn soft" style={{ width: 'auto', minHeight: 36, padding: '0 12px' }} onClick={() => setEdit({ id: p.id, name: p.name, ingredients: (recipeFor(p.id)?.ingredients || []).map(i => ({ ingredient_id: i.ingredient_id, name: i.name, quantity: i.quantity })) })}>Reçete</button>
        <button type="button" className="vm-iconbtn" style={{ background: 'none', color: 'var(--vm-muted)' }} aria-label={p.name + ' menüden çıkar'} onClick={() => run(async () => { await api.put('/sector/restaurant/menu/' + p.id, { menu: false }); menu.reload(); }, 'Menüden çıkarıldı.')}><X size={18} /></button></div>)}</div>
      <div className="vm-label"><span>Menüye ürün ekle</span></div>
      <label className="vm-search"><input value={q} placeholder="Ürün ara" aria-label="Menüye eklenecek ürün" onChange={e => search(e.target.value)} /></label>
      {found.map(p => <button key={p.id} type="button" className="vm-row" style={{ background: 'var(--vm-card)' }} onClick={() => run(async () => { await api.put('/sector/restaurant/menu/' + p.id, { menu: true }); setQ(''); setFound([]); menu.reload(); }, p.name + ' menüye eklendi.')}><span className="grow">{p.name}<small>{money(p.sale_price)}</small></span><Plus size={18} /></button>)}
      {edit && <section className="vm-card" style={{ marginTop: 12 }}><b>{edit.name} reçetesi (1 porsiyon)</b>
        {edit.ingredients.map(i => <div key={i.ingredient_id} className="vm-price-in"><span style={{ flex: 1 }}>{i.name}</span><input type="number" step="0.01" min="0" aria-label={i.name + ' miktarı'} style={{ maxWidth: 100 }} value={i.quantity} onChange={e => setEdit({ ...edit, ingredients: edit.ingredients.map(x => x.ingredient_id === i.ingredient_id ? { ...x, quantity: e.target.value } : x) })} /><button type="button" className="vm-iconbtn" style={{ background: 'none', color: 'var(--vm-muted)' }} aria-label="Malzemeyi çıkar" onClick={() => setEdit({ ...edit, ingredients: edit.ingredients.filter(x => x.ingredient_id !== i.ingredient_id) })}><X size={18} /></button></div>)}
        <label className="vm-search"><input placeholder="Malzeme ekle (hamur, kaşar, kıyma…)" aria-label="Malzeme ara" onChange={async e => { const v = e.target.value; if (v.trim().length < 2) { setFound([]); return; } try { const r = await api.get('/products', { params: { search: v.trim() } }); setFound((Array.isArray(r.data) ? r.data : r.data?.data || []).slice(0, 5).map(p => ({ ...p, __ingredient: true }))); } catch { setFound([]); } }} /></label>
        {found.filter(p => p.__ingredient).map(p => <button key={p.id} type="button" className="vm-row" style={{ background: 'var(--vm-card)' }} onClick={() => { if (!edit.ingredients.some(i => i.ingredient_id === p.id)) setEdit({ ...edit, ingredients: [...edit.ingredients, { ingredient_id: p.id, name: p.name, quantity: 1 }] }); setFound([]); }}><span className="grow">{p.name}<small>{p.unit}</small></span><Plus size={18} /></button>)}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}><button type="button" className="vm-btn ghost" onClick={() => setEdit(null)}>Vazgeç</button><button type="button" className="vm-btn" onClick={() => run(async () => { await api.put('/sector/restaurant/recipes/' + edit.id, { ingredients: edit.ingredients.map(i => ({ ingredient_id: i.ingredient_id, quantity: Number(i.quantity) })) }); setEdit(null); recipes.reload(); }, 'Reçete kaydedildi.')}>Kaydet</button></div></section>}
    </div></PackGate>
  </div>;
}
