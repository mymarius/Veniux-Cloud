import ScannerPanel from '../components/ScannerPanel';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Barcode, Camera, CheckCircle2, History, Keyboard, Minus, PackagePlus, PackageSearch,
  Plus, ScanLine, Store, Tag, Undo2
} from 'lucide-react';
import api from '../api/client';
import BarcodeCamera from '../components/BarcodeCamera';
import './RetailQuickAdd.css';

const initial = { name: '', unit: 'adet', purchase_price: '', sale_price: '', quantity: '1' };
const UNITS = ['adet', 'paket', 'kutu', 'kg', 'litre'];
const QUICK = [1, 5, 10, 12, 24, 50];
const money = v => Number(v || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
const num = v => Number(v || 0).toLocaleString('tr-TR');

export default function RetailQuickAdd() {
  const [code, setCode] = useState('');
  const [product, setProduct] = useState(null);
  const [looked, setLooked] = useState(false);
  const [manual, setManual] = useState(false);
  const [fields, setFields] = useState(initial);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouse, setWarehouse] = useState('');
  const [stock, setStock] = useState(null);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const key = useRef(null), input = useRef(null), request = useRef(0), resultCard=useRef(null);
  useEffect(()=>{if(window.veniuxMobile&&looked)resultCard.current?.scrollIntoView({block:'start',behavior:'auto'});},[looked]);

  useEffect(() => {
    api.get('/normal-depo/warehouses')
      .then(r => { setWarehouses(r.data); setWarehouse(String(r.data[0]?.id || '')); })
      .catch(() => setError('Mağaza bilgisi yüklenemedi. Sayfayı yenileyin.'));
    return () => { request.current++; };
  }, []);

  // Bulunan ürünün seçili mağazadaki mevcut stoğu
  useEffect(() => {
    setStock(null);
    if (!product || !warehouse) return undefined;
    let active = true;
    api.get('/stock/records', { params: { warehouse_id: warehouse } })
      .then(r => { if (active) setStock((Array.isArray(r.data) ? r.data : []).filter(x => x.product_id === product.id).reduce((s, x) => s + Number(x.quantity || 0), 0)); })
      .catch(() => {});
    return () => { active = false; };
  }, [product, warehouse]);

  const reset = () => { setProduct(null); setLooked(false); setManual(false); setCode(''); setFields(initial); setError(''); key.current = null; input.current?.focus(); };
  const edit = (name, value) => { key.current = null; setFields(p => ({ ...p, [name]: value })); };
  const lookup = async (value = code, preview = null) => {
    const clean = value.trim();
    if (!clean) return;
    const seq = ++request.current;
    setBusy(true); setError(''); setCamera(false); setProduct(null); setLooked(false); setManual(false); setCode(clean); key.current = null;
    try {
      const r = preview ? {data:{product:preview.product}} : await api.get('/retail/lookup', { params: { barcode: clean } });
      if (seq !== request.current) return;
      setProduct(r.data.product); setLooked(true); setFields(initial);
    } catch (e) { if (seq === request.current) setError(e.response?.data?.error || 'Barkod sorgulanamadı.'); }
    finally { if (seq === request.current) setBusy(false); }
  };
  const save = async e => {
    e.preventDefault(); setBusy(true); setError('');
    const body = { warehouse_id: warehouse, quantity: fields.quantity, ...(product ? { product_id: product.id, barcode: code } : { ...fields, barcode: manual ? undefined : code }) };
    key.current ||= crypto.randomUUID();
    try {
      const r = await api.post('/retail/receive', body, { headers: { 'Idempotency-Key': key.current } });
      const entryId = key.current;
      setHistory(h => [{ id: entryId, name: r.data.product.name, unit: r.data.product.unit, quantity: r.data.quantity, total: r.data.total_quantity, created: !product, at: new Date() }, ...h].slice(0, 12));
      reset();
    } catch (e) { setError(e.response?.data?.error || 'Kayıt sonucu alınamadı. Bilgileri değiştirmeden tekrar deneyebilirsiniz.'); }
    finally { setBusy(false); }
  };
  const addStore = async () => {
    setBusy(true); setError('');
    try { const r = await api.post('/warehouses', { name: 'Mağaza', type: 'internal' }); setWarehouses([r.data]); setWarehouse(String(r.data.id)); }
    catch (e) { setError(e.response?.data?.error || 'Mağaza oluşturulamadı.'); }
    finally { setBusy(false); }
  };

  const unit = product?.unit || fields.unit;
  const qty = parseInt(fields.quantity, 10) || 0;
  const step = looked ? 2 : 1;
  const sessionUnits = history.reduce((s, h) => s + Number(h.quantity || 0), 0);
  const margin = Number(fields.sale_price) && Number(fields.purchase_price) ? Math.round(((fields.sale_price - fields.purchase_price) / fields.sale_price) * 100) : null;

  return <section className="rq">
    <header className="rq-head">
      <div>
        <span className="rq-eyebrow">Market · bakkal · kırtasiye · tuhafiye</span>
        <h1>Hızlı ürün ve stok ekle</h1>
        <p>Barkodu okutun, miktarı girin, stoğa ekleyin. Yeni ürünler de aynı ekrandan tanımlanır.</p>
      </div>
      <label className="rq-store">
        <Store size={17} />
        <span><small>Mağaza / depo</small>
          <select aria-label="Mağaza / depo" disabled={busy} value={warehouse} onChange={e => { setWarehouse(e.target.value); key.current = null; }}>
            <option value="">Seçin</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </span>
      </label>
    </header>

    <ol className="rq-steps" aria-label="Adımlar">
      {[['Barkodu okut', Barcode], ['Bilgileri kontrol et', PackageSearch], ['Stoğa ekle', PackagePlus]].map(([label, Icon], i) => <li key={label} data-state={i + 1 < step ? 'done' : i + 1 === step ? 'active' : 'todo'}><i><Icon size={15} /></i>{label}</li>)}
    </ol>

    {!warehouses.length && !error && <div className="rq-card rq-empty-store"><Store size={22} /><div><b>Henüz mağazanız yok</b><p>Stok ekleyebilmek için bir mağaza oluşturun.</p></div><button onClick={addStore} disabled={busy} className="vx-btn" data-variant="primary">İlk mağazamı oluştur</button></div>}
    {error && <p role="alert" className="rq-alert">{error}</p>}

    <ScannerPanel warehouseId={warehouse} onCode={async(raw,{processed})=>lookup(processed)} onProductSelected={(barcode,result)=>lookup(barcode,result)} />
    <Link className="btn-soft self-start" to="/magaza/kasa">Market kasasını aç</Link>
    <div className="rq-grid">
      <div className="rq-main">
        <form onSubmit={e => { e.preventDefault(); lookup(); }} className="rq-card rq-scan">
          <label htmlFor="rq-code" className="rq-label">Barkod</label>
          <div className="rq-scan-box" data-busy={busy}>
            <ScanLine size={22} />
            <input id="rq-code" ref={input} autoFocus autoComplete="off" maxLength={128} disabled={busy} value={code}
              onChange={e => { setCode(e.target.value); setLooked(false); setManual(false); setProduct(null); key.current = null; }}
              placeholder="Barkodu okutun veya yazın" />
            <button disabled={busy || !code.trim()} className="vx-btn" data-variant="primary">{busy && !looked ? 'Aranıyor…' : <>Bul <ArrowRight size={15} /></>}</button>
          </div>
          <div className="rq-scan-actions">
            <button type="button" disabled={busy} className="rq-chip" onClick={() => setCamera(true)}><Camera size={15} /> Kamerayla okut</button>
            <button type="button" disabled={busy} className="rq-chip" onClick={() => { setCamera(false); setManual(true); setLooked(true); setProduct(null); setFields(initial); setCode(''); setError(''); key.current = null; }}><Tag size={15} /> Barkodsuz ürün</button>
            <span className="rq-hint"><Keyboard size={14} /> El terminalinde okutup Enter'a basın</span>
          </div>
        </form>

        {camera && <div className="rq-card rq-pop"><BarcodeCamera onCode={lookup} onClose={() => setCamera(false)} /></div>}

        {looked && <form ref={resultCard} onSubmit={save} className="rq-card rq-pop rq-result" key={product?.id || (manual ? 'manual' : code)}>
          {product ? <div className="rq-product">
            <i><CheckCircle2 size={22} /></i>
            <div className="min-w-0 flex-1">
              <span className="rq-badge" data-tone="green">Kayıtlı ürün</span>
              <h2>{product.name}</h2>
              <p>{[product.sku, code && `Barkod ${code}`].filter(Boolean).join(' · ')}</p>
            </div>
            <dl>
              <div><dt>Satış fiyatı</dt><dd>{money(product.sale_price)}</dd></div>
              <div><dt>Mağaza stoğu</dt><dd>{stock === null ? '…' : `${num(stock)} ${product.unit}`}</dd></div>
            </dl>
          </div> : <>
            <div className="rq-product">
              <i data-tone="blue"><PackagePlus size={22} /></i>
              <div className="min-w-0 flex-1">
                <span className="rq-badge">{manual ? 'Barkodsuz ürün' : 'Yeni barkod'}</span>
                <h2>Yeni ürün oluştur</h2>
                <p>{manual ? 'Ürüne otomatik bir kod verilir.' : `${code} barkodu sistemde yok. Bilgileri girip kaydedin.`}</p>
              </div>
            </div>
            <div className="rq-fields">
              <label className="vx-field rq-span">Ürün adı<input required maxLength={200} disabled={busy} className="vx-input" placeholder="Örn: Kurşun kalem HB" value={fields.name} onChange={e => edit('name', e.target.value)} /></label>
              {[['purchase_price', 'Alış fiyatı (₺)'], ['sale_price', 'Satış fiyatı (₺)']].map(([name, label]) => <label key={name} className="vx-field">{label}<input required type="number" min="0" max="10000000" step="0.01" inputMode="decimal" disabled={busy} className="vx-input" placeholder="0,00" value={fields[name]} onChange={e => edit(name, e.target.value)} /></label>)}
              <div className="vx-field rq-span">Birim
                <div className="rq-units" role="group" aria-label="Birim">{UNITS.map(u => <button key={u} type="button" aria-pressed={fields.unit === u} onClick={() => edit('unit', u)}>{u}</button>)}</div>
              </div>
              {margin !== null && <p className="rq-span rq-margin" data-tone={margin < 0 ? 'red' : 'green'}>Kâr marjı <b>%{margin}</b> · birim kâr {money(fields.sale_price - fields.purchase_price)}</p>}
            </div>
          </>}

          <div className="rq-qty">
            <div className="vx-field">Eklenecek miktar ({unit})
              <div className="vx-stepper rq-stepper">
                <button type="button" aria-label="Azalt" onClick={() => edit('quantity', String(Math.max(1, qty - 1)))}><Minus size={18} /></button>
                <input required type="number" min="1" max="1000000" step="1" inputMode="numeric" disabled={busy} value={fields.quantity} onChange={e => edit('quantity', e.target.value)} aria-label="Miktar" />
                <button type="button" aria-label="Artır" onClick={() => edit('quantity', String(qty + 1))}><Plus size={18} /></button>
              </div>
            </div>
            <div className="vx-chips">{QUICK.map(n => <button key={n} type="button" onClick={() => edit('quantity', String(n))}>{n}</button>)}</div>
            {product && stock !== null && qty > 0 && <p className="rq-after">Ekleme sonrası mağaza stoğu <b>{num(stock + qty)} {unit}</b></p>}
          </div>

          <div className="rq-submit">
            <button type="button" className="vx-btn" onClick={reset} disabled={busy}><Undo2 size={15} /> Vazgeç</button>
            <button disabled={busy || !warehouse} className="vx-btn" data-variant="green">{busy ? 'Kaydediliyor…' : product ? <><PackagePlus size={16} /> Stoğa ekle</> : <><PackagePlus size={16} /> Oluştur ve stoğa ekle</>}</button>
          </div>
          <p className="rq-note">Tam birim eklenir. Tartılı/ondalıklı kabul ve kasa satışı bu ekranın kapsamında değildir.</p>
        </form>}
      </div>

      <aside className="rq-side">
        <div className="rq-card">
          <div className="rq-side-head"><History size={16} /><b>Bu oturumda eklenenler</b></div>
          <div className="rq-totals"><div><span>Kalem</span><b>{history.length}</b></div><div><span>Toplam birim</span><b>{num(sessionUnits)}</b></div></div>
          {history.length ? <ul className="rq-history">
            {history.map(h => <li key={h.id}>
              <i><CheckCircle2 size={15} /></i>
              <span><b>{h.name}</b><small>{h.at.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} · mağaza stoğu {num(h.total)}{h.created ? ' · yeni ürün' : ''}</small></span>
              <strong>+{num(h.quantity)}</strong>
            </li>)}
          </ul> : <p className="rq-side-empty">Eklediğiniz ürünler burada listelenir.</p>}
        </div>
        <Link className="rq-link" to="/normal-depo/products">Tüm ürünleri görüntüle <ArrowRight size={14} /></Link>
      </aside>
    </div>
  </section>;
}
