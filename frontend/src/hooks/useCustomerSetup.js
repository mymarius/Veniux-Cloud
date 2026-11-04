import {useEffect,useState,useCallback,useRef} from 'react';
import api from '../api/client';
import {readSessionUser} from '../lib/sessionUser';
export default function useCustomerSetup(){
 const [setup,setSetup]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(false);
 const user=readSessionUser(),identity=String(user.id||'')+':'+String(sessionStorage.getItem('platform-tenant')||user.tenant_id||'');
 const sequence=useRef(0),scope=useRef(identity);scope.current=identity;
 const invalidate=useCallback(()=>{sequence.current++;},[]);
 const refresh=useCallback(async()=>{const request=++sequence.current;setError(false);try{const {data}=await api.get('/settings/onboarding');if(scope.current!==identity||request!==sequence.current)return;setSetup(data);return data;}catch{if(scope.current===identity&&request===sequence.current){setSetup(null);setError(true);}}finally{if(scope.current===identity&&request===sequence.current)setLoading(false);}},[identity]);
 useEffect(()=>{setSetup(null);setLoading(true);refresh();const handle=e=>{if(e.detail?.url==='/settings/onboarding')refresh();};window.addEventListener('veniux:data-mutated',handle);return()=>{invalidate();window.removeEventListener('veniux:data-mutated',handle);};},[refresh,invalidate]);
 return {setup,setSetup,loading,error,refresh};
}
