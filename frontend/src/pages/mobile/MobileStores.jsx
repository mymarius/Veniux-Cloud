import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, ChevronRight, ScanLine, Search, Store } from 'lucide-react';
import api from '../../api/client';
import { asList, dayKey } from '../../lib/stockAnalytics';
import { roleLabel } from '../../lib/mobileHub.mjs';
import { MobileTop, EmptyState, money } from './mobileKit';

const norm = s => String(s ?? '').toLocaleLowerCase('tr-TR');
const storeCode = w => w.code || w.warehouse_code || w.id;

// "Mağazalarım": aranabilir mağaza listesi.
export function MobileStores() {
  const [items, setItems] = useState(null), [q, setQ] = useState(''), [error, setError] = useState('');
  useEffect(() => { let live = true; api.get('/warehouses').then(r => { if (live) setItems(asList(r.data)); }).catch(e => { if (live) setError(e.response?.data?.error || 'Mağazalar alınamadı.'); }); return () => { live = false; }; }, []);
  const shown = useMemo(() => (items || []).filter(w => norm(w.name + ' ' + storeCode(w)).includes(norm(q.trim()))), [items, q]);
  return <div className="vm">
    <MobileTop title="Mağazalarım" flat />
    <div className="vm-body" style={{ marginTop: 0, paddingTop: 18 }}>
      <label className="vm-search"><Search size={18} /><input type="search" placeholder="Mağaza Ara" value={q} onChange={e => setQ(e.target.value)} aria-label="Mağaza ara" /></label>
      {error && <p role="alert" className="vm-err">{error}</p>}
      {!items && !error && <p role="status" className="vm-note">Mağazalar yükleniyor…</p>}
      {items && (shown.length === 0
        ? <EmptyState icon={<Store size={34} />} title="Mağaza yok" text={q ? 'Aramanızla eşleşen mağaza bulunamadı.' : 'Henüz mağaza eklenmemiş.'} />
        : <div className="vm-list">{shown.map(w => <Link key={w.id} to={'/m/magazalar/' + w.id} className="vm-row"><Store size={20} /><span className="grow">{w.name}<small>Kod: {storeCode(w)}</small></span><ChevronRight size={18} /></Link>)}</div>)}
    </div>
  </div>;
}

const TABS = [['detay', 'Mağaza Detay'], ['hareket', 'Hareket'], ['rapor', 'Rapor'], ['ekip', 'Ekip']];
const dayAgo = (n) => dayKey(new Date(Date.now() - n * 86400000));

