import { formatMoney } from '../../../shared/money.mjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import api from '../api/client';
import { cartAdd, cartCount, cartKey, cartPayload, cartSet, cartTotals, lineStep, loadCart, newIdempotencyKey, qtyLabel, statusLabel } from '../lib/onlineStore.mjs';
import './storefront.css';

const tl = value => formatMoney(Number(value || 0));
const apiError = (e, fallback) => e?.response?.data?.error || fallback;
const shopApi = slug => `/public/shop/${slug}`;

function Photo({ product, className = 'sf-img', size }) {
  const first = product.images && product.images[0];
  return first ? <img className={className} src={first.url} alt={first.alt || product.name} loading="lazy" decoding="async" width={size || 400} height={size || 400} />
    : <div className="sf-img-empty" role="img" aria-label={product.name + ' için görsel yok'}>Görsel yok</div>;
}
function StockTag({ state }) {
  if (state === 'out') return <span className="sf-tag out">Tükendi</span>;
  if (state === 'low') return <span className="sf-tag">Son birkaç adet</span>;
  return null;
}

// ---------- Ortak çerçeve: mağaza bilgisi, sepet, üst bar, alt bar ----------
export function StoreLayout() {
  const { slug } = useParams();
  const [store, setStore] = useState(null), [error, setError] = useState('');
  const [cart, setCartState] = useState(() => loadCart(window.localStorage, slug));
  const [terms, setTerms] = useState(false);
  useEffect(() => { setCartState(loadCart(window.localStorage, slug)); }, [slug]);
  useEffect(() => {
    let live = true; setStore(null); setError('');
    api.get(shopApi(slug)).then(r => { if (live) setStore(r.data); }).catch(e => { if (live) setError(e?.response?.status === 404 ? 'Bu mağaza bulunamadı ya da şu anda kapalı.' : apiError(e, 'Mağaza yüklenemedi.')); });
    return () => { live = false; };
  }, [slug]);
  useEffect(() => { if (store) document.title = store.name; }, [store]);
  const setCart = useCallback(next => setCartState(prev => { const value = typeof next === 'function' ? next(prev) : next; try { window.localStorage.setItem(cartKey(slug), JSON.stringify(value)); } catch { /* kayıt kapalıysa sepet yalnız bu oturumda durur */ } return value; }), [slug]);
  const ctx = useMemo(() => ({ slug, store, cart, setCart }), [slug, store, cart, setCart]);
  const count = cartCount(cart);
  if (error) return <div className="sf"><div className="sf-wrap"><div className="sf-empty"><h1>Mağaza bulunamadı</h1><p>{error}</p></div></div></div>;
  if (!store) return <div className="sf"><div className="sf-wrap"><p className="sf-empty" role="status">Yükleniyor…</p></div></div>;
  const th = store.theme || {};
  return <div className={`sf sf-font-${th.font || 'modern'} sf-layout-${th.layout || 'grid'} sf-hero-${th.hero || 'plain'}`} style={th.color ? { '--sf-accent': th.color, '--sf-accent-ink': th.ink || '#fff' } : undefined}>
    {th.banner && <div className="sf-banner-strip" role="note">{th.banner}</div>}
    <header className="sf-head"><div className="sf-wrap">
      <Link className="sf-brand" to={`/magaza/${slug}`}>{store.name}</Link>
      <Link className="sf-cartlink" to={`/magaza/${slug}/sepet`} aria-label={`Sepet, ${count} ürün`}><ShoppingBag size={20} aria-hidden="true" /> Sepet {count > 0 && <b>{count}</b>}</Link>
    </div></header>
    <main className="sf-wrap"><Outlet context={ctx} /></main>
    <footer className="sf-foot"><div className="sf-wrap">
      {store.about && <p style={{ whiteSpace: 'pre-line' }}>{store.about}</p>}
      <p>{store.contact_email && <>İletişim: <a href={`mailto:${store.contact_email}`}>{store.contact_email}</a> · </>}{store.phone && <>Tel: <a href={`tel:${store.phone}`}>{store.phone}</a> · </>}{store.terms_text && <button type="button" className="sf-chip" onClick={() => setTerms(true)}>Sipariş koşulları</button>}</p>
      <p>Bu mağaza <a href="https://veniux.com" rel="noopener">Veniux</a> ile hazırlandı.</p>
    </div></footer>
    {terms && <div className="sf-modal" role="dialog" aria-modal="true" aria-label="Sipariş koşulları" onClick={e => { if (e.target === e.currentTarget) setTerms(false); }}><div><h2 style={{ marginTop: 0 }}>Sipariş koşulları</h2><p style={{ whiteSpace: 'pre-line' }}>{store.terms_text}</p><button type="button" className="sf-btn block" onClick={() => setTerms(false)}>Kapat</button></div></div>}
  </div>;
}

