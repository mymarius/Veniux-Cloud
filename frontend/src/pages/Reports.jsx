import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import api from '../api/client';
import { readSessionUser } from '../lib/sessionUser';
import RetailDayReport from '../components/RetailDayReport';
import RetailGrossProfitReport from '../components/RetailGrossProfitReport';
import RetailInsights from '../components/RetailInsights';

// Raporlar: kasada çekmece içinde duran günlük, kâr ve satış analizi raporlarını menüden tek yerde toplar.
const TABS = [
  ['gunluk', 'Günlük rapor', 'Bugünün satışı, nakit ve kart toplamları, iadeler'],
  ['kar', 'Kâr', 'Brüt kâr; maliyeti bilinen satışlar üzerinden', true],
  ['analiz', 'Satış analizi', 'En çok satanlar, kasiyer ve saat bazlı dağılım, ölü stok', true]
];

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const [warehouses, setWarehouses] = useState([]);
  const [warehouse, setWarehouse] = useState('');
  const [error, setError] = useState('');
  const user = readSessionUser() || {};
  const manager = ['admin', 'manager'].includes(user.role) || Boolean(user.is_platform_admin);
  const tabs = TABS.filter(([, , , managerOnly]) => !managerOnly || manager);
  const current = tabs.some(([key]) => key === params.get('sekme')) ? params.get('sekme') : tabs[0][0];

  useEffect(() => {
    let live = true;
    api.get('/warehouses').then(r => {
      if (!live) return;
      const rows = Array.isArray(r.data) ? r.data : r.data?.warehouses || [];
      setWarehouses(rows);
      setWarehouse(rows[0] ? String(rows[0].id) : '');
    }).catch(() => { if (live) setError('Depolar alınamadı. Sayfayı yenileyip tekrar deneyin.'); });
    return () => { live = false; };
  }, []);

  const description = tabs.find(([key]) => key === current)?.[2];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5" data-testid="page-reports">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><BarChart3 aria-hidden="true" />Raporlar</h1>
          <p className="text-sm text-slate-500 mt-2">{description}</p>
        </div>
        {warehouses.length > 1 && (
          <label className="text-sm">Depo
            <select className="block border rounded-lg p-2 mt-1" value={warehouse} onChange={e => setWarehouse(e.target.value)}>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
        )}
      </header>

      <div className="vx-view-chips" role="tablist" aria-label="Rapor türü">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={current === key} className="vx-view-chip" onClick={() => setParams({ sekme: key })}>{label}</button>
        ))}
      </div>

      {error && <p role="alert" className="text-red-600">{error}</p>}
      {!manager && <p className="text-sm text-slate-500">Kâr ve satış analizi raporlarını yalnızca yöneticiler görebilir.</p>}

      {current === 'gunluk' && warehouse && <RetailDayReport key={'day-' + warehouse} warehouse={warehouse} canClose={false} />}
      {current === 'gunluk' && warehouse && <p className="text-xs text-slate-500">Günü kapatmak için kasa ekranındaki “Satış geçmişi ve gün sonu” bölümünü kullanın.</p>}
      {current === 'kar' && manager && warehouse && <RetailGrossProfitReport key={'profit-' + warehouse} warehouse={warehouse} />}
      {current === 'analiz' && manager && <RetailInsights />}
      {!warehouse && !error && <p>Önce bir depo oluşturun.</p>}
    </div>
  );
}
