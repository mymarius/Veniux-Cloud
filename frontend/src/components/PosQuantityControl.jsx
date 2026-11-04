import {useEffect,useRef,useState} from 'react';
import {Minus,Plus} from 'lucide-react';
import DialogShell from './ui/DialogShell';
import {keypad} from '../../../shared/retailPro.mjs';
import {validCount,POS_COUNT_MAX} from '../lib/posPresentation.mjs';
export default function PosQuantityControl({name,value,disabled,onChange,onDone}){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState('');const returnFocus=useRef(false);
 useEffect(()=>{if(open||!returnFocus.current)return;const timer=setTimeout(()=>{if(!document.querySelector('[role=dialog][aria-modal=true]'))onDone?.();returnFocus.current=false;},220);return()=>clearTimeout(timer);},[open,onDone]);
 function close(){returnFocus.current=true;setOpen(false);}
 return <><div className="pos-count-control"><button type="button" disabled={disabled||value<=1} aria-label={'Miktarı azalt '+name} onClick={()=>onChange(value-1)}><Minus size={18}/></button><input aria-label={'Okutma adedi '+name} title="Dokunmatik miktar klavyesi" type="number" min="1" max={POS_COUNT_MAX} step="1" value={value} disabled={disabled} onChange={e=>{if(validCount(e.target.value))onChange(Number(e.target.value));}} onClick={()=>{if(!disabled){setDraft(String(value));setOpen(true);}}}/><button type="button" disabled={disabled||value>=POS_COUNT_MAX} aria-label={'Miktarı artır '+name} onClick={()=>onChange(value+1)}><Plus size={18}/></button></div><DialogShell isOpen={open} onClose={close} title="Ürün miktarı" blockEnter footer={<><button className="btn-secondary" onClick={close}>Vazgeç</button><button className="btn-primary" disabled={disabled||!validCount(draft)} onClick={()=>{onChange(Number(draft));close();}}>Miktarı uygula</button></>}><p>{name}</p><label>Okutma adedi<input aria-label="Miktar klavyesi değeri" inputMode="numeric" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={7}/></label><div className="retail-keypad">{['7','8','9','4','5','6','1','2','3','C','0','⌫'].map(k=><button type="button" key={k} onClick={()=>setDraft(v=>keypad(v,k))}>{k}</button>)}</div></DialogShell></>;
}
