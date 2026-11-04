import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,CheckCircle2,FileArchive,FileUp,RefreshCw,UploadCloud,X} from 'lucide-react';
import api from '../api/client';
const size=bytes=>`${(bytes/1048576).toLocaleString('tr-TR',{maximumFractionDigits:2})} MB`;
const isManifest=name=>['latest.yml','android.json'].includes(name);
const allowed=name=>/^[A-Za-z0-9][A-Za-z0-9._ -]{0,160}$/.test(name)&&(/\.(exe|apk|blockmap)$/.test(name)||isManifest(name));
export default function UpdateManagement(){
 const [files,setFiles]=useState([]),[queue,setQueue]=useState([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false),[drag,setDrag]=useState(false);
 const [password,setPassword]=useState(''),[sessionReady,setSessionReady]=useState(false);
 async function openSession(){setError('');try{await api.post('/platform/updates/session',{password});setPassword('');setSessionReady(true);await refresh();}catch(e){setError(e.response?.data?.error||'Yayın oturumu açılamadı.');}}
 const picker=useRef(null),running=useRef(false);
 async function refresh(){setLoading(true);try{setFiles((await api.get('/platform/updates')).data.files||[]);}finally{setLoading(false);}}
 useEffect(()=>{setLoading(false);},[]);
 function select(selected){
  if(running.current)return;
  const incoming=Array.from(selected),invalid=incoming.filter(f=>!allowed(f.name)||!f.size||f.size>500*1048576||(isManifest(f.name)&&f.size>65536));
  setError(invalid.length?'Bazı dosyalar eklenmedi. EXE, APK, blockmap, latest.yml veya android.json seçin; dosya sınırı 500 MB, latest.yml sınırı 64 KB.':'');setMessage('');setConfirmed(false);
  setQueue(old=>{const next=[...old];for(const file of incoming.filter(f=>!invalid.includes(f))){const index=next.findIndex(item=>item.file.name===file.name);const item={file,status:'ready',percent:0};if(index<0)next.push(item);else next[index]=item;}return next.sort((a,b)=>(isManifest(a.file.name))-(isManifest(b.file.name)));});
 }
 function update(name,patch){setQueue(old=>old.map(item=>item.file.name===name?{...item,...patch}:item));}
 async function upload(){
  if(running.current)return;
  const pending=queue.filter(item=>item.status!=='done');if(!pending.length||pending.some(item=>isManifest(item.file.name))&&!confirmed)return;
  running.current=true;setBusy(true);setError('');setMessage('');let published=false;
  try{
   for(const {file} of pending){update(file.name,{status:'uploading',percent:0});
    try{await api.put(`/platform/updates/${encodeURIComponent(file.name)}`,file,{headers:{'Content-Type':'application/octet-stream'},timeout:600000,onUploadProgress:event=>update(file.name,{percent:Math.min(99,Math.round(event.loaded/(event.total||file.size)*100))})});update(file.name,{status:'done',percent:100});published||=isManifest(file.name);}
    catch(err){update(file.name,{status:'error'});throw err;}
   }
   setMessage(published?'Sürüm yayımlandı. İnternete bağlı Windows ve Android uygulamaları açılışta ve 5 dakikada bir güncelleme kontrolü yapar.':'Dosyalar yüklendi. Duyurmak için aynı derlemenin latest.yml veya android.json dosyasını yükleyin.');
  }catch(err){setError(err.response?.data?.error||'Yükleme tamamlanamadı. Başarılı dosyalar korundu; kalan dosyaları tekrar deneyebilirsiniz.');}
  finally{running.current=false;setBusy(false);refresh().catch(()=>setError(previous=>previous||'Sunucu listesi yenilenemedi. Tekrar yenileyin.'));}
 }
 const pending=queue.filter(item=>item.status!=='done'),manifest=pending.some(item=>isManifest(item.file.name)),published=files.find(file=>isManifest(file.name)||file.name==='windows.json');
 return <section id="desktop-updates" className="veniux-card overflow-hidden scroll-mt-28" aria-labelledby="desktop-update-title">
  <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/70 p-6">
   <div className="flex gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><UploadCloud size={22}/></span><div><p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Sürüm yönetimi</p><h2 id="desktop-update-title" className="text-xl font-semibold">Windows ve Android güncellemeleri</h2><p className="text-sm text-slate-500 mt-2">Dosyaları hazırlayın, kontrol edin ve sürüm bilgisini yayımlayın.</p></div></div>
   <button className="btn-soft flex items-center gap-2" disabled={!sessionReady||loading||busy} onClick={()=>refresh().catch(()=>setError('Liste yenilenemedi.'))}><RefreshCw size={15}/>{loading?'Kontrol ediliyor':'Listeyi yenile'}</button>
  </header>
  <div className="p-6 space-y-6">
   {!sessionReady&&<div className="rounded-xl border border-slate-200 p-4"><p className="text-sm mb-3">Merkezi yayın için sahip hesabınızın şifresini doğrulayın. Yayın yetkisi 1 saat geçerlidir.</p><input type="password" autoComplete="current-password" aria-label="Sahip hesabı şifresi" value={password} onChange={e=>setPassword(e.target.value)} className="border rounded p-2 mr-3"/><button className="btn-primary" disabled={!password} onClick={openSession}>Yayın oturumunu aç</button></div>}
   <div className="grid gap-3 sm:grid-cols-3">{[['01 · Kurulum dosyası','Windows için EXE ve blockmap; Android için imzalı APK ekleyin.'],['02 · İndirme bilgisi','Windows için latest.yml; Android için android.json ekleyin.'],['03 · Sürümü yayımla','Sürüm bilgileri en son yüklenir. Dosya boyutu ve özeti merkezi sunucuda doğrulanır.']].map(([title,text])=><div key={title} className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-semibold">{title}</h3><p className="text-xs leading-relaxed text-slate-500 mt-2">{text}</p></div>)}</div>
   <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
    <div className="space-y-4">
     <div onDragOver={e=>{e.preventDefault();if(!busy)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);select(e.dataTransfer.files);}} className={`rounded-xl border-2 border-dashed p-7 text-center ${drag?'border-blue-500 bg-blue-50':'border-slate-300 bg-slate-50/70'}`}>
      <UploadCloud size={30} className="mx-auto text-blue-600 mb-3"/><p className="font-medium text-sm">Sürüm dosyalarını buraya bırakın</p><p className="text-xs text-slate-500 mt-2 mb-4">EXE · APK · blockmap · latest.yml · android.json — birden fazla dosya seçebilirsiniz</p><input ref={picker} className="sr-only" aria-label="Güncelleme dosyalarını seç" type="file" multiple accept=".exe,.apk,.blockmap,.yml,.json" disabled={busy} onChange={e=>{select(e.target.files);e.target.value='';}}/><button className="btn-soft" disabled={busy} onClick={()=>picker.current?.click()}>Dosyaları seç</button>
     </div>
     {queue.length>0&&<ul className="space-y-2" aria-label="Yükleme kuyruğu">{queue.map(item=><li key={item.file.name} className="rounded-lg border border-slate-200 p-3"><div className="flex gap-3 items-center"><FileUp size={17} className="shrink-0 text-slate-400"/><div className="min-w-0 flex-1"><p className="text-sm font-medium break-all">{item.file.name}</p><p className="text-xs text-slate-500 mt-1">{size(item.file.size)} · {item.status==='done'?'Yüklendi':item.status==='error'?'Başarısız — tekrar denenebilir':item.status==='uploading'?`%${item.percent} · Yükleniyor`:'Yüklemeye hazır'}</p></div>{item.status==='done'?<CheckCircle2 size={18} className="text-emerald-600 shrink-0"/>:<button aria-label={`${item.file.name} dosyasını kuyruktan çıkar`} disabled={busy} className="p-2 rounded hover:bg-slate-100" onClick={()=>{setQueue(old=>old.filter(row=>row!==item));setConfirmed(false);}}><X size={16}/></button>}</div>{item.status==='uploading'&&<progress className="w-full h-2 mt-3 accent-blue-600" aria-label={`${item.file.name} yükleme ilerlemesi`} value={item.percent} max={100}/>}</li>)}</ul>}
     {manifest&&<label className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900"><input type="checkbox" className="mt-1" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/><span>Bu derlemeyi kontrol ettim. Sürüm bilgisini yükleyerek ilgili platformdaki kullanıcılara güncelleme duyurulmasını onaylıyorum.</span></label>}
     <button className="btn-primary flex items-center gap-2" disabled={!sessionReady||busy||!pending.length||(manifest&&!confirmed)} onClick={upload}>{busy?'Dosyalar yükleniyor…':manifest?'Dosyaları yükle ve sürümü yayımla':pending.some(item=>item.status==='error')?'Kalan dosyaları tekrar yükle':'Seçilen dosyaları yükle'}<ArrowUpRight size={16}/></button>
     <div aria-live="polite">{message&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}{error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}</div>
    </div>
    <aside className="rounded-xl border border-slate-200 p-5 self-start"><div className="flex justify-between items-center gap-2 mb-4"><h3 className="font-semibold text-sm">Sunucudaki dosyalar</h3><span className="text-xs rounded-full bg-slate-100 px-2 py-1">{files.length} dosya</span></div><p className="text-xs text-slate-500 leading-relaxed mb-4">{published?'Yayımlanmış sürüm bilgisi mevcut. Yeni sürümler ilgili platformdaki uygulamalara duyurulur.':'Henüz yayımlanmış sürüm yok. Kurulum dosyasının ardından sürüm bilgisini yükleyin.'}</p>{files.length?<ul className="divide-y divide-slate-100">{files.map(file=><li key={file.name} className="py-3"><p className="text-sm break-all font-medium">{file.name}</p><p className="text-xs text-slate-500 mt-1">{size(file.bytes)}</p></li>)}</ul>:<div className="rounded-lg bg-slate-50 p-6 text-center"><FileArchive size={24} className="mx-auto text-slate-400 mb-2"/><p className="text-sm text-slate-500">{loading?'Dosyalar kontrol ediliyor…':'İlk sürüm dosyalarını ekleyin.'}</p></div>}<p className="text-xs text-slate-500 leading-relaxed border-t border-slate-200 mt-4 pt-4">Bu alan merkezi yayın sunucusunu yönetir. 2.4.11 ve sonraki uygulamalar yeni sürüm uyarısı gösterir. Windows indirme ve yeniden başlatma; Android telefonun kurulum onayı ile güncellenir. Kapalı uygulamalar açıldığında kontrol eder.</p></aside>
   </div>
  </div>
 </section>;
}
