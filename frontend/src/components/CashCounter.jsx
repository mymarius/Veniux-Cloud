import {useState} from 'react';
// Para sayma yardımcısı: kaç adet banknot/bozuk para sayıldığı girilir, toplam kendiliğinden hesaplanır.
// Değerler kuruş cinsindendir; toplam TL olarak üst bileşene verilir.
const DENOMS=[[20000,'200 ₺'],[10000,'100 ₺'],[5000,'50 ₺'],[2000,'20 ₺'],[1000,'10 ₺'],[500,'5 ₺'],[100,'1 ₺'],[50,'50 kr'],[25,'25 kr'],[10,'10 kr'],[5,'5 kr']];
export default function CashCounter({disabled,onTotal}){
  const [counts,setCounts]=useState({});
  const total=next=>DENOMS.reduce((sum,[value])=>sum+value*(next[value]||0),0);
  function change(value,raw){
    const count=raw===''?0:Math.max(0,Math.min(100000,Math.floor(Number(raw)||0)));
    const next={...counts,[value]:count};
    setCounts(next);onTotal((total(next)/100).toFixed(2));
  }
  function clear(){setCounts({});onTotal('');}
  return <fieldset className="border rounded p-3 space-y-2"><legend className="text-sm font-semibold px-1">Para sayma yardımcısı</legend>
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{DENOMS.map(([value,label])=><label key={value} className="text-xs">{label}<input aria-label={label+' adedi'} type="number" inputMode="numeric" min="0" max="100000" step="1" className="border rounded p-2 block w-full" disabled={disabled} value={counts[value]||''} onChange={e=>change(value,e.target.value)}/></label>)}</div>
    <p className="text-sm">Sayılan toplam: <b>{(total(counts)/100).toLocaleString('tr-TR',{style:'currency',currency:'TRY'})}</b> <button type="button" className="btn-soft ml-2" disabled={disabled} onClick={clear}>Sıfırla</button></p>
  </fieldset>;
}
