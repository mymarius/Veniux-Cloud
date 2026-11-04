const grpc=require('@grpc/grpc-js');
const loader=require('@grpc/proto-loader');
const path=require('path');
const definition=loader.loadSync(path.join(__dirname,'speech/riva.proto'),{keepCase:true});
const Client=grpc.loadPackageDefinition(definition).nvidia.riva.tts.RivaSpeechSynthesis;
const client=new Client('grpc.nvcf.nvidia.com:443',grpc.credentials.createSsl(),{'grpc.max_receive_message_length':8*1024*1024});
const cache=new Map(),pending=new Map();
function cleanText(text){return String(text).replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/[*#`_]/g,'').replace(/\bUSD\b/g,'Amerikan doları').replace(/\$/g,' dolar ').trim();}
function wav(pcm){
 if(pcm.subarray(0,4).toString()==='RIFF')return pcm;
 const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVE',8);header.write('fmt ',12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);return Buffer.concat([header,pcm]);
}
async function synthesize(raw){
 if(typeof raw!=='string'||!raw.trim()||raw.length>2000)throw Object.assign(new Error('Ses için 1–2000 karakter arasında metin gerekli.'),{status:400});
 const text=cleanText(raw);
 if(!text)throw Object.assign(new Error('Okunacak metin bulunamadı.'),{status:400});
 if(!process.env.NVIDIA_API_KEY)throw Object.assign(new Error('Ses sağlayıcısı yapılandırılmamış.'),{status:503});
 if(cache.has(text))return cache.get(text);
 if(pending.has(text))return pending.get(text);
 if(pending.size>=3)throw Object.assign(new Error('Ses danışmanı meşgul. Biraz sonra tekrar deneyin.'),{status:429});
 const metadata=new grpc.Metadata();metadata.set('authorization','Bearer '+process.env.NVIDIA_API_KEY);metadata.set('function-id','ddacc747-1269-4fab-bfd9-8f593dead106');
 const task=new Promise((resolve,reject)=>client.synthesize({text,language_code:'tr-TR',encoding:1,sample_rate_hz:24000,voice_name:'Chatterbox-Multilingual.tr-TR.Male',custom_configuration:{exaggeration_factor:'0.35'}},metadata,{deadline:Date.now()+45000},(error,response)=>{
  if(error)return reject(Object.assign(new Error('Doğal ses hizmetinden yanıt alınamadı. Lütfen tekrar deneyin.'),{status:503}));
  if(!response?.audio?.length)return reject(Object.assign(new Error('Ses hizmeti boş yanıt verdi.'),{status:502}));
  const audio=wav(response.audio);
  if(cache.size>=12)cache.delete(cache.keys().next().value);
  cache.set(text,audio);resolve(audio);
 }));
 pending.set(text,task);try{return await task;}finally{pending.delete(text);}
}
module.exports={synthesize,cleanText,wav};
