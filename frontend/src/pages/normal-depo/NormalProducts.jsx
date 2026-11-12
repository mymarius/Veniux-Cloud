import ProductBulkImport from '../../components/ProductBulkImport';
import StockHealthPanel from '../../components/StockHealthPanel';
import { useSearchParams } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Barcode,
  RefreshCw,
} from 'lucide-react';
import { KarekodModal } from '../../components/QuickModals';
import WMSDetailDrawer from '../../components/wms/WMSDetailDrawer';
import { useToast } from '../../components/Toast';
import { DataTable, StatusBadge, MetricCard, Modal, Input, Select, Dropdown } from '../../components/ui';
import { money } from '../../lib/stockAnalytics';

const MARK_COLORS = ['#2f6fe4', '#12a37f', '#f2711c', '#7c5ce0', '#d9488b', '#0e8fb3'];

export default function NormalProducts() {
  const [params]=useSearchParams();
  const [lotDetail,setLotDetail]=useState(null);
  const [showImport,setShowImport]=useState(false);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Views
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [scaleCode, setScaleCode] = useState('');
  const [karekodModalOpen, setKarekodModalOpen] = useState(false);
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] = useState(null);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: '',
    barcode: '',
    unit: 'adet',
    purchase_price: '',purchase_price_tax_basis: null,kdv_orani:10,
    sale_price: '',
    min_stock_level: 10,
    max_stock_level: 200,
    supplier_id: ''
  });

  const { showToast } = useToast();
  useEffect(()=>{const id=Number(params.get('product'));if(id>0){setSelectedProductId(id);setDrawerOpen(true);}},[params]);
  useEffect(()=>{const id=Number(params.get('lot'));if(id>0){let active=true;apiClient.get('/normal-depo/stock-health').then(r=>{if(active)setLotDetail(r.data.lots.find(l=>l.id===id)||null);}).catch(()=>showToast('Lot bilgisi alınamadı.','error'));return()=>{active=false;};}},[params]);

  useEffect(() => {
    fetchProducts();
  }, [categoryFilter, supplierFilter, search]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      if (supplierFilter) params.append('supplier_id', supplierFilter);
      if (search) params.append('search', search);

      const [prodRes, supRes, catRes] = await Promise.all([
        apiClient.get(`/products?${params.toString()}`),
        apiClient.get('/suppliers'),
        apiClient.get('/products/categories')
      ]);

      setProducts(prodRes.data.products || prodRes.data || []);
      setSuppliers(supRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      console.error(err);
      showToast('Failed to load products.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setScaleCode('');
    setFormData({
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      category: categories.length > 0 ? (typeof categories[0] === 'string' ? categories[0] : categories[0].name || 'General') : 'General',
      barcode: '',
      unit: 'adet',
      purchase_price: '',purchase_price_tax_basis: null,kdv_orani:10,
      sale_price: '',
      min_stock_level: 10,
      max_stock_level: 200,
      supplier_id: suppliers.length > 0 ? suppliers[0].id : ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (p, e) => {
    e.stopPropagation();
    setEditingProduct(p);
    setScaleCode('');
    apiClient.get(`/products/${p.id}/scale-code`).then(r => setScaleCode(r.data?.plu || '')).catch(() => {});
    setFormData({
      sku: p.sku || '',
      name: p.name || '',
      category: p.category || '',
      barcode: p.barcode || p.gtin || '',
      unit: p.unit || 'adet',
      purchase_price: p.purchase_price ?? p.cost_price ?? '',purchase_price_tax_basis:p.purchase_price_tax_basis??null,kdv_orani:p.kdv_orani??10,
      sale_price: p.sale_price || '',
      min_stock_level: p.min_stock_level ?? 10,
      max_stock_level: p.max_stock_level || 200,
      supplier_id: p.supplier_id || ''
    });
    setShowModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await apiClient.put(`/products/${editingProduct.id}`, formData);
        if (['kg', 'g', 'litre'].includes(formData.unit) || scaleCode) await apiClient.put(`/products/${editingProduct.id}/scale-code`, { plu: ['kg', 'g', 'litre'].includes(formData.unit) ? scaleCode : '' });
        showToast('Ürün güncellendi.', 'success');
      } else {
        const created = await apiClient.post('/products', formData);
        if (scaleCode && ['kg', 'g', 'litre'].includes(formData.unit) && created.data?.id) await apiClient.put(`/products/${created.data.id}/scale-code`, { plu: scaleCode });
        showToast('Ürün oluşturuldu.', 'success');
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      showToast(err.response?.data?.error || 'Save failed.', 'error');
    }
  };

  const handleDeleteProduct = async (p, e) => {
    e.stopPropagation();
    if (!window.confirm(`${p.name} ürününü silmek istediğinize emin misiniz?`)) return;
    try {
      await apiClient.delete(`/products/${p.id}`);
      showToast('Ürün başarıyla silindi.', 'success');
      fetchProducts();
    } catch (err) {
      showToast(err.response?.data?.error || 'Ürün silinemedi.', 'error');
    }
  };

  const handleOpenBarcode = (p, e) => {
    e.stopPropagation();
    setSelectedBarcodeProduct(p);
    setKarekodModalOpen(true);
  };

  const handleOpenDetail = (p) => {
    setSelectedProductId(p.id);
    setDrawerOpen(true);
  };

  const columns = [
    {
      key: 'name',
      label: 'Ürün ve SKU',
      render: (row) => (
        <div className="vx-product-cell">
          <span className="vx-product-mark" aria-hidden="true" style={{ background: MARK_COLORS[[...(row.category || row.name || '')].reduce((t, ch) => t + ch.charCodeAt(0), 0) % MARK_COLORS.length] }}>{(row.name || '?').slice(0, 2).toLocaleUpperCase('tr-TR')}</span>
          <div className="min-w-0">
            <span className="font-semibold text-slate-800">{row.name}</span>
            <span className="block text-[11px] text-slate-500 mt-0.5">{row.sku}</span>
          </div>
        </div>
      )
    },
    {
      key: 'stock',
      label: 'Stok',
      align: 'right',
      render: (row) => {
        const qty = Number(row.total_quantity || 0), min = Number(row.min_stock_level || 0);
        const state = qty <= 0 ? 'out' : min > 0 && qty <= min ? 'low' : 'ok';
        return (
          <span className="vx-stock-cell" data-state={state}>
            <b>{qty.toLocaleString('tr-TR')} {row.unit || ''}</b>
            {state !== 'ok' && <small>{state === 'out' ? 'Tükendi' : 'Kritik'}</small>}
            <span className="vx-stock-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, qty / Math.max(1, Number(row.max_stock_level) || Math.max(qty, min * 3, 1)) * 100)}%` }} /></span>
          </span>
        );
      }
    },
    { key: 'barcode', label: 'Barkod / GTIN', render: (row) => row.barcode || row.gtin ? <span className="text-slate-600">{row.barcode || row.gtin}</span> : <span className="vx-muted">—</span> },
    { key: 'category', label: 'Kategori', render: (row) => <span className="vx-chip">{row.category || 'Genel'}</span> },
    {
      key: 'cost',
      label: 'Maliyet',
      align: 'right',
      render: (row) => <span className="text-slate-600">{money(row.purchase_price || row.cost_price)}</span>
    },
    {
      key: 'price',
      label: 'Satış Fiyatı',
      align: 'right',
      render: (row) => <span className="font-semibold text-slate-800">{money(row.sale_price || row.kamu_fiyati)}</span>
    },
    {
      key: 'supplier',
      label: 'Tedarikçi',
      render: (row) => row.supplier_name ? <span className="text-slate-600">{row.supplier_name}</span> : <span className="vx-muted">—</span>
    },
    {
      key: 'actions',
      label: 'İşlemler',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={(e) => handleOpenBarcode(row, e)} className="icon-btn" title="Barkod" aria-label={row.name + ' barkodu'}><Barcode className="w-4 h-4" /></button>
          <button onClick={(e) => handleOpenEdit(row, e)} className="icon-btn" title="Düzenle" aria-label={row.name + ' düzenle'}><Edit2 className="w-4 h-4" /></button>
          <button onClick={(e) => handleDeleteProduct(row, e)} className="icon-btn" data-tone="danger" title="Sil" aria-label={row.name + ' sil'}><Trash2 className="w-4 h-4" /></button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Ürün Kataloğu</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
              {products.length} KAYIT
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">Ürün tanımları, barkod eşleşmeleri ve tedarikçi bağlantıları.</p>
        </div>

        <div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={()=>setShowImport(!showImport)} aria-expanded={showImport}>Excel / CSV aktar</button><button onClick={handleOpenAdd} className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          <span>Yeni Ürün Ekle</span>
        </button></div>
      </div>

      {showImport&&<ProductBulkImport onCompleted={fetchProducts}/>}
      <details className="mobile-stock-details"><summary>Stok ve lot uyarılarını göster</summary><StockHealthPanel onProduct={(id,lot)=>{if(lot)setLotDetail(lot);else{setSelectedProductId(id);setDrawerOpen(true);}}}/></details>
      {lotDetail&&<section className="veniux-card p-4 mb-4" role="dialog" aria-label="Lot detayı"><div className="flex justify-between"><b>{lotDetail.name} · Lot {lotDetail.lot_number}</b><button onClick={()=>setLotDetail(null)}>Kapat</button></div><p>Depo: {lotDetail.warehouse_name} · Miktar: {lotDetail.quantity} · Son kullanma: {lotDetail.expiry_date||'Tarih yok'}</p><button className="btn-soft" data-size="sm" onClick={()=>{setSelectedProductId(lotDetail.product_id);setDrawerOpen(true);}}>Ürünü aç</button></section>}
      {/* Metric Strip */}
      <div className="product-stat-grid vx-metric-strip grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Toplam ürün</span>
          <p className="text-3xl font-light text-slate-800">{products.length}</p>
          <span className="text-xs text-slate-400 mt-1">Aktif sistem kayıtları</span>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Barkodlu ürün</span>
          <p className="text-3xl font-light text-slate-800">
            {products.filter(p => p.barcode || p.gtin).length} <span className="text-lg text-slate-400">/ {products.length}</span>
          </p>
          <span className="text-xs text-slate-400 mt-1">EAN-13 & GS1 Uyumlu</span>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Kategoriler</span>
          <p className="text-3xl font-light text-slate-800">{categories.length}</p>
          <span className="text-xs text-slate-400 mt-1">Farklı ürün grupları</span>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Tedarikçiler</span>
          <p className="text-3xl font-light text-slate-800">{suppliers.length}</p>
          <span className="text-xs text-slate-400 mt-1">Aktif tedarik ağları</span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="vx-table-wrap flex flex-col">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-[#e8edf3] flex flex-col lg:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 sm:w-80 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="İsim, SKU veya barkod ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 text-sm rounded-md pl-9 pr-3 py-2 outline-none focus:border-slate-400 transition-colors text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto">
            <Dropdown
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border border-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:border-slate-400 cursor-pointer transition-colors text-slate-700"
            >
              <option value="">Tüm Kategoriler</option>
              {categories.map((c, i) => {
                const name = typeof c === 'string' ? c : c.category || c.name;
                return <option key={i} value={name}>{name}</option>;
              })}
            </Dropdown>

            <Dropdown
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="bg-white border border-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:border-slate-400 cursor-pointer transition-colors text-slate-700"
            >
              <option value="">Tüm Tedarikçiler</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Dropdown>
          </div>
        </div>

        {/* Dense Enterprise Table */}
        <div className="max-h-[640px] overflow-y-auto custom-scrollbar">
          <DataTable 
            flush
            columns={columns}
            data={products}
            loading={loading}
            onRowClick={handleOpenDetail}
            emptyState="Arama kriterlerinize uygun ürün bulunamadı."
          />
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        title={editingProduct ? 'Ürünü düzenle' : 'Yeni ürün'}
        size="lg"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Ürün kodu / SKU" required value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
            <Input label="Barkod / EAN" placeholder="Üretici barkodunu girin; yoksa boş bırakın" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} />
            <label className="text-sm">Birim<select className="block w-full" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}>{[...new Set(['adet', 'kg', 'g', 'litre', 'paket', 'koli', formData.unit].filter(Boolean))].map(u => <option key={u} value={u}>{u}</option>)}</select></label>
            {['kg', 'g', 'litre'].includes(formData.unit) && <Input label="Terazi kodu (PLU)" placeholder="Teraziye girilen ürün kodu, örn. 123" inputMode="numeric" value={scaleCode} onChange={(e) => setScaleCode(e.target.value)} />}
          </div>
          
          <Input label="Ürün adı" required placeholder="Örn. Termal etiket 100 × 150 mm" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />

          <div className="grid grid-cols-2 gap-4">
            <Input label="Kategori" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
            <Select 
              label="Tedarikçi"
              value={formData.supplier_id} 
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              options={[
                { value: '', label: 'Tedarikçi seçin' },
                ...suppliers.map(s => ({ value: s.id, label: s.name }))
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input type="number" step="0.01" label="Alış fiyatı (TL)" value={formData.purchase_price} onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })} /><label className="text-sm">Alış fiyatı KDV temeli<select aria-label="Alış fiyatı KDV temeli" className="w-full border rounded-lg p-2" value={formData.purchase_price_tax_basis||''} onChange={e=>setFormData({...formData,purchase_price_tax_basis:e.target.value||null})}><option value="">Doğrulanmadı — maliyet belirsiz</option><option value="exclusive">KDV hariç</option><option value="inclusive">KDV dahil</option></select></label><Input label="Ürün KDV oranı (%)" type="number" min="0" max="100" value={formData.kdv_orani} onChange={e=>setFormData({...formData,kdv_orani:e.target.value})}/>
            <Input type="number" step="0.01" required label="Satış fiyatı (TL, KDV dahil)" value={formData.sale_price} onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })} />
            <Input type="number" min="0" max="1000000" step="0.001" label="Minimum stok" value={formData.min_stock_level} onChange={e=>setFormData({...formData,min_stock_level:e.target.value})}/>
            <Input type="number" min="0" step="0.001" label="Hedef stok (sipariş önerisi)" value={formData.max_stock_level} onChange={e=>setFormData({...formData,max_stock_level:e.target.value})}/>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Vazgeç</button>
            <button type="submit" className="btn-primary">{editingProduct ? 'Değişiklikleri kaydet' : 'Ürünü oluştur'}</button>
          </div>
        </form>
      </Modal>

      {/* Barcode / Karekod Modal */}
      <KarekodModal
        isOpen={karekodModalOpen}
        onClose={() => setKarekodModalOpen(false)}
        product={selectedBarcodeProduct}
      />

      {/* Slide-over Detail Drawer */}
      <WMSDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        productId={selectedProductId}
      />
    </div>
  );
}


