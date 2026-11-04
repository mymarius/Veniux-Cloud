import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import { ArrowDownLeft, ArrowRight, ArrowRightLeft, ArrowUpRight, Minus, Plus, Printer, QrCode } from 'lucide-react';
import apiClient from '../api/client';
import { useToast } from './Toast';
import DialogShell from './ui/DialogShell';

const list = data => (Array.isArray(data) ? data : data?.data || []);
const num = value => new Intl.NumberFormat('tr-TR').format(value || 0);
const QUICK_AMOUNTS = [1, 5, 10, 25, 50, 100];

// Ürün, depo ve mevcut stok bilgisini pencere açıldığında yükler.
function useStockOptions(isOpen) {
  const [state, setState] = useState({ products: [], warehouses: [], records: [], loading: false });
  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    setState(prev => ({ ...prev, loading: true }));
    Promise.all([apiClient.get('/products'), apiClient.get('/warehouses'), apiClient.get('/stock/records').catch(() => ({ data: [] }))])
      .then(([p, w, r]) => { if (active) setState({ products: list(p.data), warehouses: list(w.data), records: list(r.data), loading: false }); })
      .catch(() => { if (active) setState(prev => ({ ...prev, loading: false })); });
    return () => { active = false; };
  }, [isOpen]);
  const stockOf = (productId, warehouseId) => state.records
    .filter(r => String(r.product_id) === String(productId) && String(r.warehouse_id) === String(warehouseId))
    .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  return { ...state, stockOf };
}

function Stepper({ value, onChange, min = 1 }) {
  const step = delta => onChange(String(Math.max(min, (parseInt(value, 10) || 0) + delta)));
  return <div className="vx-stepper">
    <button type="button" onClick={() => step(-1)} aria-label="Azalt"><Minus size={16} /></button>
    <input type="number" min={min} inputMode="numeric" placeholder="0" value={value} onChange={e => onChange(e.target.value)} required aria-label="Miktar" />
    <button type="button" onClick={() => step(1)} aria-label="Artır"><Plus size={16} /></button>
  </div>;
}

