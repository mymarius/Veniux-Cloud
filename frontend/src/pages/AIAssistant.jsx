import AssistantMarkdown from '../components/AssistantMarkdown';
import AssistantFileInput from '../components/AssistantFileInput';
import AssistantOperationResult from '../components/AssistantOperationResult';
import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import {
  Search,
  Send,
  Package,
  User,
  TrendingUp,
  AlertTriangle,
  Clock,
  DollarSign,
  Truck,
  RefreshCw,
  CheckCircle2,
  Terminal
} from 'lucide-react';
import { useToast } from '../components/Toast';


export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'İşletme asistanınızım. Stok, satın alma, tedarikçi, depo, uyarı ve sayım kayıtlarını birlikte değerlendirebilir; CRM ve personel kayıt sayılarını özetleyebilirim. Telefonla ürün ekleme gibi işlemlerde sizi yönlendiririm. Kayıtları kendiliğimden değiştirmem.'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState('NVIDIA AI · Henüz yanıt alınmadı');
  const [analyzing, setAnalyzing] = useState(false);
  const [forecasts, setForecasts] = useState([]);
  const [drafting, setDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState('');
  const [loadingForecast, setLoadingForecast] = useState(true);
  const [proposal,setProposal]=useState(null),[applying,setApplying]=useState(false);

  const messagesEndRef = useRef(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchForecasts();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchForecasts = async () => {
    try {
      setLoadingForecast(true);
      const res = await apiClient.get('/ai/forecast');
      setForecasts(res.data.filter(item => item.urgency !== 'safe' && item.suggested_reorder_qty > 0));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingForecast(false);
    }
  };

  const createDrafts = async () => {
    setDrafting(true);
    setDraftResult('');
    try {
      const { data } = await apiClient.post('/purchase-orders/from-forecast', { product_ids: forecasts.map(f => f.product_id) }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
      setDraftResult(`${data.orders.length} satın alma taslağı oluşturuldu. Satın Alma ekranından onaylayın.${data.skipped.length ? ` ${data.skipped.length} ürün atlandı: ${data.skipped.map(s => `${s.name} (${s.reason})`).join(', ')}.` : ''}`);
    } catch (err) {
      setDraftResult(err.response?.data?.error || 'Taslak oluşturulamadı.');
    } finally {
      setDrafting(false);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || loading) return;

    const userMsg = { id: Date.now(), sender: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);
    setProposal(null);

    try {
      const history = messages.filter(m => m.id !== 1 && !m.failed).slice(-12).map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text.slice(0, 4000) }));
      const res = await apiClient.post('/ai/chat', { message: text, history }, { timeout: 55000 });
      if(res.data.proposal)setProposal(res.data.proposal);
      setAiStatus('NVIDIA AI · Son yanıt doğrulandı');
      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: res.data.reply || 'Sonuç alınamadı.',result:res.data.result
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setAiStatus('AI bağlantısı doğrulanamadı');
      showToast(err.response?.data?.error || 'AI bağlantısı kurulamadı.', 'error');
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          failed: true,
          text: 'Sistem şu anda bu sorguyu işleyemiyor. Lütfen tekrar deneyin.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestedQuestions = [
    'Hangi ürünler kritik veya azalan seviyede?',
    'Stok alış değerimiz ve bekleyen satın alma siparişlerimiz ne durumda?',
    'Bugün ilgilenmem gereken uyarıları ve sayımları özetle',
    'Telefonla veya terminalle yeni ürün nasıl eklerim?'
  ];

  return (
    <div className="space-y-5 pb-10">
      {/* Corporate Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
              Analiz Modülü
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">
            Stok Analizi & Talep Tahminleme
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            İşletme kayıtlarınızla çalışan operasyon ve kullanım asistanınız
          </p>
        </div>

        <div className="flex gap-2">
          <button
            disabled={analyzing}
            onClick={() => window.dispatchEvent(new CustomEvent('veniux:assistant-open',{detail:{action:'analysis'}}))}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {analyzing ? 'Analiz ediliyor…' : 'Sistemi Tara'}
          </button>
          
          <button
            onClick={fetchForecasts}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Verileri Yenile
          </button>
        </div>
      </div>

      {proposal&&<section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><strong>{proposal.title}</strong><p className="my-3 whitespace-pre-wrap text-sm">{proposal.impact}</p>{proposal.requires_file?<AssistantFileInput proposal={proposal} onPrepared={setProposal} onError={message=>showToast(message,'error')}/>:<p>Onaylıyor musunuz?</p>}<div className="flex gap-3"><button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white" disabled={applying||!proposal.id} onClick={async()=>{if(proposal.deletion_required&&!window.confirm(`${proposal.impact}\nBelirtilen silme veya bağlantı kaldırma işlemini ayrıca onaylıyor musunuz?`))return;setApplying(true);try{const {data}=await apiClient.post('/ai/actions/execute',{id:proposal.id,confirmed:true,deletion_confirmed:proposal.deletion_required===true},{timeout:75000});setMessages(prev=>[...prev,{id:Date.now(),sender:'bot',text:data.reply,result:data.result}]);setProposal(null);fetchForecasts();}catch(e){setProposal(null);showToast(e.response?.data?.error||'İşlem tamamlanamadı.','error');}finally{setApplying(false);}}}>{applying?'Uygulanıyor…':'Onayla ve uygula'}</button><button disabled={applying} onClick={()=>setProposal(null)}>Vazgeç</button></div></section>}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chat Section (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-[580px] overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800">Sorgu Arayüzü</h3>
                <p className="text-[11px] text-slate-600 font-semibold">{aiStatus}</p>
              </div>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 text-[13px] bg-slate-50/30">
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-md border border-slate-200 bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 font-bold text-[10px]">
                      SYS
                    </div>
                  )}

                  <div
                    className={`p-3.5 rounded-md max-w-lg leading-relaxed whitespace-pre-wrap shadow-sm border ${
                      isUser
                        ? 'bg-slate-800 text-white border-slate-700 font-medium'
                        : 'bg-white text-slate-800 border-slate-200'
                    }`}
                  >
                    {isUser ? m.text : <><AssistantMarkdown>{m.text}</AssistantMarkdown><AssistantOperationResult result={m.result}/></>}
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 rounded-md border border-slate-200 bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-3 items-center text-[13px] text-slate-500">
                <div className="w-7 h-7 rounded-md border border-slate-200 bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                </div>
                <span className="font-medium">Sistem sorgulanıyor...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Questions */}
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap gap-2 text-[11px]">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 whitespace-nowrap transition shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-4 border-t border-slate-200 bg-white flex items-center gap-3"
          >
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Stok raporu almak için sorgu girin... (Örn: Hangi depoda kahve azaldı?)"
                className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-slate-50 placeholder:text-slate-400"
              />
            </div>
            <button
              type="submit"
              disabled={!inputMessage.trim() || loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> Gönder
            </button>
          </form>
        </div>

        {/* Forecast & Order Recommendations (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-[580px] overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="font-bold text-sm text-slate-800">Sipariş önerileri</h3>
              <p className="text-slate-500 text-[11px] font-medium mt-0.5">Satış hızı ve tedarik süresine göre hesaplanır</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Sistem Tavsiyesi
            </span>
          </div>

          <div className="p-5 overflow-y-auto space-y-3 flex-1 bg-slate-50/30">
            {loadingForecast ? (
              <p className="text-[13px] font-medium text-slate-500 text-center py-8">Öngörüler hesaplanıyor...</p>
            ) : forecasts.length === 0 ? (
              <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md mb-4 shadow-sm">
                  <CheckCircle2 className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-700">Sipariş gerektiren ürün bulunmuyor.</p>
                <p className="text-xs text-slate-500 mt-1">Tüm stok seviyeleri tanımlı güvenlik aralığında.</p>
              </div>
            ) : (
              [<div key="draft" className="flex flex-wrap items-center justify-between gap-2"><button type="button" className="btn-primary" disabled={drafting} onClick={createDrafts}>{drafting ? 'Oluşturuluyor…' : `${forecasts.length} ürün için taslak oluştur`}</button>{draftResult && <span role="status" className="text-xs text-slate-600">{draftResult}</span>}</div>, ...forecasts.map((f, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-md bg-white border border-slate-200 shadow-sm text-[13px]"
                >
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-800">{f.name}</span>
                    <span className="font-mono text-slate-500 text-xs px-2 py-0.5 bg-slate-50 border border-slate-200 rounded">{f.sku}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mevcut Stok</p>
                      <p className="font-semibold text-slate-800">{f.current_quantity} {f.unit}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tükenecek Süre</p>
                      <p className="font-bold text-rose-600">{f.velocity_estimated ? 'Satış verisi az' : `${f.days_until_stockout} Gün`}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Önerilen Sipariş</p>
                      <p className="font-bold text-emerald-600">+{f.suggested_reorder_qty} {f.unit}</p>
                    </div>
                  </div>
                </div>
              ))]
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


