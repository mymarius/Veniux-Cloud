import {useEffect,useState} from 'react';
import {motionOn} from '../lib/motion';

// Daraltılmış yan menüde simgenin üzerine gelince, sağında koyu bir etiket belirir (videodaki ipucu).
export default function SidebarTip(){
 const [tip,setTip]=useState(null);
 useEffect(()=>{
  const shell=document.querySelector('.enterprise-shell');
  if(!shell)return undefined;
  const over=e=>{
   if(shell.dataset.sbCollapsed!=='true')return;
   const el=e.target.closest?.('.sb [data-tip]');
   if(!el){setTip(null);return;}
   const r=el.getBoundingClientRect();setTip({text:el.dataset.tip,top:r.top+r.height/2,left:r.right+10});
  };
  const out=()=>setTip(null);
  shell.addEventListener('mouseover',over);shell.addEventListener('mouseleave',out);shell.addEventListener('click',out);
  return()=>{shell.removeEventListener('mouseover',over);shell.removeEventListener('mouseleave',out);shell.removeEventListener('click',out);};
 },[]);
 if(!tip)return null;
 return <div className="vx-tip" role="tooltip" data-motion={motionOn()?'on':'off'} style={{top:tip.top,left:tip.left}}>{tip.text}</div>;
}
