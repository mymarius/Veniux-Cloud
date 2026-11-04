import {useEffect,useRef,useState} from 'react';
import {canonicalMoney,moneyNumber} from '../lib/posMoneyInput.mjs';
export default function PosMoneyInput({value,onChange,type,min,max,step,placeholder,...props}){
 const [focused,setFocused]=useState(false),[draft,setDraft]=useState('');const emitted=useRef(value);
 useEffect(()=>{if(value!==emitted.current){setDraft(value===''?'':moneyNumber(value));emitted.current=value;}},[value]);
 const shown=focused?draft:value===''?'':value==='invalid'?draft:moneyNumber(value);
 return <input {...props} type="text" inputMode="decimal" value={shown} placeholder={placeholder===undefined?undefined:moneyNumber(placeholder)} aria-invalid={value==='invalid'||undefined} onFocus={()=>{setDraft(value===''?'':value==='invalid'?draft:moneyNumber(value));setFocused(true);}} onBlur={()=>setFocused(false)} onChange={e=>{setDraft(e.target.value);const canonical=canonicalMoney(e.target.value),next=canonical===null?'invalid':canonical;emitted.current=next;onChange?.({target:{value:next}});}}/>;
}
