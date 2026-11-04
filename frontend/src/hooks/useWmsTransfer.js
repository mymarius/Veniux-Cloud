import {useRef,useState} from 'react';
import api from '../api/client';
export default function useWmsTransfer(){
 const user=JSON.parse(localStorage.getItem('user')||'{}'),scope='wms-transfer:'+ (sessionStorage.getItem('platform-tenant')||user.tenant_id)+':'+user.id;
 const [pending,setPending]=useState(()=>{try{return JSON.parse(sessionStorage.getItem(scope)||'null');}catch{return null;}}),[busy,setBusy]=useState(false),lock=useRef(false);
 async function execute(body){if(lock.current)return null;lock.current=true;setBusy(true);try{const operation=pending||{key:crypto.randomUUID(),body};sessionStorage.setItem(scope,JSON.stringify(operation));setPending(operation);const r=await api.post('/wms/locations/relocate',operation.body,{headers:{'Idempotency-Key':operation.key}});sessionStorage.removeItem(scope);setPending(null);return r.data;}catch(e){const status=e.response?.status;if(status>=400&&status<500&&![408,429].includes(status)){sessionStorage.removeItem(scope);setPending(null);}throw e;}finally{lock.current=false;setBusy(false);}}
 return {pending,busy,execute};
}
