import {useEffect,useRef,useState} from 'react';
import api from '../api/client';
import DialogShell from './ui/DialogShell';
import {acceptTerminalIdentity} from '../lib/terminalIdentity.mjs';
export default function TerminalIdentity({mode,user,blockedSwitch,onClose,onVerified}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[mfa,setMfa]=useState(false),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const running=useRef(false);
 useEffect(()=>{setEmail(mode==='unlock'?user.email||'':'');setPassword('');setCode('');setMfa(false);setError('');},[mode,user.id,user.email]);
 async function verify(e){e.preventDefault();if(running.current||!mode||(mode==='switch'&&blockedSwitch))return;running.current=true;setBusy(true);setError('');try{
  const {data}=await api.post('/auth/terminal-verify',{mode,email,password,...(mfa?{mfa_code:code}:{})},{terminalReauth:true});
  if(data.mfa_required){setMfa(true);return;}
  acceptTerminalIdentity(mode,user,data.user);
  if(mode==='switch'){
   localStorage.setItem('token',data.token);localStorage.setItem('user',JSON.stringify(data.user));
   sessionStorage.removeItem('platform-tenant');sessionStorage.removeItem('platform-tenant-name');
   window.location.reload();return;
  }
  // Manager tokens are deliberately not stored or substituted for the cashier.
  setPassword('');setCode('');onVerified();
 }catch(e){setError(e.response?.data?.error||e.message||'Hesap doğrulanamadı.');}finally{running.current=false;setBusy(false);}}
 return <DialogShell isOpen={!!mode} onClose={()=>{if(mode!=='unlock'&&!busy)onClose();}} title={mode==='unlock'?'Kasa kilitli':mode==='approve'?'Yönetici onayı':'Kasiyer değiştir'} size="sm" blockEnter={false}>
 <form className="pos-identity" onSubmit={verify}>
 {mode==='unlock'&&<p>Satış ekranını açmak için kendi hesabınızı doğrulayın.</p>}
 {mode==='approve'&&<p>Bu işlem için aynı işletmeden yönetici doğrulaması gerekir. Kasiyerin mevcut satış yetkileri değişmez.</p>}
 {mode==='switch'&&<p>{blockedSwitch?'Önce vardiyayı kapatın, sepeti bekletin ve belirsiz satış sonucunu doğrulayın.':'Yeni kasiyer kendi hesabıyla giriş yapar. Bekletilen sepetler önceki kullanıcıya aittir.'}</p>}
 <label>E-posta<input aria-label="Doğrulama e-postası" type="email" autoComplete="username" value={email} readOnly={mode==='unlock'} disabled={busy||(mode==='switch'&&blockedSwitch)} onChange={e=>setEmail(e.target.value)} required/></label>
 <label>Şifre<input aria-label="Doğrulama şifresi" type="password" autoComplete="current-password" value={password} disabled={busy||(mode==='switch'&&blockedSwitch)} onChange={e=>setPassword(e.target.value)} required/></label>
 {mfa&&<label>Doğrulama kodu<input aria-label="Doğrulama kodu" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} required/></label>}
 {error&&<p role="alert">{error}</p>}
 <button className="btn-primary" disabled={busy||(mode==='switch'&&blockedSwitch)}>{busy?'Doğrulanıyor…':mode==='unlock'?'Kilidi aç':mode==='approve'?'İşlemi onayla':'Kasiyeri değiştir'}</button>
 {mode!=='unlock'&&<button className="btn-secondary" type="button" disabled={busy} onClick={onClose}>Vazgeç</button>}
 </form></DialogShell>;
}
