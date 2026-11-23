import { currencySymbol } from '../../../shared/money.mjs';
import { t as __t } from '../i18n';
import { readSessionUser } from '../lib/sessionUser';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import {
  Activity, AlertTriangle, ArrowDownLeft, ArrowUpRight, BadgeDollarSign, Bell, Boxes, ChevronDown,
  Gauge, Handshake, IdCard, Package, RefreshCw, Truck, Wallet, Warehouse
} from 'lucide-react';
import api, { useDataSync } from '../api/client';
import BusinessChart from '../components/BusinessChart';
import RevealText from '../components/RevealText';
import TodaySales from '../components/dashboard/TodaySales';
import StockHealthPanel from '../components/StockHealthPanel';
import './DashboardPro.css';
import { BarList, CountUp, Kpi, Legend, Panel, ScoreRing, Segmented } from '../components/dashboard/AnalyticsKit';
import { chartColors } from '../lib/chartPalette';
import { DEPARTMENTS } from '../mock/hrData';
import {
  asList, change, compact, dayKey, movementLabel, movementTimeline, num, parseDate, periodTotals, sumBy, tl
} from '../lib/stockAnalytics';

const IN = '#0d7a57', OUT = '#cf4b06', BLUE = '#17263a', AMBER = '#b98a1e', VIOLET = '#6c7d96';
const PERIODS = [[7, '7 gün'], [30, '30 gün'], [90, '90 gün']];
const STAGES = [['qualification', 'Niteleme'], ['proposal', 'Teklif'], ['negotiation', 'Pazarlık'], ['won', 'Kazanıldı'], ['lost', 'Kaybedildi']];
const SEVERITY = { critical: ['Kritik', OUT], danger: ['Kritik', OUT], warning: ['Uyarı', AMBER], info: ['Bilgi', BLUE] };
const PO_STATUS = { completed: ['Tamamlandı', IN], in_transit: ['Sevkiyatta', BLUE] };
const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
const todayISO = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());

// Bir istek başarısız olursa (yetki, paket) ilgili bölüm boş veriyle çalışır.
const safe = request => request.then(res => res.data).catch(() => null);

function HeroArea({ data }) {
  const max = Math.max(...data, 1), min = Math.min(...data, 0), span = max - min || 1;
  const points = data.map((v, i) => [data.length > 1 ? i / (data.length - 1) * 100 : 0, 34 - (v - min) / span * 30]);
  const line = points.map(p => p.join(',')).join(' ');
  return <svg className="dx-area" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true"><polygon points={`0,36 ${line} 100,36`} /><polyline points={line} vectorEffect="non-scaling-stroke" /></svg>;
}

function Delta({ value }) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return <small>{__t('Önceki dönem verisi yok')}</small>;
  return <small data-up={value >= 0}>{value >= 0 ? '▲' : '▼'} %{Math.abs(Math.round(value))} önceki döneme göre</small>;
}

