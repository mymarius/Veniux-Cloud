const crypto=require('crypto');
// Protect the response boundary, including controllers that handle their own errors.
const sensitive = /password|passwd|secret|token|authorization|api[_-]?key|connection[_-]?string|database[_-]?url/i;
// The built UI executes only same-origin JavaScript. Inline CSS is needed by React,
// charts and receipt layouts; it must not imply permission to execute inline scripts.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' https: data: blob:",
  "media-src 'self' blob: data:",
  "connect-src 'self' http://127.0.0.1:17841 http://localhost:17841 ws://127.0.0.1:17841 ws://localhost:17841",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'self' blob:",
  "frame-ancestors 'none'"
].join('; ');
function defaultOrigins(port, mode=process.env.NODE_ENV) {
  const origins=[`http://127.0.0.1:${port}`,`http://localhost:${port}`,'null'];
  return mode==='production' ? origins : [...origins,'http://127.0.0.1:3000','http://localhost:3000','http://127.0.0.1:5173','http://localhost:5173'];
}
// A packaged desktop page is file:// and sends Origin: null, but so does any sandboxed web iframe.
// When the desktop started this server, null is accepted only with the secret it adds to its own requests.
function originAllowed(origin, allowed, supplied, token = process.env.VENIUX_DESKTOP_ORIGIN_TOKEN) {
  if (!origin) return true;
  if (!allowed.has(origin)) return false;
  if (origin !== 'null' || !token) return true;
  const digest = value => crypto.createHash('sha256').update(String(value || '')).digest();
  return crypto.timingSafeEqual(digest(supplied), digest(token));
}
function text(value, env = process.env) {
  let result = String(value);
  for (const [key, secret] of Object.entries(env)) {
    if (sensitive.test(key) && typeof secret === 'string' && secret.length >= 4) result = result.split(secret).join('[redacted]');
  }
  return result.replace(/\b(?:mysql|postgres(?:ql)?):\/\/\S+/gi, '[database connection redacted]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/((?:password|passwd|token|api[_-]?key|secret)\s*[=:]\s*)[^\s&,;]+/gi, '$1[redacted]');
}
function logValue(value) {
  if (value instanceof Error) return {error: 'Operation failed'};
  if (typeof value === 'string') {
    try {const parsed=JSON.parse(value);if(parsed && typeof parsed==='object')return JSON.stringify(logValue(parsed));}catch {}
    return text(value);
  }
  if (Array.isArray(value)) return value.map(logValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,sensitive.test(key) ? '[redacted]' : logValue(item)]));
  return value;
}
function errorBody(value) {
  if(Array.isArray(value))return value.map(errorBody);
  if(!value || typeof value!=='object')return value;
  const result={};
  for(const [key,item] of Object.entries(value)) {
    if(['stack','sql','parameters','connection'].includes(key))continue;
    if(['error','message','error_message'].includes(key) && typeof item==='string') {
      result[key]=/SQLITE_|SQLSTATE|ER_[A-Z_]+|no such (?:table|column)|\bSELECT\b.*\bFROM\b|\b(?:mysql|postgres(?:ql)?):\/\//i.test(item) ? 'İşlem tamamlanamadı. Sistem yöneticisine başvurun.' : text(item);
    }else result[key]=errorBody(item);
  }
  return result;
}
function installLogs() {
  if (process.env.NODE_ENV !== 'production') return;
  for (const level of ['log','info','warn','error','debug']) {
    const original=console[level].bind(console);
    console[level]=(...args)=> {
      if(level==='error' || level==='warn') {
        const label=typeof args[0]==='string' && /^[a-zA-Z0-9 _\[\]:-]{1,80}$/.test(args[0]) ? args[0] : '[Veniux] Operation failed';
        const requestId=args.find(arg=>arg && typeof arg==='object' && /^[0-9a-f-]{36}$/.test(arg.requestId||''))?.requestId;
        return original(label,requestId ? {requestId} : {});
      }
      original(...args.map(logValue));
    };
  }
}
function boundary(req,res,next) {
  const json=res.json.bind(res);
  res.json=value=> {
    if(process.env.NODE_ENV==='production' && res.statusCode>=500) {
      const aiErrors=require('../services/aiPublicErrors');
      if(Object.prototype.hasOwnProperty.call(aiErrors,value?.code))return json({error:aiErrors[value.code],code:value.code,requestId:req.requestId});
      if(value?.code==='AI_NOT_CONFIGURED')return json({error:'Yapay zekâ sunucu bağlantısı yapılandırılmamış. Sistem yöneticisine başvurun.',code:'AI_NOT_CONFIGURED',requestId:req.requestId});
      value={error:res.statusCode===503?'Hizmet geçici olarak kullanılamıyor. Biraz sonra tekrar deneyin.':'İşlem sırasında sunucu hatası oluştu. İşlem durumunu kontrol ederek tekrar deneyin.',requestId:req.requestId};
    }
    else if(process.env.NODE_ENV==='production' && res.statusCode>=400)value=errorBody(value);
    return json(value);
  };
  next();
}
module.exports={originAllowed,text,logValue,installLogs,boundary,defaultOrigins,errorBody,contentSecurityPolicy};
