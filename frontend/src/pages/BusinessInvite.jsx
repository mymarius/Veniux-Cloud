import React,{useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {ArrowRight,ShieldAlert} from 'lucide-react';
import api from '../api/client';
import {AuthShell} from '../components/AuthShell';

export default function BusinessInvite(){
 const location=useLocation();
 const [ticket,setTicket]=useState(()=>new URLSearchParams(location.search).get('token')||'');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 const submit=async e=>{
  e.preventDefault();if(busy)return;
  const f=new FormData(e.currentTarget);setBusy(true);setError('');
  try{await api.post('/business/accept-invitation',{token:ticket.trim().replace(/^VNXB1\./,''),name:f.get('name'),password:f.get('password')});setTicket('');setDone(true);}
  catch(failure){setError(failure.response?.data?.error||'Davet kabul edilemedi.');}
  finally{setBusy(false);}
 };
 const shell={slogan:'Ekibe hoş geldiniz.',tagTitle:'Davet bileti',tagValue:'Tek kullanımlık'};
 if(done)return <AuthShell {...shell} title="Hesabınız hazır" description="Davet edilen e-posta adresiniz ve belirlediğiniz şifreyle giriş yapın.">
  <Link className="btn-primary w-full flex items-center justify-center gap-2" to="/login"><span>Girişe git</span><ArrowRight className="h-4 w-4"/></Link>
 </AuthShell>;
 return <AuthShell {...shell} title="Davetinizi kabul edin" description="Size gönderilen kodu girin, adınızı ve şifrenizi belirleyin." footer={<span>Zaten hesabınız var mı? <Link className="font-bold" to="/login">Giriş yapın</Link></span>}>
  {error&&<div role="alert" className="vx-invite-error"><ShieldAlert className="h-4 w-4 shrink-0"/><span>{error}</span></div>}
  <form className="space-y-4" onSubmit={submit}>
   <label className="block vx-invite-code"><span className="block">Davet kodunuz</span><input aria-label="Davet kodunuz" value={ticket} onChange={e=>setTicket(e.target.value)} required maxLength={80} autoComplete="off" spellCheck={false} placeholder="VNXB1.…" className="w-full px-4"/></label>
   <label className="block"><span className="block">Adınız</span><input name="name" required maxLength={100} autoComplete="name" placeholder="Adınız ve soyadınız" className="w-full px-4"/></label>
   <label className="block"><span className="block">Yeni hesap şifreniz</span><input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} placeholder="En az 12 karakter" className="w-full px-4"/></label>
   <p className="vx-invite-note">Bu hesap yalnız davetteki saha/bayi yetkilerine erişir. Davet kodu tek kullanımlıdır.</p>
   <button className="btn-primary w-full flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60" disabled={busy}><span>{busy?'Hesap hazırlanıyor…':'Hesabı oluştur'}</span><ArrowRight className="h-4 w-4"/></button>
  </form>
 </AuthShell>;
}
