import { useEffect, useState } from 'react';
import api from '../../api/client';

const STATE = { deducted: 'Stoktan düştü', restored: 'İptal, stok geri eklendi', ignored: 'İptal, stok değişmedi', needs_review: 'İnceleme gerekli' };
const tl = c => c === null || c === undefined ? '—' : (c / 100).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
const errorOf = (e, fallback) => e.response?.data?.error || fallback;

export default function TrendyolConnection() {
  const [status, setStatus] = useState(null), [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ seller_id: '', api_key: '', api_secret: '', environment: 'test', warehouse_id: '', stock_buffer: 0, price_sync: false });
  const [busy, setBusy] = useState(false), [note, setNote] = useState(null);
  const [report, setReport] = useState(null);
  const showReport = () => run(async () => { const r = await api.get('/marketplace/trendyol/report'); setReport(r.data); return r; }, () => 'Rapor hazır.');
  const pullReport = () => run(async () => { await api.post('/marketplace/trendyol/settlements/sync'); const r = await api.get('/marketplace/trendyol/report'); setReport(r.data); return r; }, () => 'Trendyol ekstresi alındı.');
  const load = async () => {
    const [connection, depots] = await Promise.all([api.get('/marketplace/trendyol'), api.get('/warehouses')]);
    setStatus(connection.data);
    setWarehouses(depots.data || []);
    setForm(old => ({ ...old, stock_buffer: connection.data.stock_buffer ?? old.stock_buffer, price_sync: connection.data.price_sync ?? old.price_sync, seller_id: connection.data.seller_id || old.seller_id, environment: connection.data.environment || old.environment, warehouse_id: connection.data.warehouse_id || old.warehouse_id || depots.data?.[0]?.id || '' }));
  };
  useEffect(() => { load().catch(() => setNote({ error: true, text: 'Trendyol bağlantısını yalnız yönetici görüntüleyebilir.' })); }, []);
  const set = name => e => setForm({ ...form, [name]: e.target.value });
  const run = async (work, done) => {
    setBusy(true); setNote(null);
    try { const { data } = await work(); setNote({ text: done(data) }); await load(); } catch (e) { setNote({ error: true, text: errorOf(e, 'İşlem tamamlanamadı.') }); await load().catch(() => {}); } finally { setBusy(false); }
  };
  const save = e => { e.preventDefault(); run(async () => { const r = await api.put('/marketplace/trendyol', form); setForm(old => ({ ...old, api_key: '', api_secret: '' })); return r; }, () => 'Bağlantı kaydedildi. Bağlantı anından önceki siparişler stoktan düşülmez.'); };
  return <section className="veniux-card p-5 space-y-4" aria-label="Trendyol">
    <div><h2 className="font-semibold">Trendyol</h2><p className="text-sm text-slate-500">Yeni siparişler 5 dakikada bir çekilip stoktan düşülür, değişen stoklar Trendyol'a gönderilir. Ürünler barkodla eşleşir. Komisyon ve hakediş Trendyol cari hesap ekstresinden alınır.</p></div>
    <form className="grid sm:grid-cols-2 gap-3" onSubmit={save}>
      <label className="text-sm">Satıcı ID<input className="block w-full" value={form.seller_id} onChange={set('seller_id')} inputMode="numeric" required /></label>
      <label className="text-sm">Ortam<select className="block w-full" value={form.environment} onChange={set('environment')}><option value="test">Test</option><option value="live">Canlı</option></select></label>
      <label className="text-sm">API anahtarı<input className="block w-full" value={form.api_key} onChange={set('api_key')} autoComplete="off" placeholder={status?.connected ? 'Değiştirmek için yazın' : ''} /></label>
      <label className="text-sm">API parolası<input className="block w-full" type="password" value={form.api_secret} onChange={set('api_secret')} autoComplete="new-password" placeholder={status?.connected ? 'Değiştirmek için yazın' : ''} /></label>
      <label className="text-sm sm:col-span-2">Stok deposu<select className="block w-full" value={form.warehouse_id} onChange={set('warehouse_id')} required>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      <label className="text-sm">Güvenlik payı (adet)<input className="block w-full" type="number" min="0" max="1000" step="1" value={form.stock_buffer} onChange={e => setForm({ ...form, stock_buffer: Number(e.target.value) })} /><span className="block text-xs text-slate-500">Pazaryerine stoktan bu kadar az gösterilir; kasada satılan son ürünün internetten de satılmasını önler.</span></label>
      <label className="text-sm flex items-center gap-2 mt-5"><input type="checkbox" checked={form.price_sync} onChange={e => setForm({ ...form, price_sync: e.target.checked })} />Satış fiyatını da gönder<span className="text-xs text-slate-500">(kapalıyken fiyatı Trendyol panelinden yönetirsiniz)</span></label>
      <div className="sm:col-span-2 flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy}>Kaydet</button>
        <button type="button" className="btn-soft" disabled={busy || !status?.connected} onClick={() => run(() => api.post('/marketplace/trendyol/test'), d => `Bağlantı çalışıyor. Onaylı ürün: ${d.approved_products}.`)}>Bağlantıyı dene</button>
        <button type="button" className="btn-soft" disabled={busy || !status?.connected} onClick={() => run(() => api.post('/marketplace/trendyol/sync'), d => `Eşitlendi. ${d.stock_sent} ürünün stoğu gönderildi.${d.warning ? ' ' + d.warning : ''}`)}>Şimdi eşitle</button>
        <button type="button" className="btn-soft" disabled={busy || !status?.connected} onClick={showReport}>Kâr raporu</button>
        <button type="button" className="btn-soft" disabled={busy || !status?.connected} onClick={pullReport}>Ekstreyi şimdi al</button>
      </div>
    </form>
    {note && <p role={note.error ? 'alert' : 'status'} className={note.error ? 'text-sm font-semibold text-red-700' : 'text-sm font-semibold text-emerald-700'}>{note.text}</p>}
    {status?.connected && <p className="text-sm text-slate-500">Son eşitleme: {status.last_sync_at ? new Date(status.last_sync_at.replace(' ', 'T') + (status.last_sync_at.includes('Z') ? '' : 'Z')).toLocaleString('tr-TR') : 'henüz yok'}{status.last_error ? ` · Son hata: ${status.last_error}` : ''}</p>}
    {status?.orders?.length > 0 && <table className="w-full text-sm"><thead><tr><th className="text-left">Paket</th><th className="text-left">Sipariş</th><th className="text-left">Durum</th><th className="text-left">Stok</th></tr></thead><tbody>{status.orders.map(o => <tr key={o.package_id}><td>{o.package_id}</td><td>{o.order_number || '—'}</td><td>{o.status}</td><td title={o.stock_state === 'needs_review' ? o.detail : undefined}>{STATE[o.stock_state] || o.stock_state}</td></tr>)}</tbody></table>}
    {report && <div className="space-y-2">
      <h3 className="font-semibold">Son 30 gün: komisyon ve tahmini kâr</h3>
      <p className="text-sm">Satış {tl(report.totals.sales_cents)} · Komisyon {tl(report.totals.commission_cents)} · Hakediş {tl(report.totals.revenue_cents)} · Maliyet {tl(report.totals.cost_cents)} · <b>Tahmini kâr {tl(report.totals.profit_cents)}</b></p>
      <p className="text-xs text-slate-500">{report.note}{report.unknown_products ? ` ${report.unknown_products} barkod ürün kartlarında yok; toplam kâr bu yüzden hesaplanmadı.` : ''}{report.unsettled_packages ? ` ${report.unsettled_packages} paket henüz ekstreye yansımadı.` : ''} Ekstre saatte bir alınır.</p>
      {report.products.length > 0 && <table className="w-full text-sm"><thead><tr><th className="text-left">Ürün</th><th className="text-right">Adet</th><th className="text-right">Satış</th><th className="text-right">Komisyon</th><th className="text-right">Hakediş</th><th className="text-right">Tahmini kâr</th></tr></thead><tbody>{report.products.map(p => <tr key={p.barcode || '-'}><td>{p.name || p.barcode || '—'}</td><td className="text-right">{p.units}</td><td className="text-right">{tl(p.sales_cents)}</td><td className="text-right">{tl(p.commission_cents)}</td><td className="text-right">{tl(p.revenue_cents)}</td><td className="text-right">{tl(p.profit_cents)}</td></tr>)}</tbody></table>}
    </div>}
  </section>;
}
