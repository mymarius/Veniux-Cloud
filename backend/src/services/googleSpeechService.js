const { cleanText, wav } = require('./nvidiaSpeechService');
const cache = new Map();
const pending = new Map();
const voices={soft:'Achernar',warm:'Sulafat'};
async function synthesize(raw,profile) {
  if(profile!==undefined&&!Object.hasOwn(voices,profile))throw Object.assign(new Error('Geçersiz ses seçimi.'),{status:400});
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 2000) {
    throw Object.assign(new Error('Ses için 1–2000 karakter arasında metin gerekli.'), { status: 400 });
  }
  const text = cleanText(raw).replace(/\bveniux\b/gi,'Veniuks').replace(/\[[^\]]*\]/g,'');
  if (!text) throw Object.assign(new Error('Okunacak metin bulunamadı.'), { status: 400 });
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error('Google ses hizmeti yapılandırılmamış.'), { status: 503 });
  const model = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
  const voice = profile?voices[profile]:(process.env.GEMINI_TTS_VOICE || 'Achernar');
  const key = JSON.stringify([model, voice, text]);
  if (cache.has(key)) return cache.get(key);
  if (pending.has(key)) return pending.get(key);
  if (pending.size >= 3) throw Object.assign(new Error('Ses danışmanı meşgul. Biraz sonra tekrar deneyin.'), { status: 429 });
  const task = (async () => {
    const style = 'Türkçe konuşan profesyonel bir kadın danışman. Ana dili İstanbul Türkçesi olan, yumuşak ve sıcak sesli bir danışman gibi konuş. Sakin, doğal, nazik ve kendinden emin konuş. Fısıldama, şarkı söyleme, yapay vurgular veya abartılı duygular kullanma. Orta hızda, net telaffuzla, cümle aralarında doğal duraklamalarla oku. Reklam spikeri gibi abartma. Yalnızca verilen metni seslendir.';
    const modern = model.startsWith('gemini-3.8-');
    let response;
    try {
      const deadline=Date.now()+45000;
      for(let attempt=0;attempt<3;attempt++){
      try {
      response = await fetch(modern?'https://generativelanguage.googleapis.com/v1beta/interactions':`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify(modern ? {model,input:[{type:'user_input',content:[{type:'text',text,annotations:[{type:'speech_metadata',style}]}]}],response_format:{type:'audio'},generation_config:{speech_config:[{voice}]}} : {
          contents: [{ role: 'user', parts: [modern ? { text, speech_metadata: { style } } : { text: `${style}\n\nMetin:\n${text}` }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: modern ? { voice } : { prebuiltVoiceConfig: { voiceName: voice } } } }
        }),
        signal: AbortSignal.timeout(Math.max(1,deadline-Date.now()))
      });
      if((response.status===429||response.status>=500)&&attempt<2){await response.body?.cancel();const wait=Math.min(2000,Math.max(500,Number(response.headers?.get('retry-after'))*1000||500*(attempt+1)));if(Date.now()+wait>=deadline)break;await new Promise(resolve=>setTimeout(resolve,wait));continue;}
      break;
      } catch(error){if(attempt===2||Date.now()>=deadline)throw error;await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));}
      }
    } catch {
      throw Object.assign(new Error('Google ses hizmetine bağlanılamadı. Lütfen tekrar deneyin.'), { status: 503 });
    }
    if (!response.ok) {
      const message = response.status === 400 || response.status === 401 || response.status === 403
        ? 'Google ses erişimi reddedildi. API anahtarını ve model erişimini kontrol edin.'
        : response.status === 429 ? 'Google ses kotası doldu. Biraz sonra tekrar deneyin.' : 'Google ses hizmeti yanıt veremedi.';
      throw Object.assign(new Error(message), { status: 503 });
    }
    const result = await response.json();
    const part = modern ? result.steps?.filter(step=>step.type==='model_output').flatMap(step=>step.content||[]).filter(item=>item.type==='audio'&&item.data).at(-1) : result.candidates?.[0]?.content?.parts?.find(item => item.inlineData?.data);
    if (!part) throw Object.assign(new Error('Google ses hizmeti boş yanıt verdi.'), { status: 502 });
    const audio = wav(Buffer.from(modern?part.data:part.inlineData.data, 'base64'));
    if (cache.size >= 12) cache.delete(cache.keys().next().value);
    cache.set(key, audio);
    return audio;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
module.exports = { synthesize };
