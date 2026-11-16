import {useEffect,useState} from 'react';
import {ArrowDownToLine} from 'lucide-react';

// Yeni sürüm hazır olunca üst çubukta yeşil ok çıkar. Tıklayınca küçük bir pencere açılır; "Şimdi güncelle" programı kurup yeniden açar.
export default function UpdateButton(){
 const desktop=typeof window!=='undefined'?window.veniuxDesktop:null;
 const [state,setState]=useState({status:'idle'}),[open,setOpen]=useState(false);
 useEffect(()=>{
  if(!desktop?.getUpdateState)return undefined;
  let live=true;
  desktop.getUpdateState().then(s=>{if(live&&s)setState(s);}).catch(()=>{});
  const off=desktop.onUpdateState?.(s=>{if(live&&s)setState(s);});
  return()=>{live=false;off?.();};
 },[desktop]);
 if(!desktop?.getUpdateState||!['downloading','ready','installing'].includes(state.status))return null;
 const ready=state.status==='ready',installing=state.status==='installing';
 const title=ready?`Yeni sürüm hazır (${state.version||''}). Güncellemek için tıklayın.`:installing?'Güncelleniyor…':`Yeni sürüm indiriliyor %${state.percent||0}`;
 return <div className="update-wrap">
  <button type="button" className="update-btn" data-state={state.status} aria-label={title} title={title} disabled={!ready} onClick={()=>setOpen(o=>!o)}><ArrowDownToLine size={18}/>{!ready&&!installing&&<span>%{state.percent||0}</span>}</button>
  {open&&ready&&<div className="update-pop" role="dialog" aria-label="Güncelleme">
   <b>Yeni sürüm hazır{state.version?` (${state.version})`:''}</b>
   <p>Program kapanır, kurulum bitince kendiliğinden yeniden açılır. Birkaç dakika sürebilir; bu sırada program görünmez.</p>
   <div><button type="button" className="btn-primary" onClick={()=>{setOpen(false);desktop.installUpdate();}}>Şimdi güncelle</button><button type="button" className="btn-soft" onClick={()=>setOpen(false)}>Sonra</button></div>
  </div>}
 </div>;
}
