import {useEffect,useState} from 'react';
import api from '../api/client';

// Seçili cari hesaba fiyat türü ve yüzde iskonto bağlar; kasada müşteri seçilince sunucu uygular.
export default function CustomerPriceRule({accountId,onError}){
  const [tier,setTier]=useState('1'),[discount,setDiscount]=useState('0'),[saved,setSaved]=useState(false);
  useEffect(()=>{setSaved(false);if(!accountId)return;let live=true;api.get('/scanner/pro/accounts/'+accountId+'/price-rule').then(r=>{if(!live)return;setTier(String(r.data.price_tier));setDiscount(String(r.data.discount_percent).replace('.',','));}).catch(e=>onError?.(e.response?.data?.error||'Fiyat kuralı alınamadı.'));return()=>{live=false;};},[accountId]);
  if(!accountId)return null;
  async function save(){setSaved(false);try{await api.put('/scanner/pro/accounts/'+accountId+'/price-rule',{price_tier:Number(tier),discount_percent:Number(String(discount).replace(',','.'))||0});setSaved(true);}catch(e){onError?.(e.response?.data?.error||'Fiyat kuralı kaydedilemedi.');}}
  return <fieldset className="pos-price-rule"><legend>Müşteri fiyat kuralı</legend>
    <label>Fiyat türü<select value={tier} onChange={e=>{setTier(e.target.value);setSaved(false);}}><option value="1">Perakende</option><option value="2">Toptan</option><option value="3">Özel</option></select></label>
    <label>İskonto (%)<input value={discount} inputMode="decimal" onChange={e=>{setDiscount(e.target.value);setSaved(false);}}/></label>
    <button type="button" className="btn-secondary" onClick={save}>Kuralı kaydet</button>{saved&&<span role="status"> Kaydedildi</span>}
  </fieldset>;
}