// 1. Hızlı stok hareketi (giriş / çıkış)
export const QuickStockModal = ({ isOpen, onClose, onSuccess, defaultProduct = null, defaultWarehouse = null, type = 'inbound' }) => {
  const { products, warehouses, stockOf, loading: optionsLoading } = useStockOptions(isOpen);
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [movementType, setMovementType] = useState('inbound');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    setMovementType(type || 'inbound');
    setAmount(''); setNote('');
    setProductId(defaultProduct ? String(defaultProduct.id || defaultProduct.product_id || '') : '');
    setWarehouseId(defaultWarehouse ? String(defaultWarehouse.id || defaultWarehouse.warehouse_id || '') : '');
  }, [isOpen, defaultProduct, defaultWarehouse, type]);

  useEffect(() => {
    if (!productId && products.length) setProductId(String(products[0].id));
    if (!warehouseId && warehouses.length) setWarehouseId(String(warehouses[0].id));
  }, [products, warehouses]); // eslint-disable-line react-hooks/exhaustive-deps

  const inbound = movementType === 'inbound';
  const qty = Math.abs(parseInt(amount, 10) || 0);
  const current = stockOf(productId, warehouseId);
  const after = current + (inbound ? qty : -qty);
  const product = products.find(p => String(p.id) === String(productId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productId || !warehouseId || !qty) { showToast('Lütfen tüm zorunlu alanları doldurun.', 'warning'); return; }
    if (!inbound && qty > current) { showToast(`Depoda yalnızca ${num(current)} ${product?.unit || 'adet'} var.`, 'warning'); return; }
    setLoading(true);
    try {
      await apiClient.post('/stock/movement', {
        product_id: parseInt(productId, 10),
        warehouse_id: parseInt(warehouseId, 10),
        change_amount: inbound ? qty : -qty,
        movement_type: movementType,
        note: note || `Hızlı ${inbound ? 'giriş' : 'çıkış'} işlemi`
      });
      showToast(`Stok ${inbound ? 'girişi' : 'çıkışı'} kaydedildi (${inbound ? '+' : '−'}${num(qty)}).`, 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'İşlem başarısız oldu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogShell isOpen={isOpen} onClose={onClose} title="Hızlı stok hareketi" subtitle="Depoya ürün girişi veya çıkışı yapın"
      icon={inbound ? ArrowDownLeft : ArrowUpRight} tone={inbound ? 'green' : 'red'}
      footer={<>
        <button type="button" className="vx-btn" onClick={onClose}>Vazgeç</button>
        <button type="submit" form="quick-stock-form" className="vx-btn" data-variant={inbound ? 'green' : 'red'} disabled={loading || optionsLoading || after < 0}>
          {loading ? 'Kaydediliyor…' : inbound ? 'Girişi onayla' : 'Çıkışı onayla'}
        </button>
      </>}>
      <form id="quick-stock-form" onSubmit={handleSubmit} className="grid gap-4">
        <div className="vx-toggle" data-value={inbound ? 0 : 1} role="group" aria-label="Hareket türü">
          <button type="button" data-tone="green" aria-pressed={inbound} onClick={() => setMovementType('inbound')}><ArrowDownLeft size={15} /> Stok girişi</button>
          <button type="button" data-tone="red" aria-pressed={!inbound} onClick={() => setMovementType('outbound')}><ArrowUpRight size={15} /> Stok çıkışı</button>
        </div>

        <label className="vx-field">Ürün
          <select className="vx-input" value={productId} onChange={e => setProductId(e.target.value)} required>
            {!products.length && <option value="">{optionsLoading ? 'Yükleniyor…' : 'Önce ürün tanımlayın'}</option>}
            {products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="vx-field">Depo
            <select className="vx-input" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <div className="vx-field">Miktar{product?.unit ? ` (${product.unit})` : ''}
            <Stepper value={amount} onChange={setAmount} />
          </div>
        </div>
        <div className="vx-chips" aria-label="Hızlı miktar">
          {QUICK_AMOUNTS.map(n => <button key={n} type="button" onClick={() => setAmount(String(n))}>{n}</button>)}
          {!inbound && current > 0 && <button type="button" onClick={() => setAmount(String(current))}>Tümü ({num(current)})</button>}
        </div>

        <div className="vx-preview" aria-live="polite">
          <div><span>Mevcut stok</span><b>{num(current)}</b></div>
          <ArrowRight size={18} />
          <div><span>İşlem sonrası</span><b style={{ color: after < 0 ? '#c95858' : undefined }}>{num(after)}</b></div>
          <em style={{ color: inbound ? '#1b8e83' : '#c95858' }}>{qty ? `${inbound ? '+' : '−'}${num(qty)}` : ''}</em>
        </div>

        <label className="vx-field">Açıklama / irsaliye no <small>İsteğe bağlı</small>
          <input className="vx-input" type="text" placeholder="Örn: Tedarikçi sevkiyatı, irsaliye 2026-118" value={note} onChange={e => setNote(e.target.value)} />
        </label>
      </form>
    </DialogShell>
  );
};

// 2. Depolar arası transfer
export const QuickTransferModal = ({ isOpen, onClose, onSuccess, initialProduct = null }) => {
  const { products, warehouses, stockOf } = useStockOptions(isOpen);
  const [productId, setProductId] = useState('');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    setAmount(''); setNote('');
    setProductId(initialProduct ? String(initialProduct.id || initialProduct.product_id || '') : '');
  }, [isOpen, initialProduct]);
  useEffect(() => {
    if (!productId && products.length) setProductId(String(products[0].id));
    if (warehouses.length >= 2 && !source) { setSource(String(warehouses[0].id)); setTarget(String(warehouses[1].id)); }
  }, [products, warehouses]); // eslint-disable-line react-hooks/exhaustive-deps

  const qty = parseInt(amount, 10) || 0;
  const available = stockOf(productId, source);
  const targetStock = stockOf(productId, target);
  const names = useMemo(() => Object.fromEntries(warehouses.map(w => [String(w.id), w.name])), [warehouses]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!productId || !source || !target || !qty) { showToast('Lütfen tüm zorunlu alanları doldurun.', 'warning'); return; }
    if (source === target) { showToast('Kaynak ve hedef depo aynı olamaz.', 'warning'); return; }
    if (qty > available) { showToast(`Kaynak depoda yalnızca ${num(available)} adet var.`, 'warning'); return; }
    setLoading(true);
    try {
      await apiClient.post('/stock/transfer', {
        product_id: parseInt(productId, 10), from_warehouse_id: parseInt(source, 10), to_warehouse_id: parseInt(target, 10),
        quantity: qty, note: note || 'Depolar arası transfer'
      });
      showToast('Transfer tamamlandı.', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'Transfer başarısız oldu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogShell isOpen={isOpen} onClose={onClose} title="Depolar arası transfer" subtitle="Ürünü bir depodan diğerine aktarın" icon={ArrowRightLeft} tone="violet"
      footer={<>
        <button type="button" className="vx-btn" onClick={onClose}>Vazgeç</button>
        <button type="submit" form="quick-transfer-form" className="vx-btn" data-variant="primary" disabled={loading || warehouses.length < 2}>{loading ? 'Aktarılıyor…' : 'Transferi onayla'}</button>
      </>}>
      <form id="quick-transfer-form" onSubmit={handleTransfer} className="grid gap-4">
        {warehouses.length < 2 && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-[12.5px] text-amber-800">Transfer için en az iki depo tanımlı olmalı.</p>}
        <label className="vx-field">Ürün
          <select className="vx-input" value={productId} onChange={e => setProductId(e.target.value)} required>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
          </select>
        </label>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <label className="vx-field">Kaynak depo
            <select className="vx-input" value={source} onChange={e => setSource(e.target.value)} required>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <button type="button" className="vx-dialog-close mb-1 hidden sm:grid" aria-label="Depoları değiştir" onClick={() => { setSource(target); setTarget(source); }}><ArrowRightLeft size={16} /></button>
          <label className="vx-field">Hedef depo
            <select className="vx-input" value={target} onChange={e => setTarget(e.target.value)} required>
              {warehouses.map(w => <option key={w.id} value={w.id} disabled={String(w.id) === source}>{w.name}</option>)}
            </select>
          </label>
        </div>
        <div className="vx-field">Miktar <Stepper value={amount} onChange={setAmount} /></div>
        <div className="vx-chips">
          {QUICK_AMOUNTS.map(n => <button key={n} type="button" onClick={() => setAmount(String(n))}>{n}</button>)}
          {available > 0 && <button type="button" onClick={() => setAmount(String(available))}>Tümü ({num(available)})</button>}
        </div>
        <div className="vx-preview" aria-live="polite">
          <div><span>{names[source] || 'Kaynak'}</span><b>{num(available)} → {num(available - qty)}</b></div>
          <ArrowRight size={18} />
          <div><span>{names[target] || 'Hedef'}</span><b>{num(targetStock)} → {num(targetStock + qty)}</b></div>
        </div>
        <label className="vx-field">Not <small>İsteğe bağlı</small>
          <input className="vx-input" type="text" placeholder="Örn: Şube ikmali" value={note} onChange={e => setNote(e.target.value)} />
        </label>
      </form>
    </DialogShell>
  );
};

// 3. Real product labels are prepared in the shared label workshop.
export const KarekodModal = ({isOpen,onClose,product}) => <DialogShell isOpen={isOpen&&!!product} onClose={onClose} title="Ürün etiketi" subtitle="Gerçek barkod ve kayıtlı satış fiyatı" icon={Printer} footer={<button type="button" className="vx-btn" onClick={onClose}>Kapat</button>}>
{product&&<div className="space-y-4"><p className="font-semibold">{product.name}</p><p className="text-sm">Raf veya ürün etiketi hazırlayın; ölçüyü, tasarımı ve bağlı yazıcıyı önizlemeden seçin.</p><a className="btn-primary inline-flex" href={(window.location.protocol==='file:'?'#':'')+'/magaza/etiketler?product='+product.id}>Etiket atölyesini aç</a></div>}
</DialogShell>;
