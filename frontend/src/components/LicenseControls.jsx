import {useState} from 'react';
import api from '../api/client';
export default function LicenseControls({tenantId,license,onSaved}){
 let features={};try{features=JSON.parse(license.enabled_features_json||'{}');}catch{}
 const [status,setStatus]=useState(license.status),[module,setModule]=useState(['NORMAL','BOTH'].includes(features.module_type)?'NORMAL':'NONE'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function save(){setBusy(true);setMessage('');try{await api.patch(`/platform/tenants/${tenantId}/licenses/${license.id}`,{status,module_type:module});setMessage('Kaydedildi. Cihazın sonraki doğrulamasında uygulanır.');onSaved();}catch(e){setMessage(e.response?.data?.error||'Kaydedilemedi.');}finally{setBusy(false);}}
 return <div className="space-y-2"><div className="flex flex-wrap gap-2"><select aria-label="Lisans durumu" value={status} onChange={e=>setStatus(e.target.value)} className="border rounded p-2">{!['ACTIVE','SUSPENDED','REVOKED'].includes(status)&&<option value={status}>{status}</option>}<option value="ACTIVE">Aktif</option><option value="SUSPENDED">Askıda</option><option value="REVOKED">İptal</option></select><select aria-label="Aktif modüller" value={module} onChange={e=>setModule(e.target.value)} className="border rounded p-2"><option value="NORMAL">Normal depo</option><option value="NONE">Modüller kapalı</option></select><button disabled={busy} onClick={save} className="border rounded p-2 disabled:opacity-50">{busy?'Kaydediliyor…':'Kaydet'}</button></div>{message&&<p role="status" className="text-xs">{message}</p>}</div>;
}
