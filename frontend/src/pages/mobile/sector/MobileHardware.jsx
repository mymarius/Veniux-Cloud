import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Camera, MapPin, MessageCircle, Search, X } from 'lucide-react';
import api from '../../../api/client';
import BarcodeCamera from '../../../components/BarcodeCamera';
import { readSessionUser } from '../../../lib/sessionUser';
import { criticalKey, idsOf, newItems, whatsappLink, wholesalerText } from '../../../lib/sectorHub.mjs';
import { EmptyState, MobileTop, money } from '../mobileKit';
import { NotifyButton, PackGate, errorText, notify, usePolling } from './SectorKit';

const isBoss = () => ['admin', 'manager'].includes(readSessionUser().role);

// "3 numara vida var mı?": tek kutuda ara, ölçü ve kategori düğmeleriyle daralt, raf ve koridor bilgisini saniyesinde gör.
export function MobileProductSearch() {
  const [q, setQ] = useState(''), [size, setSize] = useState(''), [category, setCategory] = useState('');
  const [facets, setFacets] = useState({ sizes: [], categories: [] }), [result, setResult] = useState(null), [error, setError] = useState(''), [camera, setCamera] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const [s, f] = await Promise.all([api.get('/sector/hardware/search', { params: { q, size, category } }), api.get('/sector/hardware/facets', { params: { q } })]);
        if (id !== seq.current) return;
        setResult(s.data); setFacets(f.data); setError('');
      } catch (e) { if (id === seq.current) setError(errorText(e, 'Arama yapılamadı.')); }
    }, 250);
    return () => clearTimeout(timer);
  }, [q, size, category]);
  const reset = () => { setQ(''); setSize(''); setCategory(''); };
  return <div className="vm">
    <MobileTop title="Ürün Ara" flat right={<Link to="/m/kritik" className="vm-iconbtn" aria-label="Kritik stok"><AlertTriangle size={20} /></Link>} />
    <PackGate pack="hardware"><div className="vm-body" style={{ marginTop: 0, paddingTop: 16 }}>
      <div className="vm-search"><Search size={18} />
        <input type="search" autoFocus placeholder="Ürün, ölçü, barkod…  örn. 3 numara vida" value={q} onChange={e => setQ(e.target.value)} aria-label="Ürün ara" />
        {(q || size || category) && <button type="button" aria-label="Temizle" className="vm-iconbtn" style={{ width: 30, height: 30, background: 'none', color: 'var(--vm-muted)' }} onClick={reset}><X size={16} /></button>}
        <button type="button" aria-label="Kamerayla barkod oku" className="vm-iconbtn" style={{ width: 34, height: 34, background: 'var(--vm-brand)' }} onClick={() => setCamera(v => !v)}><Camera size={17} /></button></div>
      {camera && <div style={{ marginBottom: 12 }}><BarcodeCamera onCode={code => { setQ(code); setCamera(false); }} onClose={() => setCamera(false)} /></div>}
      {facets.sizes.length > 0 && <div role="group" aria-label="Ölçü" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
        {facets.sizes.map(s => <button key={s.value} type="button" className={'vm-btn ' + (size.toLowerCase() === s.value.toLowerCase() ? '' : 'soft')} style={{ width: 'auto', minHeight: 38, padding: '0 14px', flex: 'none' }} aria-pressed={size.toLowerCase() === s.value.toLowerCase()} onClick={() => setSize(size.toLowerCase() === s.value.toLowerCase() ? '' : s.value)}>{s.value} <small>({s.count})</small></button>)}</div>}
      {facets.categories.length > 1 && <div role="group" aria-label="Kategori" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
        {facets.categories.map(c => <button key={c.value} type="button" className={'vm-btn ' + (category.toLowerCase() === c.value.toLowerCase() ? '' : 'ghost')} style={{ width: 'auto', minHeight: 34, padding: '0 12px', flex: 'none', fontSize: 13 }} aria-pressed={category.toLowerCase() === c.value.toLowerCase()} onClick={() => setCategory(category.toLowerCase() === c.value.toLowerCase() ? '' : c.value)}>{c.value}</button>)}</div>}
      {error && <p role="alert" className="vm-err">{error}</p>}
      {!result && !error && <p role="status" className="vm-note">Aranıyor…</p>}
      {result && (result.items.length === 0
        ? <EmptyState icon={<Search size={34} />} title="Ürün bulunamadı" text="Farklı bir yazım veya ölçü deneyin." />
        : <><p className="vm-note" role="status">{result.total} ürün{result.total > result.items.length ? ' (ilk ' + result.items.length + ' gösteriliyor, aramayı daraltın)' : ''}</p>
          {result.items.map(item => <ProductCard key={item.id} item={item} onSaved={() => setQ(v => v + '')} />)}</>)}
    </div></PackGate>
  </div>;
}

