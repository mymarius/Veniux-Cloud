import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, FileSpreadsheet, RefreshCw, Upload, XCircle } from 'lucide-react';
import api from '../../../api/client';
import { useToast } from '../../Toast';
import { Panel } from '../../dashboard/AnalyticsKit';
import { EmptyState, dateTime } from '../MedicineParts';

const STATUS = { running: ['Çalışıyor', 'blue', Clock], success: ['Başarılı', 'green', CheckCircle2], partial: ['Kısmen başarılı', 'amber', AlertTriangle], failed: ['Başarısız', 'red', XCircle] };
const num = v => Number(v || 0).toLocaleString('tr-TR');

export function SyncStatusPill({ status }) {
  const [label, tone, Icon] = STATUS[status] || [status, 'slate', Clock];
  return <span className="md-pill" data-tone={tone}><Icon size={11} /> {label}</span>;
}

export function SyncReport({ log }) {
  if (!log) return null;
  return <>
    <div className="md-report">
      {[['Toplam bulunan', log.total], ['Yeni ilaç', log.created], ['Güncellenen', log.updated], ['Değişmeyen', log.unchanged], ['Atlanan', log.skipped], ['Hatalı', log.failed], ['Pasife alınan', log.deactivated]].map(([label, value]) =>
        <div key={label}><span>{label}</span><b>{num(value)}</b></div>)}
    </div>
    {log.skipped > 0 && log.details?.skippedNoBarcode !== undefined && <p className="mt-3 text-[12px] text-slate-500">
      Atlananlar: {[[log.details.skippedNoBarcode, 'kaynakta barkodu olmayan'], [log.details.skippedDuplicate, 'listede tekrar eden barkod'], [log.details.skippedProtected, 'elle eklenmiş / düzenlenmiş (korundu)']].filter(([n]) => n > 0).map(([n, label]) => `${num(n)} ${label}`).join(' · ')}
    </p>}
    {log.details?.controlled && <p className={`mt-3 rounded-xl p-3 text-[12.5px] ${log.details.controlled.error ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600'}`}>
      {log.details.controlled.running ? 'TİTCK reçete listeleri işleniyor…'
        : log.details.controlled.error ? log.details.controlled.error
          : <>Reçete türü: <b>{num(log.details.controlled.red)}</b> Kırmızı, <b>{num(log.details.controlled.green)}</b> Yeşil reçeteli ilaç işaretlendi; diğerleri "Kontrole tabi değil".</>}
    </p>}
    {log.details?.enrichment && <p className={`mt-3 rounded-xl p-3 text-[12.5px] ${log.details.enrichment.error ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600'}`}>
      {log.details.enrichment.running ? 'TİTCK fiyat listesi işleniyor…'
        : log.details.enrichment.error ? log.details.enrichment.error
          : <>Fiyat listesi: <b>{num(log.details.enrichment.matched)}</b> ilaç eşleşti · {num(log.details.enrichment.withPrice)} fiyat, {num(log.details.enrichment.withPrescription)} reçete türü bilgisi</>}
    </p>}
    {log.error_message && <p className="mt-3 rounded-xl bg-red-50 p-3 text-[12.5px] text-red-700">{log.error_message}</p>}
    {log.details?.deactivationSkipped && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[12.5px] text-amber-800">{log.details.deactivationSkipped}</p>}
    {log.details?.errors?.length > 0 && <details className="mt-3 text-[12px] text-slate-600"><summary className="cursor-pointer font-semibold">Hatalı satırlar ({log.details.errors.length}{log.failed > log.details.errors.length ? ` / ${num(log.failed)}` : ''})</summary>
      <ul className="mt-2 grid gap-1">{log.details.errors.map((e, i) => <li key={i}><span className="md-barcode">{e.barcode || '—'}</span> · {e.name || 'Adsız'} — {e.error}</li>)}</ul>
    </details>}
  </>;
}

// Barkodlu fiyat / reçete listesi: yüklenince hemen uygulanır, sonraki senkronizasyonlarda tekrar uygulanır.
function PriceImport({ settings, onDone }) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [result, setResult] = useState(null);
  const input = useRef(null);
  const { showToast } = useToast();
  const upload = async file => {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return showToast('Yalnızca .xlsx, .xls veya .csv dosyası yükleyin.', 'warning');
    setBusy(true); setResult(null);
    try {
      const r = await api.post('/admin/medicines/import', file, { params: { kind: 'prices' }, headers: { 'Content-Type': 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name) }, timeout: 300000 });
      setResult(r.data.data.enrichment);
      showToast(`${num(r.data.data.enrichment?.matched)} ilacın fiyat / reçete bilgisi güncellendi.`, 'success');
      onDone();
    } catch (e) { showToast(e.response?.data?.message || 'Fiyat listesi işlenemedi.', 'error'); setResult({ error: e.response?.data?.message || 'Fiyat listesi işlenemedi.' }); }
    finally { setBusy(false); }
  };
  return <Panel icon={FileSpreadsheet} title="Fiyat ve reçete listesi (isteğe bağlı)" subtitle="Barkodlu bir fiyat listesiyle ilaçların fiyatını ve reçete türünü tamamlayın">
    <div className="md-drop" data-drag={drag} role="button" tabIndex={0} onClick={() => input.current?.click()} onKeyDown={e => e.key === 'Enter' && input.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}>
      {busy ? <RefreshCw size={24} className="animate-spin" /> : <Upload size={24} />}
      <b>{busy ? 'Fiyatlar işleniyor…' : 'Fiyat listesini sürükleyin veya seçin'}</b>
      <small>"Barkod" ve "Perakende satış fiyatı" ve/veya "Reçete türü" sütunları gerekir</small>
      <input ref={input} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => upload(e.target.files[0])} />
    </div>
    <p className="mt-3 text-[12px] text-slate-500">TİTCK'nin barkodlu İlaç Fiyat Listesi yalnızca TİTCK Kurumsal Portal hesabıyla indirilebiliyor; herkese açık "Referans Bazlı" listede barkod ve TL fiyat bulunmuyor. Portal'dan indirdiğiniz listeyi veya ecza deponuzun barkodlu fiyat listesini yükleyebilirsiniz. Yüklenen liste sonraki senkronizasyonlarda da otomatik uygulanır.</p>
    {settings?.price_import_name && !result && <p className="mt-2 text-[12px] text-slate-500">Uygulanan liste: <b className="text-slate-700">{settings.price_import_name}</b>{settings.price_import_at ? ` · ${dateTime(settings.price_import_at)}` : ''}</p>}
    {result && <p className={`mt-3 rounded-xl p-3 text-[12.5px] ${result.error ? 'bg-amber-50 text-amber-800' : 'bg-teal-50 text-teal-800'}`}>
      {result.error || <><b>{num(result.matched)}</b> ilaç eşleşti · {num(result.withPrice)} fiyat, {num(result.withPrescription)} reçete türü bilgisi ({num(result.rows)} satır okundu)</>}
    </p>}
  </Panel>;
}

