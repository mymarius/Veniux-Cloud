import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { Download, Upload, Boxes, Loader2, Pill, ShieldCheck, ArrowRight } from 'lucide-react';
import { useToast } from '../components/Toast';

// Quote every cell, including user-controlled SKU/category/unit, and neutralize formulas.
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export default function ImportExport() {
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  async function exportInventory() {
    if (exporting) return;
    setExporting(true);
    try {
      const {data} = await apiClient.get('/stock/records');
      if (!Array.isArray(data)) throw new Error('INVALID_REPORT');
      if (!data.length) { showToast('Dışa aktarılacak stok kaydı yok.', 'info'); return; }
      const sensitive = data.some(row => Object.hasOwn(row, 'purchase_price'));
      const headers = ['SKU','Ürün','Kategori','Depo','Stok','Birim','Satış fiyatı', ...(sensitive ? ['Alış fiyatı','Stok değeri'] : [])];
      const rows = data.map(row => [row.sku,row.product_name,row.category,row.warehouse_name,row.quantity,row.unit,row.sale_price, ...(sensitive ? [row.purchase_price,row.stock_valuation] : [])]);
      const blob = new Blob(['\uFEFF' + [headers,...rows].map(row => row.map(csvCell).join(';')).join('\r\n')], {type:'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `veniux-stok-${new Date().toISOString().slice(0,10)}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('İndirme isteği gönderildi. Dosyanın kaydını tarayıcınızdan kontrol edin.', 'info');
    } catch {
      showToast('Stok raporu indirilemedi. Bağlantınızı kontrol edip tekrar deneyin.', 'error');
    } finally { setExporting(false); }
  }
  return <div className="space-y-6 max-w-7xl mx-auto">
    <div className="pb-4 border-b border-gray-200"><h1 className="text-xl font-bold text-gray-900">Veri Aktarımı ve Geçiş</h1><p className="text-xs text-gray-500 mt-1">Ürün içe aktarma, stok girişi ve envanter raporlama.</p></div>



    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="veniux-card p-6 space-y-5"><h2 className="font-bold text-sm">Ürün içe aktarma ve stok girişi</h2><p className="text-sm text-gray-500">Excel/CSV sütun eşleştirme, önizleme ve hata raporu Ürünler ekranındadır. Dosya aktarımı stok miktarını değiştirmez; stok girişleri Mal Kabul üzerinden yapılır.</p><div className="flex flex-wrap gap-3"><Link className="btn-primary" to="/normal-depo/products"><Upload size={16}/>Ürün içe aktarma</Link><Link className="btn-secondary" to="/normal-depo/inbound"><Boxes size={16}/>Mal Kabul</Link></div><p role="status" className="text-xs text-gray-500">Eski doğrudan stok miktarı aktarımı, lot ve kabul kayıtlarını korumak için kapatıldı.</p></section>
      <section className="veniux-card p-6 space-y-5"><h2 className="font-bold text-sm">Stok raporu</h2><p className="text-sm text-gray-500">Yetkili olduğunuz depoların mevcut stok kayıtlarını CSV olarak indirin. Alış fiyatı ve stok değeri yalnız sunucunun izin verdiği yanıtlarda bulunur.</p><button className="btn-primary" disabled={exporting} onClick={exportInventory}>{exporting ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>} {exporting ? 'Hazırlanıyor…' : 'CSV indir'}</button><p className="text-xs text-gray-500">UTF-8 ve noktalı virgül kullanılır. Excel ile açarken SKU gibi kod sütunlarını metin olarak içe aktarın; CSV dosyası hücre türünü zorlayamaz.</p></section>
    </div>


  </div>;
}
