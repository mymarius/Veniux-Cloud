import React, { useState } from 'react';
import {
  Plus,
  Search,
  Kanban,
  Table as TableIcon,
  Calendar,
  Trash2,
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { DataTable, StatusBadge, Dropdown } from '../../components/ui';

const PIPELINE_COLUMNS = [
  { id: 'new_lead', name: 'New Lead' },
  { id: 'qualified', name: 'Qualified' },
  { id: 'proposal', name: 'Proposal Sent' },
  { id: 'negotiation', name: 'Negotiation' },
  { id: 'won', name: 'Closed Won' },
  { id: 'lost', name: 'Closed Lost' }
];

export default function CRMDeals() {
  const { deals, updateDealStage, deleteDeal, setIsQuickCreateOpen, setQuickCreateType } = useCRM();

  const [viewMode, setViewMode] = useState('kanban'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRep, setSelectedRep] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [draggedDealId, setDraggedDealId] = useState(null);

  const filteredDeals = deals.filter((deal) => {
    const matchesSearch =
      !searchQuery ||
      deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.companyName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRep = selectedRep === 'all' || deal.salesRep === selectedRep;
    const matchesPriority = selectedPriority === 'all' || deal.priority === selectedPriority;
    return matchesSearch && matchesRep && matchesPriority;
  });

  const totalFilteredValue = filteredDeals.reduce((acc, d) => acc + Number(d.value), 0);

  const handleDragStart = (e, dealId) => {
    setDraggedDealId(dealId);
    e.dataTransfer.setData('text/plain', dealId);
  };

  const handleDrop = (e, columnId) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain') || draggedDealId;
    if (dealId) {
      updateDealStage(dealId, columnId);
      setDraggedDealId(null);
    }
  };

  const columns = [
    { key: 'title', label: 'Deal Title', render: (row) => <span className="font-bold text-gray-900">{row.title}</span> },
    { key: 'company', label: 'Company', render: (row) => <span className="font-medium text-gray-500">{row.companyName}</span> },
    { key: 'value', label: 'Value', align: 'right', render: (row) => <span className="font-mono font-semibold text-gray-900 tabular-nums">${Number(row.value).toLocaleString()}</span> },
    { 
      key: 'stage', 
      label: 'Stage', 
      render: (row) => (
        <Dropdown
          value={row.stage}
          onChange={(e) => updateDealStage(row.id, e.target.value)}
          className="bg-gray-100 border border-gray-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-brand-500 transition"
        >
          {PIPELINE_COLUMNS.map(col => (
            <option key={col.id} value={col.id}>{col.name}</option>
          ))}
        </Dropdown>
      )
    },
    { key: 'prob', label: 'Probability', align: 'right', render: (row) => <span className="font-mono text-gray-500">{row.probability}%</span> },
    { key: 'owner', label: 'Owner', render: (row) => <span className="text-gray-500">{row.salesRep}</span> },
    { key: 'date', label: 'Expected Close', align: 'right', render: (row) => <span className="font-mono text-gray-500">{row.expectedCloseDate}</span> },
    { 
      key: 'actions', 
      label: '', 
      align: 'right',
      render: (row) => (
        <button onClick={() => deleteDeal(row.id)} className="p-1 text-gray-500 hover:text-red-500 transition">
          <Trash2 className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-5 max-w-[1700px] mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">Sales Pipeline & Deals</h1>
            <StatusBadge status="info" text={`$${totalFilteredValue.toLocaleString()} active`} />
          </div>
          <p className="text-xs text-gray-500 mt-1">Drag and drop deals across stages to update probabilities.</p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center p-0.5 rounded-lg bg-gray-100 border border-gray-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${viewMode === 'kanban' ? 'bg-white text-gray-900 font-bold shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <Kanban className="w-3.5 h-3.5" /> Kanban
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${viewMode === 'table' ? 'bg-white text-gray-900 font-bold shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <TableIcon className="w-3.5 h-3.5" /> Table
            </button>
          </div>

          <button onClick={() => { setQuickCreateType('deal'); setIsQuickCreateOpen(true); }} className="btn-primary">
            <Plus className="w-3.5 h-3.5" />
            <span>New Opportunity</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white border border-gray-200 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter deals by name or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-lg outline-none focus:border-brand-500 transition"
            />
          </div>

          <Dropdown value={selectedRep} onChange={(e) => setSelectedRep(e.target.value)} className="bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg outline-none focus:border-brand-500">
            <option value="all">All Sales Reps</option>
            <option value="Sarah Jenkins">Sarah Jenkins</option>
            <option value="Elena Rostova">Elena Rostova</option>
            <option value="David Chen">David Chen</option>
          </Dropdown>

          <Dropdown value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)} className="bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg outline-none focus:border-brand-500">
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Dropdown>
        </div>
        <span className="text-gray-500 font-mono text-[11px] px-2">{filteredDeals.length} opportunities</span>
      </div>

      {/* KANBAN */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 items-start overflow-x-auto pb-6 min-h-[500px]">
          {PIPELINE_COLUMNS.map((col) => {
            const columnDeals = filteredDeals.filter((d) => d.stage === col.id);
            const columnTotal = columnDeals.reduce((sum, d) => sum + Number(d.value), 0);
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, col.id)}
                className="flex flex-col min-w-[240px] bg-gray-100 rounded-xl border border-gray-200 p-3 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-gray-900">{col.name}</span>
                    <span className="px-1.5 rounded-full text-[10px] font-bold bg-white text-gray-500">{columnDeals.length}</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-gray-500 tabular-nums">${(columnTotal / 1000).toFixed(0)}k</span>
                </div>

                <div className="space-y-3 min-h-[400px]">
                  {columnDeals.length === 0 ? (
                    <div className="h-24 border border-dashed border-gray-200 rounded-lg flex items-center justify-center text-[11px] text-gray-500">Drop deals here</div>
                  ) : (
                    columnDeals.map((deal) => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-brand-500/50 cursor-grab active:cursor-grabbing transition space-y-2 group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-gray-500 truncate">{deal.companyName}</span>
                          <StatusBadge status={deal.priority === 'urgent' ? 'danger' : deal.priority === 'high' ? 'warning' : 'info'} text={deal.priority} />
                        </div>
                        <div className="font-bold text-gray-900 text-xs leading-snug line-clamp-2">{deal.title}</div>
                        <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                          <div className="font-mono font-semibold text-sm text-gray-900 tabular-nums">${Number(deal.value).toLocaleString()}</div>
                          <span className="text-[10.5px] font-mono text-gray-500">{deal.probability}% win prob</span>
                        </div>
                        <div className="flex items-center justify-between text-[10.5px] text-gray-500 pt-1">
                          <div className="flex items-center gap-1.5">
                            <img src={deal.repAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80'} alt={deal.salesRep} className="w-5 h-5 rounded-full object-cover border border-gray-200" />
                            <span className="truncate max-w-[80px]">{deal.salesRep.split(' ')[0]}</span>
                          </div>
                          <div className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3" />
                            <span>{deal.expectedCloseDate?.slice(5)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <DataTable 
          columns={columns}
          data={filteredDeals}
          emptyState="No deals match your criteria."
        />
      )}
    </div>
  );
}
