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
    <div className="vx-ai space-y-5 pb-10">
      {/* Corporate Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 vx-ai-head">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">
            Asistan ve sipariş önerileri
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Kayıtlarınıza Türkçe soru sorun, biten ürünler için sipariş taslağı hazırlayın.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            disabled={analyzing}
            onClick={() => window.dispatchEvent(new CustomEvent('veniux:assistant-open',{detail:{action:'analysis'}}))}
            className="flex items-center gap-1.5 px-4 py-2 vx-ai-btn" data-tone="ink"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {analyzing ? 'Analiz ediliyor…' : 'Sistemi Tara'}
          </button>
          
          <button
            onClick={fetchForecasts}
            className="flex items-center gap-1.5 vx-ai-btn" data-tone="line"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Verileri Yenile
          </button>
        </div>
      </div>

      {proposal&&<section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><strong>{proposal.title}</strong><p className="my-3 whitespace-pre-wrap text-sm">{proposal.impact}</p>{proposal.requires_file?<AssistantFileInput proposal={proposal} onPrepared={setProposal} onError={message=>showToast(message,'error')}/>:<p>Onaylıyor musunuz?</p>}<div className="flex gap-3"><button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white" disabled={applying||!proposal.id} onClick={async()=>{if(proposal.deletion_required&&!window.confirm(`${proposal.impact}\nBelirtilen silme veya bağlantı kaldırma işlemini ayrıca onaylıyor musunuz?`))return;setApplying(true);try{const {data}=await apiClient.post('/ai/actions/execute',{id:proposal.id,confirmed:true,deletion_confirmed:proposal.deletion_required===true},{timeout:75000});setMessages(prev=>[...prev,{id:Date.now(),sender:'bot',text:data.reply,result:data.result}]);setProposal(null);fetchForecasts();}catch(e){setProposal(null);showToast(e.response?.data?.error||'İşlem tamamlanamadı.','error');}finally{setApplying(false);}}}>{applying?'Uygulanıyor…':'Onayla ve uygula'}</button><button disabled={applying} onClick={()=>setProposal(null)}>Vazgeç</button></div></section>}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chat Section (7 Cols) */}
        <div className="lg:col-span-7 vx-ai-panel flex flex-col h-[580px] overflow-hidden">
          <div className="vx-ai-panel-head flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div>
                <h3>Asistana sorun</h3>
                <p>{aiStatus}</p>
              </div>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="vx-ai-feed flex-1 p-5 overflow-y-auto space-y-4">
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="vx-ai-mark flex items-center justify-center shrink-0">
                      V
                    </div>
                  )}

                  <div
                    className={`vx-ai-msg max-w-lg leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'is-user'
                        : 'is-bot'
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
          <div className="vx-ai-suggest flex flex-wrap gap-2">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                className="vx-ai-chip"
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
            className="vx-ai-form flex items-center gap-3"
          >
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Örneğin: Hangi depoda kahve azaldı?"
                className="vx-ai-input block w-full pl-9 pr-3"
              />
            </div>
            <button
              type="submit"
              disabled={!inputMessage.trim() || loading}
              className="flex items-center gap-1.5 vx-ai-btn disabled:opacity-50" data-tone="accent"
            >
              <Send className="w-3.5 h-3.5" /> Gönder
            </button>
          </form>
        </div>

        {/* Forecast & Order Recommendations (5 Cols) */}
        <div className="lg:col-span-5 vx-ai-panel flex flex-col h-[580px] overflow-hidden">
          <div className="vx-ai-panel-head flex items-center justify-between">
            <div>
              <h3>Sipariş önerileri</h3>
              <p>Satış hızı ve tedarik süresine göre hesaplanır</p>
            </div>
          </div>

          <div className="vx-ai-orders p-5 overflow-y-auto space-y-4 flex-1">
            {loadingForecast ? (
              <p className="text-[13px] font-medium text-slate-500 text-center py-8">Öngörüler hesaplanıyor...</p>
            ) : forecasts.length === 0 ? (
              <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                <CheckCircle2 className="vx-ai-empty-icon" />
                <p className="vx-ai-empty-title">Şimdilik sipariş önerisi yok.</p>
                <p className="mt-2">Öneriler satış hızına göre hesaplanır. Biten veya azalan ürünler için bildirimlere de bakın.</p>
              </div>
            ) : (
              [<div key="draft" className="flex flex-wrap items-center justify-between gap-2"><button type="button" className="btn-primary" disabled={drafting} onClick={createDrafts}>{drafting ? 'Oluşturuluyor…' : `${forecasts.length} ürün için taslak oluştur`}</button>{draftResult && <span role="status" className="text-xs text-slate-600">{draftResult}</span>}</div>, ...forecasts.map((f, idx) => (
                <div
                  key={idx}
                  className="vx-ai-tag"
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


