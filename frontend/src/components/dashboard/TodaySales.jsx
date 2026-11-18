import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import api from '../../api/client';

const money = value => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(value);
const SUM_KEYS = ['sale_count', 'net_cents', 'cash_net_cents', 'card_net_cents', 'return_cents'];

// "Bugün ne sattım?" şeridi: depoların günlük raporlarını toplar. Yetki yoksa ya da satış modülü kapalıysa görünmez.
export default function TodaySales({ warehouses = [], revision = 0 }) {
  const [totals, setTotals] = useState(null);
  const ids = warehouses.slice(0, 4).map(w => w.id).filter(Boolean).join(',');

  useEffect(() => {
    if (!ids) { setTotals(null); return undefined; }
    let live = true;
    Promise.allSettled(ids.split(',').map(id => api.get('/scanner/day-report', { params: { warehouse_id: id } }))).then(results => {
      if (!live) return;
      const ok = results.filter(r => r.status === 'fulfilled').map(r => r.value.data);
      if (!ok.length) { setTotals(null); return; }
      setTotals(Object.fromEntries(SUM_KEYS.map(key => [key, ok.reduce((sum, report) => sum + Number(report[key] || 0), 0)])));
    });
    return () => { live = false; };
  }, [ids, revision]);

  if (!totals) return null;
  const net = totals.net_cents / 100, count = totals.sale_count;
  const average = count ? net / count : 0;
  const tiles = [
    ['Bugünkü satış', money(net), count ? `${count} fiş · ortalama ${money(average)}` : 'Henüz satış yok'],
    ['Nakit', money(totals.cash_net_cents / 100), 'kasaya giren'],
    ['Kart', money(totals.card_net_cents / 100), 'banka POS'],
    ['İade', money(totals.return_cents / 100), 'bugün iade edilen']
  ];
  return (
    <section className="dx-today" aria-label="Bugünkü satış özeti">
      {tiles.map(([label, value, note], index) => (
        <div key={label} data-main={index === 0 ? 'true' : undefined}>
          <span>{label}</span>
          <b>{value}</b>
          <small>{note}</small>
        </div>
      ))}
      <Link to="/magaza/kasa" className="dx-today-go"><ShoppingCart size={16} aria-hidden="true" /> Kasayı aç</Link>
    </section>
  );
}
