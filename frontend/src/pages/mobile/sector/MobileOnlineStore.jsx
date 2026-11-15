import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { ArrowDown, ArrowUp, Check, Copy, ExternalLink, ImagePlus, Search, Trash2 } from 'lucide-react';
import api from '../../../api/client';
import { readSessionUser } from '../../../lib/sessionUser';
import { EmptyState, MobileTop, Sheet, money } from '../mobileKit';
import { PackGate, beep, errorText, notify, useAsync, usePolling } from './SectorKit';
import { fitSize, orderActions, statusLabel, shopUrl, STATUS_FLOW } from '../../../lib/onlineStore.mjs';

const isBoss = () => ['admin', 'manager'].includes(readSessionUser().role);
const API = '/online-store';

// ---------- Siparişler ----------
const PAY_LABELS = { pending: 'ödeme bekliyor', paid: 'ödendi', failed: 'başarısız', expired: 'süresi doldu' };
function OrderSheet({ id, onClose, onChanged }) {
  const detail = useAsync(async () => (await api.get(`${API}/orders/${id}`)).data, [id]);
  const carriers = useAsync(async () => (await api.get(`${API}/carriers`)).data, []);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [reason, setReason] = useState(''), [cancelling, setCancelling] = useState(false), [ship, setShip] = useState({ carrier: '', tracking_no: '' });
  const order = detail.data;
  useEffect(() => { if (order) setShip({ carrier: order.carrier || '', tracking_no: order.tracking_no || '' }); }, [order?.carrier, order?.tracking_no]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveShip = async () => { setBusy(true); setMessage(''); try { await api.put(`${API}/orders/${id}/shipping`, ship); await detail.reload(); setMessage('Kargo bilgisi kaydedildi.'); } catch (e) { setMessage(errorText(e, 'Kargo bilgisi kaydedilemedi.')); } finally { setBusy(false); } };
  const change = async (status, why) => {
    setBusy(true); setMessage('');
    try { const r = (await api.patch(`${API}/orders/${id}/status`, { status, reason: why })).data; await detail.reload(); onChanged(); setCancelling(false); if (r.refund === 'done') setMessage('Kart ücreti müşteriye iade edildi.'); else if (r.refund === 'manual') setMessage('Dikkat: kart ücreti otomatik iade edilemedi. İadeyi iyzico panelinden elle yapın.'); }
    catch (e) { setMessage(errorText(e, 'Durum değiştirilemedi.')); } finally { setBusy(false); }
  };
  return <Sheet onClose={onClose} label="Sipariş ayrıntısı">
    {detail.error && <p role="alert" className="vm-err">{detail.error}</p>}
    {order && <>
      <h2 style={{ margin: '0 0 4px' }}>Sipariş {order.number}</h2>
      <p className="vm-note">{statusLabel(order.status)}{order.payment ? ` · kart: ${PAY_LABELS[order.payment.status] || order.payment.status}` : ''} · {order.delivery_method === 'pickup' ? 'Mağazadan teslim' : 'Adrese teslim'} · {order.payment_method === 'cod' ? 'Kapıda ödeme' : order.payment_method === 'transfer' ? 'Havale/EFT' : 'Mağazada ödeme'}</p>
      <div className="vm-list" style={{ margin: '10px 0' }}>{order.items.map(i => <div key={i.product_id} className="vm-row"><span className="grow"><b>{i.quantity}×</b> {i.name}</span><b>{money(i.line_total)}</b></div>)}</div>
      <p className="vm-note">Ara toplam {money(order.subtotal)}{order.discount_amount > 0 ? ` · İndirim −${money(order.discount_amount)} (${order.discount_code})` : ''} · Teslimat {money(order.delivery_fee)}{order.shipping_rule ? ` (${order.shipping_rule})` : ''}</p>
      <p style={{ fontWeight: 800, fontSize: 18 }}>Toplam {money(order.total)}</p>
      <div className="vm-card" style={{ margin: '10px 0' }}>
        <b>{order.customer_name}</b><div><a href={`tel:${order.phone}`}>{order.phone}</a></div>
        {order.email && <div className="vm-note">{order.email}</div>}
        {order.address && <div className="vm-note">{order.city ? order.city + ' · ' : ''}{order.address}</div>}
        {order.note && <div className="vm-note"><b>Not:</b> {order.note}</div>}
        {order.cancel_reason && <div className="vm-err">İptal nedeni: {order.cancel_reason}</div>}
      </div>
      {order.delivery_method === 'delivery' && ['confirmed', 'preparing', 'ready', 'delivered'].includes(order.status) && <div className="vm-card" style={{ margin: '10px 0' }}><b>Kargo takibi</b>
        <label className="vm-field"><input aria-label="Kargo firması" list="online-carriers" placeholder="Kargo firması (listeden seçin ya da yazın)" maxLength={60} value={ship.carrier} onChange={e => setShip(x => ({ ...x, carrier: e.target.value }))} /></label>
        <label className="vm-field"><input aria-label="Takip numarası" placeholder="Takip numarası" maxLength={60} value={ship.tracking_no} onChange={e => setShip(x => ({ ...x, tracking_no: e.target.value }))} /></label>
        <datalist id="online-carriers">{(carriers.data?.items || []).map(c => <option key={c.key} value={c.name} />)}</datalist>
        <button type="button" className="vm-btn ghost" disabled={busy} onClick={saveShip}>Kargo bilgisini kaydet</button><div className="vm-note">Müşteri sipariş sayfasında görür.</div></div>}
      {message && <p role="alert" className={/^(Kargo bilgisi kaydedildi|Kart ücreti müşteriye)/.test(message) ? 'vm-note' : 'vm-err'}>{message}</p>}
      {cancelling ? <div><label className="vm-field"><input autoFocus placeholder="İptal nedeni (isteğe bağlı)" maxLength={200} value={reason} onChange={e => setReason(e.target.value)} aria-label="İptal nedeni" /></label>
        <button type="button" className="vm-btn" disabled={busy} onClick={() => change('cancelled', reason)}>Siparişi iptal et, stok geri gelsin</button>
        <button type="button" className="vm-btn ghost" style={{ marginTop: 8 }} onClick={() => setCancelling(false)}>Vazgeç</button></div>
        : <div style={{ display: 'grid', gap: 8 }}>{orderActions(order.status).map(a => a.status === 'cancelled'
          ? <button key={a.status} type="button" className="vm-btn ghost" disabled={busy} onClick={() => setCancelling(true)}>{a.label}</button>
          : <button key={a.status} type="button" className={'vm-btn' + (a.primary ? '' : ' ghost')} disabled={busy} onClick={() => change(a.status)}>{a.label}</button>)}</div>}
      <details style={{ marginTop: 12 }}><summary className="vm-note">Durum geçmişi</summary>{order.events.map((e, i) => <div key={i} className="vm-note">{statusLabel(e.to_status)} · {String(e.created_at).slice(0, 16).replace('T', ' ')}{e.note ? ' · ' + e.note : ''}</div>)}</details>
    </>}
    <button type="button" className="vm-btn ghost" style={{ marginTop: 10 }} onClick={onClose}>Kapat</button>
  </Sheet>;
}
function OrdersTab() {
  const [status, setStatus] = useState('open'), [q, setQ] = useState(''), [selected, setSelected] = useState(null);
  const orders = useAsync(async () => (await api.get(`${API}/orders`, { params: { status, q: q.trim() || undefined } })).data, [status, q]);
  const summary = useAsync(async () => (await api.get(`${API}/summary`)).data, []);
  const known = useRef(null);
  usePolling(async () => {
    const s = (await api.get(`${API}/summary`)).data;
    if (known.current !== null && s.by_status.new > known.current) { notify('Yeni online sipariş', `${s.by_status.new - known.current} yeni sipariş geldi`); beep(2); orders.reload(); }
    known.current = s.by_status.new;
  }, 15000);
  const chips = [['open', 'Açık'], ['new', 'Yeni'], ['preparing', 'Hazırlanıyor'], ['ready', 'Hazır'], ['delivered', 'Teslim'], ['cancelled', 'İptal'], ['', 'Tümü']];
  const s = summary.data;
  return <div>
    {s && <div className="vm-card" style={{ marginBottom: 10 }}><div className="vm-note">Bugün</div><b style={{ fontSize: 20 }}>{money(s.today_total)}</b> <span className="vm-note">· {s.today_orders} sipariş · {s.by_status.new} yeni · {s.open} açık</span></div>}
    <label className="vm-search"><Search size={18} /><input placeholder="Ad, telefon veya sipariş no" aria-label="Sipariş ara" value={q} onChange={e => setQ(e.target.value)} /></label>
    <div role="group" aria-label="Durum" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>{chips.map(([v, label]) => <button key={v || 'all'} type="button" className={'vm-btn ' + (status === v ? '' : 'ghost')} style={{ minHeight: 40, padding: '0 14px', whiteSpace: 'nowrap' }} onClick={() => setStatus(v)}>{label}</button>)}</div>
    {orders.error && <p role="alert" className="vm-err">{orders.error}</p>}
    {orders.data && orders.data.items.length === 0 && <EmptyState title="Sipariş yok" text={status === 'open' ? 'Açık sipariş yok. Yeni sipariş gelince burada ve bildirimle görünür.' : 'Bu filtreyle sipariş bulunamadı.'} />}
    <div className="vm-list">{(orders.data?.items || []).map(o => <button key={o.id} type="button" className="vm-row" onClick={() => setSelected(o.id)}>
      <span className="grow"><b>{o.number}</b> · {o.customer_name}<small>{statusLabel(o.status)}{o.payment_status ? ` · kart: ${PAY_LABELS[o.payment_status] || o.payment_status}` : ''} · {String(o.created_at).slice(0, 16).replace('T', ' ')}</small></span><b>{money(o.total)}</b></button>)}</div>
    {selected && <OrderSheet id={selected} onClose={() => setSelected(null)} onChanged={() => { orders.reload(); summary.reload(); }} />}
  </div>;
}

// ---------- Ürünler ----------
// Görsel tarayıcıda küçültülür (en uzun kenar 1200 px) ve WebP/JPEG'e çevrilir; EXIF kendiliğinden silinir.
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Yalnız JPEG, PNG veya WebP görsel seçin.');
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitSize(bitmap.width, bitmap.height, 1200);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  for (const [type, quality] of [['image/webp', 0.85], ['image/jpeg', 0.85], ['image/jpeg', 0.7]]) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
    if (blob && blob.type === type && blob.size <= 2 * 1024 * 1024) return blob;
  }
  throw new Error('Görsel 2 MB altına küçültülemedi.');
}
function Thumb({ mediaKey, alt }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let revoke = '', live = true;
    api.get(`${API}/media/${mediaKey}`, { responseType: 'blob' }).then(r => { if (!live) return; revoke = URL.createObjectURL(r.data); setUrl(revoke); }).catch(() => {});
    return () => { live = false; if (revoke) URL.revokeObjectURL(revoke); };
  }, [mediaKey]);
  return url ? <img src={url} alt={alt || ''} width={72} height={72} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4, border: '2px solid var(--vm-ink)' }} /> : <div style={{ width: 72, height: 72, background: 'var(--vm-line)', borderRadius: 4 }} aria-hidden="true" />;
}
function ProductSheet({ product, onClose, onChanged }) {
  const [desc, setDesc] = useState(product.description || ''), [max, setMax] = useState(product.max_per_order ?? ''), [step, setStep] = useState(product.step ?? ''), [minQty, setMinQty] = useState(product.min_qty ?? ''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const media = useAsync(async () => (await api.get(`${API}/products/${product.id}/media`)).data, [product.id]);
  const file = useRef(null);
  const save = async () => {
    setBusy(true); setMessage('');
    try { await api.put(`${API}/products/${product.id}`, { description: desc, max_per_order: max === '' ? null : Number(String(max).replace(',', '.')), ...(product.measured_unit ? { step: step === '' ? undefined : Number(String(step).replace(',', '.')), min_qty: minQty === '' ? undefined : Number(String(minQty).replace(',', '.')) } : {}) }); onChanged(); setMessage('Kaydedildi.'); }
    catch (e) { setMessage(errorText(e, 'Kaydedilemedi.')); } finally { setBusy(false); }
  };
  const upload = async e => {
    const files = [...(e.target.files || [])]; e.target.value = '';
    setBusy(true); setMessage('');
    try {
      for (const f of files) { const blob = await shrink(f); await api.post(`${API}/products/${product.id}/media`, blob, { headers: { 'Content-Type': blob.type } }); }
      await media.reload(); onChanged();
    } catch (err) { setMessage(err?.response ? errorText(err, 'Görsel yüklenemedi.') : err.message || 'Görsel yüklenemedi.'); } finally { setBusy(false); }
  };
  const move = async (index, delta) => {
    const ids = media.data.items.map(i => i.id); const [x] = ids.splice(index, 1); ids.splice(index + delta, 0, x);
    try { await api.put(`${API}/products/${product.id}/media/order`, { ids }); media.reload(); } catch (err) { setMessage(errorText(err, 'Sıralanamadı.')); }
  };
  const remove = async item => { if (!window.confirm('Bu görsel silinsin mi?')) return; try { await api.delete(`${API}/products/${product.id}/media/${item.id}`); media.reload(); onChanged(); } catch (err) { setMessage(errorText(err, 'Silinemedi.')); } };
  const items = media.data?.items || [];
  return <Sheet onClose={onClose} label="Ürün ayrıntısı">
    <h2 style={{ margin: '0 0 4px' }}>{product.name}</h2>
    <p className="vm-note">{money(product.price)} · stok {product.stock ?? '—'}</p>
    <label className="vm-label"><span>Açıklama (en çok 2000 karakter)</span></label>
    <textarea className="vm-textarea" rows={4} maxLength={2000} value={desc} onChange={e => setDesc(e.target.value)} aria-label="Ürün açıklaması" style={{ width: '100%', border: '2px solid var(--vm-ink)', borderRadius: 3, padding: 10, background: 'var(--vm-card)', color: 'var(--vm-ink)', font: 'inherit' }} />
    <label className="vm-field" style={{ marginTop: 8 }}><input inputMode="numeric" placeholder="Sipariş başına üst sınır (boş = sınırsız)" aria-label="Sipariş başına üst sınır" value={max} onChange={e => setMax(product.measured_unit ? e.target.value.replace(/[^\d.,]/g, '') : e.target.value.replace(/\D/g, ''))} /></label>
    {product.measured_unit && <div className="vm-card" style={{ marginTop: 8 }}><b>Ölçülü satış ({product.unit})</b><p className="vm-note">Müşteri bu adımın katları kadar sipariş verir. Örn. adım 0,25 ve en az 0,5: 0,5 - 0,75 - 1 {product.unit}…</p>
      <label className="vm-field"><input inputMode="decimal" placeholder={`Satış adımı (${product.unit})`} aria-label="Satış adımı" value={step} onChange={e => setStep(e.target.value.replace(/[^\d.,]/g, ''))} /></label>
      <label className="vm-field"><input inputMode="decimal" placeholder={`En az miktar (${product.unit})`} aria-label="En az miktar" value={minQty} onChange={e => setMinQty(e.target.value.replace(/[^\d.,]/g, ''))} /></label></div>}
    <div className="vm-label"><span>Görseller ({items.length}/5)</span></div>
    <div className="vm-list">{items.map((m, i) => <div key={m.id} className="vm-row"><Thumb mediaKey={m.key} alt={m.alt} />
      <span className="grow" style={{ fontSize: 13 }}>{i === 0 ? 'Ana görsel' : 'Görsel ' + (i + 1)}<small>{m.width}×{m.height} · {Math.round(m.bytes / 1024)} KB</small></span>
      <button type="button" className="vm-iconbtn" aria-label="Yukarı" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
      <button type="button" className="vm-iconbtn" aria-label="Aşağı" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
      <button type="button" className="vm-iconbtn" aria-label="Görseli sil" onClick={() => remove(m)}><Trash2 size={16} /></button></div>)}</div>
    <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={upload} />
    <button type="button" className="vm-btn ghost" style={{ margin: '8px 0' }} disabled={busy || items.length >= 5} onClick={() => file.current.click()}><ImagePlus size={18} /> Görsel ekle</button>
    {message && <p role="status" className={message === 'Kaydedildi.' ? 'vm-note' : 'vm-err'}>{message}</p>}
    <button type="button" className="vm-btn" disabled={busy} onClick={save}>Kaydet</button>
    <button type="button" className="vm-btn ghost" style={{ marginTop: 8 }} onClick={onClose}>Kapat</button>
  </Sheet>;
}
function ProductsTab() {
  const [q, setQ] = useState(''), [filter, setFilter] = useState(''), [page, setPage] = useState(0), [selected, setSelected] = useState(null), [message, setMessage] = useState('');
  const list = useAsync(async () => (await api.get(`${API}/products`, { params: { q: q.trim() || undefined, published: filter || undefined, page } })).data, [q, filter, page]);
  const toggle = async p => {
    try { await api.put(`${API}/products/${p.id}`, { published: !p.published }); list.reload(); setMessage(''); } catch (e) { setMessage(errorText(e, 'Değiştirilemedi.')); }
  };
  const bulk = async published => {
    const ids = (list.data?.items || []).map(p => p.id);
    if (!ids.length || !window.confirm(`Bu sayfadaki ${ids.length} ürün ${published ? 'yayına alınsın' : 'gizlensin'} mı?`)) return;
    try { await api.put(`${API}/products/bulk`, { product_ids: ids, published }); list.reload(); } catch (e) { setMessage(errorText(e, 'Toplu işlem yapılamadı.')); }
  };
  return <div>
    <label className="vm-search"><Search size={18} /><input placeholder="Ürün adı veya kodu" aria-label="Ürün ara" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} /></label>
    <div role="group" aria-label="Yayın durumu" style={{ display: 'flex', gap: 8, paddingBottom: 8 }}>{[['', 'Tümü'], ['1', 'Yayında'], ['0', 'Gizli']].map(([v, l]) => <button key={v || 'all'} type="button" className={'vm-btn ' + (filter === v ? '' : 'ghost')} style={{ minHeight: 40, padding: '0 14px' }} onClick={() => { setFilter(v); setPage(0); }}>{l}</button>)}
      <button type="button" className="vm-btn ghost" style={{ minHeight: 40, padding: '0 12px', marginLeft: 'auto' }} onClick={() => bulk(true)}>Sayfayı yayınla</button></div>
    {message && <p role="alert" className="vm-err">{message}</p>}
    {list.error && <p role="alert" className="vm-err">{list.error}</p>}
    {list.data && list.data.items.length === 0 && <EmptyState title="Ürün yok" text="Önce Ürünler sayfasından ürün ekleyin ya da Excel'den aktarın." />}
    <div className="vm-list">{(list.data?.items || []).map(p => <div key={p.id} className="vm-row">
      <button type="button" className="grow" style={{ all: 'unset', cursor: 'pointer', flex: 1 }} onClick={() => setSelected(p)} aria-label={p.name + ' ayrıntısı'}><b>{p.name}</b><small style={{ display: 'block' }}>{money(p.price)} · stok {p.stock ?? '—'} · {p.images} görsel{p.measured_unit ? ` · ölçülü satış, ${String(p.step ?? '').replace('.', ',')} ${p.unit} adım` : ''}</small></button>
      <button type="button" role="switch" aria-checked={p.published} aria-label={p.name + ' mağazada yayında'} className={'vm-btn ' + (p.published ? '' : 'ghost')} style={{ minHeight: 40, padding: '0 12px' }} onClick={() => toggle(p)}>{p.published ? <><Check size={16} /> Yayında</> : 'Gizli'}</button></div>)}</div>
    {list.data && list.data.total > list.data.page_size && <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button type="button" className="vm-btn ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Önceki</button><button type="button" className="vm-btn ghost" disabled={(page + 1) * list.data.page_size >= list.data.total} onClick={() => setPage(page + 1)}>Sonraki</button></div>}
    {selected && <ProductSheet key={selected.id} product={selected} onClose={() => setSelected(null)} onChanged={() => list.reload()} />}
  </div>;
}

// ---------- Ayarlar ----------
function SettingsTab() {
  const data = useAsync(async () => (await api.get(`${API}/settings`)).data, []);
  const [form, setForm] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [slugNote, setSlugNote] = useState(''), [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!data.data) return;
    const s = data.data.store;
    setForm(s ? { ...s } : { slug: '', name: '', tagline: '', about: '', contact_email: '', public_phone: '', cod_enabled: true, transfer_enabled: false, pickup_enabled: true, transfer_note: '', delivery_fee: 0, free_delivery_over: '', min_order: 0, warehouse_id: data.data.warehouses[0]?.id || '', published: false, accepting_orders: false, terms_text: '' });
  }, [data.data]);
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  useEffect(() => {
    if (!form || !form.slug || form.slug === data.data?.store?.slug) { setSlugNote(''); return undefined; }
    const t = setTimeout(() => api.get(`${API}/slug-check`, { params: { slug: form.slug } }).then(r => setSlugNote(r.data.available ? 'Bu adres uygun.' : r.data.reason)).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [form?.slug]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useCallback(async patch => {
    setBusy(true); setMessage('');
    try {
      const body = { ...form, ...patch, free_delivery_over: form.free_delivery_over === '' ? null : Number(form.free_delivery_over), delivery_fee: Number(form.delivery_fee) || 0, min_order: Number(form.min_order) || 0, warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : null };
      const r = (await api.put(`${API}/settings`, body)).data; setForm({ ...r.store }); setMessage(patch && 'published' in patch ? (patch.published ? 'Mağaza yayında.' : 'Mağaza yayından kaldırıldı.') : 'Kaydedildi.');
    } catch (e) { setMessage(errorText(e, 'Kaydedilemedi.')); } finally { setBusy(false); }
  }, [form]);
  const link = useMemo(() => (form?.slug ? shopUrl(window.location.origin, form.slug) : ''), [form?.slug]);
  if (data.error) return <p role="alert" className="vm-err">{data.error}</p>;
  if (!form) return <p className="vm-note">Yükleniyor…</p>;
  const field = (label, key, props = {}) => <label className="vm-field"><span className="vm-note" style={{ minWidth: 0 }}>{label}</span><input aria-label={label} value={form[key] ?? ''} onChange={e => set(key, e.target.value)} {...props} /></label>;
  const check = (label, key) => <label className="vm-row" style={{ cursor: 'pointer' }}><input type="checkbox" checked={Boolean(form[key])} onChange={e => set(key, e.target.checked)} style={{ width: 22, height: 22 }} /><span className="grow">{label}</span></label>;
  return <div>
    <div className="vm-card" style={{ marginBottom: 12 }}>
      <b>{form.published ? (form.accepting_orders ? 'Mağaza yayında, sipariş alıyor' : 'Mağaza yayında, siparişe kapalı') : 'Mağaza yayında değil'}</b>
      {link && <div style={{ marginTop: 8 }}><div className="vm-note" style={{ wordBreak: 'break-all' }}>{link}</div>
        <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
          <button type="button" className="vm-btn ghost" style={{ minHeight: 40 }} onClick={() => navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}><Copy size={16} /> {copied ? 'Kopyalandı' : 'Bağlantıyı kopyala'}</button>
          {form.published && <a className="vm-btn ghost" style={{ minHeight: 40 }} href={link} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Mağazayı aç</a>}</div>
        {form.published && <div style={{ background: '#fff', padding: 10, width: 148, border: '2px solid var(--vm-ink)' }}><QRCode value={link} size={128} title="Mağaza QR kodu" /></div>}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {!form.published ? <button type="button" className="vm-btn" disabled={busy} onClick={() => save({ published: true })}>Mağazayı yayına al</button>
          : <><button type="button" className="vm-btn ghost" disabled={busy} onClick={() => save({ accepting_orders: !form.accepting_orders })}>{form.accepting_orders ? 'Siparişi durdur' : 'Siparişi aç'}</button>
            <button type="button" className="vm-btn ghost" disabled={busy} onClick={() => save({ published: false })}>Yayından kaldır</button></>}</div>
    </div>
    {message && <p role="status" className={/^(Kaydedildi|Mağaza yayında|Mağaza yayından)/.test(message) ? 'vm-note' : 'vm-err'}>{message}</p>}
    <div className="vm-label"><span>Mağaza</span></div>
    {field('Mağaza adresi (kısa ad)', 'slug', { placeholder: 'ornek-magaza', maxLength: 40, autoCapitalize: 'none' })}
    {slugNote && <p className="vm-note" role="status">{slugNote}</p>}
    {field('Mağaza adı', 'name', { maxLength: 80 })}
    {field('Kısa açıklama', 'tagline', { maxLength: 140 })}
    <label className="vm-field"><span className="vm-note">Hakkımızda</span><textarea aria-label="Hakkımızda" rows={3} maxLength={2000} value={form.about || ''} onChange={e => set('about', e.target.value)} style={{ flex: 1, border: 0, background: 'none', font: 'inherit', color: 'var(--vm-ink)' }} /></label>
    {field('İletişim e-postası (sipariş bildirimi buraya gider)', 'contact_email', { type: 'email', maxLength: 120 })}
    {field('Sitede gösterilecek telefon (isteğe bağlı)', 'public_phone', { inputMode: 'tel', maxLength: 20 })}
    <div className="vm-label"><span>Stok deposu</span></div>
    <label className="vm-field"><select aria-label="Stok deposu" value={form.warehouse_id || ''} onChange={e => set('warehouse_id', e.target.value)} style={{ flex: 1, border: 0, background: 'none', font: 'inherit', color: 'var(--vm-ink)' }}><option value="">Depo seçin</option>{data.data.warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
    <div className="vm-label"><span>Ödeme ve teslimat</span></div>
    {check('Kapıda ödeme', 'cod_enabled')}{check('Havale / EFT', 'transfer_enabled')}{check('Mağazadan teslim', 'pickup_enabled')}
    {form.transfer_enabled && <label className="vm-field"><span className="vm-note">IBAN ve açıklama</span><textarea aria-label="IBAN ve açıklama" rows={2} maxLength={600} value={form.transfer_note || ''} onChange={e => set('transfer_note', e.target.value)} style={{ flex: 1, border: 0, background: 'none', font: 'inherit', color: 'var(--vm-ink)' }} /></label>}
    {field('Teslimat ücreti (TL)', 'delivery_fee', { inputMode: 'decimal' })}
    {field('Ücretsiz teslimat eşiği (TL, boş = yok)', 'free_delivery_over', { inputMode: 'decimal' })}
    {field('Minimum sipariş tutarı (TL)', 'min_order', { inputMode: 'decimal' })}
    <ThemeCard />
    <PaymentCard />
    <DomainCard />
    <div className="vm-label"><span>Sipariş koşulları (müşteriye gösterilir)</span></div>
    <label className="vm-field"><textarea aria-label="Sipariş koşulları" rows={5} maxLength={6000} placeholder="İade, cayma hakkı ve teslimat koşullarınızı yazın. Hukuki metin için avukat veya mali müşavirinize danışın." value={form.terms_text || ''} onChange={e => set('terms_text', e.target.value)} style={{ flex: 1, border: 0, background: 'none', font: 'inherit', color: 'var(--vm-ink)' }} /></label>
    <button type="button" className="vm-btn" style={{ marginTop: 10 }} disabled={busy} onClick={() => save()}>Kaydet</button>
  </div>;
}

// ---------- Kampanya ve kargo ----------
const KIND_LABELS = { percent: 'Yüzde indirim', amount: 'Tutar indirimi (TL)', free_shipping: 'Kargo bedava' };
const inner = { flex: 1, border: 0, background: 'none', font: 'inherit', color: 'var(--vm-ink)' };
function CodesSection() {
  const list = useAsync(async () => (await api.get(`${API}/discount-codes`)).data, []);
  const empty = { code: '', kind: 'percent', value: '10', min_order: '', max_uses: '', ends_at: '' };
  const [form, setForm] = useState(empty), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const call = async fn => { setBusy(true); setMessage(''); try { await fn(); await list.reload(); } catch (e) { setMessage(errorText(e, 'İşlem yapılamadı.')); } finally { setBusy(false); } };
  const add = () => call(async () => { await api.post(`${API}/discount-codes`, { code: form.code, kind: form.kind, value: form.kind === 'free_shipping' ? 0 : Number(form.value), min_order: Number(form.min_order) || 0, max_uses: form.max_uses === '' ? null : Number(form.max_uses), ends_at: form.ends_at ? form.ends_at + ' 23:59:59' : null }); setForm(empty); });
  const f = (key, props) => <input value={form[key]} onChange={e => setForm(x => ({ ...x, [key]: e.target.value }))} {...props} />;
  return <div>
    <div className="vm-label"><span>İndirim kodları</span></div>
    {message && <p role="alert" className="vm-err">{message}</p>}
    <div className="vm-list">{(list.data?.items || []).map(c => <div key={c.id} className="vm-row" style={{ flexWrap: 'wrap' }}><span className="grow" style={{ flexBasis: '100%' }}><b>{c.code}</b> · {c.kind === 'percent' ? `%${c.value}` : c.kind === 'amount' ? money(c.value) : 'Kargo bedava'}<div className="vm-note">{c.used_count}{c.max_uses ? '/' + c.max_uses : ''} kullanım{c.min_order > 0 ? ` · min. ${money(c.min_order)}` : ''}{c.ends_at ? ` · ${String(c.ends_at).slice(0, 10)} tarihine kadar` : ''}{c.active ? '' : ' · pasif'}</div></span>
      <button type="button" className="vm-btn ghost" style={{ minHeight: 40 }} disabled={busy} onClick={() => call(() => api.put(`${API}/discount-codes/${c.id}`, { active: !c.active }))}>{c.active ? 'Durdur' : 'Aç'}</button>
      <button type="button" aria-label={c.code + ' kodunu sil'} className="vm-btn ghost" style={{ minHeight: 40 }} disabled={busy} onClick={() => call(() => api.delete(`${API}/discount-codes/${c.id}`))}><Trash2 size={16} /></button></div>)}
      {list.data && !list.data.items.length && <p className="vm-note">Henüz kod yok.</p>}</div>
    <div className="vm-card" style={{ marginTop: 10 }}><b>Yeni kod</b>
      <label className="vm-field">{f('code', { 'aria-label': 'Kod', placeholder: 'Kod (örn. YAZ10)', maxLength: 20, autoCapitalize: 'characters', onChange: e => setForm(x => ({ ...x, code: e.target.value.toUpperCase() })) })}</label>
      <label className="vm-field"><select aria-label="İndirim türü" value={form.kind} onChange={e => setForm(x => ({ ...x, kind: e.target.value }))} style={inner}>{Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      {form.kind !== 'free_shipping' && <label className="vm-field">{f('value', { 'aria-label': 'İndirim değeri', inputMode: 'decimal', placeholder: form.kind === 'percent' ? 'Yüzde (örn. 10)' : 'Tutar (TL)' })}</label>}
      <label className="vm-field">{f('min_order', { 'aria-label': 'Minimum sepet tutarı', inputMode: 'decimal', placeholder: 'Minimum sepet tutarı (TL, boş = yok)' })}</label>
      <label className="vm-field">{f('max_uses', { 'aria-label': 'Kullanım sınırı', inputMode: 'numeric', placeholder: 'Toplam kullanım sınırı (boş = sınırsız)' })}</label>
      <label className="vm-field"><span className="vm-note">Son gün</span>{f('ends_at', { 'aria-label': 'Son gün', type: 'date' })}</label>
      <button type="button" className="vm-btn" disabled={busy || !form.code} onClick={add}>Kodu ekle</button></div>
  </div>;
}
function RulesSection() {
  const list = useAsync(async () => (await api.get(`${API}/shipping-rules`)).data, []);
  const empty = { name: '', cities: '', fee: '', free_over: '' };
  const [form, setForm] = useState(empty), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const call = async fn => { setBusy(true); setMessage(''); try { await fn(); await list.reload(); } catch (e) { setMessage(errorText(e, 'İşlem yapılamadı.')); } finally { setBusy(false); } };
  const add = () => call(async () => { await api.post(`${API}/shipping-rules`, { name: form.name, cities: form.cities, fee: Number(form.fee) || 0, free_over: form.free_over === '' ? null : Number(form.free_over) }); setForm(empty); });
  const f = (key, props) => <input value={form[key]} onChange={e => setForm(x => ({ ...x, [key]: e.target.value }))} {...props} />;
  return <div style={{ marginTop: 18 }}>
    <div className="vm-label"><span>Kargo ücreti kuralları</span></div>
    <p className="vm-note">Müşterinin seçtiği il için ücret uygulanır. Sırayla bakılır, ilk eşleşen kazanır; eşleşme yoksa Ayarlar sekmesindeki varsayılan ücret geçerlidir. Tüm Türkiye için * yazın.</p>
    {message && <p role="alert" className="vm-err">{message}</p>}
    <div className="vm-list">{(list.data?.items || []).map(r => <div key={r.id} className="vm-row" style={{ flexWrap: 'wrap' }}><span className="grow" style={{ flexBasis: '100%' }}><b>{r.name}</b> · {money(r.fee)}<div className="vm-note">{r.cities[0] === '*' ? 'Tüm Türkiye' : r.cities.join(', ')}{r.free_over != null ? ` · ${money(r.free_over)} üzeri ücretsiz` : ''}{r.active ? '' : ' · pasif'}</div></span>
      <button type="button" className="vm-btn ghost" style={{ minHeight: 40 }} disabled={busy} onClick={() => call(() => api.put(`${API}/shipping-rules/${r.id}`, { active: !r.active }))}>{r.active ? 'Durdur' : 'Aç'}</button>
      <button type="button" aria-label={r.name + ' kuralını sil'} className="vm-btn ghost" style={{ minHeight: 40 }} disabled={busy} onClick={() => call(() => api.delete(`${API}/shipping-rules/${r.id}`))}><Trash2 size={16} /></button></div>)}
      {list.data && !list.data.items.length && <p className="vm-note">Kural yok; tüm siparişlerde Ayarlar sekmesindeki teslimat ücreti uygulanır.</p>}</div>
    <div className="vm-card" style={{ marginTop: 10 }}><b>Yeni kural</b>
      <label className="vm-field">{f('name', { 'aria-label': 'Kural adı', placeholder: 'Kural adı (örn. Marmara)', maxLength: 60 })}</label>
      <label className="vm-field">{f('cities', { 'aria-label': 'İller', placeholder: 'İller, virgülle (örn. İstanbul, Kocaeli) ya da *' })}</label>
      <label className="vm-field">{f('fee', { 'aria-label': 'Kargo ücreti', inputMode: 'decimal', placeholder: 'Kargo ücreti (TL)' })}</label>
      <label className="vm-field">{f('free_over', { 'aria-label': 'Ücretsiz kargo eşiği', inputMode: 'decimal', placeholder: 'Ücretsiz kargo eşiği (TL, boş = yok)' })}</label>
      <button type="button" className="vm-btn" disabled={busy || !form.name} onClick={add}>Kuralı ekle</button></div>
  </div>;
}
function CustomersTab() {
  const [q, setQ] = useState(''), [repeat, setRepeat] = useState(false), [page, setPage] = useState(0), [selected, setSelected] = useState(null);
  const list = useAsync(async () => (await api.get(`${API}/customers`, { params: { q: q.trim() || undefined, repeat: repeat ? 1 : undefined, page } })).data, [q, repeat, page]);
  const detail = useAsync(async () => (selected ? (await api.get(`${API}/customers/${selected}`)).data : null), [selected]);
  const [message, setMessage] = useState('');
  const erase = async () => {
    if (!window.confirm('Bu müşterinin kişisel bilgileri (ad, telefon, adres) ve siparişlerindeki kişisel bilgiler kalıcı olarak silinsin mi? Geri alınamaz.')) return;
    try { await api.delete(`${API}/customers/${selected}`); setSelected(null); list.reload(); } catch (e) { setMessage(errorText(e, 'Silinemedi.')); }
  };
  const d = detail.data;
  return <div>
    <p className="vm-note">Mağazadan sipariş veren herkes telefon numarasına göre burada listelenir. Tekrar sipariş verenler: {list.data?.repeat ?? 0} / {list.data?.all ?? 0}.</p>
    <label className="vm-field"><Search size={16} aria-hidden="true" /><input placeholder="Ad veya telefon ara" aria-label="Müşteri ara" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} /></label>
    <label className="vm-row" style={{ cursor: 'pointer' }}><input type="checkbox" checked={repeat} onChange={e => { setRepeat(e.target.checked); setPage(0); }} style={{ width: 22, height: 22 }} /><span className="grow">Yalnız tekrar sipariş verenler</span></label>
    {list.error && <p role="alert" className="vm-err">{list.error}</p>}
    <div className="vm-list">{(list.data?.items || []).map(c => <button key={c.id} type="button" className="vm-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setSelected(c.id); setMessage(''); }}><span className="grow"><b>{c.name}</b><small style={{ display: 'block' }}>{c.phone || 'silinmiş'}{c.city ? ' · ' + c.city : ''} · {c.order_count} sipariş</small></span><b>{money(c.total_spent)}</b></button>)}
      {list.data && !list.data.items.length && <p className="vm-note">Müşteri bulunamadı.</p>}</div>
    {list.data && list.data.total > (page + 1) * 50 && <button type="button" className="vm-btn ghost" onClick={() => setPage(page + 1)}>Daha fazla</button>}
    {selected && <Sheet onClose={() => setSelected(null)} label="Müşteri ayrıntısı">
      {d && <><h2 style={{ margin: '0 0 4px' }}>{d.name}</h2>
        <p className="vm-note">{d.phone ? <a href={`tel:${d.phone}`}>{d.phone}</a> : 'Kişisel bilgiler silinmiş'}{d.email ? ' · ' + d.email : ''}</p>
        {d.address && <p className="vm-note">{d.city ? d.city + ' · ' : ''}{d.address}</p>}
        <p style={{ fontWeight: 800 }}>{d.order_count} sipariş · {money(d.total_spent)}</p>
        <div className="vm-list">{d.orders.map(o => <div key={o.id} className="vm-row"><span className="grow"><b>{o.number}</b><small style={{ display: 'block' }}>{statusLabel(o.status)} · {String(o.created_at).slice(0, 10)}</small></span><b>{money(o.total)}</b></div>)}</div>
        {message && <p role="alert" className="vm-err">{message}</p>}
        {!d.anonymized && <button type="button" className="vm-btn ghost" style={{ marginTop: 10 }} onClick={erase}>Kişisel bilgileri sil (KVKK)</button>}</>}
      <button type="button" className="vm-btn ghost" style={{ marginTop: 8 }} onClick={() => setSelected(null)}>Kapat</button></Sheet>}
  </div>;
}
function ThemeCard() {
  const data = useAsync(async () => (await api.get(`${API}/theme`)).data, []);
  const [t, setT] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { if (data.data) setT({ ...data.data.theme }); }, [data.data]);
  if (!t) return null;
  const save = async () => { setBusy(true); setMessage(''); try { const r = (await api.put(`${API}/theme`, { color: t.color, layout: t.layout, font: t.font, hero: t.hero, banner: t.banner })).data; setT({ ...r.theme }); setMessage('Tema kaydedildi.'); } catch (e) { setMessage(errorText(e, 'Kaydedilemedi.')); } finally { setBusy(false); } };
  const sel = (label, key, options) => <label className="vm-field"><span className="vm-note">{label}</span><select aria-label={label} value={t[key]} onChange={e => setT(x => ({ ...x, [key]: e.target.value }))} style={inner}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
  return <div className="vm-card" style={{ marginTop: 14 }}>
    <b>Vitrin teması</b>
    <div role="group" aria-label="Ana renk" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '10px 0' }}>{data.data.presets.map(c => <button key={c} type="button" aria-label={'Renk ' + c} aria-pressed={t.color === c} onClick={() => setT(x => ({ ...x, color: c }))} style={{ width: 40, height: 40, borderRadius: 20, background: c, border: t.color === c ? '4px solid var(--vm-ink)' : '2px solid #fff', boxShadow: '0 0 0 1px #999' }} />)}</div>
    <label className="vm-field"><span className="vm-note">Özel renk</span><input aria-label="Özel renk" type="color" value={t.color} onChange={e => setT(x => ({ ...x, color: e.target.value }))} /></label>
    {sel('Ürün düzeni', 'layout', [['grid', 'Kartlar'], ['list', 'Liste'], ['compact', 'Sıkı kartlar']])}
    {sel('Yazı tipi', 'font', [['modern', 'Modern'], ['classic', 'Klasik'], ['rounded', 'Yumuşak']])}
    {sel('Üst alan', 'hero', [['plain', 'Sade'], ['soft', 'Açık renkli'], ['bold', 'Renkli']])}
    <label className="vm-field"><input aria-label="Duyuru şeridi" placeholder="Duyuru şeridi (örn. 500 ₺ üzeri kargo bedava)" maxLength={160} value={t.banner || ''} onChange={e => setT(x => ({ ...x, banner: e.target.value }))} /></label>
    {message && <p role="status" className={/kaydedildi/.test(message) ? 'vm-note' : 'vm-err'}>{message}</p>}
    <button type="button" className="vm-btn" disabled={busy} onClick={save}>Temayı kaydet</button>
  </div>;
}
function PaymentCard() {
  const data = useAsync(async () => (await api.get(`${API}/payment`)).data, []);
  const [form, setForm] = useState({ api_key: '', secret_key: '' }), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const d = data.data;
  const run = async fn => { setBusy(true); setMessage(''); try { await fn(); await data.reload(); setForm({ api_key: '', secret_key: '' }); setMessage('Kaydedildi.'); } catch (e) { setMessage(errorText(e, 'Kaydedilemedi.')); } finally { setBusy(false); } };
  if (!d) return null;
  return <div className="vm-card" style={{ marginTop: 14 }}>
    <b>Kartla ödeme (iyzico)</b>
    <p className="vm-note">Müşteri kartını iyzico’nun güvenli sayfasında girer; kart bilgisi Veniux’a ve mağazaya gelmez. Para doğrudan kendi iyzico hesabınıza geçer, Veniux komisyon almaz. Önce iyzico’da üye işyeri hesabı açıp API anahtarlarını alın. Deneme için “sandbox” anahtarlarıyla başlayın.</p>
    {d.has_keys && <p className="vm-note">Kayıtlı anahtar: …{d.key_hint} · {d.sandbox ? 'deneme (sandbox)' : 'canlı'} · {d.enabled ? 'açık' : 'kapalı'}</p>}
    <label className="vm-field"><input aria-label="iyzico API anahtarı" autoComplete="off" placeholder={d.has_keys ? 'API anahtarı (değiştirmek için yazın)' : 'API anahtarı'} value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} /></label>
    <label className="vm-field"><input aria-label="iyzico gizli anahtar" type="password" autoComplete="off" placeholder={d.has_keys ? 'Gizli anahtar (değiştirmek için yazın)' : 'Gizli anahtar'} value={form.secret_key} onChange={e => setForm(f => ({ ...f, secret_key: e.target.value }))} /></label>
    <label className="vm-row" style={{ cursor: 'pointer' }}><input type="checkbox" checked={d.sandbox} onChange={e => run(() => api.put(`${API}/payment`, { ...form, sandbox: e.target.checked }))} style={{ width: 22, height: 22 }} disabled={!d.has_keys && !(form.api_key && form.secret_key)} /><span className="grow">Deneme modu (sandbox)</span></label>
    {message && <p role="status" className={/^Kaydedildi/.test(message) ? 'vm-note' : 'vm-err'}>{message}</p>}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" className="vm-btn" disabled={busy || (!d.has_keys && !(form.api_key && form.secret_key))} onClick={() => run(() => api.put(`${API}/payment`, { ...form, enabled: d.has_keys ? d.enabled : false }))}>Anahtarları kaydet</button>
      {d.has_keys && <button type="button" className="vm-btn ghost" disabled={busy} onClick={() => run(() => api.put(`${API}/payment`, { enabled: !d.enabled }))}>{d.enabled ? 'Kartla ödemeyi kapat' : 'Kartla ödemeyi aç'}</button>}
      {d.has_keys && <button type="button" className="vm-btn ghost" disabled={busy} onClick={() => { if (window.confirm('Kayıtlı iyzico anahtarları silinsin mi? Kartla ödeme kapanır.')) run(() => api.delete(`${API}/payment`)); }}>Anahtarları sil</button>}
    </div>
  </div>;
}
function DomainCard() {
  const data = useAsync(async () => (await api.get(`${API}/domain`)).data, []);
  const [input, setInput] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [checks, setChecks] = useState(null);
  const d = data.data?.domain;
  const run = async fn => { setBusy(true); setMessage(''); try { await fn(); await data.reload(); } catch (e) { setMessage(errorText(e, 'İşlem yapılamadı.')); } finally { setBusy(false); } };
  const verify = () => run(async () => { const r = (await api.post(`${API}/domain/verify`)).data; setChecks(r.checks); setMessage(r.domain.verified ? 'Alan adı doğrulandı; mağazanız bu adreste açılır.' : 'TXT kaydı henüz bulunamadı. DNS değişikliği birkaç dakika sürebilir.'); });
  return <div className="vm-card" style={{ marginTop: 14 }}>
    <b>Özel alan adı</b>
    <p className="vm-note">Mağazanızı kendi alan adınızda (örn. magaza.firmam.com) açın. Önce alan adını kaydedin, sonra DNS ayarlarına aşağıdaki kayıtları ekleyip doğrulayın.</p>
    {message && <p role="status" className={/doğrulandı/.test(message) ? 'vm-note' : 'vm-err'}>{message}</p>}
    {!d && <><label className="vm-field"><input aria-label="Alan adı" placeholder="magaza.firmam.com" autoCapitalize="none" value={input} onChange={e => setInput(e.target.value)} /></label>
      <button type="button" className="vm-btn" disabled={busy || !input.trim()} onClick={() => run(async () => { await api.put(`${API}/domain`, { domain: input }); setInput(''); })}>Alan adını kaydet</button></>}
    {d && <div>
      <p><b>{d.domain}</b> · {d.verified ? 'doğrulandı' : 'doğrulama bekliyor'}</p>
      {!d.verified && <div className="vm-note" style={{ wordBreak: 'break-all' }}>
        <p>1) DNS’e <b>TXT</b> kaydı ekleyin:<br />Ad: <code>{d.instructions.txt.name}</code><br />Değer: <code>{d.instructions.txt.value}</code></p>
        <p>2) Alan adınızı <b>CNAME</b> ile yönlendirin:<br />Ad: <code>{d.instructions.cname.name}</code><br />Hedef: <code>{d.instructions.cname.value}</code></p>
        {checks && <p>TXT: {checks.txt ? 'bulundu' : 'bulunamadı'} · CNAME: {checks.cname ? 'bulundu' : 'bulunamadı'}</p>}
        <p>HTTPS sertifikası için Veniux ile iletişime geçin; alan adı doğrulandıktan sonra sertifika bağlanır.</p></div>}
      <div style={{ display: 'flex', gap: 8 }}>
        {!d.verified && <button type="button" className="vm-btn" disabled={busy} onClick={verify}>Doğrula</button>}
        <button type="button" className="vm-btn ghost" disabled={busy} onClick={() => { if (window.confirm('Alan adı bağlantısı kaldırılsın mı?')) run(async () => { await api.delete(`${API}/domain`); setChecks(null); }); }}>Kaldır</button></div></div>}
  </div>;
}
function CampaignsTab() { return <div><CodesSection /><RulesSection /></div>; }

export function MobileOnlineStore() {
  const [tab, setTab] = useState('orders');
  const tabs = isBoss() ? [['orders', 'Siparişler'], ['products', 'Ürünler'], ['customers', 'Müşteriler'], ['campaigns', 'Kod & Kargo'], ['settings', 'Ayarlar']] : [['orders', 'Siparişler']];
  return <div className="vm">
    <MobileTop title="Online Mağaza" flat />
    <PackGate pack="online_store"><div className="vm-body" style={{ marginTop: 0, paddingTop: 14 }}>
      <div role="tablist" aria-label="Online mağaza" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>{tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={'vm-btn ' + (tab === k ? '' : 'ghost')} style={{ flex: '1 1 30%', minHeight: 44, padding: '0 8px' }} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'orders' && <OrdersTab />}{tab === 'products' && <ProductsTab />}{tab === 'customers' && <CustomersTab />}{tab === 'campaigns' && <CampaignsTab />}{tab === 'settings' && <SettingsTab />}
      <p className="vm-note" style={{ marginTop: 14 }}>Akış: {STATUS_FLOW}</p>
    </div></PackGate>
  </div>;
}
