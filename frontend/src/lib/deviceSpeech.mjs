// Sunucu sesi kullanılamadığında cihazın kendi Türkçe sesiyle okur.
// Android'de yerel köprü, Windows'ta tarayıcı motorunun konuşma özelliği kullanılır.
export class DeviceSpeechUnavailable extends Error {
  constructor(message='Bu cihazda Türkçe ses bulunamadı.'){super(message);this.name='DeviceSpeechUnavailable';}
}

export function cleanSpeechText(value){
  return String(value??'')
    .replace(/\[([^\]]*)\]\([^)]*\)/g,'$1')
    .replace(/[*_#`>|]/g,' ')
    .replace(/\bveniux\b/gi,'Veniuks')
    .replace(/\s+/g,' ')
    .trim();
}

export function pickTurkishVoice(voices){
  const turkish=(voices||[]).filter(voice=>/^tr([-_]|$)/i.test(voice.lang||''));
  return turkish.find(voice=>/female|kad[ıi]n|emel|filiz|seda/i.test(voice.name||''))||turkish[0]||null;
}

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function voicesOf(synth,timeout){
  const deadline=Date.now()+timeout;
  let voices=synth.getVoices();
  while(!voices.length&&Date.now()<deadline){await wait(100);voices=synth.getVoices();}
  return voices;
}

async function speakAndroid(bridge,text,signal,onStart,pollMs){
  let waited=0;
  while(bridge.speechState()==='loading'&&waited<4000){await wait(pollMs);waited+=pollMs;if(signal?.aborted)return;}
  if(bridge.speechState()!=='ready'||!bridge.speak(text))throw new DeviceSpeechUnavailable('Telefonda Türkçe ses paketi bulunamadı. Android ayarlarından yükleyebilirsiniz.');
  onStart?.();
  // Motorun başlaması kısa sürebilir; önce konuşmanın başladığını bekle.
  for(let t=0;t<3000&&!bridge.isSpeaking();t+=pollMs){await wait(pollMs);if(signal?.aborted)return;}
  while(bridge.isSpeaking()){await wait(pollMs);if(signal?.aborted)return;}
}

function speakBrowser(synth,Utterance,voice,text,signal,onStart){
  return new Promise((resolve,reject)=>{
    const utterance=new Utterance(text);
    utterance.voice=voice;utterance.lang=voice.lang||'tr-TR';
    const finish=()=>{signal?.removeEventListener?.('abort',abort);resolve();};
    const abort=()=>{synth.cancel();finish();};
    utterance.onstart=()=>onStart?.();
    utterance.onend=finish;
    utterance.onerror=event=>{
      signal?.removeEventListener?.('abort',abort);
      if(signal?.aborted||event.error==='canceled'||event.error==='interrupted')resolve();
      else reject(new DeviceSpeechUnavailable('Cihaz sesi çalınamadı.'));
    };
    signal?.addEventListener?.('abort',abort,{once:true});
    synth.speak(utterance);
  });
}

export async function speakOnDevice(raw,{signal,onStart,env=globalThis,voiceTimeout=1500,pollMs=150}={}){
  const text=cleanSpeechText(raw);
  if(!text||signal?.aborted)return;
  const bridge=env.VeniuxAndroid;
  if(typeof bridge?.speak==='function')return speakAndroid(bridge,text,signal,onStart,pollMs);
  const synth=env.speechSynthesis,Utterance=env.SpeechSynthesisUtterance;
  if(!synth||!Utterance)throw new DeviceSpeechUnavailable();
  const voice=pickTurkishVoice(await voicesOf(synth,voiceTimeout));
  if(!voice)throw new DeviceSpeechUnavailable('Bu bilgisayarda Türkçe ses yüklü değil. Windows Ayarlar > Dil bölümünden ekleyebilirsiniz.');
  if(signal?.aborted)return;
  return speakBrowser(synth,Utterance,voice,text,signal,onStart);
}

export function stopDeviceSpeech(env=globalThis){
  try{env.VeniuxAndroid?.stopSpeaking?.();}catch{/* köprü kapanmış olabilir */}
  try{env.speechSynthesis?.cancel?.();}catch{/* desteklenmiyor */}
}
