import { useEffect, useState } from 'react';
import api from '../api/client';

const tl = c => (c / 100).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

// Şubeler (depolar) arası stok ve bu ayın net kasa satışı. Transfer toplam stoğu değiştirmez.
export default function BranchReport() {
  const [data, setData] = useState(null), [error, setError] = useState('');
  useEffect(() => { api.get('/warehouses/branch-report').then(r => setData(r.data)).catch(e => setError(e.response?.data?.error || 'Şube raporu alınamadı.')); }, []);
  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!data) return null;
  return <section className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
    <div><h2 className="font-semibold">Şube karşılaştırması</h2><p className="text-sm text-slate-500">{data.from} – {data.to} net kasa satışı ve güncel stok. {data.scope === 'restricted' ? 'Yalnız erişiminiz olan şubeler gösterilir.' : 'Şubeler arası transfer firma toplamını değiştirmez.'}</p></div>
    <div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Şube</th><th className="text-right">Stok (adet)</th><th className="text-right">Stok değeri</th><th className="text-right">Fiş</th><th className="text-right">Net satış</th></tr></thead>
      <tbody>{data.branches.map(b => <tr key={b.warehouse_id}><td>{b.name}</td><td className="text-right">{b.stock_units.toLocaleString('tr-TR')}</td><td className="text-right">{tl(b.stock_value_cents)}</td><td className="text-right">{b.receipts}</td><td className="text-right">{tl(b.net_sales_cents)}</td></tr>)}</tbody>
      <tfoot><tr className="font-semibold"><td>Toplam</td><td className="text-right">{data.totals.stock_units.toLocaleString('tr-TR')}</td><td className="text-right">{tl(data.totals.stock_value_cents)}</td><td className="text-right">{data.totals.receipts}</td><td className="text-right">{tl(data.totals.net_sales_cents)}</td></tr></tfoot>
    </table></div>
  </section>;
}
