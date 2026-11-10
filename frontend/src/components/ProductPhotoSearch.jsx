import {useRef,useState} from 'react';
import {Camera} from 'lucide-react';
import api from '../api/client';
import {fileToDataUrl} from '../lib/imageFit.mjs';
const price=v=>Number(v||0).toLocaleString('tr-TR',{style:'currency',currency:'TRY'});
// Ürünü fotoğrafla: yapay zekâ yalnız adı/markayı/barkodu okur; aday ürünler ve fiyatlar işletmenin kendi listesinden gelir.
export default function ProductPhotoSearch({disabled,onPick}){
  const input=useRef(null),[busy,setBusy]=useState(false),[result,setResult]=useState(null),[error,setError]=useState('');
  async function choose(event){
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    setBusy(true);setError('');setResult(null);
    try{
      const image_data=await fileToDataUrl(file);
      setResult((await api.post('/scanner/pro/vision/product',{image_data})).data);
    }catch(e){setError(e.response?.data?.error||'Fotoğraf okunamadı. Tekrar deneyin veya yazarak arayın.');}
    finally{setBusy(false);}
  }
  return <div className="space-y-2">
    <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={choose}/>
    <button type="button" className="btn-soft inline-flex items-center gap-1" disabled={disabled||busy} onClick={()=>input.current?.click()}><Camera size={16}/>{busy?'Okunuyor…':'Ürünü fotoğrafla'}</button>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {result&&<div role="status" className="text-sm space-y-2">
      <p>Tanınan: <b>{[result.recognized.brand,result.recognized.name,result.recognized.size].filter(Boolean).join(' ')||result.recognized.barcode}</b>{result.exact?' · barkod eşleşti':''}</p>
      {result.matches.length===0?<p>Listenizde bu ürünle eşleşen kayıt yok. Fiyatı yapay zekâ tahmin etmez; ürünü Hızlı Ekle ile tanımlayın.</p>
        :<div className="pos-search-results">{result.matches.map(p=><button key={p.id} type="button" disabled={disabled} onClick={()=>onPick(p)}>{p.name}<b>{price(p.sale_price)}</b></button>)}</div>}
    </div>}
  </div>;
}
