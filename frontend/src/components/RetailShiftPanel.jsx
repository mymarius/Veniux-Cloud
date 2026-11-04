import PosMoneyInput from './PosMoneyInput';
import {useEffect,useRef,useState} from 'react';
import api from '../api/client';
const money=c=>(Number(c||0)/100).toLocaleString('tr-TR',{style:'currency',currency:'TRY'});
export default function RetailShiftPanel({warehouse,register,context,onRegister,onChanged,onPrint,blocked}) {
  const [opening,setOpening]=useState('0'),[counted,setCounted]=useState(''),[reason,setReason]=useState(''),[direction,setDirection]=useState('in'),[amount,setAmount]=useState(''),[cashReason,setCashReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[review,setReview]=useState(null);
  const lock=useRef(false),operation=useRef(null);
  useEffect(()=>{setReview(null);setError('');setOpening('0');setCounted('');setReason('');operation.current=null;},[warehouse,register]);
  const active=context?.active_shift,rights=context?.permissions||{},r=review||active;
  function changed(){operation.current=null;}
  async function submit(path,body,kind) {
    if(lock.current || blocked)return;
    lock.current=true;setBusy(true);setError('');
    const fingerprint=JSON.stringify({path,body});
    if(operation.current?.fingerprint!==fingerprint)operation.current={fingerprint,key:crypto.randomUUID()};
    try {
      const result=(await api.post(path,body,{headers:{'Idempotency-Key':operation.current.key}})).data;
      operation.current=null;
      await onChanged();
      if(kind==='close'){setReview(result);setCounted('');setReason('');}
      else if(kind==='open'){setReview(null);setCounted('');setReason('');}
      else {setAmount('');setCashReason('');}
    } catch(e) {
      setError(e.response?.data?.error||'İşlem sonucu alınamadı. Aynı bilgilerle yeniden deneyebilirsiniz.');
      if(e.response?.status===409)await onChanged();
    } finally {lock.current=false;setBusy(false);}
  }
  async function selectHistory(id) {
    if(!id){setReview(null);return;}
    try{setReview((await api.get('/scanner/shifts/'+id)).data);setError('');}catch(e){setError(e.response?.data?.error||'Vardiya özeti alınamadı.');}
  }
  const difference=counted===''||!Number.isFinite(Number(counted))||r?.expected_cash_cents===undefined?null:Math.round(Number(counted)*100)-r.expected_cash_cents;
  return <section className="veniux-card p-4 space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Kasa vardiyası</h2><label className="text-sm">Kasa<select aria-label="Kasa seçimi" className="border rounded p-2 ml-2" value={register||context?.register?.id||''} disabled={busy||blocked} onChange={e=>onRegister(e.target.value)}>{context?.registers?.map(k=><option key={k.id} value={k.id}>{k.name}</option>)}</select></label><button className="btn-secondary" disabled={busy} onClick={onChanged}>Vardiyayı yenile</button></div>
  {!context?<p role="status">Vardiya bilgisi hazırlanıyor…</p>:<>
    <p className="text-sm" role="status">{active?`Açık vardiya #${active.shift_id} · ${active.opened_by}`:'Bu kasada açık vardiya yok. Satış ve nakit işlemleri için vardiya açın.'}</p>
    {!active&&rights.shift_open&&<div className="flex flex-wrap items-end gap-3"><label className="text-sm">Başlangıç nakdi (TL)<PosMoneyInput aria-label="Vardiya başlangıç nakdi" type="number" min="0" step="0.01" className="border rounded p-2 block" disabled={busy||blocked} value={opening} onChange={e=>{changed();setOpening(e.target.value);}}/></label><button className="btn-primary" disabled={busy||blocked||(opening===''||!Number.isFinite(Number(opening)))} onClick={()=>submit('/scanner/shifts/open',{warehouse_id:Number(warehouse),register_id:Number(context.register.id),opening_cash:opening},'open')}>Vardiyayı aç</button></div>}
    {context.recent?.length>0&&<label className="text-sm block">Vardiya geçmişi<select aria-label="Vardiya geçmişi" className="border rounded p-2 ml-2" disabled={busy} value={review?.shift_id||''} onChange={e=>selectHistory(e.target.value)}><option value="">Aktif vardiya</option>{context.recent.filter(s=>s.status==='closed').map(s=><option key={s.id} value={s.id}>#{s.id} · {new Date(s.closed_at).toLocaleString('tr-TR')} · Kapalı</option>)}</select></label>}
    {r?.expected_cash_cents!==undefined&&<><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[['Başlangıç nakdi',r.opening_cash_cents],['Nakit tahsilat',r.cash_cents],['Nakit iade / iptal',r.cash_refund_cents],['Nakit giriş',r.cash_in_cents],['Nakit çıkış',r.cash_out_cents],['Beklenen nakit',r.expected_cash_cents],['Verilen para üstü',r.change_cents],['Kart kaydı',r.card_cents],['Net veresiye',(r.credit_cents||0)-(r.credit_refund_cents||0)]].map(([label,value])=><div key={label} className="bg-slate-50 p-3 rounded"><p className="text-xs text-slate-500">{label}</p><b>{money(value)}</b></div>)}</div><p className="text-xs text-slate-500">Beklenen nakit = başlangıç + nakit tahsilat − nakit iade/iptal + nakit giriş − nakit çıkış. Tahsilat para üstü sonrası net nakittir; kart tutarı eklenmez. Nakit hareketleri satış geliri değildir.</p>
    {r.status==='closed'?<div role="status" className="space-y-2"><p>Kapalı vardiya #{r.shift_id} · Sayılan {money(r.counted_cash_cents)} · Fark {money(r.difference_cents)} · {r.closed_by}</p><p>Fark gerekçesi: {r.difference_reason||'Fark yok'}</p><button className="btn-secondary" onClick={()=>onPrint(r.shift_id)}>Kapanış özeti / yazdır</button></div>:!review&&<>
      {rights.cash_movement&&<div className="flex flex-wrap gap-3 items-end"><label className="text-sm">Nakit hareketi<select aria-label="Nakit hareket yönü" className="border rounded p-2 block" disabled={busy||blocked} value={direction} onChange={e=>{changed();setDirection(e.target.value);}}><option value="in">Nakit giriş</option><option value="out">Nakit çıkış</option></select></label><label className="text-sm">Tutar (TL)<PosMoneyInput aria-label="Nakit hareket tutarı" className="border rounded p-2 block" type="number" min="0.01" step="0.01" disabled={busy||blocked} value={amount} onChange={e=>{changed();setAmount(e.target.value);}}/></label><label className="text-sm">Gerekçe<input aria-label="Nakit hareket gerekçesi" maxLength={500} className="border rounded p-2 block" disabled={busy||blocked} value={cashReason} onChange={e=>{changed();setCashReason(e.target.value);}}/></label><button className="btn-secondary" disabled={busy||blocked||!Number.isFinite(Number(amount))||Number(amount)<=0||cashReason.trim().length<5} onClick={()=>submit('/scanner/shifts/'+active.shift_id+'/cash',{direction,amount,reason:cashReason},'cash')}>Nakit hareketini kaydet</button></div>}
      {rights.day_close&&<div className="flex flex-wrap gap-3 items-end"><label className="text-sm">Sayılan nakit (TL)<PosMoneyInput aria-label="Vardiya sayılan nakit" className="border rounded p-2 block" type="number" min="0" step="0.01" disabled={busy||blocked} value={counted} onChange={e=>{changed();setCounted(e.target.value);}}/></label><span>Fark: {difference===null?'—':money(difference)}</span><label className="text-sm">Fark gerekçesi{difference!==null&&difference!==0?' · zorunlu':''}<input aria-label="Vardiya fark gerekçesi" maxLength={500} className="border rounded p-2 block" disabled={busy||blocked} value={reason} onChange={e=>{changed();setReason(e.target.value);}}/></label><button className="btn-primary" disabled={busy||blocked||counted===''||!Number.isFinite(Number(counted))||(difference!==0&&reason.trim().length<5)} onClick={()=>submit('/scanner/shifts/'+active.shift_id+'/close',{counted_cash:counted,reason,expected_cash_cents:active.expected_cash_cents},'close')}>Vardiyayı kapat</button></div>}
    </>}
    {r.movements?.length>0&&<div className="text-sm space-y-1"><b>Nakit hareket geçmişi</b>{r.movements.map(m=><p key={m.id}>{m.direction==='in'?'Giriş':'Çıkış'} · {money(m.amount_cents)} · {m.reason} · {m.user_email}</p>)}</div>}
    {r.reversals?.length>0&&<div className="text-sm space-y-1"><b>Bu vardiyada iade / iptal</b>{r.reversals.map(e=><p key={e.id}>Satış #{e.sale_id} · {money(e.amount_cents)} · {e.reason} · Asıl vardiya {e.source_shift_id??'Eski kayıt'}</p>)}</div>}
    </>}
  </>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}</section>;
}
