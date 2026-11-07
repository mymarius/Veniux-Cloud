import { useEffect, useRef, useState } from 'react';
import {Flashlight,SwitchCamera,X} from 'lucide-react';
export default function BarcodeCamera({ onCode, onClose, fullScreen=false, onManual, continuous=false,paused=false,resumeKey=0,toolbar,bottomPanel,embedded=false }) {
 const video=useRef(null),frame=useRef(null),latest=useRef(onCode);
 const [error,setError]=useState(''),[facing,setFacing]=useState('environment'),[torch,setTorch]=useState(false),[canTorch,setCanTorch]=useState(false);latest.current=onCode;
 const blocked=useRef(paused),track=useRef(null),detected=useRef(false),closeButton=useRef(null);blocked.current=paused;
 useEffect(()=>{detected.current=false;},[resumeKey]);
 useEffect(()=>{if(!fullScreen)return;const previous=document.activeElement;closeButton.current?.focus();const escape=e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const controls=[...(closeButton.current?.closest('[role=dialog]')?.querySelectorAll('button:not(:disabled),input:not(:disabled)')||[])];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',escape);return()=>{document.removeEventListener('keydown',escape);previous?.focus?.();};},[fullScreen]);
 async function toggleTorch(){try{await track.current?.applyConstraints({advanced:[{torch:!torch}]});setTorch(v=>!v);}catch{setCanTorch(false);}}
 useEffect(()=>{
  let cancelled=false,stream,timer;const region=document.createElement('canvas'),context=region.getContext('2d');
  const stop=()=>{cancelled=true;clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());track.current=null;};
  const scan=async()=>{
   try{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('Kamera için HTTPS bağlantısı gerekir. Barkodu elle yazabilir veya el terminali kullanabilirsiniz.');
    if(!window.BarcodeDetector)throw new Error('Bu tarayıcı kamera ile barkod okumayı desteklemiyor. Destekleyen bir tarayıcıda açın veya barkodu elle girin.');
    const supported=await window.BarcodeDetector.getSupportedFormats();
    const formats=['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','data_matrix','qr_code'].filter(f=>supported.includes(f));
    if(!formats.length)throw new Error('Bu cihazda uygun barkod okuyucu bulunamadı.');
    const detector=new window.BarcodeDetector({formats});
    setError('');setTorch(false);setCanTorch(false);
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720}},audio:false});
    if(cancelled){stream.getTracks().forEach(t=>t.stop());return;}
    track.current=stream.getVideoTracks()[0];setCanTorch(Boolean(track.current?.getCapabilities?.().torch));video.current.srcObject=stream;await video.current.play();
    const tick=async()=>{
     if(cancelled)return;
     try{
      if(!document.hidden&&!blocked.current&&!detected.current&&video.current?.readyState>=2){let image=video.current;const v=video.current;
       if((fullScreen||embedded)&&frame.current&&context&&v.videoWidth&&v.videoHeight){const box=v.getBoundingClientRect(),area=frame.current.getBoundingClientRect();if(box.width&&box.height&&area.width&&area.height){const scale=Math.max(box.width/v.videoWidth,box.height/v.videoHeight),x=Math.max(0,(area.left-box.left+(v.videoWidth*scale-box.width)/2)/scale),y=Math.max(0,(area.top-box.top+(v.videoHeight*scale-box.height)/2)/scale),w=Math.min(v.videoWidth-x,area.width/scale),h=Math.min(v.videoHeight-y,area.height/scale);if(w>0&&h>0){const cw=Math.max(1,Math.round(Math.min(640,w))),ch=Math.max(1,Math.round(cw*h/w));if(region.width!==cw)region.width=cw;if(region.height!==ch)region.height=ch;context.drawImage(v,x,y,w,h,0,0,cw,ch);image=region;}}}
       const codes=await detector.detect(image);if(cancelled)return;if(codes[0]?.rawValue){const code=codes[0].rawValue;if(!continuous){stop();latest.current(code);return;}detected.current=true;latest.current(code);}}
      if(!cancelled)timer=setTimeout(tick,250);
     }catch{stop();setError('Barkod okunamadı. Kamerayı yeniden açın veya elle giriş yapın.');}
    };tick();
   }catch(e){if(cancelled)return;stop();if(e.name==='NotAllowedError')setError('Kamera izni verilmedi. Barkodu elle girebilirsiniz.');else setError(e.message||'Kamera açılamadı.');}
  };scan();return stop;
 },[facing,continuous]);
 if(embedded)return <div className="till-camera"><video ref={video} autoPlay muted playsInline aria-label="Barkod kamerası"/><div ref={frame} className="till-camera-frame"/>{error&&<p role="alert">{error}</p>}<div className="till-camera-tools">{canTorch&&<button type="button" onClick={toggleTorch} aria-label="Feneri aç veya kapat" aria-pressed={torch}><Flashlight size={20}/></button>}<button type="button" onClick={()=>setFacing(v=>v==='environment'?'user':'environment')} aria-label="Kamerayı değiştir"><SwitchCamera size={20}/></button></div></div>;
 if(fullScreen)return <section className="mobile-camera" role="dialog" aria-modal="true" aria-label="Barkod okut"><video ref={video} autoPlay muted playsInline aria-label="Barkod kamerası"/><header><div className="reader-camera-tools"><button type="button" disabled={!canTorch} onClick={toggleTorch} aria-label="Feneri aç veya kapat" aria-pressed={torch}><Flashlight size={21}/></button><button type="button" onClick={()=>setFacing(v=>v==='environment'?'user':'environment')} aria-label="Kamerayı değiştir"><SwitchCamera size={21}/></button></div>{toolbar||<span>Barkod okut</span>}<button ref={closeButton} type="button" onClick={onClose} aria-label="Kamerayı kapat"><X size={22}/></button></header><div className="mobile-camera-guide"><div ref={frame} className="mobile-camera-frame"/><p role={error?'alert':undefined}>{error||'Barkodu çerçevenin içine getirin'}</p></div><footer>{bottomPanel}{onManual&&<button type="button" className="reader-manual-button" onClick={onManual}>Barkod numarasını yaz</button>}<small>Kamera görüntüsü cihazınızda kalır.</small></footer></section>;
 return <div className="veniux-card p-4 space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold">Barkodu kameraya gösterin</h2><button type="button" className="btn-secondary" onClick={onClose}>Kapat</button></div>{error?<p role="alert" className="text-red-700 text-sm">{error}</p>:<video ref={video} autoPlay muted playsInline className="w-full max-h-72 rounded-lg bg-slate-900" aria-label="Barkod kamerası"/>}<p className="text-xs text-slate-500">Görüntüler sunucuya gönderilmez; barkod bu cihazda okunur.</p></div>;
}
