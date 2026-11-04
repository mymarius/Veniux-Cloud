import {useEffect,useState} from 'react';
import QRCode from 'react-qr-code';
import api from '../../api/client';
export default function TwoFactorPanel(){
 const [state,setState]=useState(null),[password,setPassword]=useState(''),[code,setCode]=useState(''),[setup,setSetup]=useState(null),[codes,setCodes]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[changed,setChanged]=useState(false);
 useEffect(()=>{api.get('/auth/mfa').then(r=>setState(r.data)).catch(()=>setMessage('İki aşamalı doğrulama durumu alınamadı.'));},[]);
 async function act(action){setBusy(true);setMessage('');try{const {data}=await api.post('/auth/mfa/'+action,{password,code});if(action==='setup'){setSetup(data);setCode('');}else{setCodes(data.recoveryCodes||null);setState({enabled:action==='confirm'});setSetup(null);setPassword('');setCode('');setChanged(true);setMessage('Güvenlik ayarı güncellendi. Önceki oturumlar kapatıldı; yeniden giriş yapın.');}}catch(e){setMessage(e.response?.data?.error||'İşlem tamamlanamadı.');}finally{setBusy(false);}}
 function login(){localStorage.removeItem('token');localStorage.removeItem('user');if(location.protocol==='file:')location.hash='/login';else location.assign('/login');}
 return <section className="veniux-card p-6 space-y-4"><div className="flex justify-between gap-4"><div><h2 className="font-semibold">İki aşamalı doğrulama</h2><p className="text-sm text-gray-500 mt-2">Google Authenticator, Microsoft Authenticator veya benzeri bir uygulamada üretilen kodla hesabınızı koruyun.</p></div><span className="text-sm font-medium">{state?state.enabled?'Açık':'Kapalı':'Kontrol ediliyor…'}</span></div>
 {message&&<p role="status" className="text-sm">{message}</p>}
 {codes&&<div className="border rounded-xl p-4 space-y-3"><h3 className="font-semibold">Kurtarma kodlarınızı güvenli bir yerde saklayın</h3><p className="text-sm text-gray-500">Her kod yalnız bir kez kullanılabilir. Bu liste tekrar gösterilmez. QR ve kurulum anahtarını kimseyle paylaşmayın.</p><div className="grid sm:grid-cols-2 gap-2">{codes.map(c=><code key={c} className="text-xs select-all">{c}</code>)}</div></div>}
 {changed?<button className="btn-primary" onClick={login}>Kaydettim, yeniden giriş yap</button>:state&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();act(setup?'confirm':state.enabled?'disable':'setup');}}>
 <label className="block text-sm">Mevcut parola<input className="block w-full border rounded-lg p-3 mt-2" type="password" autoComplete="current-password" required value={password} maxLength={72} onChange={e=>setPassword(e.target.value)}/></label>
 {setup&&<div className="space-y-3"><p className="text-sm">Uygulamanızda hesap ekleyip QR kodunu okutun. Ardından üretilen altı haneli kodu girin. Kurulum 10 dakika geçerlidir.</p><div className="bg-white p-4 inline-block"><QRCode value={setup.uri} size={160}/></div><details><summary className="text-sm cursor-pointer">QR yerine kurulum anahtarını göster</summary><code className="block break-all select-all p-3">{setup.secret}</code></details></div>}
 {(setup||state.enabled)&&<label className="block text-sm">{state.enabled?'Doğrulama veya kurtarma kodu':'Altı haneli doğrulama kodu'}<input className="block w-full border rounded-lg p-3 mt-2" autoComplete="one-time-code" required value={code} maxLength={24} onChange={e=>setCode(e.target.value)} /></label>}
 <button className="btn-primary" disabled={busy}>{busy?'Doğrulanıyor…':setup?'Kodu doğrula ve etkinleştir':state.enabled?'İki aşamalı doğrulamayı kapat':'Kurulumu başlat'}</button>{state.enabled&&<p className="text-xs text-gray-500">Kapatmak için parolanız ve ikinci doğrulama kodunuz gerekir. Kalan kurtarma kodu: {state.recoveryRemaining}</p>}
 </form>}
 </section>;
}
