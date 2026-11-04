import React,{useEffect,useState} from 'react';
import api from '../../api/client';
import {X,Loader2} from 'lucide-react';
export default function AccessScopeEditor({user,onClose}){
 const [scope,setScope]=useState(null),[warehouses,setWarehouses]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;Promise.all([api.get(`/settings/users/${user.id}/access-scope`),api.get('/warehouses')]).then(([s,w])=>{if(live){setScope(s.data);setWarehouses(w.data);}}).catch(e=>{if(live)setError(e.response?.data?.error||'Erişim bilgileri alınamadı.');});return()=>{live=false;};},[user.id]);
 async function save(e){e.preventDefault();if(busy||!scope)return;setBusy(true);setError('');try{await api.put(`/settings/users/${user.id}/access-scope`,{mode:scope.mode,warehouse_ids:scope.mode==='company'?[]:scope.warehouse_ids});onClose();}catch(e){setError(e.response?.data?.error||'Erişim kaydedilemedi. Tekrar deneyin.');}finally{setBusy(false);}}
 return <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4" onKeyDown={e=>{if(e.key==='Escape'&&!busy)onClose();}}><div role="dialog" aria-modal="true" aria-label="Depo erişim kapsamı" className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-auto">
 <div className="flex justify-between items-center"><h3 className="font-bold text-base text-gray-900">Depo erişim kapsamı</h3><button type="button" disabled={busy} onClick={onClose} aria-label="Kapat"><X className="w-5 h-5"/></button></div>
 <p className="text-sm text-gray-500">{user.fullName||user.email} · Rol işlem yetkisini, bu seçim erişilebilen depoları belirler.</p>
 {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
 {!scope&&!error&&<Loader2 className="animate-spin w-5 h-5"/>}
 {scope&&<form onSubmit={save} className="space-y-4">
 <label className="flex gap-2 text-sm"><input disabled={busy} type="radio" name="scope" checked={scope.mode==='restricted'} onChange={()=>setScope({...scope,mode:'restricted'})}/>Seçili depolar</label>
 <label className="flex gap-2 text-sm"><input disabled={busy} type="radio" name="scope" checked={scope.mode==='company'} onChange={()=>setScope({...scope,mode:'company'})}/>Firma genelinde erişim</label>
 {scope.mode==='company'?<p className="text-sm text-amber-700">Mevcut ve sonradan açılan tüm firma depolarına erişim verir. Rol izinleri değişmez.</p>:<div className="border border-gray-200 rounded-lg p-3 space-y-2">{warehouses.map(w=><label key={w.id} className="flex gap-2 text-sm"><input type="checkbox" disabled={busy} checked={scope.warehouse_ids.includes(w.id)} onChange={e=>setScope({...scope,warehouse_ids:e.target.checked?[...scope.warehouse_ids,w.id]:scope.warehouse_ids.filter(id=>id!==w.id)})}/>{w.name}</label>)}<p className="text-xs text-gray-500">Depo seçilmezse operasyon erişimi kapalı kalır. Ayrı şube kaydı bulunmadığından depo/mağaza lokasyonları kullanılır.</p></div>}
 <button className="btn-primary w-full" disabled={busy} type="submit">{busy?'Kaydediliyor…':'Erişimi kaydet'}</button></form>}
 </div></div>;
}
