import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer, Tag, Trash2, X } from 'lucide-react';
import { createProductList } from '../../lib/mobileHub.mjs';
import { ConfirmBox, EmptyState, MobileTop, money, sessionScope } from './mobileKit';

// "Ürünler": Fiyat Gör ekranında listeye eklenen ürünler; tek tek silinir, topluca etiket yazdırmaya gönderilir.
export default function MobileList() {
  const list = useMemo(() => createProductList(window.localStorage, sessionScope()), []);
  const [items, setItems] = useState(() => list.load()), [clear, setClear] = useState(false);
  const ids = items.map(i => i.id).filter(Boolean);
  return <div className="vm">
    <MobileTop title="Ürünler" back="/m/tara?mod=fiyat" flat right={items.length > 0 && <button type="button" className="vm-iconbtn" aria-label="Listeyi temizle" onClick={() => setClear(true)}><Trash2 size={20} /></button>} />
    <div className="vm-body" style={{ marginTop: 0, paddingTop: 18 }}>
      {items.length === 0 ? <EmptyState icon={<Tag size={34} />} title="Liste boş" text="Fiyat Gör ekranında ürün okutup Listeye Ekle deyin." /> :
        <div className="vm-list">{items.map(i => <div key={i.barcode} className="vm-row"><span className="grow">{i.name}<small>{i.barcode} · {money(i.price)}</small></span>
          <button type="button" className="vm-iconbtn" style={{ background: 'none', color: 'var(--vm-muted)' }} aria-label={i.name + ' ürününü listeden çıkar'} onClick={() => setItems(list.remove(i.barcode))}><X size={18} /></button></div>)}</div>}
      {ids.length > 0 && <Link to={'/magaza/etiketler?products=' + ids.join(',')} className="vm-btn" style={{ marginTop: 16 }}><Printer size={18} /> Ürünleri Yazdır</Link>}
      {items.length > ids.length && <p className="vm-note" style={{ marginTop: 8 }}>{items.length - ids.length} ürün sistemde tanımlı olmadığı için etiket yazdırmaya gönderilemez.</p>}
    </div>
    {clear && <ConfirmBox title="Liste temizlensin mi?" text="Listedeki tüm ürünler bu cihazdan silinir." yes="Evet, Temizle" onNo={() => setClear(false)} onYes={() => { setItems(list.clear()); setClear(false); }} />}
  </div>;
}
