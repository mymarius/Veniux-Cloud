import React from 'react';
import api from '../api/client';
const labels={id:'Kayıt kimliği',name:'Ad',fullName:'Ad soyad',title:'Başlık',message:'Bilgi',status:'Durum',success:'Başarılı',file:'Dosya',quantity:'Miktar',total_quantity:'Toplam miktar',device_name:'Cihaz adı',revision:'Kayıt sürümü',data:'Kayıtlar',total:'Toplam',result:'Sonuç',operation:'İşlem'};
function Lines({data,depth=0}){
 if(data===null||data===undefined)return null;
 if(depth>3)return <span>Ayrıntılar ilgili işlem ekranında görülebilir.</span>;
 if(Array.isArray(data))return <ul className="space-y-2">{data.slice(0,30).map((row,i)=><li key={i}><Lines data={row} depth={depth+1}/></li>)}{data.length>30&&<li>İlk 30 kayıt gösteriliyor.</li>}</ul>;
 if(typeof data==='object')return <dl className="space-y-1">{Object.entries(data).map(([key,value])=><div key={key}><dt className="font-medium">{labels[key]||key}</dt><dd><Lines data={value} depth={depth+1}/></dd></div>)}</dl>;
 return <span>{typeof data==='boolean'?(data?'Evet':'Hayır'):String(data)}</span>;
}
export default function AssistantOperationResult({result}){
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 async function download(){setBusy(true);setError('');try{const {data}=await api.get(result.download.url,{responseType:'blob'});const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=result.download.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setError('Rapor indirilemedi. Süresi dolduysa yeniden hazırlayın.');}finally{setBusy(false);}}
 if(result===undefined)return null;
 if(result?.download)return <div className="my-2 text-sm"><button className="rounded border px-3 py-2" disabled={busy} onClick={download}>{busy?'İndiriliyor…':result.download.filename+' dosyasını indir'}</button>{error&&<p role="alert">{error}</p>}</div>;
 return <details className="my-2 rounded border p-3 text-sm"><summary>İşlem sonucu</summary><Lines data={result}/></details>;
}
