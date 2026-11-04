// Single source of truth for what each role can do, as enforced by the route guards.
// tests/roleCapabilities.test.js calls every `probe` with every role and fails if this
// table and the real requireRole(...) checks ever disagree.

const ROLES = [
  { id: 'admin', title: 'Yönetici', summary: 'Tüm işlemler, kullanıcı yönetimi ve denetim kayıtları.' },
  { id: 'manager', title: 'Müdür', summary: 'Stok, depo ve satın alma işlemleri; kullanıcı ekleyemez.' },
  // Keep the persisted role ID for existing accounts; no retired module is offered.
  { id: 'pharmacist', title: 'Kayıt görevlisi', summary: 'Mevcut kayıtları görüntüleme; stok hareketi yapamaz.' },
  { id: 'cashier', title: 'Kasiyer', summary: 'Market kasasında satış; ek kasa yetkileri ayrıca verilir.' },
  { id: 'operator', title: 'Depo operatörü', summary: 'Şu an yalnızca görüntüleme; stok hareketi yapamaz.' },
  { id: 'viewer', title: 'İzleyici', summary: 'Yalnızca görüntüleme.' }
];

const ALL = ROLES.map(r => r.id);
const MANAGE = ['admin', 'manager'];

const CAPABILITIES = [
  {
    category: 'Ürün ve stok',
    items: [
      { id: 'products_view', name: 'Ürün ve stokları görüntüleme', desc: 'Ürün kartları, stok listesi ve hareket geçmişi.', roles: ALL, probe: ['GET', '/api/products'] },
      { id: 'products_edit', name: 'Ürün ekleme ve düzenleme', desc: 'Yeni ürün, barkod ve fiyat güncelleme.', roles: MANAGE, probe: ['POST', '/api/products', {}] },
      { id: 'products_delete', name: 'Ürün silme', desc: 'Ürün kartını sistemden kaldırma.', roles: ['admin'], probe: ['DELETE', '/api/products/999999999'] },
      { id: 'stock_adjust', name: 'Stok düzeltme', desc: 'Manuel giriş/çıkış, sayım farkı ve toplu stok aktarımı.', roles: MANAGE, probe: ['POST', '/api/stock/adjust', {}] }
    ]
  },
  {
    category: 'Depo operasyonları',
    items: [
      { id: 'inbound', name: 'Mal kabul', desc: 'İrsaliye kabulü ve rafa yerleştirme.', roles: MANAGE, probe: ['POST', '/api/wms/inbound/receipts', {}] },
      { id: 'picking', name: 'Toplama ve sevkiyat', desc: 'Toplama dalgaları, paketleme ve sevk.', roles: MANAGE, probe: ['POST', '/api/wms/picking/waves', {}] },
      { id: 'transfer', name: 'Transfer', desc: 'Raflar ve depolar arası stok taşıma.', roles: MANAGE, probe: ['POST', '/api/wms/locations/relocate', {}] },
      { id: 'cycle_count', name: 'Sayım sonucunu kaydetme', desc: 'Sayım farkını stoğa işleme.', roles: MANAGE, probe: ['POST', '/api/wms/cycle-count/adjust', {}] },
      { id: 'terminal_ops', name: 'El terminali işlemleri', desc: 'Terminalden mal kabul, çıkış, transfer ve sayım.', roles: MANAGE, probe: ['POST', '/api/terminal/operations/inbound', {}] },
      { id: 'purchase_orders', name: 'Satın alma siparişleri', desc: 'Sipariş görüntüleme, oluşturma ve teslim alma.', roles: MANAGE, probe: ['GET', '/api/purchase-orders'] }
    ]
  },
  {
    category: 'Mağaza',
    items: [
      { id: 'retail_sale', name: 'Kasada satış', desc: 'Market kasasında barkodla satış yapma.', roles: ['admin', 'manager', 'cashier'], probe: ['GET', '/api/scanner/sales'] }
    ]
  },
  {
    category: 'Yönetim',
    items: [
      { id: 'users_view', name: 'Kullanıcıları görüntüleme', desc: 'Ekip listesi ve rolleri.', roles: MANAGE, probe: ['GET', '/api/settings/users'] },
      { id: 'users_manage', name: 'Kullanıcı ekleme ve düzenleme', desc: 'Personel ekleme, rol ve depo erişimi atama, silme.', roles: ['admin'], probe: ['POST', '/api/settings/users', {}] },
      { id: 'company_settings', name: 'Şirket bilgileri', desc: 'Firma profili ve iletişim bilgileri.', roles: MANAGE, probe: ['PUT', '/api/settings/company', {}] },
      { id: 'audit_logs', name: 'Denetim kayıtları', desc: 'Kritik işlem geçmişini okuma.', roles: ['admin'], probe: ['GET', '/api/audit-logs'] },
      { id: 'ai_assistant', name: 'İşletme asistanı', desc: 'Yapay zekâ danışmanı ve otomatik özetler.', roles: MANAGE, probe: ['GET', '/api/ai/capabilities'] }
    ]
  }
];

// Public shape for the settings page (probes are test-only detail).
const matrix = () => ({
  roles: ROLES,
  capabilities: CAPABILITIES.map(group => ({
    category: group.category,
    items: group.items.map(({ probe, ...item }) => item)
  }))
});

module.exports = { ROLES, CAPABILITIES, matrix };