function ProductCard({ item }) {
  const [size, setSize] = useState(item.size || ''), [saved, setSaved] = useState(''), [open, setOpen] = useState(false);
  const empty = item.stock_total <= 0;
  const saveSize = async () => { try { await api.put('/sector/hardware/products/' + item.id + '/attributes', { size: size.trim() || null }); setSaved('Kaydedildi'); } catch (e) { setSaved(errorText(e, 'Kaydedilemedi')); } };
  return <section className="vm-card" aria-label={item.name}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ minWidth: 0 }}><b>{item.name}</b><div className="vm-note">{item.sku}{item.size ? ' · ' + item.size : ''}{item.fragile ? ' · kırılgan' : ''}</div></div>
      <div style={{ textAlign: 'right' }}><div style={{ fontSize: 24, fontWeight: 800, color: empty ? 'var(--vm-bad)' : 'var(--vm-text)' }}>{item.stock_total}</div><div className="vm-note">{item.unit || 'adet'} · {money(item.sale_price)}</div></div>
    </div>
    {item.locations.length > 0
      ? <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>{item.locations.map(l => <div key={l.location_id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><MapPin size={16} style={{ flex: 'none', color: 'var(--vm-brand)' }} />
        <span><b>Koridor {l.aisle}</b> · Raf {l.rack} · Kat {l.shelf} <span className="vm-note">({l.zone}) {l.quantity} {item.unit || 'adet'}</span>{l.tags.map(t => <em key={t} style={{ marginLeft: 6, fontStyle: 'normal', fontSize: 11, background: '#165da41a', color: 'var(--vm-brand)', borderRadius: 6, padding: '2px 6px' }}>{t}</em>)}</span></div>)}</div>
      : <p className="vm-note" style={{ marginTop: 6 }}>Raf konumu kayıtlı değil.</p>}
    {item.stock.length > 1 && <p className="vm-note" style={{ marginTop: 6 }}>{item.stock.map(s => s.warehouse_name + ': ' + s.quantity).join(' · ')}</p>}
    {isBoss() && <div style={{ marginTop: 8 }}><button type="button" className="vm-btn soft" style={{ minHeight: 38 }} onClick={() => setOpen(v => !v)}>Ölçüyü düzenle</button>
      {open && <div className="vm-price-in"><input aria-label="Ölçü" placeholder="örn. M3, 8 mm, 1/2 inç" value={size} maxLength={40} onChange={e => setSize(e.target.value)} /><button type="button" className="vm-btn" style={{ width: 'auto', padding: '0 16px' }} onClick={saveSize}>Kaydet</button></div>}
      {saved && <p role="status" className="vm-note">{saved}</p>}</div>}
  </section>;
}

// Kritik stok: "3 numara vida bitiyor, toptancıya yaz". Uygulama açıkken yeni uyarı gelince telefon titrer.
export function useCriticalWatcher(enabled) {
  const [data, setData] = useState(null);
  const seen = useRef(null);
  usePolling(async () => {
    const next = (await api.get('/sector/hardware/critical')).data;
    if (seen.current !== null) {
      const fresh = newItems(seen.current, next.items, criticalKey);
      if (fresh.length) notify('Kritik stok', fresh.length === 1 ? fresh[0].message : fresh.length + ' ürün azaldı veya bitti.');
    }
    seen.current = idsOf(next.items, criticalKey); setData(next);
  }, 60000, enabled);
  return data;
}

export function MobileCritical() {
  const [enabled] = useState(true);
  const data = useCriticalWatcher(enabled);
  const phone = data?.items.find(i => i.supplier?.phone)?.supplier.phone;
  return <div className="vm">
    <MobileTop title="Kritik Stok" flat />
    <PackGate pack="hardware"><div className="vm-body" style={{ marginTop: 0, paddingTop: 16 }}>
      <NotifyButton />
      {!data && <p role="status" className="vm-note">Yükleniyor…</p>}
      {data && (data.items.length === 0
        ? <EmptyState icon={<AlertTriangle size={34} />} title="Raflar dolu" text="Asgari stok düzeyinin altına inen ürün yok." />
        : <>
          <p className="vm-note" role="status" style={{ marginTop: 10 }}>{data.count} ürün kritik seviyede, {data.empty} tanesi bitti. Liste dakikada bir yenilenir.</p>
          <a className="vm-btn" style={{ margin: '10px 0' }} target="_blank" rel="noopener noreferrer" href={whatsappLink(phone, wholesalerText(data.items))}><MessageCircle size={18} /> Toptancıya yaz (WhatsApp)</a>
          <div className="vm-list">{data.items.map(i => <div key={i.id} className="vm-row"><AlertTriangle size={20} style={{ color: i.empty ? 'var(--vm-bad)' : 'var(--vm-accent)' }} />
            <span className="grow">{i.name}<small>{i.message}{i.supplier ? ' · ' + i.supplier.name : ''}</small></span>
            {i.supplier?.phone && <a href={whatsappLink(i.supplier.phone, wholesalerText([i]))} target="_blank" rel="noopener noreferrer" aria-label={i.name + ' için ' + i.supplier.name + ' kişisine yaz'}><MessageCircle size={20} /></a>}</div>)}</div></>)}
    </div></PackGate>
  </div>;
}
