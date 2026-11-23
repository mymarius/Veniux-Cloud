import { currencySymbol } from '../../../shared/money.mjs';
import { useMemo, useState } from 'react';
import apiClient from '../api/client';
import { Modal, Input } from './ui';

const split = v => [...new Set(String(v || '').split(',').map(x => x.trim()).filter(Boolean))];

// Beden/renk varyantları: her kombinasyon kendi barkodu ve stoğu olan ayrı bir ürün olarak açılır.
export default function VariantWizard({ isOpen, onClose, onDone }) {
  const [f, setF] = useState({ name: '', sku_prefix: '', category: '', sizes: '', colors: '', sale_price: '', purchase_price: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState(null);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const count = useMemo(() => Math.max(1, split(f.sizes).length) * Math.max(1, split(f.colors).length), [f.sizes, f.colors]);
  const none = !split(f.sizes).length && !split(f.colors).length;
  const close = () => { setResult(null); setError(''); onClose(); };
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = (await apiClient.post('/products/variants', { ...f, sale_price: Number(f.sale_price || 0), purchase_price: Number(f.purchase_price || 0) })).data;
      setResult(r); onDone?.();
    } catch (err) { setError(err.response?.data?.error || 'Varyantlar oluşturulamadı.'); } finally { setBusy(false); }
  };
  return <Modal isOpen={isOpen} onClose={close} title="Varyantlı ürün ekle" size="lg">
    {result ? <div className="space-y-3" role="status">
      <p><b>{result.created.length}</b> çeşit oluşturuldu{result.skipped.length ? `, ${result.skipped.length} tanesi zaten vardı (atlandı)` : ''}.</p>
      <p className="text-sm text-slate-500">Her çeşidin barkodu otomatik üretildi. Etiket merkezinden basıp ürüne yapıştırabilir, mal kabulden stok girebilirsiniz.</p>
      <div className="overflow-auto" style={{ maxHeight: 220 }}><table className="w-full text-sm"><tbody>{result.created.map(c => <tr key={c.sku} className="border-b"><td className="p-1">{c.name}</td><td className="p-1">{c.sku}</td><td className="p-1">{c.barcode}</td></tr>)}</tbody></table></div>
      <div className="flex justify-end"><button type="button" className="btn-primary" onClick={close}>Tamam</button></div>
    </div> : <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Ürün adı" required placeholder="Tişört" value={f.name} onChange={set('name')} />
        <Input label="Stok kodu öneki" required placeholder="TS" value={f.sku_prefix} onChange={set('sku_prefix')} />
        <Input label="Bedenler (virgülle)" placeholder="S, M, L, XL" value={f.sizes} onChange={set('sizes')} />
        <Input label="Renkler (virgülle)" placeholder="Siyah, Beyaz, Mavi" value={f.colors} onChange={set('colors')} />
        <Input label={`Satış fiyatı (${currencySymbol()})`} type="number" min="0" step="0.01" value={f.sale_price} onChange={set('sale_price')} />
        <Input label={`Alış fiyatı (${currencySymbol()})`} type="number" min="0" step="0.01" value={f.purchase_price} onChange={set('purchase_price')} />
        <Input label="Kategori" placeholder="Giyim" value={f.category} onChange={set('category')} />
      </div>
      <p className="text-sm text-slate-500">{none ? 'En az bir beden veya renk girin.' : `${count} çeşit oluşturulacak. Örnek: ${[f.name || 'Ürün', split(f.sizes)[0], split(f.colors)[0]].filter(Boolean).join(' · ')}`}</p>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={close}>Vazgeç</button><button type="submit" className="btn-primary" disabled={busy || none || count > 120}>{busy ? 'Oluşturuluyor…' : 'Çeşitleri oluştur'}</button></div>
    </form>}
  </Modal>;
}
