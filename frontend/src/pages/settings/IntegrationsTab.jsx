import {useEffect,useState} from 'react';
import api from '../../api/client';
import TrendyolConnection from './TrendyolConnection';
export default function IntegrationsTab(){
 const [status,setStatus]=useState(null);const [error,setError]=useState('');
 useEffect(()=>{api.get('/settings/integrations').then(r=>setStatus(r.data)).catch(()=>setError('Entegrasyon durumunu yalnızca yönetici görüntüleyebilir.'));},[]);
 return <section className="space-y-5 max-w-4xl"><h1 className="text-xl font-bold">Entegrasyon bağlantıları</h1><p className="text-sm">Hesap bilgileri sunucuda saklanır. Bağlantı tanımlı olması, hizmetin canlı ortamda doğrulandığı anlamına gelmez.</p>{error&&<p role="alert">{error}</p>}<TrendyolConnection/><div className="grid sm:grid-cols-2 gap-4">{[['smtp','E-posta'],['telegram','Telegram'],['ai','Yapay zekâ'],['payment','Ödeme']].map(([key,title])=><div className="veniux-card p-5" key={key}><h2 className="font-bold">{title}</h2><p>{status?status[key]?'Sunucuda tanımlı · canlı test gerekli':'Bağlantı tanımlanmamış':'Kontrol ediliyor…'}</p></div>)}</div><p>E-fatura ve ödeme hizmetleri için yetkili test hesabı ve sağlayıcı bağlantısı gerekir. Bu bağlantılar doğrulanmadan canlı işlem yapılmaz.</p></section>;
}
