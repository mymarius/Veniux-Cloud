import {useState} from 'react';
import PosMoneyInput from './PosMoneyInput';
// Hızlı gider: kasadan çıkan küçük giderler (ekmek, su, temizlik…) tek satırda kaydedilir.
// Kayıt, mevcut "nakit çıkış" hareketi olarak tutulur; açıklama "Gider · kategori · not" biçimindedir.
export const EXPENSE_CATEGORIES=['Yemek / içecek','Temizlik','Ulaşım / yakıt','Fatura','Bakım / tamir','Diğer'];
export const EXPENSE_PREFIX='Gider · ';
export function expenseTotals(movements=[]){
  const totals={};
  for(const m of movements){
    if(m.direction!=='out'||!String(m.reason||'').startsWith(EXPENSE_PREFIX))continue;
    const category=String(m.reason).slice(EXPENSE_PREFIX.length).split(' · ')[0]||'Diğer';
    totals[category]=(totals[category]||0)+m.amount_cents;
  }
  return totals;
}
export default function QuickExpense({disabled,onSubmit}){
  const [category,setCategory]=useState(EXPENSE_CATEGORIES[0]),[amount,setAmount]=useState(''),[note,setNote]=useState('');
  const valid=Number.isFinite(Number(amount))&&Number(amount)>0;
  async function save(){
    const reason=EXPENSE_PREFIX+category+(note.trim()?' · '+note.trim():'');
    if(await onSubmit({amount,reason})){setAmount('');setNote('');}
  }
  return <fieldset className="border rounded p-3 space-y-2"><legend className="text-sm font-semibold px-1">Hızlı gider (kasadan çıkan)</legend>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Gider kategorisi">{EXPENSE_CATEGORIES.map(c=><button key={c} type="button" aria-pressed={category===c} className={category===c?'btn-primary':'btn-soft'} disabled={disabled} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    <div className="flex flex-wrap gap-3 items-end">
      <label className="text-sm">Tutar (TL)<PosMoneyInput aria-label="Gider tutarı" type="number" min="0.01" step="0.01" className="border rounded p-2 block" disabled={disabled} value={amount} onChange={e=>setAmount(e.target.value)}/></label>
      <label className="text-sm">Not (isteğe bağlı)<input aria-label="Gider notu" maxLength={200} className="border rounded p-2 block" disabled={disabled} value={note} onChange={e=>setNote(e.target.value)}/></label>
      <button type="button" className="btn-secondary" disabled={disabled||!valid} onClick={save}>Gideri kaydet</button>
    </div>
    <p className="text-xs text-slate-500">Tutar kasadaki beklenen nakitten düşer. Kasa dışından ödenen giderler burada tutulmaz.</p>
  </fieldset>;
}
