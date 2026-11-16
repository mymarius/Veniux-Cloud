import {MODELS} from '../../../shared/scaleProtocols.mjs';

const fmt=f=>f?`${f.weight.toLocaleString('tr-TR',{maximumFractionDigits:3})} ${f.unit}`:'—';
// Terazi durumu ve canlı ağırlık. Ağırlık kararlıysa kasa miktarı kendiliğinden doldurur.
export default function ScalePanel({scale}){
 const {supported,prefs,setPrefs,frame,connected,error,connect,disconnect}=scale;
 return <div className="scale-panel" aria-label="Terazi bağlantısı">
  <div className="scale-live" role="status" aria-live="polite">
   <b>{connected?fmt(frame):'Terazi bağlı değil'}</b>
   {connected&&frame&&<span data-stable={frame.stable||undefined}>{frame.stable?'Kararlı':'Oturuyor…'}</span>}
  </div>
  {!connected&&<div className="scale-setup">
   <select aria-label="Terazi modeli" value={prefs.model} onChange={e=>setPrefs({model:e.target.value,baud:MODELS[e.target.value].baud})}>{Object.entries(MODELS).map(([k,m])=><option key={k} value={k}>{m.label}</option>)}</select>
   <select aria-label="Baud hızı" value={prefs.baud} onChange={e=>setPrefs({baud:Number(e.target.value)})}>{[2400,4800,9600,19200,38400,115200].map(b=><option key={b} value={b}>{b}</option>)}</select>
  </div>}
  <button type="button" className="btn-soft" disabled={!supported} onClick={connected?disconnect:connect}>{connected?'Terazi bağlantısını kes':'Teraziyi bağla'}</button>
  {!supported&&<small>Bu ortamda seri port yok. Windows programını veya Chrome/Edge kullanın.</small>}
  {error&&<small role="alert">{error}</small>}
 </div>;
}
