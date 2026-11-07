import {readCountDraft,saveCountDraft} from '../../../../shared/countDraft.mjs';
import { readSessionUser } from '../../lib/sessionUser';
import {applyScan,countProgress} from '../../../../shared/countScan.mjs';
import ScannerPanel from '../../components/ScannerPanel';
import { Dropdown } from '../../components/ui';
import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';
import {
  Boxes,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Warehouse,
  Search,
  RefreshCw,
  SlidersHorizontal,
  FileCheck2,
  Lock,
  ScanLine,
  ArrowRight
} from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function WMSCycleCount() {
  const keyOf=l=>l.location_id+':'+l.product_id+':'+(l.lot_id??'none');
  const [review,setReview]=useState(null),[reviews,setReviews]=useState([]),[reason,setReason]=useState(''),[approveKey,setApproveKey]=useState(null),[busy,setBusy]=useState(false),[search,setSearch]=useState(''),[scanner,setScanner]=useState(false);
  const [quick,setQuick]=useState(false),[quickLocation,setQuickLocation]=useState(null),[quickStatus,setQuickStatus]=useState(null);
  const [products,setProducts]=useState([]),[manualProduct,setManualProduct]=useState(''),[manualLocation,setManualLocation]=useState(''),[manualLot,setManualLot]=useState('');
  const role=readSessionUser().role,canApprove=['admin','manager'].includes(role);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedAisle, setSelectedAisle] = useState('ALL');
  const [locations, setLocations] = useState([]);
  const [counts, setCounts] = useState({});
  const [showSystemQuantities, setShowSystemQuantities] = useState(false);
  const [loading, setLoading] = useState(true);

  const { showToast } = useToast();
  const [savedDraft,setSavedDraft]=useState(null);const countRequest=useRef(0);
  const currentUser=readSessionUser(),draftKey=['veniux:smartcount-v1',currentUser.id,sessionStorage.getItem('platform-tenant')||currentUser.tenant_id,selectedWarehouseId,selectedAisle].join(':');
  useEffect(()=>{try{setSavedDraft(readCountDraft(sessionStorage,draftKey));}catch{setSavedDraft(null);}},[draftKey]);
  function restoreDraft(){if(!savedDraft)return;setLocations(old=>[...savedDraft.rows,...old.filter(row=>!savedDraft.rows.some(saved=>keyOf(saved)===keyOf(row)))]);setCounts(old=>({...old,...savedDraft.counts}));showToast('Taslak açıldı. İlk başlangıç kaydı korunur; stok hareketi olduysa yeniden sayım istenir.','info');}


  useEffect(() => {
    fetchWarehouses();
    apiClient.get('/products').then(r=>setProducts(Array.isArray(r.data)?r.data:r.data.products||[])).catch(()=>{});
  }, []);

  useEffect(() => {
    if (selectedWarehouseId) {
      fetchCountLocations();
    }
    return()=>{countRequest.current++;};
  }, [selectedWarehouseId, selectedAisle]);

  const fetchWarehouses = async () => {
    try {
      const res = await apiClient.get('/warehouses');
      setWarehouses(res.data || []);
      if (res.data?.length > 0) {
        setSelectedWarehouseId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
      showToast('Depolar yüklenirken hata oluştu.', 'error');
    }
  };

  const fetchCountLocations = async () => {
    if (!selectedWarehouseId) return;
    const request=++countRequest.current;setLoading(true);
    try {
      let url = `/wms/cycle-count/locations?warehouse_id=${selectedWarehouseId}`;
      if (selectedAisle !== 'ALL') url += `&aisle_code=${selectedAisle}`;
      const res = await apiClient.get(url);
      if(request!==countRequest.current)return;setLocations(res.data || []);

      // Initialize counts state
      const initialCounts = {};
      (res.data || []).forEach(loc => {
        initialCounts[keyOf(loc)] = '';
      });
      setCounts(initialCounts);
      setReviews((await apiClient.get('/wms/cycle-count/reviews')).data);
    } catch (err) {
      console.error(err);
      showToast('Sayım lokasyonları yüklenemedi.', 'error');
    } finally {
      if(request===countRequest.current)setLoading(false);
    }
  };

  const handleCountChange = (locationId, val) => {
    const next={...counts,[locationId]:val};setCounts(next);try{setSavedDraft(saveCountDraft(sessionStorage,draftKey,locations,next));}catch{showToast('Taslak cihazda saklanamadı. Ekrandaki miktar korunuyor.','warning');}
  };

  const handleSubmitAdjustment=async loc=>{const value=counts[keyOf(loc)];if(value===''||value===undefined){showToast('Sayılan miktarı girin.','warning');return;}setBusy(true);try{const r=await apiClient.post('/wms/cycle-count/preview',{baseline_token:loc.baseline_token,counted_qty:value});setReview({...r.data,...loc,system_qty:r.data.system_qty,counted_qty:r.data.counted_qty});setReason('');setApproveKey(crypto.randomUUID());setReviews((await apiClient.get('/wms/cycle-count/reviews')).data);}catch(e){showToast(e.response?.data?.error||'Sayım önizlemesi alınamadı.','error');}finally{setBusy(false);}};
  const approve=async()=>{if(busy||!window.confirm('Gösterilen sayım farkı stok hareketi olarak işlenecek. Onaylıyor musunuz?'))return;setBusy(true);try{const r=await apiClient.post('/wms/cycle-count/adjust',{review_id:review.id,reason},{headers:{'Idempotency-Key':approveKey}});showToast(r.data.message,'success');try{const draft=readCountDraft(sessionStorage,draftKey);if(draft){const remaining={...draft.counts};delete remaining[keyOf(review)];const rows=draft.rows.filter(row=>keyOf(row)!==keyOf(review));setSavedDraft(saveCountDraft(sessionStorage,draftKey,rows,remaining));}}catch{}setReview(null);await fetchCountLocations();}catch(e){showToast(e.response?.data?.error||'Sonuç alınamadı; aynı onayı tekrar kontrol edin.','error');}finally{setBusy(false);}};
  const addManualRow=async()=>{try{const r=await apiClient.post('/wms/cycle-count/baseline',{warehouse_id:Number(selectedWarehouseId),location_id:Number(manualLocation),product_id:Number(manualProduct),lot_number:manualLot||undefined});const p=products.find(p=>String(p.id)===manualProduct),l=locations.find(l=>String(l.location_id)===manualLocation);const row={...r.data,product_name:p?.name,sku:p?.sku,barcode:p?.barcode,unit:p?.unit,location_code:l?.location_code,aisle_code:l?.aisle_code,zone_name:l?.zone_name};setLocations(old=>[...old.filter(x=>keyOf(x)!==keyOf(row)),row]);setCounts(old=>({...old,[keyOf(row)]:''}));setSearch('');showToast('Sayım başlangıcı kaydedildi; şimdi fiziki miktarı girin.','success');}catch(e){showToast(e.response?.data?.error||'Sayım satırı açılamadı.','error');}};
  const handleQuickScan=raw=>{const result=applyScan(locations,counts,raw,quickLocation);if(result.error){setQuickStatus({error:true,text:result.error});return;}if(result.shelf){setQuickLocation(result.location);setQuickStatus({text:'Raf seçildi: '+result.shelf});return;}setCounts(result.counts);try{setSavedDraft(saveCountDraft(sessionStorage,draftKey,locations,result.counts));}catch{}setQuickStatus({text:result.row.product_name+': '+result.quantity});};
  const submitAllCounts=async()=>{const rows=locations.filter(l=>l.product_id&&counts[keyOf(l)]!==''&&counts[keyOf(l)]!==undefined);setBusy(true);let sent=0;const failed=[];for(const row of rows){try{await apiClient.post('/wms/cycle-count/preview',{baseline_token:row.baseline_token,counted_qty:counts[keyOf(row)]});sent++;}catch(e){failed.push(row.product_name+' ('+(e.response?.data?.error||'gönderilemedi')+')');}}try{setReviews((await apiClient.get('/wms/cycle-count/reviews')).data);}catch{}setBusy(false);setQuickStatus(failed.length?{error:true,text:sent+' satır gönderildi. Kalan: '+failed.join(', ')}:{text:sent+' satır onaya gönderildi. Stok, yönetici onayından sonra değişir.'});};
  const progress=countProgress(locations,counts);
  const aisles = Array.from(new Set(locations.map(l => l.aisle_code).filter(Boolean))).sort();

  return (
    <div className="space-y-6 animate-fade-in max-w-[1700px] mx-auto text-gray-900 font-sans pb-12">
      {savedDraft?.rows.length>0&&<section className="veniux-card p-4"><p>{savedDraft.rows.length} satırlık yerel sayım taslağı var. Taslak stok hareketi oluşturmaz; sunucu kontrolü ve yönetici onayı gerekir.</p><button className="btn-secondary" disabled={busy} onClick={restoreDraft}>Taslağı geri aç</button><button className="btn-soft" disabled={busy} onClick={()=>{try{sessionStorage.removeItem(draftKey);setSavedDraft(null);}catch{}}}>Kaydedilmiş taslağı kaldır</button></section>}
      {/* 1. Master Header */}
      <div className="veniux-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-500/20 text-brand-500 border border-brand-500/30 rounded-lg shadow-lg shadow-indigo-600/20">
            <ScanLine className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-gray-900 uppercase">
                Stok sayımı
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-600 border border-brand-200">
                {locations.length} GÖZ LİSTELENDİ
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Kör sayım · Hareket değişiminde yeniden kontrol · Yetkili onayı
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 bg-gray-50 px-3.5 py-2 rounded-full border border-gray-200">
            <Warehouse className="w-4 h-4 text-brand-500" />
            <Dropdown
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="bg-transparent text-gray-900 font-bold outline-none cursor-pointer"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id} className="bg-white">{w.name}</option>
              ))}
            </Dropdown>
          </div>

          <button
            disabled={!canApprove}
            onClick={() => setShowSystemQuantities(!showSystemQuantities)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full font-bold border transition ${
              showSystemQuantities
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {showSystemQuantities ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span>{showSystemQuantities ? 'Sistem Stoklarını Gizle' : 'Sistem Stoklarını Göster'}</span>
          </button>
        </div>
      </div>

      <section className="veniux-card p-4 space-y-3" aria-label="Hızlı sayım">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Hızlı sayım</h2><p className="text-sm text-gray-500">Rafı okutun, sonra her ürünü tek tek okutun. Sayaç kendiliğinden artar.</p></div>
          <button type="button" className={quick ? 'btn-soft' : 'btn-primary'} onClick={() => { setQuick(!quick); setQuickStatus(null); }}>{quick ? 'Hızlı sayımı kapat' : 'Hızlı sayımı başlat'}</button>
        </div>
        {quick && <>
          <ScannerPanel compact onCode={async raw => handleQuickScan(raw)} />
          <div className="vx-count-progress" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Sayım ilerlemesi"><i style={{ width: progress.percent + '%' }} /></div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>{progress.done} / {progress.total} satır sayıldı{quickLocation !== null ? ` · Raf: ${locations.find(l => l.location_id === quickLocation)?.location_code || ''}` : ''}</span>
            <button type="button" className="btn-primary" disabled={busy || !progress.done} onClick={submitAllCounts}>Sayılanları onaya gönder</button>
          </div>
          {quickStatus && <p role={quickStatus.error ? 'alert' : 'status'} className={quickStatus.error ? 'text-sm font-semibold text-red-700' : 'text-sm font-semibold text-emerald-700'}>{quickStatus.text}</p>}
        </>}
      </section>

      <section className="veniux-card p-4 space-y-3"><label className="block text-sm">Barkod, ürün veya lot ile bul<input className="border rounded p-2 w-full" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Barkodu okutun veya elle yazın"/></label><button className="btn-soft" onClick={()=>setScanner(!scanner)}>Barkod okuyucu girişi</button>{scanner&&<ScannerPanel onCode={async raw=>{const r=await apiClient.post('/scanner/lookup',{barcode:raw,warehouse_id:selectedWarehouseId});if(!r.data.product)throw Error('Ürün bulunamadı.');setSearch(r.data.product.barcode||r.data.product.sku);}}/>}</section>
      <details className="veniux-card p-4"><summary className="cursor-pointer font-semibold">Manuel ürün / lot / raf satırı aç</summary><div className="grid md:grid-cols-3 gap-3 mt-3"><label>Ürün<select className="border rounded p-2 w-full" value={manualProduct} onChange={e=>setManualProduct(e.target.value)}><option value="">Seçin</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.barcode||p.sku}</option>)}</select></label><label>Raf<select className="border rounded p-2 w-full" value={manualLocation} onChange={e=>setManualLocation(e.target.value)}><option value="">Seçin</option>{[...new Map(locations.map(l=>[l.location_id,l])).values()].map(l=><option key={l.location_id} value={l.location_id}>{l.location_code}</option>)}</select></label><label>Lot numarası<input className="border rounded p-2 w-full" value={manualLot} onChange={e=>setManualLot(e.target.value)} placeholder="Lotlu üründe kayıtlı lot numarası"/></label></div><button className="btn-secondary mt-3" disabled={!manualProduct||!manualLocation||busy} onClick={addManualRow}>Sayım satırını aç</button></details>
      {review&&<section className="veniux-card p-4 space-y-3" role="dialog" aria-label="Sayım farkı önizleme"><h2 className="font-semibold">Sayım farkı önizleme</h2><p>{review.product_name} · {review.location_code} · Lot {review.lot_number||'yok'} · {review.expiry_date||'Tarih yok'}</p><p>{review.system_qty===undefined?<>Sayılan: {review.counted_qty} · Yönetici onayına gönderildi</>:<>Kayıtlı: {review.system_qty} · Sayılan: {review.counted_qty} · Fark: {Number((review.counted_qty-review.system_qty).toFixed(6))}</>}</p><p className="text-sm text-slate-500">Sayan kullanıcı: {review.operator_id}. Onayda stok tekrar kontrol edilir.</p>{canApprove&&<><label>Onay gerekçesi<input maxLength={500} className="border rounded p-2 w-full" value={reason} onChange={e=>{setReason(e.target.value);setApproveKey(crypto.randomUUID());}}/></label><button className="btn-primary" disabled={busy||reason.trim().length<5} onClick={approve}>Farkı onayla ve işle</button></>}<button className="btn-secondary" onClick={()=>setReview(null)}>Kapat</button></section>}
      {reviews.some(r=>r.status==='pending'&&String(r.warehouse_id)===String(selectedWarehouseId))&&<section className="veniux-card p-4 space-y-2"><h2 className="font-semibold">Onay bekleyen sayımlar</h2>{reviews.filter(r=>r.status==='pending'&&String(r.warehouse_id)===String(selectedWarehouseId)).map(r=><button className="btn-soft flex w-full justify-start text-left whitespace-normal py-2" key={r.id} onClick={()=>{setReview(r);setReason('');setApproveKey(crypto.randomUUID());}}>{r.product_name} · {r.location_code} · Lot {r.lot_number||'yok'} · {r.system_qty} → {r.counted_qty}</button>)}</section>}
      {/* 2. Count Locations Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden text-xs">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/70">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-brand-500" />
            <h3 className="font-bold text-gray-900 uppercase">SAYILACAK GÖZ LİSTESİ</h3>
          </div>

          <div className="flex items-center gap-2">
            <Dropdown
              value={selectedAisle}
              onChange={(e) => setSelectedAisle(e.target.value)}
              className="bg-white border border-gray-200 text-gray-900 px-3 py-1.5 rounded-full outline-none font-medium"
            >
              <option value="ALL">Tüm Koridorlar</option>
              {aisles.map(a => <option key={a} value={a}>{a} Koridoru</option>)}
            </Dropdown>
            <button onClick={fetchCountLocations} className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-gray-900 transition shadow-2xs">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
            <span>Sayım gözleri taranıyor...</span>
          </div>
        ) : locations.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            <p className="text-sm font-bold text-gray-700">Bu koridorda sayılacak aktif ürün gözü bulunamadı.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Göz Kodu</th>
                  <th className="px-4 py-3">Ürün & SKU</th>
                  <th className="px-4 py-3">Parti (Lot)</th>
                  {showSystemQuantities && <th className="px-4 py-3 text-right text-amber-600">Sistem Stoğu</th>}
                  <th className="px-4 py-3 text-center">Fiziki Sayılan Adet</th>
                  <th className="px-4 py-3 text-right">Mutabakat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {locations.filter(loc=>[loc.product_name,loc.sku,loc.barcode,loc.lot_number,loc.location_code].some(v=>String(v||'').toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')))).map((loc) => {
                  const counted = counts[keyOf(loc)];
                  const hasDifference = showSystemQuantities && counted !== '' && parseFloat(counted) !== loc.system_qty;

                  return (
                    <tr key={keyOf(loc)} className="hover:bg-brand-50/40 transition">
                      <td className="px-4 py-3 font-bold text-brand-600">{loc.location_code}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-gray-900 block">{loc.product_name || 'Ürün'}</span>
                        <span className="text-[10px] text-gray-500 block">SKU: {loc.sku}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{loc.lot_number || '-'}<small className="block">{loc.expiry_date||'Tarih yok'}</small></td>

                      {showSystemQuantities && (
                        <td className="px-4 py-3 text-right font-bold text-amber-600">
                          {loc.system_qty || 0} Adet
                        </td>
                      )}

                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0" step="0.000001" disabled={!loc.product_id||busy}
                          value={counts[keyOf(loc)]}
                          onChange={(e) => handleCountChange(keyOf(loc), e.target.value)}
                          placeholder="Adet girin..."
                          className={`w-32 px-3 py-1.5 bg-gray-50 border rounded-xl font-bold text-center outline-none ${
                            hasDifference ? 'border-rose-500 text-rose-600' : 'border-gray-200 text-gray-900 focus:border-brand-500'
                          }`}
                        />
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          disabled={!loc.product_id||busy} onClick={() => handleSubmitAdjustment(loc)}
                          className="px-4 py-1.5 bg-brand-500 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md transition"
                        >
                          Farkı incele
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
