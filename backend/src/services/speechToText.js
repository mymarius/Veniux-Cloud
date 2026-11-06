// Mikrofon kaydını Türkçe metne çevirir. Ses ve metin saklanmaz, günlüğe yazılmaz.
const TYPES=new Set(['audio/webm','audio/ogg','audio/mp4','audio/wav']);
async function transcribe(buffer,type){
 const mime=String(type||'').split(';')[0].trim();
 if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>5*1048576||!TYPES.has(mime))throw Object.assign(Error('Geçersiz ses kaydı.'),{status:400});
 if(!process.env.GEMINI_API_KEY)throw Object.assign(Error('Ses tanıma hizmeti yapılandırılmamış.'),{status:503});
 let response;
 try{response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(process.env.GEMINI_STT_MODEL||'gemini-2.5-flash')+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},signal:AbortSignal.timeout(30000),
  body:JSON.stringify({contents:[{role:'user',parts:[{text:'Bu Türkçe ses kaydını kelimesi kelimesine yaz. Yalnız söylenenleri yaz, açıklama ekleme. Anlaşılır konuşma yoksa boş yanıt ver.'},{inlineData:{mimeType:mime,data:buffer.toString('base64')}}]}],generationConfig:{temperature:0}})});}
 catch{throw Object.assign(Error('Ses tanıma hizmetine bağlanılamadı.'),{status:503});}
 if(!response.ok)throw Object.assign(Error(response.status===429?'Ses tanıma kotası doldu. Biraz sonra deneyin.':'Ses tanıma hizmeti yanıt vermedi.'),{status:503});
 const result=await response.json();
 return (result.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join(' ').trim().slice(0,2000);
}
module.exports={transcribe};
