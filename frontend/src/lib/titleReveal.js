import {motionOn} from './motion';

// Sayfa başlığını harf harf belirtir: başlığın üstüne, aynı yazı tipinde, harflere bölünmüş katman koyar.
// React'ın kendi metin düğümüne dokunmaz; animasyon bitince katman kalkar ve asıl başlık görünür.
export function revealTitle(h){
 if(!motionOn()||!h||h.dataset.vxDone)return;
 h.dataset.vxDone='1';
 if(h.childNodes.length!==1||h.firstChild.nodeType!==3)return;
 const text=h.textContent.trim();
 if(!text||text.length>80)return;
 const color=getComputedStyle(h).color;
 const layer=document.createElement('span');layer.className='vx-split';layer.setAttribute('aria-hidden','true');
 let n=0;
 text.split(' ').forEach((word,wi,all)=>{
  const w=document.createElement('span');w.className='vx-w';
  for(const ch of word){const c=document.createElement('span');c.className='vx-c';c.textContent=ch;c.style.setProperty('--i',String(n++));c.style.color=color;w.appendChild(c);}
  layer.appendChild(w);
  if(wi<all.length-1)layer.appendChild(document.createTextNode(' '));
 });
 h.dataset.vxSplit='1';h.appendChild(layer);
 setTimeout(()=>{delete h.dataset.vxSplit;layer.remove();},n*38+1300);
}