// Veri Senkronizasyonu ve İçe Aktar sekmeleri
export function SyncPanel({ withImport = false }) {
  const [status, setStatus] = useState(null);
  const [current, setCurrent] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(null);
  const [drag, setDrag] = useState(false);
  const fileInput = useRef(null);
  const poll = useRef(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    const r = await api.get('/admin/medicines/sync/status');
    setStatus(r.data.data);
    const id = r.data.data.running?.id || current?.id;
    if (id) setCurrent((await api.get(`/admin/medicines/sync/logs/${id}`)).data.data);
    return r.data.data;
  }, [current?.id]);

  useEffect(() => { load().catch(() => showToast('Senkronizasyon durumu alınamadı.', 'error')); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Çalışan iş varken her 1,5 saniyede ilerleme okunur.
  useEffect(() => {
    clearInterval(poll.current);
    if (current?.status === 'running') poll.current = setInterval(() => load().catch(() => {}), 1500);
    return () => clearInterval(poll.current);
  }, [current?.status, load]);

  const start = async () => {
    try {
      const r = await api.post('/admin/medicines/sync', {});
      setCurrent({ id: r.data.data.logId, status: 'running', total: 0 });
      showToast('Senkronizasyon başlatıldı.', 'success');
      setTimeout(() => load().catch(() => {}), 400);
    } catch (e) { showToast(e.response?.data?.message || 'Senkronizasyon başlatılamadı.', 'error'); }
  };
  const upload = async file => {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return showToast('Yalnızca .xlsx, .xls veya .csv dosyası yükleyin.', 'warning');
    if (file.size > 40 * 1024 * 1024) return showToast('Dosya en fazla 40 MB olabilir.', 'warning');
    setUploading(true);
    try {
      const r = await api.post('/admin/medicines/import', file, { headers: { 'Content-Type': 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name) }, timeout: 180000 });
      setUploaded(r.data.data);
      showToast('Dosya yüklendi. Şimdi senkronizasyonu başlatabilirsiniz.', 'success');
      load().catch(() => {});
    } catch (e) { showToast(e.response?.data?.message || 'Dosya yüklenemedi.', 'error'); }
    finally { setUploading(false); }
  };

  const running = current?.status === 'running';
  const provider = status?.providers?.find(p => p.key === status.settings.active_provider);

  return <div className="grid gap-4">
    {withImport && <Panel icon={FileSpreadsheet} title="İlaç listesi içe aktar" subtitle="TİTCK'nin ücretsiz yayımladığı Excel / CSV listesini yükleyin">
      <div className="md-drop" data-drag={drag} role="button" tabIndex={0} onClick={() => fileInput.current?.click()} onKeyDown={e => e.key === 'Enter' && fileInput.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}>
        {uploading ? <RefreshCw size={26} className="animate-spin" /> : <Upload size={26} />}
        <b>{uploading ? 'Yükleniyor…' : 'Dosyayı sürükleyin veya seçin'}</b>
        <small>.xlsx, .xls veya .csv · en fazla 40 MB · "Barkod" ve "İlaç adı" sütunları zorunlu</small>
        <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => upload(e.target.files[0])} />
      </div>
      <ol className="mt-4 grid gap-1.5 text-[12.5px] text-slate-600" style={{ listStyle: 'decimal', paddingLeft: 18 }}>
        <li>titck.gov.tr adresinden "Ruhsatlı Beşeri Tıbbi Ürünler Listesi" veya "İlaç Fiyat Listesi" Excel dosyasını indirin.</li>
        <li>Dosyayı buraya yükleyin. Sütun adları otomatik tanınır (Barkod, İlaç Adı, Etken Madde, ATC Kodu, Ruhsat Sahibi, Fiyat, Durum…).</li>
        <li>"İlaç Verilerini Güncelle" ile içe aktarın. Aynı barkod ikinci kez eklenmez; değişen kayıtlar güncellenir.</li>
      </ol>
      {(uploaded || status?.settings?.last_import_name) && <p className="mt-3 text-[12px] text-slate-500">Hazır dosya: <b className="text-slate-700">{uploaded?.originalName || status.settings.last_import_name}</b>{status?.settings?.last_import_at && !uploaded ? ` · ${dateTime(status.settings.last_import_at)}` : ''}</p>}
    </Panel>}

    {withImport && <PriceImport settings={status?.settings} onDone={() => load().catch(() => {})} />}

    <Panel icon={RefreshCw} title="Veri senkronizasyonu" subtitle={provider ? `Aktif kaynak: ${provider.label}` : 'Veri kaynağı'}
      action={provider && !provider.available && !withImport
        ? <Link className="vx-btn" data-variant="primary" to="/admin/medicines?tab=import"><FileSpreadsheet size={15} /> Önce listeyi yükleyin</Link>
        : <button className="vx-btn" data-variant="primary" onClick={start} disabled={running || !status || (provider && !provider.available)}>{running ? <><RefreshCw size={15} className="animate-spin" /> Güncelleniyor…</> : <><RefreshCw size={15} /> İlaç Verilerini Güncelle</>}</button>}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3 text-[12.5px]"><span className="text-slate-500">Son başarılı senkronizasyon</span><b className="mt-1 block text-[15px] text-slate-800">{status?.lastSuccess ? dateTime(status.lastSuccess.finished_at) : 'Henüz yapılmadı'}</b></div>
        <div className="rounded-xl bg-slate-50 p-3 text-[12.5px]"><span className="text-slate-500">Kaynak durumu</span><b className={`mt-1 block text-[13px] ${provider?.available ? 'text-teal-700' : 'text-amber-700'}`}>{provider ? provider.message : '—'}</b></div>
      </div>
      {current ? <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-[12.5px] text-slate-600">#{current.id} · başlangıç {dateTime(current.started_at)}</span><SyncStatusPill status={current.status} /></div>
        {running && <div className="md-progress mb-4" role="progressbar" aria-label="Senkronizasyon sürüyor"><i /></div>}
        <SyncReport log={current} />
      </> : <EmptyState icon={RefreshCw} title="Bu oturumda senkronizasyon başlatılmadı" text="Kaynak çalışmazsa mevcut ilaç verileri olduğu gibi kullanılmaya devam eder." />}
    </Panel>
  </div>;
}

