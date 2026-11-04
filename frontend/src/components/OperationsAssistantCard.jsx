import React, { useEffect, useState } from 'react';
import { ClipboardList, ArrowUpRight } from 'lucide-react';
import apiClient from '../api/client';

export default function OperationsAssistantCard() {
  const [overview,setOverview]=useState(null),[error,setError]=useState('');
  let user={};try{user=JSON.parse(localStorage.getItem('user')||'{}');}catch{}
  const allowed=['admin','manager'].includes(user.role);
  useEffect(()=>{
    if(!allowed)return;
    let active=true;
    const receive=e=>{setOverview(e.detail);setError('');};
    window.addEventListener('veniux:assistant-overview',receive);
    apiClient.get('/ai/overview').then(({data})=>{if(active)setOverview(data);}).catch(()=>{if(active)setError('İşletme takibi şu anda yüklenemedi.');});
    return()=>{active=false;window.removeEventListener('veniux:assistant-overview',receive);};
  },[allowed]);
  if(!allowed)return null;
  return <section className="operations-brief" aria-label="İşletme asistanı">
    <div className="operations-brief-title"><ClipboardList size={18}/><h2>Günün öncelikleri</h2></div>
    <div className="operations-brief-items" role="status">{error ? <span>{error}</span> : overview ? [[overview.totals.low_stock,'stok riski'],[overview.totals.open_alerts,'açık uyarı'],[overview.totals.overdue_tasks,'gecikmiş görev']].map(([count,label])=><span key={label}><strong>{count}</strong> {label}</span>) : <span>Kayıtlar kontrol ediliyor…</span>}</div>
    <button className="btn-soft" onClick={()=>window.dispatchEvent(new CustomEvent('veniux:assistant-open',{detail:{message:'Bugünkü önceliklerimi özetle ve hangi adımları atmam gerektiğini açıkla.'}}))}>Birlikte değerlendir <ArrowUpRight size={15}/></button>
  </section>;
}