// ---------- Ana sayfa ----------
export function StoreHome() {
  const { slug, store, cart, setCart } = useOutletContext();
  const [q, setQ] = useState(''), [term, setTerm] = useState(''), [category, setCategory] = useState('');
  const [items, setItems] = useState([]), [page, setPage] = useState(0), [total, setTotal] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => { const t = setTimeout(() => { setTerm(q.trim()); setPage(0); }, 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    let live = true; setLoading(true); setError('');
    api.get(`${shopApi(slug)}/products`, { params: { q: term || undefined, category: category || undefined, page } })
      .then(r => { if (!live) return; setTotal(r.data.total); setItems(prev => (page === 0 ? r.data.items : [...prev, ...r.data.items])); })
      .catch(e => { if (live) setError(apiError(e, 'Ürünler yüklenemedi.')); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [slug, term, category, page]);
  const totals = cartTotals(cart, store, 'delivery');
  const count = cartCount(cart);
  return <>
    <section className="sf-hero"><h1>{store.name}</h1>{store.tagline && <p>{store.tagline}</p>}</section>
    {!store.accepting_orders && <p className="sf-banner" role="status">Mağaza şu anda sipariş almıyor. Ürünleri inceleyebilirsiniz.</p>}
    <form className="sf-search" role="search" onSubmit={e => { e.preventDefault(); setTerm(q.trim()); setPage(0); }}><label className="sf-sr" htmlFor="sf-q">Ürün ara</label><input id="sf-q" type="search" placeholder="Ürün ara" value={q} onChange={e => setQ(e.target.value)} /></form>
    {store.categories.length > 0 && <div className="sf-chips" role="group" aria-label="Kategoriler"><button type="button" className="sf-chip" aria-pressed={!category} onClick={() => { setCategory(''); setPage(0); }}>Tümü</button>{store.categories.map(c => <button key={c.name} type="button" className="sf-chip" aria-pressed={category === c.name} onClick={() => { setCategory(c.name); setPage(0); }}>{c.name}</button>)}</div>}
    {error && <p className="sf-error" role="alert">{error}</p>}
    {!loading && !error && items.length === 0 && <p className="sf-empty">Aramanıza uygun ürün bulunamadı.</p>}
    <div className="sf-grid">{items.map(p => <article className="sf-card" key={p.id}>
      <Link to={`/magaza/${slug}/urun/${p.id}`} aria-label={p.name}><Photo product={p} /></Link>
      <div className="sf-card-body"><h3><Link to={`/magaza/${slug}/urun/${p.id}`}>{p.name}</Link></h3><span className="sf-price">{tl(p.price)}{p.measured ? ` / ${p.unit_label}` : ''}</span><StockTag state={p.stock_state} />
        <button type="button" className="sf-btn" disabled={p.stock_state === 'out' || !store.accepting_orders} onClick={() => setCart(c => cartAdd(c, p))}>{cart[p.id] ? `Sepette (${qtyLabel(cart[p.id])})` : p.measured ? `Sepete ekle (${String(p.min_qty).replace('.', ',')} ${p.unit_label})` : 'Sepete ekle'}</button></div></article>)}</div>
    {items.length < total && <div className="sf-more"><button type="button" className="sf-btn ghost" disabled={loading} onClick={() => setPage(page + 1)}>{loading ? 'Yükleniyor…' : 'Daha fazla göster'}</button></div>}
    {count > 0 && <div className="sf-bar"><div className="sf-wrap"><span>{count} ürün · {tl(totals.subtotal)}</span><Link className="sf-btn" to={`/magaza/${slug}/sepet`}>Sepete git</Link></div></div>}
  </>;
}

// ---------- Ürün sayfası ----------
export function StoreProduct() {
  const { slug, store, cart, setCart } = useOutletContext();
  const { id } = useParams();
  const [product, setProduct] = useState(null), [error, setError] = useState(''), [qty, setQty] = useState(1), [shown, setShown] = useState(0), [added, setAdded] = useState(false);
  useEffect(() => {
    let live = true; setProduct(null); setError(''); setShown(0);
    api.get(`${shopApi(slug)}/products/${id}`).then(r => { if (live) { setProduct(r.data); setQty(r.data.measured ? r.data.min_qty : 1); } }).catch(e => { if (live) setError(e?.response?.status === 404 ? 'Bu ürün artık satışta değil.' : apiError(e, 'Ürün yüklenemedi.')); });
    return () => { live = false; };
  }, [slug, id]);
  useEffect(() => { if (product) document.title = `${product.name} | ${store.name}`; return () => { document.title = store.name; }; }, [product, store.name]);
  if (error) return <div className="sf-empty"><p>{error}</p><Link className="sf-btn" to={`/magaza/${slug}`}>Mağazaya dön</Link></div>;
  if (!product) return <p className="sf-empty" role="status">Yükleniyor…</p>;
  const step = product.measured ? product.step : 1, minQty = product.measured ? product.min_qty : 1;
  const limit = Math.min(product.measured ? 1000 : 50, product.max_per_order || (product.measured ? 1000 : 50));
  const shownQty = String(Math.round(qty * 1000) / 1000).replace('.', ',') + (product.measured ? ' ' + product.unit_label : '');
  const img = product.images[shown];
  return <article className="sf-product">
    <div className="sf-gallery">{img ? <img className="sf-main" src={img.url} alt={img.alt || product.name} width={800} height={800} /> : <div className="sf-img-empty" style={{ borderRadius: 12 }} role="img" aria-label="Görsel yok">Görsel yok</div>}
      {product.images.length > 1 && <div className="sf-thumbs">{product.images.map((m, i) => <button key={m.url} type="button" aria-current={i === shown} aria-label={`Görsel ${i + 1}`} onClick={() => setShown(i)}><img src={m.url} alt="" width={64} height={64} loading="lazy" /></button>)}</div>}</div>
    <div className="sf-info"><p className="sf-tag" style={{ margin: 0, color: 'var(--sf-muted)' }}>{product.category}</p><h1>{product.name}</h1><p className="sf-price" style={{ fontSize: 24 }}>{tl(product.price)}{product.measured ? ` / ${product.unit_label}` : ''}</p><StockTag state={product.stock_state} />
      {product.description && <p className="sf-desc">{product.description}</p>}
      {store.accepting_orders && product.stock_state !== 'out' ? <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <div className="sf-qty" role="group" aria-label={product.measured ? 'Miktar' : 'Adet'}><button type="button" aria-label="Azalt" onClick={() => setQty(Math.max(minQty, Math.round((qty - step) * 1000) / 1000))}>−</button><span aria-live="polite">{shownQty}</span><button type="button" aria-label="Artır" onClick={() => setQty(Math.min(limit, Math.round((qty + step) * 1000) / 1000))}>+</button></div>
        <button type="button" className="sf-btn" onClick={() => { setCart(c => cartAdd(c, product, qty)); setAdded(true); setTimeout(() => setAdded(false), 2500); }}>Sepete ekle</button></div>
        : <p className="sf-banner">{product.stock_state === 'out' ? 'Bu ürün şu anda tükendi.' : 'Mağaza şu anda sipariş almıyor.'}</p>}
      <p role="status" className="sf-sr">{added ? 'Ürün sepete eklendi' : ''}</p>
      {added && <p className="sf-ok">Sepete eklendi. <Link to={`/magaza/${slug}/sepet`}>Sepete git</Link></p>}
      {cart[product.id] && !added && <p className="sf-note" style={{ color: 'var(--sf-muted)' }}>Sepetinizde {qtyLabel(cart[product.id])}{product.measured ? '' : ' adet'} var.</p>}
      <p style={{ marginTop: 16 }}><Link to={`/magaza/${slug}`}>← Alışverişe devam et</Link></p></div>
  </article>;
}

// ---------- Sepet ve sipariş ----------
export function StoreCart() {
  const { slug, store, cart, setCart } = useOutletContext();
  const navigate = useNavigate();
  const lines = Object.values(cart);
  const [delivery, setDelivery] = useState(store.pickup && !store.payment.cod ? 'pickup' : 'delivery');
  const methods = useMemo(() => {
    const list = [];
    if (delivery === 'delivery') { if (store.payment.cod) list.push(['cod', 'Kapıda ödeme', 'Teslimatta nakit veya kartla ödersiniz.']); }
    else { list.push(['pickup', 'Mağazada ödeme', 'Siparişinizi teslim alırken ödersiniz.']); }
    if (store.payment.card) list.push(['card', 'Kartla öde', 'Güvenli ödeme sayfasında kartınızla ödersiniz. Kart bilgisi mağazaya iletilmez.']);
    return list;
  }, [delivery, store]);
  const [payment, setPayment] = useState(''), [form, setForm] = useState({ customer_name: '', phone: '', email: '', address: '', note: '', consent: false, website: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [terms, setTerms] = useState(false);
  const key = useRef(null);
  useEffect(() => { if (!methods.find(m => m[0] === payment)) setPayment(methods[0] ? methods[0][0] : ''); }, [methods, payment]);
  const local = cartTotals(cart, store, delivery);
  const [city, setCity] = useState(''), [codeInput, setCodeInput] = useState(''), [applied, setApplied] = useState(''), [codeMsg, setCodeMsg] = useState(''), [quote, setQuote] = useState(null);
  const needCity = delivery === 'delivery' && (store.provinces || []).length > 0;
  const cartSig = JSON.stringify(cartPayload(cart));
  // Sunucudan sepet özeti: kargo kuralı (il) ve indirim kodu varsa gerçek toplam sunucudan gelir; yoksa yerel hesap gösterilir.
  useEffect(() => {
    if (!lines.length || (!applied && !needCity)) { setQuote(null); return undefined; }
    let live = true;
    api.post(`${shopApi(slug)}/quote`, { delivery_method: delivery, city: city || undefined, discount_code: applied || undefined, items: JSON.parse(cartSig).map(({ product_id, quantity }) => ({ product_id, quantity })) })
      .then(r => { if (live) { setQuote(r.data); if (applied) setCodeMsg(`“${r.data.code}” kodu uygulandı.`); } })
      .catch(e => { if (!live) return; setQuote(null); const d = e?.response?.data || {}; if (applied && /CODE/.test(d.code || '')) { setCodeMsg(d.error); setApplied(''); } });
    return () => { live = false; };
  }, [slug, delivery, city, applied, needCity, cartSig, lines.length]);
  const totals = quote ? { ...local, subtotal: quote.subtotal, fee: quote.delivery_fee, total: quote.total, discount: quote.discount } : { ...local, discount: 0 };
  const applyCode = () => { const c = codeInput.trim(); setCodeMsg(''); if (!c) { setApplied(''); return; } setApplied(c); };
  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const submit = async e => {
    e.preventDefault(); setError(''); setNotice('');
    if (!key.current) key.current = newIdempotencyKey();
    setBusy(true);
    try {
      const body = { delivery_method: delivery, payment_method: payment, customer_name: form.customer_name, phone: form.phone, email: form.email || undefined, address: delivery === 'delivery' ? form.address : undefined, note: form.note || undefined, consent: form.consent, website: form.website, city: needCity ? city : undefined, discount_code: applied || undefined, items: cartPayload(cart) };
      const r = await api.post(`${shopApi(slug)}/orders`, body, { headers: { 'Idempotency-Key': key.current } });
      setCart({}); key.current = null;
      if (r.data.payment_url) { window.location.assign(r.data.payment_url); return; }
      navigate(`/magaza/${slug}/siparis/${r.data.code}`, { replace: true });
    } catch (err) {
      const data = err?.response?.data || {};
      if (data.code === 'PRICE_CHANGED') { setCart(c => { const next = { ...c }; for (const ch of data.changed || []) if (next[ch.product_id]) next[ch.product_id] = { ...next[ch.product_id], price: ch.price }; return next; }); setNotice('Bazı ürünlerin fiyatı değişti. Güncel tutarları kontrol edip tekrar onaylayın.'); key.current = null; }
      else if (data.code === 'OUT_OF_STOCK') { setCart(c => { const next = { ...c }; for (const s of data.shortages || []) { if (s.available <= 0) delete next[s.product_id]; else if (next[s.product_id]) { const fixed = cartSet({ [s.product_id]: next[s.product_id] }, s.product_id, s.available); if (fixed[s.product_id]) next[s.product_id] = fixed[s.product_id]; else delete next[s.product_id]; } } return next; }); setError('Bazı ürünlerin stoğu yetersiz; sepetiniz mevcut stoğa göre güncellendi. Kontrol edip tekrar deneyin.'); key.current = null; }
      else if (/^(BAD_CODE|CODE_)/.test(data.code || '')) { setError(data.error); setApplied(''); setCodeMsg(data.error); key.current = null; }
      else if (data.code === 'PAYMENT_UNAVAILABLE') { setError(data.error); key.current = null; }
      else if (data.code === 'PRODUCT_UNAVAILABLE') { setError(data.error + ' Sepeti yenilemek için ürün sayfalarını kontrol edin.'); key.current = null; }
      else setError(apiError(err, 'Sipariş gönderilemedi. Bağlantınızı kontrol edip tekrar deneyin.'));
    } finally { setBusy(false); }
  };
  if (!lines.length) return <div className="sf-empty"><h1>Sepetiniz boş</h1><p>Beğendiğiniz ürünleri sepete ekleyin.</p><Link className="sf-btn" to={`/magaza/${slug}`}>Alışverişe başla</Link></div>;
  return <>
    <h1>Sepetiniz</h1>
    <div className="sf-lines">{lines.map(l => <div className="sf-line" key={l.id}>
      {l.image ? <img className="sf-thumb" src={l.image} alt="" width={64} height={64} /> : <div className="sf-thumb" aria-hidden="true" />}<div><b>{l.name}</b><div>{tl(l.price)}{l.unit ? ` / ${l.unit}` : ''}</div></div>
      <div className="sf-qty" role="group" aria-label={l.name + ' adedi'}><button type="button" aria-label="Azalt" onClick={() => setCart(c => cartSet(c, l.id, l.quantity - lineStep(l)))}>−</button><span aria-live="polite">{qtyLabel(l)}</span><button type="button" aria-label="Artır" onClick={() => setCart(c => cartSet(c, l.id, l.quantity + lineStep(l)))}>+</button></div></div>)}</div>
    <form className="sf-form" onSubmit={submit} noValidate>
      <fieldset><legend>Teslimat</legend>
        <label className="sf-radio"><input type="radio" name="delivery" checked={delivery === 'delivery'} onChange={() => setDelivery('delivery')} /><span><b>Adrese teslim</b><br /><small>{(store.provinces || []).length ? 'Teslimat ücreti seçtiğiniz ile göre hesaplanır' : store.delivery_fee > 0 ? `Teslimat ücreti ${tl(store.delivery_fee)}${store.free_delivery_over != null ? ` (${tl(store.free_delivery_over)} üzeri ücretsiz)` : ''}` : 'Ücretsiz teslimat'}</small></span></label>
        {store.pickup && <label className="sf-radio"><input type="radio" name="delivery" checked={delivery === 'pickup'} onChange={() => setDelivery('pickup')} /><span><b>Mağazadan teslim</b><br /><small>Ücretsiz</small></span></label>}</fieldset>
      <fieldset><legend>Ödeme</legend>{methods.map(([v, label, hint]) => <label className="sf-radio" key={v}><input type="radio" name="payment" checked={payment === v} onChange={() => setPayment(v)} /><span><b>{label}</b><br /><small>{hint}</small></span></label>)}{methods.length === 0 && <p className="sf-error">Bu teslimat yöntemi için ödeme seçeneği tanımlı değil.</p>}</fieldset>
      <fieldset><legend>Bilgileriniz</legend>
        <div className="sf-field"><label htmlFor="sf-name">Ad soyad</label><input id="sf-name" autoComplete="name" required value={form.customer_name} onChange={e => set('customer_name', e.target.value)} /></div>
        <div className="sf-field"><label htmlFor="sf-phone">Telefon</label><input id="sf-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="05xx xxx xx xx" required value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
        <div className="sf-field"><label htmlFor="sf-email">{payment === 'card' ? 'E-posta (kartla ödeme için gerekli)' : 'E-posta (isteğe bağlı)'}</label><input id="sf-email" type="email" autoComplete="email" required={payment === 'card'} value={form.email} onChange={e => set('email', e.target.value)} /></div>
        {needCity && <div className="sf-field"><label htmlFor="sf-city">İl</label><select id="sf-city" required value={city} onChange={e => setCity(e.target.value)}><option value="">İl seçin</option>{store.provinces.map(p => <option key={p} value={p}>{p}</option>)}</select></div>}
        {delivery === 'delivery' && <div className="sf-field"><label htmlFor="sf-address">Açık adres</label><textarea id="sf-address" rows={3} autoComplete="street-address" required value={form.address} onChange={e => set('address', e.target.value)} /></div>}
        <div className="sf-field"><label htmlFor="sf-note">Sipariş notu (isteğe bağlı)</label><textarea id="sf-note" rows={2} maxLength={300} value={form.note} onChange={e => set('note', e.target.value)} /></div>
        <div className="sf-hp" aria-hidden="true"><label>Web sitesi<input tabIndex={-1} autoComplete="off" value={form.website} onChange={e => set('website', e.target.value)} /></label></div></fieldset>
      {store.has_codes && <div className="sf-field"><label htmlFor="sf-code">İndirim kodu</label><div style={{ display: 'flex', gap: 8 }}><input id="sf-code" autoCapitalize="characters" autoComplete="off" value={codeInput} onChange={e => setCodeInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCode(); } }} /><button type="button" className="sf-btn" onClick={applyCode}>Uygula</button></div>{codeMsg && <small role="status" style={{ color: applied ? 'inherit' : 'var(--sf-danger, #b42318)' }}>{codeMsg}</small>}</div>}
      <div className="sf-totals" aria-live="polite"><div><span>Ara toplam</span><span>{tl(totals.subtotal)}</span></div>{totals.discount > 0 && <div><span>İndirim</span><span>−{tl(totals.discount)}</span></div>}<div><span>Teslimat</span><span>{delivery === 'delivery' && needCity && !city ? 'İl seçince' : totals.fee ? tl(totals.fee) : 'Ücretsiz'}</span></div><div className="grand"><span>Toplam</span><span>{tl(totals.total)}</span></div></div>
      {totals.belowMin && <p className="sf-error" role="alert">Minimum sipariş tutarı {tl(store.min_order)}. {tl(totals.missing)} daha ekleyin.</p>}
      <label className="sf-radio" style={{ cursor: 'default' }}><input type="checkbox" checked={form.consent} onChange={e => set('consent', e.target.checked)} /><span>Kişisel verilerimin siparişi işlemek amacıyla {store.name} tarafından işlenmesini kabul ediyorum{store.terms_text && <> ve <button type="button" className="sf-chip" onClick={() => setTerms(true)}>sipariş koşullarını</button> okudum</>}.</span></label>
      {notice && <p className="sf-banner" role="status">{notice}</p>}
      {error && <p className="sf-error" role="alert">{error}</p>}
      <button type="submit" className="sf-btn block" disabled={busy || !store.accepting_orders || totals.belowMin || !payment || !form.consent}>{busy ? 'Gönderiliyor…' : `Siparişi tamamla · ${tl(totals.total)}`}</button>
      {!store.accepting_orders && <p className="sf-error">Mağaza şu anda sipariş almıyor.</p>}
    </form>
    {terms && <div className="sf-modal" role="dialog" aria-modal="true" aria-label="Sipariş koşulları" onClick={e => { if (e.target === e.currentTarget) setTerms(false); }}><div><h2 style={{ marginTop: 0 }}>Sipariş koşulları</h2><p style={{ whiteSpace: 'pre-line' }}>{store.terms_text}</p><button type="button" className="sf-btn block" onClick={() => setTerms(false)}>Kapat</button></div></div>}
  </>;
}

export function StoreOrder() {
  const { slug, store } = useOutletContext();
  const { code } = useParams();
  const [order, setOrder] = useState(null), [error, setError] = useState(''), [payError, setPayError] = useState(''), [paying, setPaying] = useState(false);
  const payNow = async () => { setPaying(true); setPayError(''); try { const r = await api.post(`${shopApi(slug)}/orders/${code}/pay`); window.location.assign(r.data.payment_url); } catch (e) { setPayError(apiError(e, 'Ödeme sayfası açılamadı.')); setPaying(false); } };
  useEffect(() => {
    let live = true;
    const load = () => api.get(`${shopApi(slug)}/orders/${code}`).then(r => { if (live) setOrder(r.data); }).catch(e => { if (live) setError(e?.response?.status === 404 ? 'Sipariş bulunamadı. Bağlantıyı kontrol edin.' : apiError(e, 'Sipariş yüklenemedi.')); });
    load(); const t = setInterval(load, 30000);
    return () => { live = false; clearInterval(t); };
  }, [slug, code]);
  if (error) return <div className="sf-empty"><p>{error}</p><Link className="sf-btn" to={`/magaza/${slug}`}>Mağazaya dön</Link></div>;
  if (!order) return <p className="sf-empty" role="status">Yükleniyor…</p>;
  return <section style={{ padding: '16px 0' }}>
    {order.payment && order.payment.status === 'pending' && order.status === 'new'
      ? <div className="sf-banner" role="status"><b>Ödeme bekleniyor</b><p style={{ margin: '6px 0' }}>Siparişiniz, ödeme tamamlanınca işleme alınır. Ödeme sayfasını kapattıysanız aşağıdan devam edebilirsiniz. Ödeme 30 dakika içinde tamamlanmazsa sipariş iptal olur.</p>{payError && <p className="sf-error" role="alert">{payError}</p>}<button type="button" className="sf-btn" disabled={paying} onClick={payNow}>Ödemeyi tamamla</button></div>
      : order.status === 'cancelled' ? <p className="sf-error" role="status">Bu sipariş iptal edildi{order.payment && order.payment.status === 'failed' ? ' (ödeme alınamadı)' : ''}.</p>
      : <p className="sf-ok" role="status">{order.payment_method === 'card' ? 'Ödemeniz alındı, siparişiniz işleme alındı.' : 'Siparişiniz alındı.'} Teşekkürler {order.customer_name}!</p>}
    <h1>Sipariş {order.number}</h1>
    <p><span className="sf-status">{statusLabel(order.status)}</span> <small style={{ color: 'var(--sf-muted)' }}>Bu sayfa durumu kendiliğinden günceller. Bağlantıyı saklayın.</small></p>
    <div className="sf-lines">{order.items.map(i => <div className="sf-line" key={i.product_id} style={{ gridTemplateColumns: '1fr auto' }}><div><b>{i.name}</b><div>{i.quantity} × {tl(i.unit_price)}</div></div><b>{tl(i.line_total)}</b></div>)}</div>
    <div className="sf-totals"><div><span>Ara toplam</span><span>{tl(order.subtotal)}</span></div>{order.discount > 0 && <div><span>İndirim{order.discount_code ? ` (${order.discount_code})` : ''}</span><span>−{tl(order.discount)}</span></div>}<div><span>Teslimat</span><span>{order.delivery_fee ? tl(order.delivery_fee) : 'Ücretsiz'}</span></div><div className="grand"><span>Toplam</span><span>{tl(order.total)}</span></div></div>
    <p>{order.delivery_method === 'pickup' ? 'Mağazadan teslim alacaksınız.' : 'Adresinize teslim edilecek.'} Ödeme: {order.payment_method === 'cod' ? 'Kapıda ödeme' : order.payment_method === 'transfer' ? 'Havale / EFT' : order.payment_method === 'card' ? 'Kartla ödeme' : 'Mağazada ödeme'}.</p>
    {order.tracking_no && <div className="sf-banner"><b>Kargo takibi</b><p style={{ margin: '6px 0 0' }}>{order.carrier ? order.carrier + ' · ' : ''}Takip no: {order.tracking_no}</p>{order.tracking_url && <p style={{ margin: '8px 0 0' }}><a className="sf-btn ghost" href={order.tracking_url} target="_blank" rel="noopener noreferrer">Kargom nerede?</a></p>}</div>}
    <p>Telefon: {order.phone}</p>
    <p><Link className="sf-btn ghost" to={`/magaza/${slug}`}>{store.name} mağazasına dön</Link></p>
  </section>;
}
