import { chartColors } from '../../../lib/chartPalette';
import React from 'react';
import { useCRM } from '../../../context/CRMContext';
import BusinessChart from '../../BusinessChart';
export default function CRMCharts() {
  const { deals, tasks } = useCRM();
  const stages = [['qualification','Niteleme'],['proposal','Teklif'],['negotiation','Pazarlık'],['won','Kazanıldı'],['lost','Kaybedildi']];
  const open = deals.filter(d => !['won','lost'].includes(d.stage));
  const amount = open.reduce((sum,d) => sum + Number(d.value || 0),0);
  return <div className="business-chart-grid"><article className="business-panel"><div className="business-panel-heading"><div><h2>Satış fırsatlarının görünümü</h2><p>Aşamalara göre toplam fırsat değeri · ₺</p></div><span className="business-badge">{open.length} açık fırsat</span></div><BusinessChart type="bar" title="Satış aşamalarına göre fırsat değeri" labels={stages.map(s=>s[1])} datasets={[{ label: 'Fırsat değeri (₺)', data: stages.map(s=>deals.filter(d=>d.stage===s[0]).reduce((sum,d)=>sum+Number(d.value||0),0)), backgroundColor: chartColors, borderRadius: 7, maxBarThickness: 42 }]} /><p className="text-xs text-slate-500">Açık fırsatların toplam değeri: <strong>{amount.toLocaleString('tr-TR')} ₺</strong></p></article><article className="business-panel"><div className="business-panel-heading"><div><h2>Ekibin iş yükü</h2><p>Görevlerin güncel durumu</p></div></div><BusinessChart type="doughnut" title="Tamamlanan ve açık görevler" labels={['Tamamlandı','Açık görev']} datasets={[{ data: [tasks.filter(t=>t.status==='completed').length,tasks.filter(t=>t.status!=='completed').length], backgroundColor: ['#21a69b','#3563b1'], borderWidth: 4, borderColor:'#fff' }]} /></article></div>;
}
