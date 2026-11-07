import {useEffect,useState} from 'react';
import api from '../../api/client';
import TrendyolConnection from './TrendyolConnection';
import EDocumentConnection from './EDocumentConnection';
import AccountingExport from './AccountingExport';
export default function IntegrationsTab(){
 const [status,setStatus]=useState(null);const [error,setError]=useState('');
 useEffect(()=>{api.get('/settings/integrations').then(r=>setStatus(r.data)).catch(()=>setError('Entegrasyon durumunu yalnızca yönetici görüntüleyebilir.'));},[]);
 return <section className="space-y-5 max-w-4xl"><div><h1 className="text-xl font-bold">Entegrasyonlar</h1><p className="text-sm mt-2">Hesap bilgileri sunucuda saklanır. Tanımlı görünen bir bağlantıyı ilk kullanımda mutlaka deneyin.</p></div>{error&&<p role="alert">{error}</p>}<TrendyolConnection/><EDocumentConnection/><AccountingExport/><div className="grid sm:grid-cols-2 gap-4">{[['smtp','E-posta'],['telegram','Telegram'],['ai','Yapay zekâ'],['payment','Ödeme']].map(([key,title])=><div className="veniux-card vx-set-tile p-5" data-on={status?.[key]?'1':'0'} key={key}><h2 className="font-bold">{title}</h2><p>{status?status[key]?'Tanımlı, henüz denenmedi':'Tanımlı değil':'Kontrol ediliyor…'}</p></div>)}</div><p className="text-sm">E-fatura ve ödeme için sağlayıcınızın verdiği test hesabı gerekir. Bağlantı doğrulanmadan gerçek işlem yapılmaz.</p></section>;
}
