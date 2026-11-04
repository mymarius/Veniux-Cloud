import React,{useState} from 'react';
import api from '../api/client';
export default function AssistantFileInput({proposal,onPrepared,onError}){
 const [busy,setBusy]=useState(false);
 async function choose(e){
  const file=e.target.files?.[0];if(!file)return;
  if(file.size>500*1024*1024){onError('Dosya en fazla 500 MB olmalı.');return;}
  setBusy(true);
  try{
   const uploaded=await api.post('/ai/actions/files',file,{headers:{'Content-Type':'application/octet-stream','x-file-name':encodeURIComponent(file.name),'x-upload-type':file.type||'application/octet-stream'},timeout:300000});
   const request=proposal.file_request;
   const {data}=await api.post('/ai/actions/prepare',{kind:request.kind,args:{...request.args,file:{upload_id:uploaded.data.id}}},{timeout:70000});
   onPrepared(data);
  }catch(err){onError(err.response?.data?.error||'Dosya işleme hazırlanamadı.');}
  finally{setBusy(false);}
 }
 return <label className="block my-3 text-sm">{busy?'Dosya yükleniyor ve kontrol ediliyor…':'İşlem dosyasını seçin (en fazla 500 MB)'}<input className="block mt-2" type="file" disabled={busy} onChange={choose}/></label>;
}
