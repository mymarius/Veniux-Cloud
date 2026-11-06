const error=(message,status=502,code='AI_PROVIDER_UNAVAILABLE')=>Object.assign(new Error(message),{status,code});
function responseText(text,json){
 if(typeof text!=='string'||!text.trim())throw error('Asistan geçerli yanıt veremedi.',502,'AI_INVALID_RESPONSE');
 if(!json)return text;
 const clean=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 try{const value=JSON.parse(clean);if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return JSON.stringify(value);}catch{throw error('Asistan yanıtı tamamlanamadı. Lütfen tekrar deneyin.',502,'AI_INVALID_RESPONSE');}
}
// NVIDIA kapalıysa veya modeli reddederse aynı istek Gemini ile tamamlanır.
async function geminiComplete(messages,{json=false,visitor=false}={}){
 const system=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n\n');
 const contents=messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:String(m.content)}]}));
 let response;
 try{response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(process.env.GEMINI_CHAT_MODEL||'gemini-2.5-flash')+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},signal:AbortSignal.timeout(40000),
  body:JSON.stringify({...(system?{systemInstruction:{parts:[{text:system}]}}:{}),contents,generationConfig:{temperature:0.2,maxOutputTokens:visitor?600:2048,thinkingConfig:{thinkingBudget:0},...(json?{responseMimeType:'application/json'}:{})}})});}
 catch{throw error('AI sağlayıcısına ulaşılamadı veya yanıt süresi aşıldı.',503);}
 if(!response.ok){await response.body?.cancel();throw error('Yapay zekâ sağlayıcısı isteği tamamlayamadı.',response.status===429?429:502,response.status===429?'AI_RATE_LIMITED':[401,403].includes(response.status)?'AI_PROVIDER_AUTH':response.status>=500?'AI_PROVIDER_UNAVAILABLE':'AI_PROVIDER_REJECTED');}
 let data;try{data=await response.json();}catch{throw error('Asistan yanıtı tamamlanamadı.',502,'AI_INVALID_RESPONSE');}
 const candidate=data.candidates?.[0];
 if(candidate?.finishReason==='MAX_TOKENS')throw error('Asistan yanıtı tamamlanamadı.',502,'AI_INVALID_RESPONSE');
 return responseText((candidate?.content?.parts||[]).map(p=>p.text||'').join(''),json);
}
async function complete(messages,options={}){
 const canFallBack=Boolean(process.env.GEMINI_API_KEY);
 if(!process.env.NVIDIA_API_KEY&&canFallBack)return geminiComplete(messages,options);
 try{return await nvidiaComplete(messages,options);}
 catch(failure){if(canFallBack&&['AI_PROVIDER_REJECTED','AI_PROVIDER_AUTH','AI_PROVIDER_UNAVAILABLE'].includes(failure.code))return geminiComplete(messages,options);throw failure;}
}
async function nvidiaComplete(messages,{json=false,visitor=false}={}) {
 const key=process.env.NVIDIA_API_KEY;
 if(!key)throw Object.assign(error('Yapay zekâ sunucu ayarı eksik. Sistem yöneticisi sağlayıcı bağlantısını yapılandırmalıdır.',503),{code:'AI_NOT_CONFIGURED'});
 const deadline=Date.now()+45000;
 for(let attempt=0;attempt<2;attempt++){
 try{
 let response;
 try{response=await fetch('https://integrate.api.nvidia.com/v1/chat/completions',{
  method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
  signal:AbortSignal.timeout(Math.max(1,Math.min(20000,deadline-Date.now()))),
  body:JSON.stringify({model:process.env.NVIDIA_MODEL||'nvidia/nemotron-3-super-120b-a12b',messages,temperature:0.2,max_tokens:visitor?600:2048,stream:false,...(visitor||json?{chat_template_kwargs:{enable_thinking:false}}:{}),...(json?{response_format:{type:'json_object'}}:{})})
 });}catch{throw error('AI sağlayıcısına ulaşılamadı veya yanıt süresi aşıldı.',503);}
 if(!response.ok){await response.body?.cancel();throw error('Yapay zekâ sağlayıcısı isteği tamamlayamadı.',response.status===429?429:502,response.status===429?'AI_RATE_LIMITED':[401,403].includes(response.status)?'AI_PROVIDER_AUTH':response.status>=500?'AI_PROVIDER_UNAVAILABLE':'AI_PROVIDER_REJECTED');}
 let data;try{data=await response.json();}catch{throw error('Asistan yanıtı tamamlanamadı.',502,'AI_INVALID_RESPONSE');}
 if(data.choices?.[0]?.finish_reason==='length')throw error('Asistan yanıtı tamamlanamadı.',502,'AI_INVALID_RESPONSE');
 return responseText(data.choices?.[0]?.message?.content,json);
 }catch(failure){if(attempt===0&&Date.now()<deadline&&['AI_PROVIDER_UNAVAILABLE','AI_INVALID_RESPONSE'].includes(failure.code))continue;throw failure;}
 }
}
module.exports={complete};


