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
function OrderSheet({ id, onClose, onChanged }) {
  const detail = useAsync(async () => (await api.get(`${API}/orders/${id}`)).data, [id]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [reason, setReason] = useState(''), [cancelling, setCancelling] = useState(false);
  const order = detail.data;
  const change = async (status, why) => {
    setBusy(true); setMessage('');
    try { await api.patch(`${API}/orders/${id}/status`, { status, reason: why }); await detail.reload(); onChanged(); setCancelling(false); }
    catch (e) { setMessage(errorText(e, 'Durum değiştirilemedi.')); } finally { setBusy(false); }
  };
  return <Sheet onClose={onClose} label="Sipariş ayrıntısı">
    {detail.error && <p role="alert" className="vm-err">{detail.error}</p>}
    {order && <>
      <h2 style={{ margin: '0 0 4px' }}>Sipariş {order.number}</h2>
      <p className="vm-note">{statusLabel(order.status)} · {order.delivery_method === 'pickup' ? 'Mağazadan teslim' : 'Adrese teslim'} · {order.payment_method === 'cod' ? 'Kapıda ödeme' : order.payment_method === 'transfer' ? 'Havale/EFT' : 'Mağazada ödeme'}</p>
      <div className="vm-list" style={{ margin: '10px 0' }}>{order.items.map(i => <div key={i.product_id} className="vm-row"><span className="grow"><b>{i.quantity}×</b> {i.name}</span><b>{money(i.line_total)}</b></div>)}</div>
      <p className="vm-note">Ara toplam {money(order.subtotal)} · Teslimat {money(order.delivery_fee)}</p>
      <p style={{ fontWeight: 800, fontSize: 18 }}>Toplam {money(order.total)}</p>
      <div className="vm-card" style={{ margin: '10px 0' }}>
        <b>{order.customer_name}</b><div><a href={`tel:${order.phone}`}>{order.phone}</a></div>
        {order.email && <div className="vm-note">{order.email}</div>}
        {order.address && <div className="vm-note">{order.address}</div>}
        {order.note && <div className="vm-note"><b>Not:</b> {order.note}</div>}
        {order.cancel_reason && <div className="vm-err">İptal nedeni: {order.cancel_reason}</div>}
      </div>
      {message && <p role="alert" className="vm-err">{message}</p>}
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
      <span className="grow"><b>{o.number}</b> · {o.customer_name}<small>{statusLabel(o.status)} · {String(o.created_at).slice(0, 16).replace('T', ' ')}</small></span><b>{money(o.total)}</b></button>)}</div>
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
  const [desc, setDesc] = useState(product.description || ''), [max, setMax] = useState(product.max_per_order ?? ''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const media = useAsync(async () => (await api.get(`${API}/products/${product.id}/media`)).data, [product.id]);
  const file = useRef(null);
  const save = async () => {
    setBusy(true); setMessage('');
    try { await api.put(`${API}/products/${product.id}`, { description: desc, max_per_order: max === '' ? null : Number(max) }); onChanged(); setMessage('Kaydedildi.'); }
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
    <label className="vm-field" style={{ marginTop: 8 }}><input inputMode="numeric" placeholder="Sipariş başına üst sınır (boş = sınırsız)" aria-label="Sipariş başına üst sınır" value={max} onChange={e => setMax(e.target.value.replace(/\D/g, ''))} /></label>
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
    const ids = (list.data?.items || []).filter(p => !p.measured_unit).map(p => p.id);
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
      <button type="button" className="grow" style={{ all: 'unset', cursor: 'pointer', flex: 1 }} onClick={() => setSelected(p)} aria-label={p.name + ' ayrıntısı'}><b>{p.name}</b><small style={{ display: 'block' }}>{money(p.price)} · stok {p.stock ?? '—'} · {p.images} görsel{p.measured_unit ? ' · tartılı (yayınlanamaz)' : ''}</small></button>
      <button type="button" role="switch" aria-checked={p.published} aria-label={p.name + ' mağazada yayında'} disabled={p.measured_unit} className={'vm-btn ' + (p.published ? '' : 'ghost')} style={{ minHeight: 40, padding: '0 12px' }} onClick={() => toggle(p)}>{p.published ? <><Check size={16} /> Yayında</> : 'Gizli'}</button></div>)}</div>
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
    <div className="vm-label"><span>Sipariş koşulları (müşteriye gösterilir)</span></div>
    <label className="vm-field"><textarea aria-label="Sipariş koşulları" rows={5} maxLength={6000} placeholder="İade, cayma hakkı ve teslimat koşullarınızı yazın. Hukuki metin için avukat veya mali müşavirinize danışın." value={form.terms_text || ''} onChange={e => set('terms_text', e.target.value)} style={{ flex: 1, border: 0, background: 'none', font: 'inherit', color: 'var(--vm-ink)' }} /></label>
    <button type="button" className="vm-btn" style={{ marginTop: 10 }} disabled={busy} onClick={() => save()}>Kaydet</button>
  </div>;
}

export function MobileOnlineStore() {
  const [tab, setTab] = useState('orders');
  const tabs = isBoss() ? [['orders', 'Siparişler'], ['products', 'Ürünler'], ['settings', 'Ayarlar']] : [['orders', 'Siparişler']];
  return <div className="vm">
    <MobileTop title="Online Mağaza" flat />
    <PackGate pack="online_store"><div className="vm-body" style={{ marginTop: 0, paddingTop: 14 }}>
      <div role="tablist" aria-label="Online mağaza" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>{tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={'vm-btn ' + (tab === k ? '' : 'ghost')} style={{ flex: 1, minHeight: 44 }} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'orders' && <OrdersTab />}{tab === 'products' && <ProductsTab />}{tab === 'settings' && <SettingsTab />}
      <p className="vm-note" style={{ marginTop: 14 }}>Akış: {STATUS_FLOW}</p>
    </div></PackGate>
  </div>;
}
