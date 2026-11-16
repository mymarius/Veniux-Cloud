import {useEffect,useState} from 'react';
import {motionOn} from '../lib/motion';

// Oturumda ilk açılışta lacivert bir perde, köşedeki daireden büyüyerek ekranı açar (videodaki açılış).
export default function IntroReveal(){
 const [show,setShow]=useState(()=>{try{if(!motionOn()||window.veniuxMobile)return false;if(sessionStorage.getItem('vx_intro'))return false;sessionStorage.setItem('vx_intro','1');document.documentElement.dataset.intro='1';document.documentElement.style.setProperty('--vx-base','.1s');return true;}catch{return false;}});
 useEffect(()=>{if(!show)return undefined;const t=setTimeout(()=>{setShow(false);delete document.documentElement.dataset.intro;document.documentElement.style.removeProperty('--vx-base');},900);return()=>clearTimeout(t);},[show]);
 if(!show)return null;
 return <div className="vx-intro" aria-hidden="true"><span className="vx-intro-dot"/></div>;
}
