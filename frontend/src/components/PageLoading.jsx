import {useEffect,useState} from 'react';
import logo from '../assets/veniux-logo.webp';
import './PageLoading.css';

export default function PageLoading(){
 const [slow,setSlow]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setSlow(true),8000);return()=>clearTimeout(timer);},[]);
 return <div className="vx-page-loading" data-testid="page-loading" role="status" aria-live="polite" aria-busy="true">
  <div className="vx-loading-content">
   <div className="vx-loading-brand"><img src={logo} alt=""/><span>Veniux<small>ENTERPRISE</small></span></div>
   <div className="vx-loading-orbit" aria-hidden="true"><span/><span/><span/></div>
   <h1>Çalışma alanınız hazırlanıyor</h1>
   <p>{slow?'Bağlantı beklenenden uzun sürüyor. Lütfen biraz bekleyin.':'Birazdan kaldığınız yerden devam edebilirsiniz.'}</p>
   <div className="vx-loading-track" aria-hidden="true"><span/></div>
   {slow&&<button type="button" onClick={()=>window.location.reload()}>Yeniden dene</button>}
  </div>
  <span className="vx-loading-footer">Veniux Enterprise</span>
 </div>;
}
