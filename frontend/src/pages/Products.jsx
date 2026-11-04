import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Barcode,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { KarekodModal } from '../components/QuickModals';
import WMSDetailDrawer from '../components/wms/WMSDetailDrawer';
import { useToast } from '../components/Toast';
import { DataTable, StatusBadge, MetricCard, Modal, Input, Select, Dropdown } from '../components/ui';

export default function Products() {
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
    purchase_price: '',
    sale_price: '',
    min_stock_level: 10,
    max_stock_level: 200,
    supplier_id: ''
  });

  const { showToast } = useToast();

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
    setFormData({
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      category: categories.length > 0 ? (typeof categories[0] === 'string' ? categories[0] : categories[0].name || 'General') : 'General',
      barcode: `869${Math.floor(100000000 + Math.random() * 900000000)}`,
      unit: 'adet',
      purchase_price: '',
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
    setFormData({
      sku: p.sku || '',
      name: p.name || '',
      category: p.category || '',
      barcode: p.barcode || p.gtin || '',
      unit: p.unit || 'adet',
      purchase_price: p.purchase_price || p.cost_price || '',
      sale_price: p.sale_price || '',
      min_stock_level: p.min_stock_level || 10,
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
        showToast('Product updated.', 'success');
      } else {
        await apiClient.post('/products', formData);
        showToast('Product created.', 'success');
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
      label: 'Product & SKU',
      render: (row) => (
        <div>
          <span className="font-bold text-gray-900 group-hover:text-brand-500 transition">{row.name}</span>
          <span className="block font-mono text-[10px] text-gray-500">SKU: {row.sku}</span>
        </div>
      )
    },
    { key: 'barcode', label: 'Barcode/GTIN', render: (row) => <span className="font-mono text-gray-500">{row.barcode || row.gtin || '-'}</span> },
    { key: 'category', label: 'Category', render: (row) => <StatusBadge status="info" text={row.category || 'General'} /> },
    {
      key: 'cost',
      label: 'Cost',
      align: 'right',
      render: (row) => <span className="font-mono font-bold text-gray-500 tabular-nums">${Number(row.purchase_price || row.cost_price || 0).toFixed(2)}</span>
    },
    {
      key: 'price',
      label: 'Price',
      align: 'right',
      render: (row) => <span className="font-mono font-bold text-green-600 tabular-nums">${Number(row.sale_price || row.kamu_fiyati || 0).toFixed(2)}</span>
    },
    {
      key: 'supplier',
      label: 'Supplier',
      render: (row) => <span className="text-gray-500">{row.supplier_name || '-'}</span>
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); handleOpenDetail(row); }} title="Ürün Detayı & Stok Lokasyonları" className="p-1.5 text-gray-500 hover:text-brand-500 transition"><Eye className="w-4 h-4" /></button>
          <button onClick={(e) => handleOpenBarcode(row, e)} title="Karekod / Barkod" className="p-1.5 text-gray-500 hover:text-brand-500 transition"><Barcode className="w-4 h-4" /></button>
          <button onClick={(e) => handleOpenEdit(row, e)} title="Düzenle" className="p-1.5 text-gray-500 hover:text-brand-500 transition"><Edit2 className="w-4 h-4" /></button>
          <button onClick={(e) => handleDeleteProduct(row, e)} title="Sil" className="p-1.5 text-gray-500 hover:text-red-500 transition"><Trash2 className="w-4 h-4" /></button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-gray-900 pb-12">
      {/* Header */}
      <div className="veniux-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-brand-500/10 text-brand-500 rounded-xl border border-brand-500/20">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono tracking-tight uppercase">Master Product Catalog</h1>
              <StatusBadge status="info" text={`${products.length} MASTER SKUS`} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Product definitions, GTIN mappings, and supplier links.</p>
          </div>
        </div>

        <button onClick={handleOpenAdd} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span>New Product</span>
        </button>
      </div>

      {/* Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard title="Total Master Items" value={products.length} trendLabel="Active system records" />
        <MetricCard title="Barcoded SKUs" value={`${products.filter(p => p.barcode || p.gtin).length} / ${products.length}`} trendLabel="EAN-13 & GS1 Compliant" />
        <MetricCard title="Categories" value={categories.length} trendLabel="Unique storage groups" />
        <MetricCard title="Suppliers" value={suppliers.length} trendLabel="Active vendors" />
      </div>

      {/* Main Table Container */}
      <div className="veniux-card flex flex-col h-[600px] overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-gray-100/50 flex flex-col lg:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 sm:w-80 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search by name, SKU or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-100 border border-gray-200 text-xs rounded-xl pl-9 pr-3 py-2 outline-none focus:border-brand-500 transition"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto">
            <Dropdown
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-gray-100 border border-gray-200 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-brand-500 cursor-pointer transition"
            >
              <option value="">All Categories</option>
              {categories.map((c, i) => {
                const name = typeof c === 'string' ? c : c.category || c.name;
                return <option key={i} value={name}>{name}</option>;
              })}
            </Dropdown>

            <Dropdown
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="bg-gray-100 border border-gray-200 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-brand-500 cursor-pointer transition"
            >
              <option value="">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Dropdown>
          </div>
        </div>

        {/* Dense Enterprise Table */}
        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0">
            <DataTable 
              columns={columns}
              data={products}
              loading={loading}
              onRowClick={handleOpenDetail}
              emptyState="No products match your criteria."
            />
          </div>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        title={editingProduct ? 'Edit Product' : 'New Master SKU'}
        size="lg"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="SKU Code" required value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
            <Input label="Barcode / EAN" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} />
          </div>
          
          <Input label="Product Name" required placeholder="e.g. Paracetamol 500mg" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />

          <div className="grid grid-cols-2 gap-4">
            <Input label="Category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
            <Select 
              label="Supplier"
              value={formData.supplier_id} 
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              options={[
                { value: '', label: '-- Select Supplier --' },
                ...suppliers.map(s => ({ value: s.id, label: s.name }))
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input type="number" step="0.01" label="Cost Price ($)" value={formData.purchase_price} onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })} />
            <Input type="number" step="0.01" required label="Sale Price ($)" value={formData.sale_price} onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editingProduct ? 'Save Changes' : 'Create Product'}</button>
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
