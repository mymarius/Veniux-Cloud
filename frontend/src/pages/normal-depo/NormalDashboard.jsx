import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Boxes, Clock, Flame,
  Layers, Package, PieChart, Plus, RefreshCw, Smartphone, TrendingUp, Wallet, Warehouse
} from 'lucide-react';
import apiClient, { useDataSync } from '../../api/client';
import BusinessChart from '../../components/BusinessChart';
import StockHealthPanel from '../../components/StockHealthPanel';
import { QuickStockModal } from '../../components/QuickModals';
import { useToast } from '../../components/Toast';
import { BarList, Heatmap, Kpi, Legend, Panel, Segmented } from '../../components/dashboard/AnalyticsKit';
import { chartColors } from '../../lib/chartPalette';
import {
  activityHeatmap, asList, change, compact, hourlyProfile, movementLabel, movementTimeline, movementTypes,
  num, parseDate, periodTotals, stockHealth, sumBy, tl, topMovers
} from '../../lib/stockAnalytics';

const IN = '#21a69b', OUT = '#e58282', BLUE = '#3563b1';
const PERIODS = [[7, '7 gün'], [14, '14 gün'], [30, '30 gün'], [90, '90 gün']];

export default function NormalDashboard() {
  const [data, setData] = useState(null);
  const [locations, setLocations] = useState([]);
  const [warehouseId, setWarehouseId] = useState('all');
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [stockModal, setStockModal] = useState(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  useDataSync(() => setTick(t => t + 1));

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all(['/warehouses', '/products', '/stock/records', '/stock/movements?limit=5000'].map(url => apiClient.get(url)))
      .then(([w, p, r, m]) => { if (active) { setData({ warehouses: asList(w.data), products: asList(p.data), records: asList(r.data), movements: asList(m.data) }); setError(''); } })
      .catch(() => { if (active) setError('Depo verileri yüklenemedi. Yenile düğmesiyle tekrar deneyin.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tick]);

  // Raf doluluğu yalnızca tek bir depo seçiliyken anlamlıdır.
  useEffect(() => {
    if (warehouseId === 'all') { setLocations([]); return; }
    let active = true;
    apiClient.get(`/wms/locations?warehouse_id=${warehouseId}`)
      .then(res => { if (active) setLocations(asList(res.data)); })
      .catch(() => { if (active) setLocations([]); });
    return () => { active = false; };
  }, [warehouseId, tick]);

  const view = useMemo(() => {
    if (!data) return null;
    const inWarehouse = row => warehouseId === 'all' || String(row.warehouse_id) === warehouseId || String(row.target_warehouse_id) === warehouseId;
    const movements = data.movements.filter(inWarehouse);
    const records = data.records.filter(row => warehouseId === 'all' || String(row.warehouse_id) === warehouseId);
    const products = warehouseId === 'all' ? data.products : data.products.filter(p => records.some(r => r.product_id === p.id));
    const since = Date.now() - days * 864e5;
    const periodMovements = movements.filter(row => (parseDate(row.created_at)?.getTime() || 0) >= since);
    const totals = periodTotals(movements, days);
    const timeline = movementTimeline(movements, days);
    const health = stockHealth(products, records);
    const value = records.reduce((s, r) => s + Number(r.quantity || 0) * Number(r.purchase_price || 0), 0);
    const units = records.reduce((s, r) => s + Number(r.quantity || 0), 0);
    const busiest = timeline.reduce((best, d) => (d.inbound + d.outbound > best.inbound + best.outbound ? d : best), timeline[0]);
    return {
      movements, records, totals, timeline, health, value, units, busiest,
      types: movementTypes(periodMovements),
      movers: topMovers(periodMovements),
      hourly: hourlyProfile(periodMovements),
      heat: activityHeatmap(periodMovements),
      categories: sumBy(records, r => r.category || 'Diğer', r => Number(r.quantity || 0) * Number(r.purchase_price || 0)).slice(0, 8),
      byWarehouse: sumBy(data.records, r => r.warehouse_name || 'Depo', r => Number(r.quantity || 0) * Number(r.purchase_price || 0))
    };
  }, [data, warehouseId, days]);

  const occupied = locations.filter(l => !l.is_empty).length;
  const occupancy = locations.length ? Math.round((occupied / locations.length) * 100) : null;
  const warehouseName = warehouseId === 'all' ? 'Tüm depolar' : data?.warehouses.find(w => String(w.id) === warehouseId)?.name;

  if (loading && !data) return <div className="space-y-5" data-testid="dashboard-loading"><div className="skeleton h-10 w-64" /><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-32" />)}</div><div className="skeleton h-96 w-full" /></div>;

  const { current, previous } = view?.totals || { current: {}, previous: {} };
  const spark = key => view?.timeline.slice(-14).map(d => d[key]) || [];

  return <div className="ax-page" data-testid="page-dashboard">
    <header className="ax-head">
      <div>
        <span className="ax-eyebrow"><i />Stok ve depo · canlı</span>
        <h1>Depo Özeti</h1>
        <p>{warehouseName} · giriş, çıkış ve stok hareketlerinin {days} günlük analizi</p>
      </div>
      <div className="ax-actions">
        <select aria-label="Depo seçin" data-testid="select-dashboard-warehouse" className="ax-select" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
          <option value="all">Tüm depolar</option>
          {data?.warehouses.map(w => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
        </select>
        <Segmented label="Dönem" value={days} onChange={setDays} options={PERIODS} />
        <button className="ax-btn" onClick={() => setTick(t => t + 1)} aria-label="Verileri yenile" data-testid="button-dashboard-refresh"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        <button className="ax-btn" onClick={() => navigate('/normal-depo/terminal')} data-testid="button-dashboard-terminal"><Smartphone size={15} /> Terminal</button>
        <button className="ax-btn" data-primary onClick={() => setStockModal('inbound')}><Plus size={15} /> Stok girişi</button>
      </div>
    </header>

    {error && <div role="alert" data-testid="status-dashboard-error" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}

    {view && <>
      <StockHealthPanel compact/>
      <section className="ax-grid ax-kpis ax-reveal">
        <Kpi label="Toplam giriş" value={current.inbound} icon={ArrowDownLeft} tone="teal" trend={change(current.inbound, previous.inbound)} spark={spark('inbound')} sparkColor={IN} />
        <Kpi label="Toplam çıkış" value={current.outbound} icon={ArrowUpRight} tone="red" trend={change(current.outbound, previous.outbound)} spark={spark('outbound')} sparkColor={OUT} />
        <Kpi label="Net stok değişimi" value={current.inbound - current.outbound} format={v => (v > 0 ? '+' : '') + num(v)} icon={TrendingUp} tone="blue" detail={`${num(current.count)} işlem · önceki dönem ${num(previous.count)}`} spark={spark('net')} sparkColor={BLUE} />
        <Kpi label="Stok değeri" value={view.value} format={tl} icon={Wallet} tone="violet" detail={`${num(view.units)} birim · ${num(view.records.length)} kayıt`} />
        <Kpi label={occupancy === null ? 'Kritik ürün' : 'Raf doluluğu'} value={occupancy ?? view.health.groups.critical.length + view.health.groups.out.length} format={occupancy === null ? undefined : v => `%${Math.round(v)}`} icon={occupancy === null ? AlertTriangle : Layers} tone="amber" detail={occupancy === null ? 'kritik + tükenen' : `${occupied}/${locations.length} göz dolu`} to={occupancy === null ? '/normal-depo/products' : '/normal-depo/locations'} />
      </section>

      <section className="ax-grid ax-2-1 ax-reveal">
        <Panel icon={Activity} title="Giriş ve çıkış akışı" subtitle="Günlük stok giriş / çıkış miktarı" action={<Link to="/normal-depo/movements">Stok hareketleri <ArrowUpRight size={13} /></Link>}>
          <div className="ax-stats">
            <div><span>Günlük ort. giriş</span><b style={{ color: IN }}>{num(current.inbound / days)}</b></div>
            <div><span>Günlük ort. çıkış</span><b style={{ color: OUT }}>{num(current.outbound / days)}</b></div>
            <div><span>En yoğun gün</span><b>{view.busiest && view.busiest.inbound + view.busiest.outbound ? view.busiest.label : '—'}</b></div>
            <div><span>Çıkış / giriş oranı</span><b>{current.inbound ? `%${Math.round((current.outbound / current.inbound) * 100)}` : '—'}</b></div>
          </div>
          <BusinessChart key={`flow-${days}-${warehouseId}`} title="Günlük giriş ve çıkış" height={290} labels={view.timeline.map(d => d.label)} datasets={[
            { label: 'Giriş', data: view.timeline.map(d => d.inbound), borderColor: IN },
            { label: 'Çıkış', data: view.timeline.map(d => d.outbound), borderColor: OUT }
          ]} />
        </Panel>
        <Panel icon={PieChart} title="Hareket türleri" subtitle={`Son ${days} gündeki işlemlerin dağılımı`}>
          <BusinessChart key={`types-${days}-${warehouseId}`} type="doughnut" title="Hareket türleri" height={240} legend={false} center={{ value: num(view.types.reduce((s, t) => s + t[1], 0)), label: 'işlem' }}
            labels={view.types.map(t => t[0])} datasets={[{ label: 'İşlem', data: view.types.map(t => t[1]), backgroundColor: chartColors }]} />
          <Legend items={view.types.map(([label, value], i) => [label, chartColors[i % chartColors.length], num(value)])} />
        </Panel>
      </section>

      <section className="ax-grid ax-1-1 ax-reveal">
        <Panel icon={TrendingUp} title="Günlük net değişim" subtitle="Girişten çıkış düşülerek bulunan net miktar">
          <BusinessChart key={`net-${days}-${warehouseId}`} type="bar" title="Günlük net değişim" height={260} legend={false} labels={view.timeline.map(d => d.label)}
            datasets={[{ label: 'Net', data: view.timeline.map(d => d.net), backgroundColor: view.timeline.map(d => (d.net >= 0 ? IN : OUT)) }]} />
        </Panel>
        <Panel icon={Flame} title="En çok hareket gören ürünler" subtitle="Giriş ve çıkış miktarına göre ilk 7 ürün">
          <BusinessChart key={`movers-${days}-${warehouseId}`} type="bar" horizontal stacked title="En çok hareket gören ürünler" height={260} labels={view.movers.map(m => m.name.length > 22 ? m.name.slice(0, 21) + '…' : m.name)} datasets={[
            { label: 'Giriş', data: view.movers.map(m => m.inbound), backgroundColor: IN },
            { label: 'Çıkış', data: view.movers.map(m => m.outbound), backgroundColor: OUT }
          ]} />
        </Panel>
      </section>

      <section className="ax-grid ax-1-1 ax-reveal">
        <Panel icon={Clock} title="Saatlik dağılım" subtitle="Günün hangi saatlerinde stok hareket ediyor">
          <BusinessChart key={`hourly-${days}-${warehouseId}`} type="bar" stacked title="Saatlik giriş ve çıkış" height={240} labels={view.hourly.map((_, h) => String(h).padStart(2, '0'))} datasets={[
            { label: 'Giriş', data: view.hourly.map(h => h.inbound), backgroundColor: IN },
            { label: 'Çıkış', data: view.hourly.map(h => h.outbound), backgroundColor: OUT }
          ]} />
        </Panel>
        <Panel icon={Activity} title="Haftalık yoğunluk haritası" subtitle="Gün ve saate göre işlem sayısı">
          <Heatmap key={`heat-${days}-${warehouseId}`} grid={view.heat} />
        </Panel>
      </section>

      <section className="ax-grid ax-2-1 ax-reveal">
        <Panel icon={Boxes} title="Kategorilere göre stok değeri" subtitle="Alış fiyatı üzerinden">
          <BusinessChart key={`cat-${warehouseId}`} type="bar" title="Kategorilere göre stok değeri" height={260} legend={false} valueFormat={compact}
            labels={view.categories.map(c => c[0])} datasets={[{ label: 'Değer', data: view.categories.map(c => c[1]), backgroundColor: chartColors }]} />
        </Panel>
        <Panel icon={AlertTriangle} title="Stok sağlığı" subtitle="Minimum ve maksimum seviyelere göre" action={<Link to="/normal-depo/products">Ürünler <ArrowUpRight size={13} /></Link>}>
          {(() => {
            const g = view.health.groups;
            const rows = [['Sağlıklı', g.healthy.length, IN], ['Kritik', g.critical.length, '#e9ad51'], ['Tükendi', g.out.length, OUT], ['Fazla stok', g.excess.length, '#9b8cdb']];
            return <>
              <BusinessChart key={`health-${warehouseId}`} type="doughnut" title="Stok sağlığı" height={190} legend={false} center={{ value: num(rows.reduce((s, r) => s + r[1], 0)), label: 'ürün' }}
                labels={rows.map(r => r[0])} datasets={[{ label: 'Ürün', data: rows.map(r => r[1]), backgroundColor: rows.map(r => r[2]) }]} />
              <Legend items={rows.map(([label, value, color]) => [label, color, value])} />
            </>;
          })()}
        </Panel>
      </section>

      <section className="ax-grid ax-1-2 ax-reveal">
        <Panel icon={Warehouse} title="Depolara göre stok değeri" subtitle="Tüm depoların karşılaştırması">
          <BarList rows={view.byWarehouse.map(([label, value], i) => ({ label, value, color: warehouseName === label ? BLUE : chartColors[(i + 1) % chartColors.length] }))} format={tl} empty="Henüz depoda stok yok." />
          <h3 className="mb-3 mt-6 text-[12px] font-semibold text-slate-600">Öncelikli ürünler</h3>
          <BarList rows={[...view.health.groups.out, ...view.health.groups.critical].slice(0, 5).map(p => ({ label: p.name, value: p.qty, hint: `Minimum ${num(p.min_stock_level)} · ${p.sku}`, color: p.qty <= 0 ? OUT : '#e9ad51' }))} format={num} empty="Kritik seviyede ürün yok." />
        </Panel>
        <Panel icon={ArrowRightLeft} title="Son hareketler" subtitle="En yeni 10 stok işlemi" action={<Link to="/normal-depo/movements">Tümü <ArrowUpRight size={13} /></Link>}>
          <div className="overflow-x-auto">
            <table className="ax-table">
              <thead><tr><th>İşlem</th><th>Ürün</th><th>Depo</th><th data-num>Miktar</th><th data-num>Zaman</th></tr></thead>
              <tbody>
                {view.movements.slice(0, 10).map(row => {
                  const qty = Number(row.change_amount || 0);
                  const date = parseDate(row.created_at);
                  return <tr key={row.id}>
                    <td><span className="ax-pill" data-tone={/transfer/i.test(row.movement_type) ? 'neutral' : qty >= 0 ? 'in' : 'out'}>{movementLabel(row)}</span></td>
                    <td><b className="font-semibold text-slate-700">{row.product_name}</b><div className="text-[10.5px] text-slate-400">{row.sku}</div></td>
                    <td>{row.warehouse_name}{row.target_warehouse_name ? ` → ${row.target_warehouse_name}` : ''}</td>
                    <td data-num className={qty >= 0 ? 'font-bold text-teal-700' : 'font-bold text-red-500'}>{qty > 0 ? '+' : ''}{num(qty)}</td>
                    <td data-num className="text-slate-500">{date ? date.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </tr>;
                })}
                {!view.movements.length && <tr><td colSpan={5} className="py-10 text-center text-slate-400">Henüz stok hareketi bulunmuyor.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    </>}

    <QuickStockModal isOpen={!!stockModal} type={stockModal || 'inbound'} onClose={() => setStockModal(null)}
      onSuccess={() => { showToast('Stok girişi tamamlandı.', 'success'); setStockModal(null); setTick(t => t + 1); }} />
  </div>;
}
