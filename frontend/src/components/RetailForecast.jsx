import { useState } from 'react';
import api from '../api/client';

const tl = value => Number(value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
const number = value => Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 });

// Sipariş önerisi (satış hızına göre) ve son kullanma tarihi indirim önerisi. İkisi de öneridir; kendiliğinden sipariş verilmez, indirim uygulanmaz.
export default function RetailForecast() {
  const [forecast, setForecast] = useState(null), [discounts, setDiscounts] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError('');
    try {
      const [a, b] = await Promise.all([api.get('/scanner/pro/reorder-forecast'), api.get('/scanner/pro/expiry-discounts')]);
      setForecast(a.data); setDiscounts(b.data);
    } catch (e) { setError(e.response?.data?.error || 'Öneriler alınamadı.'); } finally { setBusy(false); }
  }
  return <section className="veniux-card p-4 space-y-3 mt-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Sipariş ve indirim önerileri</h2><button type="button" className="btn-secondary" disabled={busy} onClick={load}>Önerileri hazırla</button></div>
    <p className="text-sm text-slate-500">Son 30 günün satış hızına göre hesaplanır. Öneridir: sipariş kendiliğinden verilmez, indirim kendiliğinden uygulanmaz.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {forecast && <div className="space-y-3"><h3 className="font-semibold">Bitmek üzere olanlar ({forecast.cover_days} günden az stoğu kalan)</h3>
      {forecast.suppliers.length === 0 ? <p className="text-sm">Şu an bitmek üzere olan ürün yok.</p> : forecast.suppliers.map(group => <div key={group.supplier_id || 'none'} className="border rounded p-3"><b>{group.name}</b>
        <table className="w-full text-sm mt-2"><thead><tr><th className="text-left">Ürün</th><th className="text-right">Günlük satış</th><th className="text-right">Eldeki</th><th className="text-right">Kalan gün</th><th className="text-right">Önerilen sipariş</th></tr></thead>
          <tbody>{group.items.map(i => <tr key={i.product_id}><td>{i.name}</td><td className="text-right">{number(i.daily_rate)} {i.unit}</td><td className="text-right">{number(i.on_hand)}</td><td className="text-right">{number(i.days_left)}</td><td className="text-right"><b>{number(i.suggested_quantity)} {i.unit}</b></td></tr>)}</tbody></table></div>)}</div>}
    {discounts && <div className="space-y-2"><h3 className="font-semibold">Son kullanma tarihi yaklaşanlar ({discounts.days} gün içinde)</h3>
      {discounts.items.length === 0 ? <p className="text-sm">Tarihi yaklaşan stoklu lot yok.</p> : <table className="w-full text-sm"><thead><tr><th className="text-left">Ürün · Lot</th><th className="text-left">Depo</th><th className="text-right">Kalan gün</th><th className="text-right">Miktar</th><th className="text-right">Önerilen indirim</th><th className="text-right">Yeni fiyat</th></tr></thead>
        <tbody>{discounts.items.map(i => <tr key={i.lot_id}><td>{i.name} · {i.lot_number}</td><td>{i.warehouse_name}</td><td className="text-right">{i.days_remaining}</td><td className="text-right">{number(i.quantity)}</td><td className="text-right"><b>%{i.suggested_percent}</b></td><td className="text-right">{tl(i.discounted_price)}</td></tr>)}</tbody></table>}
      <p className="text-xs text-slate-500">İndirimi uygulamak için Ayarlar &gt; Barkod okuyucular ve kasa &gt; Kampanyalar bölümünden kampanya açın.</p></div>}
  </section>;
}
