import React, { useState } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { Avatar, Bar, Chip, tl, trDate } from './Parts';

/**
 * Fırsat panosu (kanban).
 *
 * Sürükle-bırak yerel HTML5 olaylarıyla yapılır — ek bağımlılık yok.
 * Klavye erişilebilirliği için her kartta aşama ilerlet/gerilet düğmeleri de
 * bulunur, böylece işlem yalnızca fareye bağlı değildir.
 */

const STAGES = [
  { id: 'qualification', label: 'Niteleme', tone: '#A8A29E' },
  { id: 'proposal', label: 'Teklif', tone: '#F59E0B' },
  { id: 'negotiation', label: 'Pazarlık', tone: '#426b9c' },
  { id: 'won', label: 'Kazanıldı', tone: '#15803D' },
  { id: 'lost', label: 'Kaybedildi', tone: '#B91C1C' }
];

const PRIORITY_TONE = { urgent: 'red', high: 'amber', medium: 'orange', low: 'slate' };
const PRIORITY_LABEL = { urgent: 'Acil', high: 'Yüksek', medium: 'Orta', low: 'Düşük' };

export default function CrmDealsBoard({ onCreate }) {
  const { deals, updateDealStage } = useCRM();
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);

  const move = (dealId, stageId) => {
    const deal = deals.find((d) => d.id === dealId);
    if (deal && deal.stage !== stageId) updateDealStage(dealId, stageId);
  };

  const shift = (deal, delta) => {
    const i = STAGES.findIndex((s) => s.id === deal.stage);
    const next = STAGES[Math.min(STAGES.length - 1, Math.max(0, i + delta))];
    if (next && next.id !== deal.stage) updateDealStage(deal.id, next.id);
  };

  return (
    <div className="overflow-x-auto pb-2 custom-scrollbar">
      <div className="flex min-w-max gap-4">
        {STAGES.map((stage) => {
          const rows = deals.filter((d) => d.stage === stage.id);
          const total = rows.reduce((s, d) => s + Number(d.value || 0), 0);
          const isOver = overStage === stage.id;

          return (
            <section
              key={stage.id}
              onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id); }}
              onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, stage.id);
                setDragId(null);
                setOverStage(null);
              }}
              className={`flex w-[292px] shrink-0 flex-col rounded-xl border bg-gray-50/60 transition-colors ${
                isOver ? 'border-brand-300 bg-brand-50/60' : 'border-gray-200/80'
              }`}
            >
              <header className="flex items-center gap-2.5 border-b border-gray-200/70 px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: stage.tone }} />
                <h3 className="text-[12.5px] font-semibold text-gray-900">{stage.label}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-gray-500 shadow-2xs">
                  {rows.length}
                </span>
                <span className="ml-auto text-[11.5px] font-bold tabular-nums text-gray-600">{tl(total)}</span>
              </header>

              <div className="flex-1 space-y-2.5 p-3">
                {rows.map((d) => {
                  const stageIndex = STAGES.findIndex((s) => s.id === d.stage);
                  return (
                    <article
                      key={d.id}
                      draggable
                      onDragStart={(e) => {
                        setDragId(d.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', d.id);
                      }}
                      onDragEnd={() => { setDragId(null); setOverStage(null); }}
                      className={`group cursor-grab rounded-lg border border-gray-100 bg-white p-3.5 shadow-2xs transition-all active:cursor-grabbing ${
                        dragId === d.id ? 'opacity-40' : 'hover:border-brand-200 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-gray-400" />
                        <p className="min-w-0 flex-1 text-[12.5px] font-bold leading-snug text-gray-900">{d.title}</p>
                      </div>

                      <p className="mt-1.5 truncate pl-[22px] text-[11px] font-medium text-gray-500">{d.companyName}</p>

                      <div className="mt-3 flex items-center gap-2 pl-[22px]">
                        <Bar value={d.probability} tone={stage.tone} />
                        <span className="w-9 shrink-0 text-right text-[10.5px] font-bold tabular-nums text-gray-500">
                          %{d.probability}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2 pl-[22px]">
                        <Avatar name={d.salesRep} size={24} />
                        <Chip tone={PRIORITY_TONE[d.priority]}>{PRIORITY_LABEL[d.priority] || d.priority}</Chip>
                        <span className="ml-auto text-[12px] font-semibold tabular-nums text-gray-900">{tl(d.value)}</span>
                      </div>

                      <div className="mt-2.5 flex items-center gap-1 border-t border-gray-100 pt-2.5 pl-[22px]">
                        <span className="text-[10.5px] font-semibold tabular-nums text-gray-400">
                          {trDate(d.expectedCloseDate)}
                        </span>
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => shift(d, -1)}
                            disabled={stageIndex === 0}
                            title="Önceki aşamaya al"
                            className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            ‹
                          </button>
                          <button
                            onClick={() => shift(d, 1)}
                            disabled={stageIndex === STAGES.length - 1}
                            title="Sonraki aşamaya al"
                            className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            ›
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {rows.length === 0 && (
                  <div className={`rounded-lg border-2 border-dashed py-8 text-center text-[11.5px] font-semibold transition-colors ${
                    isOver ? 'border-brand-300 text-brand-600' : 'border-gray-200 text-gray-400'
                  }`}>
                    {isOver ? 'Buraya bırakın' : 'Bu aşamada fırsat yok'}
                  </div>
                )}

                {stage.id === 'qualification' && (
                  <button
                    onClick={() => onCreate?.('deal')}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2.5 text-[11.5px] font-bold text-gray-500 transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    <Plus className="h-3.5 w-3.5" /> Fırsat ekle
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
