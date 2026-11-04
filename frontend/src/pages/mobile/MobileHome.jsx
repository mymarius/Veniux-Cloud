import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ScanBarcode,Package,Warehouse,ClipboardCheck,ArrowDownLeft,ArrowUpRight,RefreshCw,ChevronRight,Settings,AlertCircle,BarChart3,Handshake,Printer} from 'lucide-react';
import api,{useDataSync} from '../../api/client';
import {readSessionUser} from '../../lib/sessionUser';
import {asList} from '../../lib/stockAnalytics';
import useCustomerSetup from '../../hooks/useCustomerSetup';
import {moduleForPath} from '../../lib/customerExperience.mjs';
export default function MobileHome(){
 const {setup}=useCustomerSetup();
 const [data,setData]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const user=readSessionUser();useDataSync(()=>setRevision(n=>n+1));
 useEffect(()=>{let active=true;const controller=new AbortController();setError('');Promise.all(['/normal-depo/dashboard-stats','/warehouses','/alerts'].map(p=>api.get(p,{signal:controller.signal}))).then(([p,w,a])=>{if(active)setData({productCount:Number(p.data.totalProducts||0),warehouses:asList(w.data),alerts:asList(a.data)});}).catch(()=>{if(active)setError('Kayıtlar yenilenemedi. İnternet bağlantınızı kontrol edin.');});return()=>{active=false;controller.abort();};},[revision]);
 const tasks=[['Etiketler','/magaza/etiketler',Printer,'orange'],['Depolar','/normal-depo/warehouses',Warehouse,'blue'],['Ürünler','/normal-depo/products',Package,'violet'],['Raporlar','/normal-depo/analytics',BarChart3,'teal'],...(['admin','manager'].includes(user.role)?[['Mal kabul','/normal-depo/inbound',ArrowDownLeft,'orange'],['Sayım','/normal-depo/counting',ClipboardCheck,'green']]:[]),...(window.VeniuxAndroid?.isCloud?.()?[['Saha ve bayi','/business',Handshake,'pink']]:[])];
 return <div className="mobile-home"><div className="mobile-home-heading"><div><p className="mobile-kicker">{user.company_name||'İŞLETMENİZ'}</p><h1>Merhaba{user.full_name?', '+user.full_name.split(' ')[0]:''}</h1><p>Bugün hangi işlemle başlayalım?</p></div><button aria-label="Kayıtları yenile" className="mobile-refresh" onClick={()=>setRevision(n=>n+1)}><RefreshCw size={20}/></button></div>
 {error&&<p role="alert" className="mobile-warning"><AlertCircle size={18}/>{error}</p>}
 <Link className="mobile-scan-action" to="/magaza/hizli-ekle"><span className="mobile-scan-icon"><ScanBarcode size={30}/></span><span><strong>Barkod okut</strong><small>Ürünü bulun, fiyatını görün.</small></span><ChevronRight size={22}/></Link>
 <h2 className="mobile-section-title mobile-hub-label">İşlemler</h2><div className="mobile-module-grid">{tasks.filter(([,to])=>!setup||setup.revision===0||!moduleForPath(to)||setup.modules.includes(moduleForPath(to))).map(([title,to,Icon,tone])=><Link key={to} to={to}><span data-tone={tone}><Icon size={25}/></span><strong>{title}</strong></Link>)}</div>
 <div className="mobile-summary mobile-compact-summary"><Link to="/normal-depo/products"><span>Ürün</span><strong>{data?data.productCount:'—'}</strong></Link><Link to="/normal-depo/warehouses"><span>Depo</span><strong>{data?data.warehouses.length:'—'}</strong></Link></div>
 <div className="mobile-section-heading"><h2 className="mobile-section-title">Uyarılar</h2><Link to="/alerts">Tümünü gör <ChevronRight size={14}/></Link></div>
 <div className="mobile-alert-list">{!data?<p role="status">Kayıtlar yükleniyor…</p>:data.alerts.length?data.alerts.slice(0,3).map(a=><Link key={a.id} to="/alerts"><AlertCircle size={20}/><span><strong>{a.title||'Stok bildirimi'}</strong><small>{a.message}</small></span><ChevronRight size={16}/></Link>):<p>Henüz uyarı kaydı bulunmuyor.</p>}</div>
 <Link className="mobile-settings-link" to="/settings"><Settings size={18}/>Hesap, lisans ve bağlantı<ChevronRight size={16}/></Link>
 </div>;
}

