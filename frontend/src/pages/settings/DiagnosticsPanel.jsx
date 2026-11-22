import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { classifyScan, printerStatusText } from '../../lib/scannerProbe.mjs';
import { STATUS_META, mergeScans, offlineQueueResult, barcodeResult, exportPayload } from '../../lib/diagnosticsView.mjs';
import { createOfflineQueue } from '../../lib/offline/offlineQueue.mjs';
import { salesStore } from '../../lib/offline/offlineStore';

const when = iso => { try { return new Date(iso).toLocaleString('tr-TR'); } catch { return iso; } };
const LEVEL = { ok: 'Her şey yolunda', warn: 'Dikkat gerektiren noktalar var', fail: 'Sorun var' };

// Veniux Tanılama: masaüstü ölçümleri (IPC), sunucu ölçümleri (/diagnostics/app) ve bu cihazın çevrimdışı kuyruğu tek taramada.
// Yalnız ölçer ve öneri verir; onarım yapmaz. Destek paketi kullanıcının seçtiği yere kaydedilir, otomatik gönderilmez.
export default function DiagnosticsPanel() {
  const desktop = typeof window !== 'undefined' ? window.veniuxDesktop : null;
  const hasEngine = !!desktop?.diagRun;
  const { showToast } = useToast();
  const [catalog, setCatalog] = useState([]);
  const [scan, setScan] = useState(null);
  const [server, setServer] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [manual, setManual] = useState({});
  const [printers, setPrinters] = useState([]);
  const [printer, setPrinter] = useState('');
  const [probe, setProbe] = useState(null);
  const times = useRef([]);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!hasEngine) return undefined;
    desktop.diagList().then(setCatalog).catch(() => {});
    desktop.diagHistory().then(setHistory).catch(() => {});
    desktop.diagPrinters().then(l => { setPrinters(l); if (l[0]) setPrinter(l[0].name); }).catch(() => {});
    return desktop.onDiagProgress?.(p => setProgress(p));
  }, [hasEngine, desktop]);

  const screenResults = useCallback(async () => {
    let counts = null;
    try { counts = await createOfflineQueue(salesStore).counts(); } catch { /* depo yok */ }
    return { results: [offlineQueueResult(counts), ...Object.values(manual)] };
  }, [manual]);

  const serverResults = useCallback(async () => {
    try { const { data } = await api.get('/diagnostics/app'); setServer(data); return data; }
    catch (e) {
      const status = e.response?.status;
      return { results: [{ id: 'app.server', group: 'Ağ ve bulut', name: 'Sunucu tanılaması', status: status === 403 ? 'unavailable' : 'fail', summary: status === 403 ? 'Bu hesapta yetki yok (yönetici gerekir).' : 'Sunucuya ulaşılamadı.', ms: 0, advice: status === 403 ? undefined : 'İnternet/yerel sunucu bağlantısını kontrol edin.' }] };
    }
  }, []);

  async function run(request) {
    if (busy) return;
    setBusy(true); setProgress(null); cancelled.current = false;
    try {
      const desktopScan = hasEngine ? await desktop.diagRun(request) : null;
      const single = request.id && !/^app\./.test(request.id) ? true : false;
      const parts = [desktopScan];
      if (!single && !cancelled.current) { parts.push(await serverResults(), await screenResults()); }
      const merged = mergeScans(parts);
      if (desktopScan) merged.mode = desktopScan.mode;
      setScan(merged);
      if (hasEngine) desktop.diagHistory().then(setHistory).catch(() => {});
    } catch (e) { showToast(e?.message || 'Tarama çalıştırılamadı.', 'error'); }
    finally { setBusy(false); setProgress(null); }
  }
  const cancel = () => { cancelled.current = true; desktop?.diagCancel?.(); };

  async function exportPackage() {
    try {
      const r = await desktop.diagExport(exportPayload(scan, server));
      if (r.saved) showToast('Destek paketi kaydedildi: ' + r.name + '. Dosyayı WhatsApp veya e-postayla destek ekibine kendiniz gönderin.', 'success');
    } catch (e) { showToast(e?.message || 'Destek paketi kaydedilemedi.', 'error'); }
  }
  async function backupNow() {
    if (!window.confirm('Şimdi yedek alınsın mı?')) return;
    try { await api.post('/backup'); showToast('Yedek alındı.', 'success'); } catch (e) { showToast(e.response?.data?.error || 'Yedek alınamadı.', 'error'); }
  }
  async function testPrint() {
    try {
      const r = await desktop.diagTestPrint(printer);
      showToast(r.printed ? 'Deneme fişi yazıcıya gönderildi. Çıktıyı kontrol edin.' : 'Yazdırılamadı: ' + r.reason, r.printed ? 'success' : 'error');
      setManual(m => ({ ...m, 'dev.test-print': { id: 'dev.test-print', group: 'Cihazlar', name: 'Deneme fişi: ' + printer, status: r.printed ? 'ok' : 'fail', summary: r.printed ? 'Yazıcıya gönderildi (çıktıyı gözle doğrulayın).' : 'Yazdırılamadı: ' + r.reason, ms: 0 } }));
    } catch (e) { showToast(e?.message || 'Deneme fişi gönderilemedi.', 'error'); }
  }

  // Barkod testi: kutuya okutulur; 20 sn içinde bir şey gelmezse "algılanmadı".
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setTimeout(() => { setWaiting(false); setManual(m => ({ ...m, 'dev.barcode': barcodeResult(null, true) })); }, 20000);
    return () => clearTimeout(t);
  }, [waiting]);
  function onKey(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const c = classifyScan(times.current, event.currentTarget.value);
      times.current = []; event.currentTarget.value = '';
      setProbe(c); setWaiting(false);
      setManual(m => ({ ...m, 'dev.barcode': barcodeResult(c, false) }));
      return;
    }
    if (event.key.length === 1) times.current.push(performance.now());
  }

  const groups = scan ? [...new Set(scan.results.map(r => r.group || 'Diğer'))] : [];
  return (
    <section className="veniux-card p-4 space-y-4" data-testid="diagnostics-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Veniux Tanılama</h2>
          <p className="text-sm text-slate-500">Bilgisayarın, ağın, verinin ve cihazların gerçek durumunu ölçer. Hiçbir şeyi değiştirmez; sorun varsa öneri verir.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => run({ mode: 'quick' })}>Hızlı tarama</button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => run({ mode: 'full' })}>Tam tarama</button>
          {busy && <button type="button" className="btn-secondary" onClick={cancel}>İptal</button>}
        </div>
      </div>
      {!hasEngine && <p className="text-sm bg-slate-50 border border-slate-200 rounded p-3" role="status">Bilgisayar ölçümleri (bellek, disk, yedek, yazıcı) yalnız Veniux masaüstü programında çalışır; tarayıcıda sunucu ve kuyruk ölçümleri yapılır, diğerleri "Ölçülemedi" görünür.</p>}
      {busy && <div role="status" className="text-sm" data-testid="diag-progress">Taranıyor{progress?.total ? ` · ${progress.done}/${progress.total}` : '…'}{progress?.current ? ` · ${progress.current}` : ''}<div className="h-1.5 bg-slate-200 rounded mt-1"><div className="h-1.5 bg-brand-500 rounded" style={{ width: progress?.total ? Math.round(progress.done / progress.total * 100) + '%' : '10%' }} /></div></div>}

      {scan && (<>
        <div className={'rounded-lg border p-3 flex flex-wrap items-center gap-3 ' + STATUS_META[scan.level].tone} data-testid="diag-summary" data-level={scan.level}>
          <strong>{LEVEL[scan.level]}</strong>
          <span className="text-sm">{['ok', 'warn', 'fail', 'timeout', 'unavailable', 'cancelled'].filter(s => scan.count[s]).map(s => `${scan.count[s]} ${STATUS_META[s].label.toLowerCase()}`).join(' · ')}</span>
          <span className="text-xs ml-auto">{when(scan.at)}</span>
        </div>
        {groups.map(g => (
          <div key={g} className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{g}</h3>
            {scan.results.filter(r => (r.group || 'Diğer') === g).map(r => (
              <div key={r.id} className="p-2.5 rounded-lg border border-slate-200 bg-white flex flex-wrap items-start gap-2" data-testid="diag-row" data-status={r.status}>
                <span className={'text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ' + STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{r.name}</div>
                  <div className="text-sm text-slate-600 break-words">{r.summary}{r.detail ? ' · ' + r.detail : ''}</div>
                  {r.advice && <div className="text-xs text-amber-800 mt-0.5">Öneri: {r.advice}</div>}
                </div>
                <span className="text-xs text-slate-400">{r.ms} ms</span>
                {hasEngine && /^(sys|data|net|dev)\./.test(r.id) && r.id !== 'dev.barcode' && r.id !== 'dev.test-print' && <button type="button" className="text-xs underline" disabled={busy} onClick={() => run({ id: r.id })}>Yeniden dene</button>}
              </div>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {hasEngine && <button type="button" className="btn-secondary" onClick={exportPackage}>Destek paketi oluştur</button>}
          <button type="button" className="btn-secondary" onClick={backupNow}>Şimdi yedek al</button>
        </div>
        {hasEngine && <p className="text-xs text-slate-500">Destek paketi parola, anahtar, e-posta, telefon, IBAN ve müşteri bilgilerinden arındırılır, kaydedeceğiniz yeri siz seçersiniz ve hiçbir yere otomatik gönderilmez.</p>}
      </>)}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="p-3 rounded-lg border border-slate-200 space-y-2">
          <h3 className="font-semibold text-sm">Barkod okuyucu testi</h3>
          <p className="text-xs text-slate-500">Başlatıp kutuya bir ürünün barkodunu okuyucuyla okutun (20 sn).</p>
          <button type="button" className="btn-secondary" onClick={() => { setProbe(null); setWaiting(true); }}>{waiting ? 'Bekleniyor…' : 'Testi başlat'}</button>
          <input aria-label="Barkod test kutusu" className="border rounded p-2 w-full" disabled={!waiting} onKeyDown={onKey} placeholder="Barkodu buraya okutun" autoComplete="off" />
          {probe && <p className="text-sm" role="status">{manual['dev.barcode']?.summary}</p>}
          {!waiting && !probe && manual['dev.barcode'] && <p className="text-sm" role="status">{manual['dev.barcode'].summary}</p>}
        </div>
        <div className="p-3 rounded-lg border border-slate-200 space-y-2">
          <h3 className="font-semibold text-sm">Yazıcı deneme fişi</h3>
          {!hasEngine ? <p className="text-xs text-slate-500">Yalnız masaüstü programında.</p> : printers.length === 0 ? <p className="text-xs text-slate-500">Windows'ta tanımlı yazıcı bulunamadı.</p> : (<>
            <select aria-label="Yazıcı" className="border rounded p-2 w-full" value={printer} onChange={e => setPrinter(e.target.value)}>{printers.map(p => <option key={p.name} value={p.name}>{p.name} · {printerStatusText(p.status)}</option>)}</select>
            <button type="button" className="btn-secondary" onClick={testPrint}>Deneme fişi yazdır</button>
            <p className="text-xs text-slate-500">Mali fiş değildir; yalnız yazıcıyı sınar.</p>
          </>)}
        </div>
      </div>

      {hasEngine && catalog.length > 0 && <details className="text-sm"><summary className="cursor-pointer font-semibold">Testler ({catalog.length}) ve geçmiş ({history.length})</summary>
        <ul className="mt-2 space-y-1">{catalog.map(t => <li key={t.id}><strong>{t.name}</strong> <span className="text-slate-500">— {t.description}{t.quick ? ' (hızlı taramada)' : ''}</span></li>)}</ul>
        <h4 className="font-semibold mt-3">Son taramalar</h4>
        {history.length === 0 ? <p className="text-slate-500">Henüz tarama yok.</p> : <ul className="space-y-1">{history.map(h => <li key={h.id} className="flex gap-2"><span className={'text-[11px] font-bold px-2 rounded-full border ' + STATUS_META[h.level].tone}>{STATUS_META[h.level].label}</span><span>{when(h.at)} · {h.mode === 'quick' ? 'hızlı' : h.mode === 'single' ? 'tek test' : 'tam'} · {h.results.length} test</span></li>)}</ul>}
      </details>}
    </section>
  );
}
