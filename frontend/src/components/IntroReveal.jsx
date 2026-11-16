import {useEffect,useState} from 'react';
import {motionOn} from '../lib/motion';

// Oturumda ilk açılışta lacivert bir perde, köşedeki daireden büyüyerek ekranı açar (videodaki açılış).
export default function IntroReveal(){
 const [show,setShow]=useState(()=>{try{if(!motionOn()||window.veniuxMobile)return false;if(sessionStorage.getItem('vx_intro'))return false;sessionStorage.setItem('vx_intro','1');return true;}catch{return false;}});
 useEffect(()=>{if(!show)return undefined;const t=setTimeout(()=>setShow(false),2200);return()=>clearTimeout(t);},[show]);
 if(!show)return null;
 return <div className="vx-intro" aria-hidden="true"><span className="vx-intro-dot"/></div>;
}