// Mağaza ayrıntısı: bugünkü ciro kartı ve dört sekme (A101'deki Mağaza Detay / Ziyaret / Rapor / Organizasyon karşılığı).
export function MobileStoreDetail() {
  const { id } = useParams();
  const [store, setStore] = useState(null), [tab, setTab] = useState('detay'), [today, setToday] = useState(null), [yesterday, setYesterday] = useState(null);
  const [moves, setMoves] = useState(null), [team, setTeam] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api.get('/warehouses').then(r => { const w = asList(r.data).find(x => String(x.id) === String(id)); if (live) { if (w) setStore(w); else setError('Mağaza bulunamadı.'); } }).catch(() => live && setError('Mağaza alınamadı.'));
    api.get('/scanner/day-report', { params: { warehouse_id: id, date: dayAgo(0) } }).then(r => live && setToday(r.data)).catch(() => live && setToday(false));
    api.get('/scanner/day-report', { params: { warehouse_id: id, date: dayAgo(1) } }).then(r => live && setYesterday(r.data)).catch(() => {});
    return () => { live = false; };
  }, [id]);
  useEffect(() => {
    let live = true;
    if (tab === 'hareket' && !moves) api.get('/stock/movements', { params: { warehouse_id: id, limit: 30 } }).then(r => live && setMoves(asList(r.data))).catch(() => live && setMoves([]));
    if (tab === 'ekip' && !team) api.get('/settings/users').then(r => live && setTeam(asList(r.data))).catch(() => live && setTeam(false));
    return () => { live = false; };
  }, [tab, id, moves, team]);
  const todaySales = today ? today.sales_cents / 100 : null, prev = yesterday ? yesterday.sales_cents / 100 : null;
  const change = todaySales !== null && prev ? ((todaySales - prev) / prev) * 100 : null;
  return <div className="vm">
    <MobileTop title={store?.name || 'Mağaza'} right={<Link to="/m/tara" className="vm-iconbtn" aria-label="Barkod okut"><ScanLine size={20} /></Link>} flat />
    <div className="vm-body" style={{ marginTop: 0, paddingTop: 18 }}>
      {error && <p role="alert" className="vm-err">{error} <Link to="/m/magazalar">Mağazalara dön</Link></p>}
      <section className="vm-card" aria-label="Mağaza cirosu">
        <div className="vm-note">Mağaza Cirosu (bugün)</div>
        <div className="vm-stat"><span className="vm-money">{today === null ? '…' : today === false ? '—' : money(todaySales)}</span>
          {change !== null && <span className={'chip' + (change < 0 ? ' down' : '')}>{change < 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}%{Math.abs(change).toFixed(1).replace('.', ',')}</span>}</div>
        {today && <div className="vm-note">{today.sale_count} fiş{prev !== null && ' · dün ' + money(prev)}</div>}
      </section>
      <div className="vm-tabs" role="tablist">{TABS.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>)}</div>
      {tab === 'detay' && store && <section className="vm-card"><dl className="vm-kv">
        <dt>Mağaza kodu</dt><dd>{storeCode(store)}</dd>
        <dt>Tür</dt><dd>{store.warehouse_type === 'NORMAL' ? 'Mağaza' : store.warehouse_type || '—'}</dd>
        {store.address && <><dt>Adres</dt><dd>{store.address}</dd></>}
        {store.phone && <><dt>Telefon</dt><dd>{store.phone}</dd></>}
        <dt>Ürün çeşidi</dt><dd>{Number(store.unique_product_count ?? 0).toLocaleString('tr-TR')}</dd>
        <dt>Stok adedi</dt><dd>{Number(store.total_stored_quantity ?? 0).toLocaleString('tr-TR')}</dd>
        <dt>Stok değeri</dt><dd>{money(store.total_warehouse_value)}</dd>
      </dl></section>}
      {tab === 'hareket' && (moves === null ? <p role="status" className="vm-note">Hareketler yükleniyor…</p> : moves.length === 0
        ? <EmptyState icon={<Store size={34} />} title="Hareket yok" text="Bu mağazada son stok hareketi bulunmuyor." />
        : <div className="vm-list">{moves.map(m => <div key={m.id} className="vm-row"><span className="grow">{m.product_name || m.sku}<small>{String(m.created_at || '').slice(0, 16)} · {m.movement_type}</small></span><b>{Number(m.change_amount) > 0 ? '+' : ''}{Number(m.change_amount).toLocaleString('tr-TR')}</b></div>)}</div>)}
      {tab === 'rapor' && (today === null ? <p role="status" className="vm-note">Rapor yükleniyor…</p> : today === false
        ? <p className="vm-note">Bu mağaza için günlük rapor bu hesapla görüntülenemiyor.</p>
        : <section className="vm-card"><dl className="vm-kv">
          <dt>Fiş adedi</dt><dd>{today.sale_count}</dd><dt>Brüt satış</dt><dd>{money(today.gross_cents / 100)}</dd><dt>İndirim</dt><dd>{money(today.discount_cents / 100)}</dd>
          <dt>Net satış</dt><dd>{money(today.sales_cents / 100)}</dd><dt>Nakit</dt><dd>{money(today.cash_cents / 100)}</dd><dt>Kart</dt><dd>{money(today.card_cents / 100)}</dd>
          <dt>Veresiye</dt><dd>{money(today.credit_cents / 100)}</dd><dt>İade</dt><dd>{money(today.return_cents / 100)}</dd><dt>İptal</dt><dd>{money(today.cancel_cents / 100)}</dd></dl></section>)}
      {tab === 'ekip' && (team === null ? <p role="status" className="vm-note">Ekip yükleniyor…</p> : team === false
        ? <p className="vm-note">Ekip listesini yalnız yönetici ve müdür görür.</p>
        : <div className="vm-list">{team.map(u => <div key={u.id} className="vm-row"><span className="grow">{u.full_name || u.name || u.email}<small>{roleLabel(u.role)}</small></span></div>)}</div>)}
    </div>
  </div>;
}
