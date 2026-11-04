const fs=require('fs'),path=require('path');
function record(req,error){
 if(!/^\/api\/ai\/chat(?:\?|$)/.test(req.originalUrl||''))return;
 try{
  const folder=path.join(require('../config/runtimeConfig').paths().data,'diagnostics');fs.mkdirSync(folder,{recursive:true,mode:0o700});const file=path.join(folder,'ai-errors.jsonl');
  if(fs.existsSync(file)&&fs.statSync(file).size>65536)fs.renameSync(file,file+'.previous');
  const entry={at:new Date().toISOString(),requestId:req.requestId,status:error.status||500,code:error.code||null,name:error.name,stage:req.aiStage||'request',frames:String(error.stack||'').split('\n').slice(1,7).map(s=>s.trim())};
  fs.appendFileSync(file,JSON.stringify(entry)+'\n',{mode:0o600});
 }catch{}
}
module.exports={record};
