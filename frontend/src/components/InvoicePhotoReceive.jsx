import {useRef,useState} from 'react';
import {Camera} from 'lucide-react';
import api from '../api/client';
import {fileToDataUrl} from '../lib/imageFit.mjs';
const price=v=>Number(v||0).toLocaleString('tr-TR',{style:'currency',currency:'TRY'});
// Fatura fotoğrafından mal kabul: yapay zekâ satırları TASLAK olarak okur. Hiçbir şey siz onaylamadan stoğa işlenmez;
// eşleşmeyen satır varsayılan olarak atlanır, miktar ve ürün seçimi elle düzeltilebilir. Her satır mevcut mal kabul ile ayrı işlenir.
export default function InvoicePhotoReceive({warehouse}){
  const input=useRef(null),[busy,setBusy]=useState(false),[draft,setDraft]=useState(null),[rows,setRows]=useState([]),[error,setError]=useState(''),[report,setReport]=useState(null);
  async function choose(event){
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    setBusy(true);setError('');setDraft(null);setReport(null);
    try{
      const data=(await api.post('/scanner/pro/vision/invoice',{image_data:await fileToDataUrl(file,1600,0.85)})).data;
      setDraft(data);
      setRows(data.lines.map(l=>({key:crypto.randomUUID(),quantity:String(Math.round(l.quantity)||1),product:l.exact?String(l.candidates[0].id):'',done:false})));
    }catch(e){setError(e.response?.data?.error||'Fatura okunamadı. Fotoğrafı düz ve net çekin.');}
    finally{setBusy(false);}
  }
  const update=(index,patch)=>setRows(list=>list.map((r,i)=>i===index?{...r,...patch}:r));
  const ready=rows.filter(r=>r.product&&!r.done&&Number.isInteger(Number(r.quantity))&&Number(r.quantity)>0);
  async function receive(){
    if(!warehouse||!ready.length)return;
    setBusy(true);setError('');
    let ok=0,failed=0;const next=[...rows];
    for(let i=0;i<next.length;i++){
      const r=next[i];
      if(!r.product||r.done||!(Number.isInteger(Number(r.quantity))&&Number(r.quantity)>0))continue;
      try{await api.post('/retail/receive',{warehouse_id:warehouse,product_id:Number(r.product),quantity:Number(r.quantity)},{headers:{'Idempotency-Key':r.key}});next[i]={...r,done:true};ok++;}
      catch{failed++;}
    }
    setRows(next);setReport({ok,failed});setBusy(false);
  }
  return <section className="veniux-card p-4 space-y-3 mt-4"><h2 className="font-semibold">Fatura fotoğrafından mal kabul</h2>
    <p className="text-sm text-slate-500">Tedarikçi faturasının fotoğrafını çekin; satırlar taslak olarak çıkar. Siz kontrol edip onaylamadan stoğa hiçbir şey eklenmez.</p>
    <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={choose}/>
    <button type="button" className="btn-secondary inline-flex items-center gap-1" disabled={busy||!warehouse} onClick={()=>input.current?.click()}><Camera size={16}/>{busy&&!draft?'Okunuyor…':'Fatura fotoğrafı çek'}</button>
    {!warehouse&&<p className="text-sm">Önce yukarıdan mağaza/depo seçin.</p>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {draft&&<div className="space-y-2">
      <p className="text-sm">Tedarikçi: <b>{draft.supplier||'okunamadı'}</b> · Fatura no: <b>{draft.invoice_no||'—'}</b> · Tarih: <b>{draft.date||'—'}</b></p>
      {draft.warnings.map(w=><p key={w} role="status" className="text-sm text-amber-800">{w}</p>)}
      <table className="w-full text-sm"><thead><tr><th className="text-left">Faturadaki satır</th><th className="text-left">Sizin ürününüz</th><th className="text-right">Miktar (adet)</th><th className="text-right">Faturadaki fiyat</th><th/></tr></thead>
        <tbody>{draft.lines.map((l,i)=><tr key={rows[i]?.key||i}><td>{l.name}</td>
          <td><select aria-label={'Ürün eşleştirme: '+l.name} className="border rounded p-1" disabled={busy||rows[i]?.done} value={rows[i]?.product||''} onChange={e=>update(i,{product:e.target.value})}><option value="">Atla (stoğa işleme)</option>{l.candidates.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
          <td className="text-right"><input aria-label={'Miktar: '+l.name} type="number" min="1" step="1" className="border rounded p-1 w-24" disabled={busy||rows[i]?.done} value={rows[i]?.quantity||''} onChange={e=>update(i,{quantity:e.target.value})}/></td>
          <td className="text-right">{l.unit_price===null?'—':price(l.unit_price)}</td><td>{rows[i]?.done?'İşlendi':''}</td></tr>)}</tbody></table>
      <button type="button" className="btn-primary" disabled={busy||!ready.length} onClick={receive}>Onayla ve {ready.length} satırı stoğa işle</button>
      {report&&<p role="status" className="text-sm">{report.ok} satır işlendi{report.failed?`, ${report.failed} satır işlenemedi (tekrar deneyebilirsiniz; işlenenler tekrar eklenmez)`:''}.</p>}
      <p className="text-xs text-slate-500">Fiyatlar yalnızca bilgi içindir; alış fiyatı ve ürün fiyatı değiştirilmez. Eşleşmeyen ürünü Hızlı Ekle ile tanımlayın.</p>
    </div>}
  </section>;
}
