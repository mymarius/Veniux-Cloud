(function(){
 const waiting=new Map();const session=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,"0")).join("");let sequence=0;
 window.veniuxMobile={apiBase:'https://veniux.local/api',
  request(method,path,headers,body,timeout){return new Promise((resolve,reject)=>{const id=session+"-"+String(++sequence),timer=setTimeout(()=>{waiting.delete(id);reject(new Error('Bilgisayar yanıt vermedi. Aynı Wi-Fi ağına bağlı olduğunuzu kontrol edin.'));},Math.min(60000,timeout));waiting.set(id,{resolve,reject,timer});const encoded=body&&typeof body==='object'&&body.base64?body.base64:btoa(unescape(encodeURIComponent(typeof body==='string'?body:JSON.stringify(body))));VeniuxAndroid.request(id,method,path,JSON.stringify(headers),encoded);});},
  _finish(id,result){const task=waiting.get(id);if(!task)return;clearTimeout(task.timer);waiting.delete(id);if(result.error)task.reject(new Error(result.error));else task.resolve(result);}
 };
})();

