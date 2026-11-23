import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle2, Minus, PackagePlus, Plus, ScanLine, Trash2, Undo2 } from 'lucide-react';
import api from '../api/client';
import BarcodeCamera from '../components/BarcodeCamera';
import { addEntry, chunk, parseDraft, patchRow, readiness, removeRow, serializeDraft, setQuantity, toLines, UNITS } from '../lib/bulkReceive.mjs';
import { currencySymbol } from '../../../shared/money.mjs';
import './RetailQuickAdd.css';
import './RetailBulkReceive.css';

const DRAFT_KEY = 'veniux-bulk-receive-draft';
const STEPS = [1, 6, 10, 12, 24];
const num = v => Number(v || 0).toLocaleString('tr-TR');

export default function RetailBulkReceive() {
  const [rows, setRowsState] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouse, setWarehouse] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState(1);
  const [camera, setCamera] = useState(false);
  const [resumeKey, setResumeKey] = useState(0);
  const [pending, setPending] = useState(0);
  const [last, setLast] = useState(null);
  const [error, setError] = useState('');
  const [rowErrors, setRowErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const [restored, setRestored] = useState(0);
  const rowsRef = useRef([]), stepRef = useRef(1), queue = useRef(Promise.resolve()), input = useRef(null), keys = useRef(new Map());
  stepRef.current = step;

  const setRows = useCallback(next => {
    const value = typeof next === 'function' ? next(rowsRef.current) : next;
    rowsRef.current = value; setRowsState(value); setConfirming(false);
  }, []);

  useEffect(() => {
    api.get('/normal-depo/warehouses')
      .then(r => {
        setWarehouses(r.data);
        let saved = null;
        try { saved = parseDraft(localStorage.getItem(DRAFT_KEY) || ''); } catch { /* depolama yok */ }
        const ids = r.data.map(w => String(w.id));
        setWarehouse(saved?.warehouse && ids.includes(saved.warehouse) ? saved.warehouse : String(r.data[0]?.id || ''));
        if (saved?.rows.length) { setRows(saved.rows); setRestored(saved.rows.length); }
      })
      .catch(() => setError('Mağaza bilgisi yüklenemedi. Sayfayı yenileyin.'));
  }, [setRows]);

  // Taslak: sayfa yenilense ya da bağlantı kopsa yüzlerce satır kaybolmaz.
  useEffect(() => {
    try { if (rows.length) localStorage.setItem(DRAFT_KEY, serializeDraft(rows, warehouse)); else localStorage.removeItem(DRAFT_KEY); } catch { /* depolama yok */ }
  }, [rows, warehouse]);

  // Tek barkod: listede varsa miktarı artır (ağ yok); yoksa kendi katalog → dış öneri → boş satır (elle doldurulur).
  const handle = useCallback(async raw => {
    const barcode = raw.trim();
    if (!barcode) return;
    const existing = rowsRef.current.find(r => r.barcode && (r.barcode === barcode || (/^\d+$/.test(barcode) && r.barcode.replace(/^0+/, '') === barcode.replace(/^0+/, ''))));
    if (existing) {
      const out = addEntry(rowsRef.current, { barcode: existing.barcode }, stepRef.current);
      setRows(out.rows); setLast({ name: existing.name || barcode, text: '+' + stepRef.current + ' → ' + out.row.quantity, tone: 'ok' });
      return;
    }
    let entry;
    try {
      const r = await api.get('/retail/lookup', { params: { barcode } });
      if (r.data.product) {
        entry = { kind: 'existing', barcode, product_id: r.data.product.id, name: r.data.product.name, unit: r.data.product.unit, pack: r.data.pack || null, source: 'Kayıtlı ürün' };
      } else {
        let s = null;
        try { s = (await api.get('/retail/lookup/suggest', { params: { barcode } })).data; } catch { /* öneri yoksa elle */ }
        const sg = s && s.suggestion && s.source !== 'catalog' && s.source !== 'none' ? s : null;
        entry = { kind: 'new', barcode, name: sg ? (sg.suggestion.suggested_name || sg.suggestion.name) : '', unit: sg?.suggestion.suggested_unit || 'adet', purchase_price: '', sale_price: '', source: sg ? (sg.attribution?.source || 'Katalog') + ' önerisi' : 'Katalogda yok', checksum_ok: s ? s.checksum_ok : undefined };
      }
    } catch (e) {
      entry = { kind: 'new', barcode, name: '', unit: 'adet', purchase_price: '', sale_price: '', source: 'Sorgulanamadı: elle doldurun' };
    }
    const out = addEntry(rowsRef.current, entry, stepRef.current);
    setRows(out.rows);
    setLast({ name: entry.name || barcode, text: entry.kind === 'new' ? (entry.name ? 'yeni ürün: fiyat girin' : 'tanınmadı: ad ve fiyat girin') : 'eklendi (' + out.row.quantity + ')', tone: entry.kind === 'new' ? 'warn' : 'ok' });
  }, [setRows]);

  // Okutmalar sırayla işlenir: art arda okutulan barkodlar birbirini ezmez.
  const scan = useCallback(raw => {
    setError(''); setDone(null);
    setPending(n => n + 1);
    queue.current = queue.current.then(() => handle(String(raw))).catch(() => setError('Barkod işlenemedi; yeniden okutun.')).finally(() => { setPending(n => n - 1); setResumeKey(k => k + 1); });
  }, [handle]);

  const submitCode = e => { e.preventDefault(); const v = code; setCode(''); scan(v); input.current?.focus(); };

  const state = useMemo(() => readiness(rows), [rows]);
  const issueOf = useMemo(() => Object.fromEntries(state.problems.map(p => [p.id, p.issues])), [state]);

  async function commit() {
    setSaving(true); setError(''); setRowErrors({}); setDone(null);
    let lines = 0, units = 0, news = 0, batches = 0;
    try {
      for (const part of chunk(rowsRef.current)) {
        const payload = { warehouse_id: warehouse, lines: toLines(part) };
        // Aynı liste aynı anahtarla gider: bağlantı kopup yeniden denenirse stok ikinci kez eklenmez.
        const sig = JSON.stringify(payload);
        if (!keys.current.has(sig)) keys.current.set(sig, crypto.randomUUID());
        try {
          const r = await api.post('/retail/receive/batch', payload, { headers: { 'Idempotency-Key': keys.current.get(sig) } });
          lines += r.data.line_count; units += r.data.total_units; news += r.data.new_products; batches++;
          const gone = new Set(part.map(p => p.id));
          setRows(rowsRef.current.filter(r2 => !gone.has(r2.id)));
          keys.current.delete(sig);
        } catch (e) {
          const body = e.response?.data;
          if (body?.line_errors) setRowErrors(Object.fromEntries(body.line_errors.map(x => [part[x.index]?.id, x.error])));
          else if (body?.line_index !== undefined && part[body.line_index]) setRowErrors({ [part[body.line_index].id]: body.error });
          setError((body?.error || 'Kayıt sonucu alınamadı. Listeyi değiştirmeden tekrar deneyebilirsiniz.') + (batches ? ' (' + lines + ' satır önceki parçada kaydedildi.)' : ' Hiçbir şey kaydedilmedi.'));
          break;
        }
      }
    } finally { setSaving(false); }
    if (lines) { setDone({ lines, units, news }); try { if (!rowsRef.current.length) localStorage.removeItem(DRAFT_KEY); } catch { /* */ } }
  }

  const clearAll = () => { if (rows.length && !window.confirm(rows.length + ' satırlık listeyi temizlemek istiyor musunuz? Kaydedilmemiş okutmalar silinir.')) return; setRows([]); setRowErrors({}); setRestored(0); setLast(null); input.current?.focus(); };
  const addBlank = () => { const out = addEntry(rowsRef.current, { kind: 'new', barcode: '', name: '', unit: 'adet', purchase_price: '', sale_price: '', source: 'Elle eklendi' }, 1); setRows(out.rows); };

  return (
    <div className="rq rbr">
      <header className="rq-head">
        <div>
          <span className="rq-eyebrow">Mal kabul</span>
          <h1>Toplu mal kabul</h1>
          <p>Barkodları art arda okutun; ürün tanınır, listeye eklenir. Bitince tek onayla hepsi stoğa girer.</p>
        </div>
        <label className="rq-store"><PackagePlus size={18} /><span><small>Mağaza</small>
          <select value={warehouse} onChange={e => setWarehouse(e.target.value)} disabled={saving} aria-label="Mağaza">
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select></span></label>
      </header>

      <section className="rq-card rbr-scan">
        <form onSubmit={submitCode} className="rbr-form">
          <label className="rq-label" htmlFor="rbr-code">Barkod</label>
          <div className="rbr-row">
            <input id="rbr-code" ref={input} autoFocus inputMode="numeric" autoComplete="off" placeholder="Okutun ya da yazıp Enter'a basın" value={code} onChange={e => setCode(e.target.value)} disabled={saving} />
            <button type="submit" className="btn-soft" disabled={saving || !code.trim()}><ScanLine size={16} /> Ekle</button>
            <button type="button" className="btn-soft" onClick={() => setCamera(c => !c)}><Camera size={16} /> {camera ? 'Kamerayı kapat' : 'Kamera'}</button>
          </div>
        </form>
        <div className="rbr-steps" role="group" aria-label="Her okutmada eklenecek adet">
          <span>Her okutma:</span>
          {STEPS.map(s => <button key={s} type="button" className={'rq-chip' + (step === s ? ' on' : '')} aria-pressed={step === s} onClick={() => { setStep(s); input.current?.focus(); }}>×{s}</button>)}
        </div>
        {camera && <div className="rbr-camera"><BarcodeCamera continuous resumeKey={resumeKey} onCode={scan} onClose={() => setCamera(false)} /></div>}
        <div className="rbr-last" role="status" aria-live="polite">
          {pending > 0 ? 'Aranıyor…' : last ? <span className={'rbr-tone-' + last.tone}><b>{last.name}</b> — {last.text}</span> : 'Henüz okutma yok.'}
        </div>
      </section>

      {restored > 0 && <p className="rq-hint" role="status">Kaydedilmemiş liste geri yüklendi ({restored} satır). Kontrol edip kaydedin ya da temizleyin.</p>}
      {error && <p className="rq-alert" role="alert">{error}</p>}
      {done && <section className="rq-card rq-pop" role="status"><CheckCircle2 size={20} /> <b>{num(done.lines)} satır kaydedildi</b> — {num(done.units)} adet stoğa girdi{done.news ? `, ${num(done.news)} yeni ürün oluşturuldu` : ''}.</section>}

      <section className="rq-card rbr-list">
        <div className="rbr-bar">
          <strong>{num(state.lines)} satır · {num(state.units)} adet{state.news ? ` · ${num(state.news)} yeni ürün` : ''}</strong>
          <span className="rbr-actions">
            <button type="button" className="btn-soft" onClick={addBlank} disabled={saving}><Plus size={14} /> Satır ekle</button>
            <button type="button" className="btn-soft" onClick={clearAll} disabled={saving || !rows.length}><Undo2 size={14} /> Temizle</button>
          </span>
        </div>
        {!rows.length ? <p className="rq-hint">Liste boş. İlk barkodu okutun.</p> : (
          <div className="rbr-scroll">
            <table className="rbr-table">
              <thead><tr><th>#</th><th>Ürün</th><th>Adet</th><th>Alış ({currencySymbol()})</th><th>Satış ({currencySymbol()})</th><th><span className="sr-only">Sil</span></th></tr></thead>
              <tbody>
                {[...rows].reverse().map((r, i) => {
                  const issues = issueOf[r.id] || [], err = rowErrors[r.id];
                  return (
                    <tr key={r.id} className={(issues.length ? 'rbr-bad ' : '') + (err ? 'rbr-err' : '')}>
                      <td>{rows.length - i}</td>
                      <td>
                        {r.kind === 'new'
                          ? <input aria-label="Ürün adı" className="rbr-name" placeholder="Ürün adı" value={r.name} onChange={e => setRows(patchRow(rowsRef.current, r.id, { name: e.target.value }))} />
                          : <b>{r.name}</b>}
                        <small>{r.barcode || 'barkodsuz'} · {r.source}{r.pack ? ` · ${r.pack.unit} ×${r.pack.factor}` : ''}{r.checksum_ok === false ? ' · sağlama basamağı tutmuyor' : ''}</small>
                        {r.kind === 'new' && <select aria-label="Birim" value={r.unit} onChange={e => setRows(patchRow(rowsRef.current, r.id, { unit: e.target.value }))}>{UNITS.map(u => <option key={u}>{u}</option>)}</select>}
                        {err ? <em className="rbr-msg">{err}</em> : issues.length > 0 && <em className="rbr-msg">{issues[0]}</em>}
                      </td>
                      <td>
                        <span className="rbr-qty">
                          <button type="button" aria-label="Azalt" onClick={() => setRows(setQuantity(rowsRef.current, r.id, r.quantity - 1))} disabled={r.quantity <= 1}><Minus size={14} /></button>
                          <input aria-label="Adet" inputMode="numeric" value={r.quantity} onChange={e => setRows(setQuantity(rowsRef.current, r.id, e.target.value))} />
                          <button type="button" aria-label="Artır" onClick={() => setRows(setQuantity(rowsRef.current, r.id, r.quantity + 1))}><Plus size={14} /></button>
                        </span>
                      </td>
                      <td>{r.kind === 'new' ? <input aria-label="Alış fiyatı" inputMode="decimal" value={r.purchase_price} onChange={e => setRows(patchRow(rowsRef.current, r.id, { purchase_price: e.target.value }))} /> : '—'}</td>
                      <td>{r.kind === 'new' ? <input aria-label="Satış fiyatı" inputMode="decimal" value={r.sale_price} onChange={e => setRows(patchRow(rowsRef.current, r.id, { sale_price: e.target.value }))} /> : '—'}</td>
                      <td><button type="button" aria-label="Satırı sil" className="rbr-del" onClick={() => setRows(removeRow(rowsRef.current, r.id))}><Trash2 size={15} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="rbr-confirm">
          {state.problems.length > 0 && <span className="rq-hint">{state.problems.length} satırda eksik var; tamamlanınca kaydedilebilir.</span>}
          {!confirming
            ? <button type="button" className="rbr-primary" disabled={!state.ready || saving || !warehouse || pending > 0} onClick={() => setConfirming(true)}>Hepsini kaydet ({num(state.lines)} satır)</button>
            : <span className="rbr-ask"><b>{num(state.lines)} satır, {num(state.units)} adet stoğa eklenecek{state.news ? `; ${num(state.news)} yeni ürün oluşacak` : ''}.</b>
              <button type="button" className="rbr-primary" disabled={saving} onClick={commit}>{saving ? 'Kaydediliyor…' : 'Onayla ve kaydet'}</button>
              <button type="button" className="btn-soft" disabled={saving} onClick={() => setConfirming(false)}>Vazgeç</button></span>}
        </div>
      </section>
      <p className="rq-hint"><Link to="/magaza/hizli-ekle">Tek ürün ekle</Link> · Liste bu cihazda saklanır; yenileseniz de kaybolmaz.</p>
    </div>
  );
}

