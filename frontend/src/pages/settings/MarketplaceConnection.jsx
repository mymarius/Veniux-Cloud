import { formatMoney } from '../../../../shared/money.mjs';
import { t as __t } from '../../i18n';
import { useEffect, useState } from 'react';
import api from '../../api/client';

const STATE = { deducted: 'Stoktan düştü', restored: 'İptal, stok geri eklendi', ignored: 'İptal, stok değişmedi', needs_review: 'İnceleme gerekli' };
const tl = c => c === null || c === undefined ? '—' : formatMoney((c / 100));
const errorOf = (e, fallback) => e.response?.data?.error || fallback;

const FIELDS = {
  trendyol: { seller: 'Satıcı ID', key: 'API anahtarı', secret: 'API parolası', numeric: true, text: "Yeni siparişler 5 dakikada bir çekilip stoktan düşülür, değişen stoklar Trendyol'a gönderilir. Ürünler barkodla eşleşir. Komisyon ve hakediş Trendyol cari hesap ekstresinden alınır." },
  hepsiburada: { seller: 'Mağaza (merchant) kimliği', key: 'Geliştirici adı', secret: 'Servis anahtarı', numeric: false, text: "Yeni siparişler çekilip stoktan düşülür, değişen stoklar Hepsiburada'ya gönderilir. Ürünler barkod (merchant SKU) ile eşleşir." },
  n11: { seller: 'Mağaza adı', key: 'Uygulama anahtarı (appkey)', secret: 'Gizli anahtar (appsecret)', numeric: false, text: "Yeni paketler çekilip stoktan düşülür, değişen stoklar N11'e gönderilir. Ürünler stok kodu (barkod) ile eşleşir." }
};

