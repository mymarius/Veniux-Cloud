import {useEffect,useRef,useState} from 'react';
import {Mic} from 'lucide-react';
// Sesle arama: tarayıcının Türkçe konuşma tanımasını kullanır (Chrome/Edge). Ses, tarayıcının tanıma servisine gönderilir.
// Cihaz desteklemiyorsa düğme görünmez; çalışmazsa kasiyere yazarak aramasını söyleyen kısa bir mesaj çıkar.
export default function VoiceSearchButton({onText,disabled}){
  const Recognition=typeof window!=='undefined'&&(window.SpeechRecognition||window.webkitSpeechRecognition);
  const [listening,setListening]=useState(false),[message,setMessage]=useState('');
  const recognition=useRef(null);
  useEffect(()=>()=>{try{recognition.current?.abort();}catch{/* durmuş olabilir */}},[]);
  if(!Recognition)return null;
  function start(){
    setMessage('');
    const rec=new Recognition();rec.lang='tr-TR';rec.interimResults=false;rec.maxAlternatives=1;
    rec.onresult=e=>{const text=String(e.results?.[0]?.[0]?.transcript||'').trim().replace(/[.!?]+$/,'');if(text)onText(text);else setMessage('Ses anlaşılamadı.');};
    rec.onerror=e=>setMessage(e.error==='not-allowed'?'Mikrofon izni verilmedi.':e.error==='no-speech'?'Ses duyulmadı.':'Ses tanıma bu cihazda çalışmadı. Yazarak arayın.');
    rec.onend=()=>setListening(false);
    recognition.current=rec;setListening(true);
    try{rec.start();}catch{setListening(false);setMessage('Ses tanıma başlatılamadı.');}
  }
  return <span className="inline-flex items-center gap-2"><button type="button" className="btn-soft inline-flex items-center gap-1" aria-pressed={listening} disabled={disabled||listening} onClick={start}><Mic size={16}/>{listening?'Dinleniyor…':'Sesle ara'}</button>{message&&<span role="status" className="text-xs">{message}</span>}</span>;
}
