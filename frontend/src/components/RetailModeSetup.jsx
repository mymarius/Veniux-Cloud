import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import api from '../api/client';
export default function RetailModeSetup(){
 const [prefs,setPrefs]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let live=true;api.get('/scanner/pro/preferences').then(r=>{if(live)setPrefs(r.data);}).catch(()=>{if(live)setMessage('Kasa tercihleri alınamadı. Bağlantıyı kontrol edin.');});return()=>{live=false;};},[]);
 async function save(mode){if(!prefs||busy)return;setBusy(true);try{const {data}=await api.put('/scanner/pro/preferences',{...prefs,mode});setPrefs(data);setMessage('Kasa görünümü kaydedildi. Satış motoru ve mevcut kayıtlar değişmedi.');}catch{setMessage('Tercih kaydedilemedi. Mevcut görünüm korunuyor.');}finally{setBusy(false);}}
 return <section className="veniux-card p-4 space-y-3"><h3 className="font-semibold">Kasa görünümünü seçin</h3><p>Her görünüm aynı ürün, stok, vardiya ve ödeme motorunu kullanır. Bu tercih kullanıcı hesabınız için saklanır.</p><label>Kasa modu<select className="border rounded p-2 ml-3" disabled={!prefs||busy} value={prefs?.mode||'standard'} onChange={e=>save(e.target.value)}><option value="standard">Mevcut standart kasa</option><option value="classic">Klasik market kasası</option><option value="visual">Görselli hızlı satış</option></select></label><p>Terazi için ürünün kg/litre birimini ve cihazın barkod önekini doğrulayın. Model/protokol adaptörü bulunmayan seri veya TCP teraziler otomatik bağlı kabul edilmez. ÖKC ve e-belge için ayrıca üretici/entegratör erişimi gerekir.</p><Link className="btn-secondary" to="/magaza/kasa">Kasa ve donanım rehberini aç</Link>{message&&<p role="status">{message}</p>}</section>;
}
