import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Check, List, Search, X, AlertTriangle } from 'lucide-react';
import api from '../../api/client';
import BarcodeCamera from '../../components/BarcodeCamera';
import { asList } from '../../lib/stockAnalytics';
import { chooseSummary, createLabelLog, createOutbox, createProductList, flushOutbox, parsePrice } from '../../lib/mobileHub.mjs';
import { readSessionUser } from '../../lib/sessionUser';
import { ConfirmBox, Sheet, money, sessionScope } from './mobileKit';

const STORE_KEY = 'vx-m-store';

// Kamera ekranı: "Etiket Kontrol" (raftaki etiket fiyatı ile sistem fiyatı) ve "Fiyat Gör" (ürün ve fiyat listesi).
export default function MobileScan() {
  const navigate = useNavigate(), [params, setParams] = useSearchParams();
  const mode = params.get('mod') === 'fiyat' ? 'fiyat' : 'etiket';
  const user = readSessionUser();
  const [stores, setStores] = useState([]), [storeId, setStoreId] = useState(() => { try { return localStorage.getItem(STORE_KEY) || ''; } catch { return ''; } });
  const store = stores.find(s => String(s.id) === String(storeId)) || stores[0] || null;
  const scope = sessionScope() + ':' + (store?.id ?? 'x');
  const labels = useMemo(() => createLabelLog(window.localStorage, scope), [scope]);
  const list = useMemo(() => createProductList(window.localStorage, sessionScope()), []);
  const outbox = useMemo(() => createOutbox(window.localStorage, scope), [scope]);
  const [log, setLog] = useState(() => ({ correct: 0, wrong: [] })), [items, setItems] = useState(() => list.load());
  const [product, setProduct] = useState(null), [message, setMessage] = useState(''), [notice, setNotice] = useState(''), [shelf, setShelf] = useState(''), [verdict, setVerdict] = useState(null);
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [paused, setPaused] = useState(false), [resume, setResume] = useState(0);
  const [wrongOpen, setWrongOpen] = useState(false), [leave, setLeave] = useState(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => { api.get('/warehouses').then(r => { if (live.current) setStores(asList(r.data)); }).catch(() => {}); }, []);
  // Etiket kontrolleri sunucuya gönderilir (tüm cihazlar aynı mağaza özetini görür); bağlantı yoksa cihazda sıraya girer.
  async function sync() {
    if (!store) return;
    await flushOutbox(outbox, item => api.post('/label-checks', item));
    try {
      const server = (await api.get('/label-checks', { params: { warehouse_id: store.id } })).data;
      if (live.current) setLog(chooseSummary(labels.load(), server, outbox.load().length));
    } catch { /* yerel durum gösterilir */ }
  }
  useEffect(() => { setLog(labels.load()); sync(); }, [labels, store?.id]);
  useEffect(() => { try { if (store) localStorage.setItem(STORE_KEY, String(store.id)); } catch { /* yok say */ } }, [store]);

  const next = () => { setProduct(null); setMessage(''); setNotice(''); setShelf(''); setVerdict(null); setCode(''); setPaused(false); setResume(n => n + 1); };
  async function lookup(value) {
    const barcode = String(value || '').trim();
    if (!barcode || busy) return;
    setBusy(true); setPaused(true); setMessage(''); setVerdict(null); setShelf('');
    try {
      const r = await api.get('/retail/lookup', { params: { barcode } });
      if (!live.current) return;
      if (r.data?.product) setProduct({ ...r.data.product, barcode: r.data.product.barcode || barcode });
      else { setProduct(null); setMessage('Ürün bulunamadı: ' + barcode); }
    } catch (e) { if (live.current) { setProduct(null); setMessage(e.response?.data?.error || 'Ürün sorgulanamadı.'); } }
    finally { if (live.current) setBusy(false); }
  }
  function compare() {
    const entered = parsePrice(shelf);
    if (entered === null) { setMessage('Etiketteki fiyatı yazın (örn. 29,90).'); return; }
    setMessage('');
    const result = labels.record({ barcode: product.barcode, id: product.id, name: product.name, shelf: entered, system: Number(product.sale_price) });
    setLog({ correct: result.correct, wrong: result.wrong }); setVerdict(result.ok ? 'ok' : 'bad');
    if (store) outbox.add({ id: crypto.randomUUID(), warehouse_id: store.id, barcode: product.barcode, product_id: product.id ?? null, product_name: product.name, shelf_price: entered, system_price: Number(product.sale_price), checked_at: new Date().toISOString() });
    sync();
  }
  function add() { setItems(list.add({ barcode: product.barcode, id: product.id, name: product.name, price: Number(product.sale_price) })); setNotice('Listeye eklendi.'); }
  const close = () => { if (mode === 'fiyat' && items.length) setLeave(true); else navigate('/m'); };
  const total = log.correct + log.wrong.length;

  const toolbar = <div className="reader-camera-mode" role="group" aria-label="Çalışma modu">
    <button type="button" aria-pressed={mode === 'etiket'} onClick={() => { setParams({ mod: 'etiket' }); next(); }}>Etiket Kontrol</button>
    <button type="button" aria-pressed={mode === 'fiyat'} onClick={() => { setParams({ mod: 'fiyat' }); next(); }}>Fiyat Gör</button>
  </div>;

  const searchBox = <form className="vm-search" onSubmit={e => { e.preventDefault(); lookup(code); }}>
    <Search size={18} /><input inputMode="numeric" placeholder="Ürün Kodu veya Barkod Ara" aria-label="Barkod veya ürün kodu" value={code} onChange={e => setCode(e.target.value)} />
    {code && <button type="button" aria-label="Temizle" className="vm-iconbtn" style={{ width: 30, height: 30, background: 'none', color: 'inherit' }} onClick={() => setCode('')}><X size={16} /></button>}
  </form>;

  const panel = <div className="vm-panel">
    {store && <div style={{ marginBottom: 8 }}>
      <label className="vm-note" style={{ display: 'block' }}>Mağaza Kodu: <b>{store.code || store.warehouse_code || store.id}</b>
        {stores.length > 1 && <select aria-label="Mağaza seç" value={store.id} onChange={e => setStoreId(e.target.value)} style={{ marginLeft: 8, maxWidth: 190 }}>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
      </label>
      <div className="vm-note">{user.full_name || user.email}</div>
    </div>}
    {searchBox}
    {message && <p role="alert" className="vm-err">{message}</p>}
    {notice && <p role="status" className="vm-note" style={{ color: 'var(--vm-good)' }}>{notice}</p>}
    {product && <div className="vm-card" role="status" style={{ marginBottom: 10 }}>
      <b>{product.name}</b><div className="vm-note">{product.barcode}</div>
      <div className="vm-money" style={{ fontSize: 24 }}>{money(product.sale_price)}</div>
      {mode === 'etiket' && !verdict && <>
        <div className="vm-price-in"><input inputMode="decimal" aria-label="Etiketteki fiyat" placeholder="Etiket fiyatı" value={shelf} onChange={e => setShelf(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') compare(); }} /><button type="button" className="vm-btn" style={{ width: 'auto', padding: '0 18px' }} onClick={compare}>Karşılaştır</button></div></>}
      {mode === 'etiket' && verdict && <p role="status" style={{ fontWeight: 700, color: verdict === 'ok' ? 'var(--vm-good)' : 'var(--vm-bad)' }}>{verdict === 'ok' ? <><Check size={16} /> Etiket doğru</> : <><AlertTriangle size={16} /> Etiket hatalı, güncellenmeli</>}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button type="button" className="vm-btn ghost" onClick={next}>Sonraki</button>
      </div>
    </div>}
    {mode === 'etiket' && <>
      <div className="vm-counts"><div className="vm-count ok"><Check size={22} /><div><b>{log.correct}</b><small>Doğru</small></div></div><div className="vm-count bad"><X size={22} /><div><b>{log.wrong.length}</b><small>Hatalı</small></div></div></div>
      <p className="vm-note">Bugün toplam {total} etiket kontrol edildi.</p>
      <button type="button" className="vm-btn" onClick={() => setWrongOpen(true)}>Hatalı Etiketleri Gör</button></>}
    {mode === 'fiyat' && <div style={{ display: 'flex', gap: 10 }}>
      <button type="button" className="vm-btn soft" disabled={!product || busy} onClick={add}>Listeye Ekle</button>
      <Link to="/m/liste" className="vm-btn"><List size={16} /> Listeyi Gör{items.length ? ' (' + items.length + ')' : ''}</Link></div>}
  </div>;

  return <div className="vm" style={{ padding: 0 }}>
    <BarcodeCamera fullScreen continuous paused={paused} resumeKey={resume} onCode={lookup} onClose={close} toolbar={toolbar} bottomPanel={panel} />
    {wrongOpen && <Sheet onClose={() => setWrongOpen(false)} label="Hatalı etiketler">
      <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>Hatalı Etiketler</h2>
      {log.wrong.length === 0 ? <p className="vm-note">Bugün hatalı etiket yok.</p> :
        <div className="vm-list">{log.wrong.map(w => <div key={w.barcode} className="vm-row"><span className="grow">{w.name}<small>{w.barcode}</small></span><span style={{ textAlign: 'right' }}>Etiket {money(w.shelf)}<small>Sistem {money(w.system)}</small></span></div>)}</div>}
      {log.wrong.length > 0 && <Link to={'/magaza/etiketler?products=' + log.wrong.map(w => w.id).filter(Boolean).join(',')} className="vm-btn" style={{ marginTop: 12 }} onClick={() => setWrongOpen(false)}>Etiketleri Yazdır</Link>}
      <button type="button" className="vm-btn ghost" style={{ marginTop: 10 }} onClick={() => setWrongOpen(false)}>Kapat</button>
    </Sheet>}
    {leave && <ConfirmBox title="Tamamlamadan çıkmak istediğine emin misin?" text="Listede ürünler var. Çıkarsan bu liste bu cihazda kalır ama yazdırma işlemini yapmamış olursun." onNo={() => setLeave(false)} onYes={() => navigate('/m')} />}
  </div>;
}