export function SyncLogs() {
  const [logs, setLogs] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => api.get('/admin/medicines/sync/logs').then(r => setLogs(r.data.data)).catch(() => setLogs([]));
  useEffect(() => { load(); }, []);
  return <Panel icon={Clock} title="Senkronizasyon logları" subtitle="Tüm veri güncelleme işlemlerinin geçmişi" action={<button className="vx-btn" onClick={load}><RefreshCw size={14} /> Yenile</button>}>
    {logs && !logs.length ? <EmptyState icon={Clock} title="Henüz kayıt yok" /> : <div className="overflow-x-auto"><table className="md-list">
      <thead><tr><th>#</th><th>Kaynak</th><th>Başlangıç</th><th>Bitiş</th><th style={{ textAlign: 'right' }}>Toplam</th><th style={{ textAlign: 'right' }}>Yeni</th><th style={{ textAlign: 'right' }}>Güncel.</th><th style={{ textAlign: 'right' }}>Atlanan</th><th style={{ textAlign: 'right' }}>Hatalı</th><th>Durum</th></tr></thead>
      <tbody>{(logs || []).map(l => <React.Fragment key={l.id}>
        <tr onClick={() => setOpen(open === l.id ? null : l.id)}>
          <td>{l.id}</td><td>{l.provider}</td><td>{dateTime(l.started_at)}</td><td>{dateTime(l.finished_at)}</td>
          {['total', 'created', 'updated', 'skipped', 'failed'].map(k => <td key={k} style={{ textAlign: 'right' }} className="tabular-nums">{num(l[k])}</td>)}
          <td><SyncStatusPill status={l.status} /></td>
        </tr>
        {open === l.id && <tr><td colSpan={10} style={{ background: '#fbfcfe' }}><div className="py-2"><SyncReport log={l} /><p className="mt-2 text-[11px] text-slate-500">Başlatan: {l.triggered_by || '—'}</p></div></td></tr>}
      </React.Fragment>)}</tbody>
    </table></div>}
  </Panel>;
}
