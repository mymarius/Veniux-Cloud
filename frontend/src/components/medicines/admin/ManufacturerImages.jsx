import {useEffect,useState} from 'react';
import api from '../../../api/client';
export default function ManufacturerImages(){
 const [state,setState]=useState(null),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;const load=()=>api.get('/admin/medicines/images/sync').then(r=>{if(active)setState(r.data);}).catch(()=>{});load();const timer=setInterval(load,5000);return()=>{active=false;clearInterval(timer);};},[]);
 async function start(){setMessage('');try{await api.post('/admin/medicines/images/sync');setState({...state,running:true});}catch(e){setMessage(e.response?.data?.error||'Başlatılamadı.');}}
 return <section className="veniux-card p-5 mb-5 space-y-3"><h2 className="font-semibold">Üretici görsellerini eşleştir</h2><p className="text-sm text-slate-500">Polifarma resmî kataloğundaki görselleri ürün adı, doz ve form eşleşmesiyle bağlar. Mevcut görseller korunur. Ürün ailesi görsellerinde kutu boyutu ve setli/setsiz ambalajı ayrıca doğrulayın.</p><button className="vx-btn" disabled={state?.running} onClick={start}>{state?.running?'Görseller kontrol ediliyor…':'Eksik görselleri eşleştir'}</button>{state?.lastResult&&<p role="status">{state.lastResult.updated} görsel eklendi. {state.lastResult.remaining} kayıtta görsel eksik.</p>}{(message||state?.lastError)&&<p role="alert">{message||state.lastError}</p>}</section>;
}