export default function Dashboard() {
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [revision, setRevision] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const user = readSessionUser();

  const canViewCosts = ['admin', 'manager'].includes(user.role) || Boolean(user.is_platform_admin);
  useDataSync(() => setRevision(x => x + 1));

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([
      Promise.all(['/warehouses', '/stock/dashboard-summary', '/stock/movements?limit=5000'].map(url => api.get(url))),
      Promise.all([safe(api.get('/alerts')), safe(api.get('/purchase-orders')), safe(api.get('/suppliers')), safe(api.get('/workspaces/crm')), safe(api.get('/workspaces/hr'))])
    ]).then(([core, [alerts, orders, suppliers, crm, hr]]) => {
      if (!active) return;
      setRaw({
        warehouses: asList(core[0].data), summary: core[1].data || {}, movements: asList(core[2].data),
        alerts: asList(alerts), orders: asList(orders), suppliers: asList(suppliers),
        crm: crm?.data || null, hr: hr?.data || null
      });
      setUpdatedAt(new Date());
    }).catch(() => { if (active) setError('Operasyon verileri yüklenemedi. Yenile düğmesiyle tekrar deneyin.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  const a = useMemo(() => {
    if (!raw) return null;
    // Ürün/stok kayıtları tarayıcıya indirilmez: özet sunucuda hesaplanır (/stock/dashboard-summary).
    const { summary, movements } = raw;
    const value = Number(summary.value || 0), saleValue = Number(summary.sale_value || 0), units = Number(summary.units || 0);
    const health = { counts: { healthy: 0, critical: 0, out: 0, excess: 0, ...summary.health }, attention: summary.attention || [] };
    const totals = periodTotals(movements, days);
    const timeline = movementTimeline(movements, days);
    const openAlerts = raw.alerts.filter(x => ['unread', 'active'].includes(x.status));

    // Stok değeri zaman serisi: bugünkü değerden geriye doğru hareketler geri alınarak bulunur.
    const dailyValueDelta = new Map();
    movements.forEach(m => {
      const date = parseDate(m.created_at); if (!date || /transfer/i.test(m.movement_type || '')) return;
      const key = dayKey(date);
      dailyValueDelta.set(key, (dailyValueDelta.get(key) || 0) + Number(m.change_amount || 0) * Number(m.unit_cost || 0));
    });
    let running = value;
    const valueSeries = [...timeline].reverse().map(d => { const v = running; running -= dailyValueDelta.get(d.key) || 0; return Math.max(0, v); }).reverse();

    // Ürün bazında değer: sunucu ilk 8'i hazır verir
    const productRows = (canViewCosts ? summary.top_by_value : summary.top_by_qty) || [];

    // CRM
    const deals = raw.crm?.deals || [], tasks = raw.crm?.tasks || [], leads = raw.crm?.leads || [];
    const openDeals = deals.filter(d => !['won', 'lost'].includes(d.stage));
    const won = deals.filter(d => d.stage === 'won'), closed = deals.filter(d => ['won', 'lost'].includes(d.stage));
    const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate < todayISO());

    // Personel
    const employees = (raw.hr?.employees || []).filter(e => e.status !== 'ayrildi');

    const expiry = null;

    // Sağlık skoru bileşenleri (0-100)
    const productCount = summary.product_count || 1;
    const turnover = units ? (totals.current.outbound / units) * (30 / days) : 0;
    const dims = [
      ['Stok sağlığı', summary.product_count ? clamp((health.counts.healthy + health.counts.excess * 0.5) / productCount * 100) : 100],
      ['Uyarı kontrolü', clamp(100 - openAlerts.length * 8)],
      ['Stok devri', clamp(turnover * 100)],
      ['Tedarik', raw.orders.length ? clamp(raw.orders.filter(o => o.status === 'completed').length / raw.orders.length * 100) : null],
      ['Satış başarısı', closed.length ? clamp(won.length / closed.length * 100) : null],
      ['Görev disiplini', tasks.length ? clamp(100 - overdueTasks.length / tasks.length * 100) : null],
      ['Miat güvenliği', expiry && raw.lots.length ? clamp(100 - (expiry[0][1] + expiry[1][1]) / Math.max(1, expiry.reduce((s, b) => s + b[1], 0)) * 100) : null]
    ].filter(d => d[1] !== null);
    const core = dims.filter(d => ['Stok sağlığı', 'Uyarı kontrolü', 'Miat güvenliği', 'Görev disiplini'].includes(d[0]));
    const score = core.length ? Math.round(core.reduce((s, d) => s + d[1], 0) / core.length) : 100;

    return {
      value, saleValue, units, health, totals, timeline, valueSeries, openAlerts, productRows,
      deals, openDeals, won, closed, leads, tasks, overdueTasks, employees, expiry, dims, score,
      byWarehouse: (summary.by_warehouse || []).map(w => [w.name, canViewCosts ? w.value : 0]).sort((x, y) => y[1] - x[1]),
      byWarehouseQty: (summary.by_warehouse || []).map(w => [w.name, w.qty]).sort((x, y) => y[1] - x[1]),
      byCategory: (summary.categories || []).map(([n, v]) => [n, canViewCosts ? v : 0]).slice(0, 6),
      byCategoryQty: (summary.categories_qty || []).slice(0, 6),
      alertTypes: sumBy(raw.alerts, x => (SEVERITY[x.severity] || ['Diğer'])[0], () => 1)
    };
  }, [raw, days, canViewCosts]);

  const { current, previous } = a?.totals || {};
  const scoreText = !a ? '' : a.score >= 80 ? 'İşletmeniz dengeli görünüyor.' : a.score >= 55 ? 'Dikkat gerektiren birkaç alan var.' : 'Öncelikli aksiyon gereken alanlar var.';

  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });

  const easy = !!useTheme()?.prefs?.easy;
  const EASY_ACTIONS = [
    ['Satış yap', 'Kasayı açıp ürün sat', '/magaza/kasa'],
    ['Ürün ekle', 'Yeni ürün kaydet', '/magaza/hizli-ekle'],
    ['Ürünlerime bak', 'Listede ara, fiyat ve stok gör', '/normal-depo/products'],
    ['Mal geldi', 'Gelen malı stoğa ekle', '/normal-depo/inbound'],
    ['Stok hareketleri', 'Ne girdi, ne çıktı', '/normal-depo/movements'],
    ['Uyarılar', 'Biten ve azalan ürünler', '/alerts']
  ];

  return <div className="ax-page ax-overview">
    {easy && <section className="easy-home" aria-label={__t('Ne yapmak istiyorsunuz?')}>
      <h2>{__t('Ne yapmak istiyorsunuz?')}</h2>
      <div>{EASY_ACTIONS.map(([t, d, to]) => <Link key={to} to={to}><b>{t}</b><span>{d}</span></Link>)}</div>
    </section>}
    <header className="ax-head">
      <div>
        <RevealText text="Genel Bakış" />
        <p>{[user.company_name, today].filter(Boolean).join(' · ')}{updatedAt ? ` · son güncelleme ${updatedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
      </div>
      <div className="ax-actions">
        <Segmented label={__t('Analiz dönemi')} value={days} onChange={setDays} options={PERIODS} />
        <button className="ax-btn" disabled={loading} onClick={() => setRevision(x => x + 1)}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> {__t('Yenile')}</button>
      </div>
    </header>

    {error && <div role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {loading && !a && <div role="status" className="space-y-4"><div className="skeleton h-56 w-full rounded-xl" /><div className="skeleton h-96 w-full rounded-xl" /></div>}

    {a && <>
      <TodaySales warehouses={raw.warehouses} revision={revision} />

      <section className="dx-hero">
        <div className="dx-hero-main">
          <span>{canViewCosts ? 'Toplam stok değeri' : 'Toplam stok'}</span>
          <strong>{canViewCosts ? <CountUp value={a.value} format={tl} /> : <CountUp value={a.units} format={v => num(v) + ' birim'} />}</strong>
          <small>{num(a.units)} birim · {raw.summary.product_count} ürün · {raw.warehouses.length} depo</small>
          {canViewCosts && <HeroArea data={a.valueSeries} />}
        </div>
        <div className="dx-hero-stats">
          <div><span>{__t('Dönem girişi')}</span><b><CountUp value={current.inbound} format={num} /></b><Delta value={change(current.inbound, previous.inbound)} /></div>
          <div><span>{__t('Dönem çıkışı')}</span><b><CountUp value={current.outbound} format={num} /></b><Delta value={change(current.outbound, previous.outbound)} /></div>
          {canViewCosts && <div><span>{__t('Satış değeri')}</span><b><CountUp value={a.saleValue} format={v => compact(v) + ' ' + currencySymbol()} /></b><small>Potansiyel kâr {compact(a.saleValue - a.value)} {currencySymbol()}</small></div>}
        </div>
        <div className="dx-hero-score" aria-label={`İşletme sağlık skoru ${a.score}`}>
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" /><circle cx="60" cy="60" r="50" pathLength="100" strokeDasharray={`${a.score} 100`} data-tone={a.score >= 80 ? 'good' : a.score >= 55 ? 'mid' : 'bad'} /></svg>
          <b><CountUp value={a.score} /></b><span>{__t('Sağlık skoru')}</span>
          <small>{scoreText}</small>
        </div>
      </section>

      <section className="dx-todo" aria-label={__t('Bugün yapılacaklar')}>
        <Link to="/normal-depo/products" data-tone={a.health.counts.out + a.health.counts.critical ? 'bad' : 'good'}><i><AlertTriangle size={18} /></i><span><b>{a.health.counts.out + a.health.counts.critical}</b> {__t('ürün kritik seviyede')}<small>{a.health.counts.out} ürün tükendi · sipariş planlayın</small></span><ArrowUpRight size={16} /></Link>
        <Link to="/alerts" data-tone={a.openAlerts.length ? 'mid' : 'good'}><i><Bell size={18} /></i><span><b>{a.openAlerts.length}</b> {__t('açık uyarı')}<small>{raw.alerts.length} toplam bildirim</small></span><ArrowUpRight size={16} /></Link>
        <Link to="/crm/dashboard" data-tone={a.overdueTasks.length ? 'mid' : 'info'}><i><Handshake size={18} /></i><span><b>{a.openDeals.length}</b> {__t('açık fırsat')}<small>{a.overdueTasks.length} geciken görev</small></span><ArrowUpRight size={16} /></Link>
      </section>

      <section className="ax-grid ax-2-1 ax-reveal">
        <Panel icon={Activity} title={__t('Stok akışı ve değer trendi')} subtitle={`Son ${days} gün · giriş, çıkış${canViewCosts ? ' ve tahmini stok değeri' : ''}`} action={<Link to="/normal-depo/dashboard">{__t('Depo analizi')} <ArrowUpRight size={13} /></Link>}>
          <BusinessChart key={`flow-${days}`} title={__t('Stok akışı ve değer trendi')} height={300} labels={a.timeline.map(d => d.label)}
            options={{ scales: {
              x: { grid: { display: false }, border: { display: false }, ticks: { color: '#8290a4', maxTicksLimit: 8, maxRotation: 0 } },
              y: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(128,128,128,.18)' }, ticks: { color: '#8290a4', maxTicksLimit: 5, callback: v => compact(v) } },
              ...(canViewCosts ? { y1: { position: 'right', beginAtZero: true, border: { display: false }, grid: { display: false }, ticks: { color: '#8290a4', maxTicksLimit: 5, callback: v => compact(v) + ' ' + currencySymbol() } } } : {})
            } }}
            datasets={[
              { label: 'Giriş', data: a.timeline.map(d => d.inbound), borderColor: IN },
              { label: 'Çıkış', data: a.timeline.map(d => d.outbound), borderColor: OUT },
              ...(canViewCosts ? [{ label: `Stok değeri (${currencySymbol()})`, data: a.valueSeries, borderColor: VIOLET, fill: false, borderDash: [5, 4], yAxisID: 'y1' }] : [])
            ]} />
        </Panel>
        <Panel icon={Package} title={__t('Stok sağlığı')} subtitle={`${raw.summary.product_count} ürünün durumu`} action={<Link to="/normal-depo/products">{__t('Ürünler')} <ArrowUpRight size={13} /></Link>}>
          {(() => {
            const g = a.health.counts, rows = [['Sağlıklı', g.healthy, IN], ['Kritik', g.critical, AMBER], ['Tükendi', g.out, OUT], ['Fazla stok', g.excess, VIOLET]];
            const all = rows.reduce((t, r) => t + r[1], 0) || 1;
            return <>
              <div className="dx-stack" role="img" aria-label={rows.map(r => `${r[0]} ${r[1]}`).join(', ')}>{rows.filter(r => r[1]).map(r => <i key={r[0]} style={{ width: `${r[1] / all * 100}%`, background: r[2] }} />)}</div>
              <ul className="dx-legend">{rows.map(r => <li key={r[0]}><i style={{ background: r[2] }} />{r[0]}<b>{r[1]}</b></li>)}</ul>
            </>;
          })()}
          <h3 className="dx-sub">{__t('Öncelikli ürünler')}</h3>
          <ul className="dx-priority">
            {a.health.attention.slice(0, 4).map(p => <li key={p.id || p.sku}><div><b>{p.name}</b><span>{num(p.qty)} / {num(p.min_stock_level)}</span></div><i><u style={{ width: `${Math.min(100, p.qty / Math.max(1, p.min_stock_level) * 100)}%`, background: p.qty <= 0 ? OUT : AMBER }} /></i></li>)}
            {!a.health.attention.length && <li className="ax-empty">{__t('Kritik ürün yok.')}</li>}
          </ul>
        </Panel>
      </section>

      <section className="ax-grid ax-2-1 ax-reveal">
        <Panel icon={Activity} title={__t('Son hareketler')} subtitle="Tüm depolardaki en yeni işlemler" action={<Link to="/normal-depo/movements">{__t('Tümü')} <ArrowUpRight size={13} /></Link>}>
          <ol className="dx-timeline">
            {raw.movements.slice(0, 7).map(row => {
              const qty = Number(row.change_amount || 0), date = parseDate(row.created_at);
              return <li key={row.id} data-dir={/transfer/i.test(row.movement_type) ? 'move' : qty >= 0 ? 'in' : 'out'}>
                <i>{qty >= 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}</i>
                <div><b>{row.product_name}</b><span>{movementLabel(row)} · {row.warehouse_name}</span></div>
                <em>{qty > 0 ? '+' : ''}{num(qty)}</em>
                <time>{date ? date.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</time>
              </li>;
            })}
            {!raw.movements.length && <li className="ax-empty">{__t('Henüz stok hareketi bulunmuyor.')}</li>}
          </ol>
        </Panel>
        <Panel icon={Warehouse} title={__t('Depolar')} subtitle="Stok miktarı ve kapasite" action={<Link to="/normal-depo/warehouses">{__t('Tümü')} <ArrowUpRight size={13} /></Link>}>
          <ul className="dx-priority">
            {raw.warehouses.map(w => {
              const qty = a.byWarehouseQty.find(x => x[0] === w.name)?.[1] || 0, cap = Number(w.capacity || 0), pct = cap ? Math.min(100, qty / cap * 100) : 0;
              return <li key={w.id}><div><b>{w.name}</b><span>{num(qty)}{cap ? ` / ${num(cap)} · %${Math.round(pct)}` : ''}</span></div><i><u style={{ width: `${pct}%`, background: BLUE }} /></i></li>;
            })}
            {!raw.warehouses.length && <li className="ax-empty">{__t('Henüz depo tanımlanmadı.')}</li>}
          </ul>
          {canViewCosts && <><h3 className="dx-sub">{__t('Kategoriye göre değer')}</h3>
          <BarList rows={a.byCategory.slice(0, 4).map(([label, value], i) => ({ label, value, color: chartColors[i % chartColors.length] }))} format={tl} empty="Henüz kategori verisi yok." /></>}
        </Panel>
      </section>

      <button type="button" className="ax-more" aria-expanded={showDetails} onClick={() => setShowDetails(x => !x)}>
        <ChevronDown size={16} /> {showDetails ? 'Ayrıntılı analizi gizle' : 'Ayrıntılı analizi göster'}
      </button>

      {showDetails && <>
        {['NORMAL','BOTH'].includes(user.module_type)&&<StockHealthPanel compact/>}
        <section className="ax-grid ax-kpis ax-reveal">
          <Kpi label={__t('Satış değeri')} value={a.saleValue} format={v => compact(v) + ' ' + currencySymbol()} icon={BadgeDollarSign} tone="teal" detail={canViewCosts ? (a.saleValue ? `potansiyel kâr ${compact(a.saleValue - a.value)} ${currencySymbol()}` : 'satış fiyatı girilmemiş') : `${num(a.units)} birim satışta`} />
          <Kpi label={__t('Ürün çeşidi')} value={raw.summary.product_count} icon={Package} tone="violet" detail={`${num(a.units)} birim · ${raw.warehouses.length} depo`} to="/normal-depo/products" />
          <Kpi label={__t('Açık pipeline')} value={a.openDeals.reduce((s, d) => s + Number(d.value || 0), 0)} format={v => compact(v) + ' ' + currencySymbol()} icon={Handshake} tone="blue" detail={`${a.openDeals.length} açık fırsat`} to="/crm/deals" />
        </section>

        <section className="ax-grid ax-3 ax-reveal">
        <Panel icon={Gauge} title={__t('İşletme sağlık skoru')} subtitle="Stok, uyarı, miat ve görev durumundan hesaplanır">
          <ScoreRing score={a.score} label="/ 100" caption={scoreText} />
          <div className="mt-5"><BarList rows={a.dims.map(([label, v]) => ({ label, value: v, color: v >= 80 ? IN : v >= 55 ? AMBER : OUT }))} format={v => `%${v}`} /></div>
        </Panel>
        <Panel icon={Boxes} title={__t('Kategori dağılımı')} subtitle="Kategorilere göre stok değeri">
          <BarList rows={a.byCategory.map(([label, value], i) => ({ label, value, color: chartColors[i % chartColors.length] }))} format={tl} empty="Henüz kategori verisi yok." />
        </Panel>
        <Panel icon={Package} title={__t('Stok sağlığı')} subtitle="Min / maks seviyelerine göre ürünler" action={<Link to="/normal-depo/products">{__t('Ürünler')} <ArrowUpRight size={13} /></Link>}>
          {(() => {
            const g = a.health.counts;
            const rows = [['Sağlıklı', g.healthy, IN], ['Kritik', g.critical, AMBER], ['Tükendi', g.out, OUT], ['Fazla stok', g.excess, VIOLET]];
            return <>
              <BusinessChart type="doughnut" title={__t('Stok sağlığı')} height={200} legend={false} center={{ value: num(raw.summary.product_count), label: 'ürün' }}
                labels={rows.map(r => r[0])} datasets={[{ label: 'Ürün', data: rows.map(r => r[1]), backgroundColor: rows.map(r => r[2]) }]} />
              <Legend items={rows.map(([l, v, c]) => [l, c, v])} />
            </>;
          })()}
        </Panel>
        </section>

        <section className="ax-grid ax-1-1 ax-reveal">
        <Panel icon={canViewCosts ? Wallet : Package} title={canViewCosts ? "En değerli stoklar" : "En yüksek stoklu ürünler"} subtitle={canViewCosts ? "Alış değerine göre ilk 8 ürün" : "Mevcut adede göre ilk 8 ürün"}>
          {(() => {
            const rows = canViewCosts
              ? [...a.productRows].sort((x, y) => y.value - x.value).filter(r => r.value > 0).slice(0, 8)
              : [...a.productRows].sort((x, y) => y.qty - x.qty).filter(r => r.qty > 0).slice(0, 8);
            return <BusinessChart type="bar" horizontal title={canViewCosts ? "En değerli stoklar" : "En yüksek stoklu ürünler"} height={280} legend={false} valueFormat={canViewCosts ? compact : num}
              labels={rows.map(r => (r.name.length > 24 ? r.name.slice(0, 23) + '…' : r.name))} datasets={[{ label: canViewCosts ? `Değer (${currencySymbol()})` : 'Miktar (adet)', data: rows.map(r => canViewCosts ? r.value : r.qty), backgroundColor: BLUE }]} />;
          })()}
        </Panel>
        <Panel icon={Bell} title={__t('Bildirim dağılımı')} subtitle="Önem derecesine göre" action={<Link to="/alerts">{__t('Bildirimler')} <ArrowUpRight size={13} /></Link>}>
          <BusinessChart type="bar" title={__t('Bildirim dağılımı')} height={250} legend={false} labels={a.alertTypes.map(x => x[0])}
            datasets={[{ label: 'Bildirim', data: a.alertTypes.map(x => x[1]), backgroundColor: a.alertTypes.map(x => Object.values(SEVERITY).find(s => s[0] === x[0])?.[1] || '#7295b2') }]} />
        </Panel>
        </section>

        <section className="ax-grid ax-3 ax-reveal">
        <Panel icon={Handshake} title={__t('Satış hunisi')} subtitle={`${a.deals.length} fırsat · kazanma oranı ${a.closed.length ? `%${Math.round(a.won.length / a.closed.length * 100)}` : '—'}`} action={<Link to="/crm/dashboard">CRM <ArrowUpRight size={13} /></Link>}>
          <BusinessChart type="bar" title={__t('Aşamalara göre fırsat değeri')} height={230} legend={false} valueFormat={compact} labels={STAGES.map(s => s[1])}
            datasets={[{ label: `Değer (${currencySymbol()})`, data: STAGES.map(([id]) => a.deals.filter(d => d.stage === id).reduce((s, d) => s + Number(d.value || 0), 0)), backgroundColor: ['#94a3b8', AMBER, BLUE, IN, OUT] }]} />
          <div className="ax-stats mt-4" style={{ marginBottom: 0 }}><div><span>{__t('Aday müşteri')}</span><b>{num(a.leads.length)}</b></div><div><span>{__t('Geciken görev')}</span><b className={a.overdueTasks.length ? 'text-red-500' : ''}>{num(a.overdueTasks.length)}</b></div></div>
        </Panel>
        <Panel icon={Truck} title={__t('Satın alma siparişleri')} subtitle={`${raw.orders.length} sipariş · ${raw.suppliers.length} tedarikçi`}>
            {(() => {
              const rows = sumBy(raw.orders, o => (PO_STATUS[o.status] || ['Onay bekliyor'])[0], () => 1);
              const color = l => Object.values(PO_STATUS).find(s => s[0] === l)?.[1] || AMBER;
              return <>
                <BusinessChart type="doughnut" title={__t('Sipariş durumları')} height={190} legend={false} center={{ value: num(raw.orders.length), label: 'sipariş' }}
                  labels={rows.map(r => r[0])} datasets={[{ label: 'Sipariş', data: rows.map(r => r[1]), backgroundColor: rows.map(r => color(r[0])) }]} />
                <Legend items={rows.map(([l, v]) => [l, color(l), v])} />
                <p className="mt-3 text-[11.5px] text-slate-500">{__t('Toplam sipariş tutarı')} <b className="text-slate-700">{tl(raw.orders.reduce((s, o) => s + Number(o.total_amount || 0), 0))}</b></p>
              </>;
            })()}
          </Panel>
        <Panel icon={IdCard} title={__t('Ekip dağılımı')} subtitle={`${a.employees.length} aktif çalışan`} action={<Link to="/crm/team">{__t('Personel')} <ArrowUpRight size={13} /></Link>}>
          {raw.hr
            ? (() => {
              const rows = sumBy(a.employees, e => DEPARTMENTS.find(d => d.id === e.departmentId)?.name || 'Diğer', () => 1);
              return <>
                <BusinessChart type="doughnut" title={__t('Departmanlara göre personel')} height={190} legend={false} center={{ value: num(a.employees.length), label: 'kişi' }}
                  labels={rows.map(r => r[0])} datasets={[{ label: 'Personel', data: rows.map(r => r[1]), backgroundColor: chartColors }]} />
                <Legend items={rows.map(([l, v], i) => [l, chartColors[i % chartColors.length], v])} />
              </>;
            })()
            : <p className="ax-empty">{__t('Personel verilerini yalnızca yöneticiler görebilir.')}</p>}
        </Panel>
        </section>
      </>}
    </>}
  </div>;
}
