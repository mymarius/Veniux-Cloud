import veniuxLogo from '../assets/veniux-logo.webp';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, Send, Maximize2, Volume2, VolumeX } from 'lucide-react';
import apiClient, { broadcastSync } from '../api/client';
import './AssistantLauncher.css';
import AssistantMarkdown from './AssistantMarkdown';
import AssistantFileInput from './AssistantFileInput';
import AssistantOperationResult from './AssistantOperationResult';
import { playWithReveal } from '../lib/synchronizedPlayback';
import { speechChunks } from '../lib/speechChunks';

export default function AssistantLauncher() {
  const location=useLocation();
  const token = localStorage.getItem('token');
  let user = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { /* signed out */ }
  const allowed = token && ['admin', 'manager'].includes(user.role);
  const visitor=!token||location.pathname==='/';
  const canChat=visitor||allowed;
  const [welcome,setWelcome]=useState(null);
  const [voice,setVoice]=useState(()=>localStorage.getItem('veniux-assistant-voice')==='1');
  const [overview,setOverview]=useState(null),[monitorError,setMonitorError]=useState('');
  const [proposal,setProposal]=useState(null),[actionBusy,setActionBusy]=useState(false);
  const [deletionApproval,setDeletionApproval]=useState(null);
  const [notice,setNotice]=useState(null);
  const latestOverview=useRef(null),seenWarnings=useRef(new Set()),lastWarningSpeech=useRef(0);
  const tenant=sessionStorage.getItem('platform-tenant')||user.tenant_id||user.tenantId||'home';
  const monitoring=Boolean(allowed&&!visitor);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const launcher = useRef(null);
  const field = useRef(null);
  const bottom = useRef(null);
  const request = useRef(null);
  const voiceRef=useRef(voice);
  const audioRef=useRef(null),speechRequest=useRef(null),audioUrl=useRef(null),speechGeneration=useRef(0);
  const speechBusy=useRef(false);
  const preparedSpeech=useRef(new Map());
  function loadSpeech(text){
    const cache=preparedSpeech.current;
    if(cache.has(text))return cache.get(text);
    const task=apiClient.post('/ai/speech',{text,profile:'google-soft'},{responseType:'blob',timeout:55000}).then(response=>response.data).catch(error=>{if(cache.get(text)===task)cache.delete(text);throw error;});
    if(cache.size>=4)cache.delete(cache.keys().next().value);
    cache.set(text,task);return task;
  }
  const [speechStatus,setSpeechStatus]=useState('');
  function stopSpeech(){
    speechGeneration.current++;
    speechBusy.current=false;
    speechRequest.current?.abort();audioRef.current?.pause();
    audioRef.current?.dispatchEvent(new Event('ended'));
    if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);
    audioUrl.current=null;audioRef.current=null;setSpeechStatus('');
  }
  async function speak(text,interrupt=true,onStart){
    if(document.hidden)return;
    if(interrupt&&speechBusy.current){stopSpeech();await new Promise(resolve=>setTimeout(resolve,0));}
    if(navigator.locks)return navigator.locks.request('veniux-assistant-audio',{ifAvailable:true},lock=>lock?performSpeech(text,interrupt,onStart):undefined);
    return performSpeech(text,interrupt,onStart);
  }
  async function performSpeech(text,interrupt=true,onStart){
    if(!interrupt&&speechBusy.current)return;
    stopSpeech();setError('');
    speechBusy.current=true;
    const generation=speechGeneration.current;
    const controller=new AbortController();speechRequest.current=controller;
    const chunks=speechChunks(text);
    try{
      for(let index=0;index<chunks.length;index++){
        const chunk=chunks[index];
        if(controller.signal.aborted||generation!==speechGeneration.current)return;
        setSpeechStatus('Yanıt ve ses hazırlanıyor…');
        const blob=await loadSpeech(chunk);
        if(chunks[index+1])loadSpeech(chunks[index+1]).catch(()=>{});
        if(controller.signal.aborted||generation!==speechGeneration.current)return;
        const url=URL.createObjectURL(blob);audioUrl.current=url;
        const audio=new Audio(url);audio.preload='auto';audioRef.current=audio;
        await playWithReveal(audio,()=>{setSpeechStatus('Danışman konuşuyor…');if(chunk===chunks[0])onStart?.();});
        URL.revokeObjectURL(url);audioUrl.current=null;
      }
    }catch(err){if(!controller.signal.aborted){if(generation===speechGeneration.current)setError(err.name==='NotAllowedError'?'Sesi açmak için hoparlör düğmesine dokunun.':'Sesli yanıt şu anda kullanılamıyor. Sohbetimize yazılı olarak devam edebiliriz.');}} 
    finally{if(generation===speechGeneration.current){audioRef.current?.pause();audioRef.current=null;if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);audioUrl.current=null;speechRequest.current=null;speechBusy.current=false;setSpeechStatus('');}}
  }
  async function presentWithVoice(text,present,isCurrent=()=>true){
    let shown=false;
    const reveal=()=>{if(!shown&&isCurrent()){shown=true;present();}};
    if(voiceRef.current)await speak(text,true,reveal);
    // Keep the reply available if playback fails or the user switches sound off.
    reveal();
  }
  useEffect(()=>{
    if(!visitor)return;
    let active=true;
    apiClient.get('/ai/visitor').then(({data})=>{if(active)setWelcome(data);}).catch(()=>{if(active)setWelcome({greeting:'Veniux’a hoş geldiniz. İşletmeniz için uygun stok ve depo paketini birlikte seçelim. Hangi alanda çözüm arıyorsunuz?',plans:[],suggestions:['Paketleri tanıtır mısınız?']});});
    return()=>{active=false;};
  },[visitor]);
  useEffect(()=>{
    const greeting=visitor?welcome?.greeting:null;
    if(greeting)loadSpeech(speechChunks(greeting)[0]).catch(()=>{});
  },[visitor,welcome?.greeting]);
  useEffect(()=>{voiceRef.current=voice;localStorage.setItem('veniux-assistant-voice',voice?'1':'0');},[voice]);
  useEffect(()=>{
    if(!monitoring){setOverview(null);setNotice(null);return;}
    let active=true,inFlight=false;
    const controller=new AbortController();
    const storageKey=`veniux-assistant-seen:${user.id||user.userId}:${tenant}`;
    try{seenWarnings.current=new Set(JSON.parse(sessionStorage.getItem(storageKey)||'[]'));}catch{seenWarnings.current=new Set();}
    async function refresh(){
      if(inFlight||document.hidden)return;
      inFlight=true;
      try{
        const {data}=await apiClient.get('/ai/overview',{signal:controller.signal});
        if(!active)return;
        setOverview(data);latestOverview.current=data;setMonitorError('');
        window.dispatchEvent(new CustomEvent('veniux:assistant-overview',{detail:data}));
        const fresh=data.warnings.filter(w=>['critical','danger','warning'].includes(w.severity)&&!seenWarnings.current.has(w.key));
        if(fresh.length){
          setNotice({message:fresh[0].message,count:fresh.length});
          if(voiceRef.current&&speechBusy.current)return;
          const canAnnounce=voiceRef.current&&Date.now()-lastWarningSpeech.current>60000;
          if(canAnnounce){
            lastWarningSpeech.current=Date.now();
            speak(`İşletmeniz için ${fresh.length} yeni uyarı var. ${fresh.slice(0,2).map(w=>w.message).join(' ')} Ayrıntıları panelden inceleyebilirsiniz.`,false);
          }
          if(!voiceRef.current||canAnnounce){fresh.forEach(w=>seenWarnings.current.add(w.key));sessionStorage.setItem(storageKey,JSON.stringify([...seenWarnings.current].slice(-300)));}
        }
        if(location.pathname.endsWith('/dashboard')&&!sessionStorage.getItem(`veniux-dashboard-welcome:${storageKey}`)){
          sessionStorage.setItem(`veniux-dashboard-welcome:${storageKey}`,'1');
          setMessages(prev=>[...prev,{role:'assistant',content:`Panelinize hoş geldiniz. ${data.summary} Öncelikleri birlikte değerlendirebiliriz. Değişiklik gerektiren işlemlerde önce onayınızı isteyeceğim.`}]);
        }
      }catch(err){if(active&&!controller.signal.aborted)setMonitorError('Takip verileri yenilenemedi. Son bilgilere dayanarak işlem yapmayın.');}
      finally{inFlight=false;}
    }
    const onMutation=e=>{if(!e.detail?.url?.startsWith('/ai/')||e.detail?.url==='/ai/actions/execute')refresh();};
    refresh();const timer=setInterval(refresh,60000);
    window.addEventListener('visibilitychange',refresh);window.addEventListener('veniux:data-mutated',onMutation);
    return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('visibilitychange',refresh);window.removeEventListener('veniux:data-mutated',onMutation);};
  },[monitoring,token,tenant,location.pathname]);
  useEffect(()=>{
    const show=e=>{if(!monitoring)return;setOpen(true);if(e.detail?.message)send(null,e.detail.message);if(e.detail?.action==='analysis')prepareAction('analysis');};
    window.addEventListener('veniux:assistant-open',show);return()=>window.removeEventListener('veniux:assistant-open',show);
  },[monitoring,messages,busy]);
  useEffect(()=>()=>stopSpeech(),[]);
  useEffect(()=>{const hide=()=>{if(document.hidden)stopSpeech();};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
  useEffect(()=>{if(!open)stopSpeech();},[open]);
  useEffect(() => {
    stopSpeech();
    request.current?.abort(); setMessages([]); setError(''); setInput(''); setBusy(false);
    setProposal(null);setOverview(null);latestOverview.current=null;setNotice(null);
    return () => request.current?.abort();
  }, [token,visitor,tenant]);
  useEffect(() => {
    if (!open) return;
    const escape = e => { if (e.key === 'Escape') { setOpen(false); launcher.current?.focus(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }); }, [messages, busy, open]);
  async function send(e,quickMessage) {
    e?.preventDefault();
    const message = (quickMessage||input).trim();
    if (!message || busy || !canChat) return;
    const history = messages.slice(visitor?-10:-12);
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setInput('');setProposal(null);
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    try {
      const { data } = await apiClient.post(visitor?'/ai/visitor/chat':'/ai/chat', { message, history }, { timeout: 55000, signal: controller.signal });
      if (!controller.signal.aborted)await presentWithVoice(data.reply,()=>{setMessages(prev=>[...prev,{role:'assistant',content:data.reply,result:data.result}]);if(data.proposal)setProposal(data.proposal);setBusy(false);},()=>!controller.signal.aborted);
    } catch (err) {
      if (!controller.signal.aborted) { setError(err.response?.data?.error || 'Yanıt alınamadı. Tekrar deneyebilirsiniz.'); setInput(message); }
    } finally { if (!controller.signal.aborted&&request.current===controller) setBusy(false); }
  }
  async function prepareAction(kind,alert_id){
    if(actionBusy)return;setActionBusy(true);setError('');
    try{const {data}=await apiClient.post('/ai/actions/prepare',{kind,alert_id});await presentWithVoice(`${data.title}. ${data.impact} Onaylıyor musunuz?`,()=>setProposal(data));}
    catch(err){setError(err.response?.data?.error||'İşlem hazırlanamadı.');}finally{setActionBusy(false);}
  }
  async function approveAction(){
    if(!proposal?.id||actionBusy||proposal.deletion_required&&deletionApproval!==proposal.id)return;setActionBusy(true);setError('');
    try{const {data}=await apiClient.post('/ai/actions/execute',{id:proposal.id,confirmed:true,deletion_confirmed:proposal.deletion_required&&deletionApproval===proposal.id},{timeout:75000});setProposal(null);broadcastSync('assistant');await presentWithVoice(data.reply,()=>setMessages(prev=>[...prev,{role:'assistant',content:data.reply,result:data.result}]));}
    catch(err){setProposal(null);setError(err.response?.data?.error||'İşlem tamamlanamadı. Tekrar kontrol edin.');}finally{setActionBusy(false);}
  }
  return <div className="veniux-assistant">
    {!open&&notice&&monitoring&&<div className="veniux-assistant-notice" data-pos={location.pathname==='/magaza/kasa' ? 'true' : undefined} role="status"><strong>{notice.count} yeni işletme uyarısı</strong><p>{notice.message}</p><button onClick={()=>setOpen(true)}>İncele</button><button aria-label="Bildirimi kapat" onClick={()=>setNotice(null)}><X size={14}/></button></div>}
    {open && <section id="veniux-quick-chat" role="dialog" aria-label="Veniux AI Asistanı" className="veniux-chat">
      <header><img src={veniuxLogo} alt="" /><div><strong>{visitor?'Veniux Çözüm Danışmanı':'Veniux Asistan'}</strong><small>{visitor?'İhtiyacınıza uygun paketi birlikte seçelim':'İşletmenizin yanında'}</small></div>
        {<button aria-label={voice?'Sesi kapat':'Sesli danışmanı ve uyarıları aç'} aria-pressed={voice} onClick={()=>{const enabled=!voice;setVoice(enabled);voiceRef.current=enabled;if(enabled)speak(messages.filter(m=>m.role==='assistant').at(-1)?.content||(visitor?welcome?.greeting:latestOverview.current?.summary)||'Veniux’a hoş geldiniz. Size nasıl yardımcı olabilirim?');else stopSpeech();}}>{voice?<Volume2 size={17}/>:<VolumeX size={17}/>}</button>}
        {allowed && <Link to="/ai-assistant" onClick={() => setOpen(false)} aria-label="Tam sayfa asistanı aç"><Maximize2 size={17} /></Link>}
        <button aria-label="Sohbeti kapat" onClick={() => { setOpen(false);stopSpeech();launcher.current?.focus(); }}><X size={19} /></button>
      </header>
      <div className="veniux-chat-body" aria-live="polite" aria-relevant="additions text">
        <p className="veniux-chat-welcome">{visitor?welcome?.greeting||'Veniux’a hoş geldiniz. Size uygun çözümü birlikte belirleyelim.':'Merhaba, ben Veniux asistanınızım. Size nasıl yardımcı olabilirim?'}</p>
        {visitor&&<><div className="veniux-chat-suggestions">{welcome?.suggestions?.map(s=><button key={s} disabled={busy} onClick={e=>send(e,s)}>{s}</button>)}</div>{!messages.length&&<div className="veniux-chat-plans">{welcome?.plans?.map(p=><button key={p.id} disabled={busy} onClick={e=>send(e,`${p.name} paketini tanıtıp bana uygun olup olmadığını belirler misiniz?`)}><strong>{p.name.replace(' Lisansı','')}</strong><span>{p.price_try ? p.price_try.toLocaleString('tr-TR')+' ₺ (KDV dahil)' : '$'+p.price_usd.toLocaleString('en-US')} / yıl</span><small>{p.max_warehouses} depo · {p.max_users} kullanıcı</small></button>)}</div>}<Link className="veniux-chat-register" to="/register" onClick={()=>setOpen(false)}>Hesap oluştur</Link></>}
        {!canChat ? <p>İşletme asistanını yönetici veya müdür hesabıyla kullanabilirsiniz.</p> : <>
          {monitoring&&<div className="veniux-monitor"><strong>İşletme takibi {monitorError?'· Bağlantı bekleniyor':'· Açık'}</strong><p>{overview?.summary||'Güncel kayıtlar kontrol ediliyor…'}</p>{overview&&<small>Son kontrol: {new Date(overview.captured_at).toLocaleTimeString('tr-TR')} · Dakikada bir</small>}<p className="veniux-chat-hint">{overview?.scope}</p>{monitorError&&<p role="alert" className="veniux-chat-error">{monitorError}</p>}<div className="veniux-chat-suggestions">{overview?.suggestions.map(s=><button key={s} disabled={busy} onClick={e=>send(e,s)}>{s}</button>)}<button disabled={actionBusy||!!proposal} onClick={()=>prepareAction('analysis')}>Analiz için onay iste</button></div>{overview?.warnings.slice(0,5).map(w=><div className={`veniux-monitor-warning ${w.severity}`} key={w.key}><p>{w.message}</p><Link to={w.path} onClick={()=>setOpen(false)}>İlgili ekranı aç</Link>{w.alert_id&&<button disabled={actionBusy||!!proposal} onClick={()=>prepareAction('alert_read',w.alert_id)}>Okundu işaretle</button>}</div>)}</div>}
          {proposal&&<section className="veniux-approval" aria-label="İşlem onayı"><strong>{proposal.title}</strong><p style={{whiteSpace:'pre-wrap'}}>{proposal.impact}</p>{proposal.requires_file?<AssistantFileInput proposal={proposal} onPrepared={data=>{setDeletionApproval(null);presentWithVoice(`${data.title}. ${data.impact} Onaylıyor musunuz?`,()=>setProposal(data));}} onError={setError}/>:<><p>Onaylıyor musunuz?</p><small>Bu işlem yalnızca onayınızla yapılır. Onay 5 dakika geçerlidir.</small>{proposal.deletion_required&&<label><input type="checkbox" checked={deletionApproval===proposal.id} onChange={e=>setDeletionApproval(e.target.checked?proposal.id:null)}/> Yukarıda belirtilen silme veya bağlantı kaldırma işlemini ayrıca onaylıyorum.</label>}</>}<div><button disabled={!proposal.id||actionBusy||proposal.deletion_required&&deletionApproval!==proposal.id} onClick={approveAction}>{actionBusy?'İşleniyor…':proposal.deletion_required?'Silme işlemini onayla':'Onayla ve uygula'}</button><button disabled={actionBusy} onClick={()=>{setProposal(null);stopSpeech();}}>Vazgeç</button></div></section>}
          {messages.map((m, i) => <div key={i} className={`veniux-chat-message ${m.role}`}><small>{m.role === 'user' ? 'Siz' : 'Veniux'}</small>{m.role === 'assistant' ? <><AssistantMarkdown>{m.content}</AssistantMarkdown><AssistantOperationResult result={m.result}/></> : m.content}</div>)}
          {speechStatus&&<p role="status" className="veniux-chat-hint">{speechStatus}</p>}{busy && <p role="status">Veniux yanıt hazırlıyor…</p>}
          {error && <p role="alert" className="veniux-chat-error">{error}</p>}
        </>}
        <div ref={bottom} />
      </div>
      {canChat && <form onSubmit={send}><input ref={field} aria-label="Asistana mesaj" placeholder={visitor?'İhtiyacınızı anlatın…':'Bir şey sorun…'} maxLength={visitor?2000:4000} value={input} onChange={e => setInput(e.target.value)} /><button type="submit" disabled={busy || !input.trim()} aria-label="Mesajı gönder"><Send size={18} /></button></form>}
      <footer>{visitor?'Yapay zekâ destekli danışman · Paket fiyatlarında para birimi belirtilir':voice?'Kadın sesli uyarılar açık · Değişiklikler onayınıza bağlı':'Sesli uyarılar için hoparlörü açın · Değişiklikler onayınıza bağlı'}</footer>
    </section>}
    <button ref={launcher} className="veniux-assistant-launcher" aria-label={open ? 'Veniux asistanını kapat' : 'Veniux asistanını aç'} aria-expanded={open} aria-controls="veniux-quick-chat" onClick={() => setOpen(v => !v)} title="Veniux AI Asistanı">
      <img src={veniuxLogo} alt="" />
    </button>
  </div>;
}