export default function MarketplaceConnection({ provider = 'trendyol' }) {
  const base = '/marketplace/' + provider, copy = FIELDS[provider] || FIELDS.trendyol;
  const [status, setStatus] = useState(null), [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ seller_id: '', api_key: '', api_secret: '', environment: provider === 'n11' ? 'live' : 'test', warehouse_id: '', stock_buffer: 0, price_sync: false, enabled: false });
  const [busy, setBusy] = useState(false), [note, setNote] = useState(null);
  const [report, setReport] = useState(null);
  const showReport = () => run(async () => { const r = await api.get(base + '/report'); setReport(r.data); return r; }, () => 'Rapor hazır.');
  const pullReport = () => run(async () => { await api.post(base + '/settlements/sync'); const r = await api.get(base + '/report'); setReport(r.data); return r; }, () => 'Trendyol ekstresi alındı.');
  const load = async () => {
    const [connection, depots] = await Promise.all([api.get(base), api.get('/warehouses')]);
    setStatus(connection.data);
    setWarehouses(depots.data || []);
    setForm(old => ({ ...old, enabled: connection.data.enabled ?? old.enabled, stock_buffer: connection.data.stock_buffer ?? old.stock_buffer, price_sync: connection.data.price_sync ?? old.price_sync, seller_id: connection.data.seller_id || old.seller_id, environment: connection.data.environment || old.environment, warehouse_id: connection.data.warehouse_id || old.warehouse_id || depots.data?.[0]?.id || '' }));
  };
  useEffect(() => { load().catch(() => setNote({ error: true, text: 'Pazaryeri bağlantısını yalnız yönetici görüntüleyebilir.' })); }, []);
  const set = name => e => setForm({ ...form, [name]: e.target.value });
  const run = async (work, done) => {
    setBusy(true); setNote(null);
    try { const { data } = await work(); setNote({ text: done(data) }); await load(); } catch (e) { setNote({ error: true, text: errorOf(e, 'İşlem tamamlanamadı.') }); await load().catch(() => {}); } finally { setBusy(false); }
  };
  const save = e => { e.preventDefault(); run(async () => { const r = await api.put(base, form); setForm(old => ({ ...old, api_key: '', api_secret: '' })); return r; }, () => 'Bağlantı kaydedildi. Bağlantı anından önceki siparişler stoktan düşülmez.'); };
  return <section className="veniux-card p-5 space-y-4" aria-label={status?.label || provider}>
    <div><h2 className="font-semibold">{status?.label || provider}{status?.experimental && <span className="ml-2 text-xs font-semibold text-amber-700">{__t('Gerçek mağazada denenmedi')}</span>}</h2><p className="text-sm text-slate-500">{copy.text}</p>{status?.experimental && <p className="text-xs text-amber-700 mt-1">{__t('Bu bağlantı kapalı kaydedilir. Önce "Bağlantıyı dene" ile doğrulayın, sonra "Eşitlemeyi aç"ı işaretleyin.')}</p>}</div>
    <form className="grid sm:grid-cols-2 gap-3" onSubmit={save}>
      <label className="text-sm">{copy.seller}<input className="block w-full" value={form.seller_id} onChange={set('seller_id')} inputMode={copy.numeric ? 'numeric' : undefined} required /></label>
      <label className="text-sm">{__t('Ortam')}<select className="block w-full" value={form.environment} onChange={set('environment')}>{(status?.environments || ['test', 'live']).includes('test') && <option value="test">{__t('Test')}</option>}<option value="live">{__t('Canlı')}</option></select></label>
      <label className="text-sm">{copy.key}<input className="block w-full" value={form.api_key} onChange={set('api_key')} autoComplete="off" placeholder={status?.connected ? 'Değiştirmek için yazın' : ''} /></label>
      <label className="text-sm">{copy.secret}<input className="block w-full" type="password" value={form.api_secret} onChange={set('api_secret')} autoComplete="new-password" placeholder={status?.connected ? 'Değiştirmek için yazın' : ''} /></label>
      <label className="text-sm sm:col-span-2">{__t('Stok deposu')}<select className="block w-full" value={form.warehouse_id} onChange={set('warehouse_id')} required>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      <label className="text-sm">{__t('Güvenlik payı (adet)')}<input className="block w-full" type="number" min="0" max="1000" step="1" value={form.stock_buffer} onChange={e => setForm({ ...form, stock_buffer: Number(e.target.value) })} /><span className="block text-xs text-slate-500">{__t('Pazaryerine stoktan bu kadar az gösterilir; kasada satılan son ürünün internetten de satılmasını önler.')}</span></label>
      <label className="text-sm flex items-center gap-2 mt-5"><input type="checkbox" checked={form.price_sync} onChange={e => setForm({ ...form, price_sync: e.target.checked })} />{__t('Satış fiyatını da gönder')}<span className="text-xs text-slate-500">{__t('(kapalıyken fiyatı pazaryeri panelinden yönetirsiniz)')}</span></label>
      {status?.experimental && <label className="text-sm flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />{__t('Eşitlemeyi aç (siparişleri çek, stoğu gönder)')}</label>}
      <div className="sm:col-span-2 flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy}>{__t('Kaydet')}</button>
        <button type="button" className="btn-soft" disabled={busy || !status?.connected} onClick={() => run(() => api.post(base + '/test'), d => d.approved_products === undefined ? 'Bağlantı çalışıyor.' : `Bağlantı çalışıyor. Onaylı ürün: ${d.approved_products}.`)}>{__t('Bağlantıyı dene')}</button>
        <button type="button" className="btn-soft" disabled={busy || !status?.connected} onClick={() => run(() => api.post(base + '/sync'), d => `Eşitlendi. ${d.stock_sent} ürünün stoğu gönderildi.${d.warning ? ' ' + d.warning : ''}`)}>{__t('Şimdi eşitle')}</button>
        {provider === 'trendyol' && <><button type="button" className="btn-soft" disabled={busy || !status?.connected} onClick={showReport}>{__t('Kâr raporu')}</button>
        <button type="button" className="btn-soft" disabled={busy || !status?.connected} onClick={pullReport}>{__t('Ekstreyi şimdi al')}</button></>}
      </div>
    </form>
    {note && <p role={note.error ? 'alert' : 'status'} className={note.error ? 'text-sm font-semibold text-red-700' : 'text-sm font-semibold text-emerald-700'}>{note.text}</p>}
    {status?.connected && <p className="text-sm text-slate-500">Son eşitleme: {status.last_sync_at ? new Date(status.last_sync_at.replace(' ', 'T') + (status.last_sync_at.includes('Z') ? '' : 'Z')).toLocaleString('tr-TR') : 'henüz yok'}{status.last_error ? ` · Son hata: ${status.last_error}` : ''}</p>}
    {status?.orders?.length > 0 && <table className="w-full text-sm"><thead><tr><th className="text-left">{__t('Paket')}</th><th className="text-left">{__t('Sipariş')}</th><th className="text-left">{__t('Durum')}</th><th className="text-left">{__t('Stok')}</th></tr></thead><tbody>{status.orders.map(o => <tr key={o.package_id}><td>{o.package_id}</td><td>{o.order_number || '—'}</td><td>{o.status}</td><td title={o.stock_state === 'needs_review' ? o.detail : undefined}>{STATE[o.stock_state] || o.stock_state}</td></tr>)}</tbody></table>}
    {report && <div className="space-y-2">
      <h3 className="font-semibold">{__t('Son 30 gün: komisyon ve tahmini kâr')}</h3>
      <p className="text-sm">Satış {tl(report.totals.sales_cents)} · Komisyon {tl(report.totals.commission_cents)} · Hakediş {tl(report.totals.revenue_cents)} · Maliyet {tl(report.totals.cost_cents)} · <b>Tahmini kâr {tl(report.totals.profit_cents)}</b></p>
      <p className="text-xs text-slate-500">{report.note}{report.unknown_products ? ` ${report.unknown_products} barkod ürün kartlarında yok; toplam kâr bu yüzden hesaplanmadı.` : ''}{report.unsettled_packages ? ` ${report.unsettled_packages} paket henüz ekstreye yansımadı.` : ''} Ekstre saatte bir alınır.</p>
      {report.products.length > 0 && <table className="w-full text-sm"><thead><tr><th className="text-left">{__t('Ürün')}</th><th className="text-right">{__t('Adet')}</th><th className="text-right">{__t('Satış')}</th><th className="text-right">{__t('Komisyon')}</th><th className="text-right">{__t('Hakediş')}</th><th className="text-right">{__t('Tahmini kâr')}</th></tr></thead><tbody>{report.products.map(p => <tr key={p.barcode || '-'}><td>{p.name || p.barcode || '—'}</td><td className="text-right">{p.units}</td><td className="text-right">{tl(p.sales_cents)}</td><td className="text-right">{tl(p.commission_cents)}</td><td className="text-right">{tl(p.revenue_cents)}</td><td className="text-right">{tl(p.profit_cents)}</td></tr>)}</tbody></table>}
    </div>}
  </section>;
}
