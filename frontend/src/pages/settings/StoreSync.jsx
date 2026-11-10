import { useEffect, useState } from 'react';
import api from '../../api/client';

const when = v => v ? new Date(String(v).replace(' ', 'T') + (String(v).includes('Z') ? '' : 'Z')).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const money = v => Number(v).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

// Mağaza–bulut eşitleme (tek yön: mağaza -> bulut). Satışlar buluta yalnız raporlama için gider; bulut stoğu değişmez.
// İki yüz: (1) Bulut hesabında mağaza için cihaz anahtarı üretilir ve gelen cirolar görülür. (2) Mağaza bilgisayarında bu anahtar girilir.
export default function StoreSync() {
  const [devices, setDevices] = useState([]), [summary, setSummary] = useState([]), [shifts, setShifts] = useState([]), [config, setConfig] = useState(null);
  const [name, setName] = useState(''), [fresh, setFresh] = useState(null), [form, setForm] = useState({ cloud_url: 'https://app.veniux.com', device_key: '' });
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const fail = (e, fallback) => setMessage(e.response?.data?.error || fallback);
  const load = async () => {
    try { setConfig((await api.get('/store-sync/config')).data); } catch (e) { fail(e, 'Eşitleme durumu alınamadı.'); return; }
    try { setDevices((await api.get('/store-sync/devices')).data.items); const sum = (await api.get('/store-sync/summary')).data; setSummary(sum.items); setShifts(sum.shifts || []); } catch { /* yetki yoksa bu bölüm boş kalır */ }
  };
  useEffect(() => { load(); }, []);
  const run = async (action, done) => { setBusy(true); setMessage(''); try { await action(); if (done) setMessage(done); await load(); } catch (e) { fail(e, 'İşlem tamamlanamadı.'); } finally { setBusy(false); } };
  const create = () => run(async () => { setFresh((await api.post('/store-sync/devices', { name })).data); setName(''); }, 'Cihaz anahtarı üretildi. Aşağıdaki anahtarı şimdi kopyalayın; bir daha gösterilmez.');
  const revoke = d => { if (window.confirm(d.name + ' için anahtar iptal edilsin mi? Bu mağaza artık satış yükleyemez.')) run(() => api.delete('/store-sync/devices/' + d.id), 'Anahtar iptal edildi.'); };
  const save = () => run(async () => { await api.put('/store-sync/config', { ...form, enabled: true }); setForm(f => ({ ...f, device_key: '' })); }, 'Bağlantı kaydedildi. Satışlar birkaç dakikada bir buluta gönderilir.');
  const push = () => run(async () => { const r = (await api.post('/store-sync/push')).data; setMessage(r.error ? 'Gönderilemedi: ' + r.error : r.skipped ? 'Bağlantı kapalı.' : r.sent + ' satış, ' + (r.shifts || 0) + ' vardiya buluta gönderildi' + (r.products && !r.products.error ? '; ürünlerden ' + r.products.added + ' eklendi, ' + r.products.updated + ' güncellendi.' : r.products?.error ? '. Ürünler alınamadı: ' + r.products.error : '.')); });
  const remove = () => { if (window.confirm('Bu bilgisayarın buluta satış göndermesi durdurulsun mu?')) run(() => api.delete('/store-sync/config'), 'Bağlantı kaldırıldı.'); };
  const totals = Object.values(summary.reduce((m, r) => { const t = m[r.device_id] || (m[r.device_id] = { name: r.device_name, sales: 0, net: 0, out: 0 }); t.sales += r.sale_count; t.net += r.net_total; return m; }, {}));
  shifts.forEach(r => { const t = totals.find(x => x.name === r.device_name); if (t) t.out += r.cash_out; });
  const top = Math.max(1, ...totals.map(t => t.net));
  return <section className="veniux-card p-4 mt-4 space-y-4">
    <h2 className="font-semibold">Mağaza–bulut eşitleme</h2>
    <p className="text-sm">Bu bilgisayardaki satışlar, iade/iptaller, vardiyalar ve giderler raporlama için bulut hesabına gönderilir; bulutun stoğu ve kendi satışları değişmez. Ürün ve fiyat ise buluttan bu bilgisayara iner: barkodu eşleşen ürünün adı, kategorisi, birimi, satış fiyatı ve KDV oranı bulutun değerine eşitlenir (bulut kazanır), buluttaki yeni ürünler eklenir. Bu bilgisayardaki ürün silinmez; stok ve alış fiyatı değişmez.</p>

    <div className="space-y-2">
      <h3 className="font-medium text-sm">1) Bulut hesabında: mağaza ekle</h3>
      <p className="text-xs">Bu adımı bulut hesabında (app.veniux.com) yönetici olarak yapın. Her mağaza bilgisayarı için ayrı anahtar üretin; kaybolursa yalnız onu iptal edersiniz.</p>
      <div className="flex flex-wrap gap-2 items-center">
        <input aria-label="Mağaza adı" className="input" placeholder="Mağaza adı (örn. Kadıköy)" maxLength={80} value={name} onChange={e => setName(e.target.value)} />
        <button type="button" className="btn-secondary" disabled={busy || name.trim().length < 2} onClick={create}>Anahtar üret</button>
      </div>
      {fresh && <p role="status" className="text-sm border rounded p-2 break-all"><b>{fresh.name}</b> anahtarı: <code>{fresh.key}</code><br /><span className="text-xs">Bu anahtar yalnız şimdi görünür. Mağaza bilgisayarında 2. adıma yapıştırın.</span></p>}
      {devices.length > 0 && <table className="w-full text-sm"><thead><tr><th className="text-left">Mağaza</th><th className="text-left">Son bağlantı</th><th className="text-left">Durum</th><th /></tr></thead>
        <tbody>{devices.map(d => <tr key={d.id}><td>{d.name}</td><td>{when(d.last_seen_at)}</td><td>{d.revoked_at ? 'İptal edildi' : 'Etkin'}</td><td>{!d.revoked_at && <button type="button" className="btn-soft" disabled={busy} onClick={() => revoke(d)}>İptal et</button>}</td></tr>)}</tbody></table>}
      {summary.length > 0 && <>
        <h3 className="font-medium text-sm pt-2">Mağaza karşılaştırması (son 14 gün)</h3>
        <ul className="text-sm space-y-1">{totals.sort((a, b) => b.net - a.net).map(t => <li key={t.name}>
          <div className="flex justify-between gap-2"><span>{t.name}</span><span><b>{money(t.net)}</b> · {t.sales} satış{t.out > 0 && <> · gider {money(t.out)}</>}</span></div>
          <div role="img" aria-label={t.name + ' ciro çubuğu'} style={{ height: 8, borderRadius: 4, background: 'rgba(127,127,127,.2)' }}><div style={{ height: 8, borderRadius: 4, width: Math.round(t.net / top * 100) + '%', background: '#2f6fed' }} /></div>
        </li>)}</ul>
        <h3 className="font-medium text-sm pt-2">Günlük ciro</h3>
        <table className="w-full text-sm"><thead><tr><th className="text-left">Gün</th><th className="text-left">Mağaza</th><th className="text-right">Satış</th><th className="text-right">Net ciro</th></tr></thead>
          <tbody>{summary.map(r => <tr key={r.device_id + r.business_date}><td>{r.business_date}</td><td>{r.device_name}</td><td className="text-right">{r.sale_count}</td><td className="text-right">{money(r.net_total)}</td></tr>)}</tbody></table></>}
    </div>

    <div className="space-y-2">
      <h3 className="font-medium text-sm">2) Mağaza bilgisayarında: buluta bağla</h3>
      {config?.configured && <p className="text-sm">Bağlı: <b>{config.cloud_url}</b> · {config.enabled ? 'açık' : 'kapalı'} · Bekleyen satış: <b>{config.pending}</b> · Son deneme: {when(config.last_run_at)}{config.last_error && <span role="alert"> · Hata: {config.last_error}</span>}</p>}
      <div className="flex flex-wrap gap-2 items-center">
        <input aria-label="Bulut adresi" className="input" value={form.cloud_url} onChange={e => setForm({ ...form, cloud_url: e.target.value })} />
        <input aria-label="Cihaz anahtarı" className="input" type="password" autoComplete="off" placeholder="vsk_…" value={form.device_key} onChange={e => setForm({ ...form, device_key: e.target.value })} />
        <button type="button" className="btn-secondary" disabled={busy || !form.device_key} onClick={save}>Kaydet</button>
        {config?.configured && <button type="button" className="btn-soft" disabled={busy} onClick={push}>Şimdi gönder</button>}
        {config?.configured && <button type="button" className="btn-soft" disabled={busy} onClick={remove}>Bağlantıyı kaldır</button>}
      </div>
      <p className="text-xs">Anahtar bu bilgisayarın veritabanında saklanır; mağaza bilgisayarını yetkisiz kişilere açmayın.</p>
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
