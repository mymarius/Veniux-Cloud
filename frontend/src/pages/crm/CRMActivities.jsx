import React, { useState } from 'react';
import {
  Activity,
  Search,
  Filter,
  DollarSign,
  Mail,
  Phone,
  Video,
  Zap,
  CheckCircle2,
  FileText,
  Clock,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';

export default function CRMActivities() {
  const { activities, logActivity } = useCRM();
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredActivities = activities.filter((act) => {
    const matchesSearch =
      !searchQuery ||
      act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.relatedObject?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || act.type === filterType;
    return matchesSearch && matchesType;
  });

  const getActivityIcon = (type) => {
    switch (type) {
      case 'deal_won':
        return <DollarSign className="w-4 h-4 text-green-600" />;
      case 'email':
        return <Mail className="w-4 h-4 text-brand-500" />;
      case 'call':
        return <Phone className="w-4 h-4 text-amber-500" />;
      case 'meeting':
        return <Video className="w-4 h-4 text-purple-500" />;
      case 'automation':
        return <Zap className="w-4 h-4 text-brand-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-200/50 border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 text-gray-900">
              Activity Timeline & Audit Trail
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-500/10 bg-brand-500/10 text-brand-500 dark:text-brand-500 text-xs font-bold font-mono border border-brand-500/20 border-brand-500/20">
              {activities.length} Recorded Events
            </span>
          </div>
          <p className="text-xs text-gray-500 text-gray-500 mt-1">
            Real-time chronological stream of customer emails, calls, Zoom meetings, deal wins, and workflow automations.
          </p>
        </div>

        <button
          onClick={() => {
            const desc = prompt('Log new team activity remark:');
            if (desc) {
              logActivity({
                type: 'note',
                title: 'Manual Activity Entry',
                description: desc,
                relatedObject: 'General Workspace',
                badgeColor: 'info'
              });
            }
          }}
          className="btn-primary"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Log Activity</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg crm-card text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter timeline events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 crm-input"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto text-xs font-semibold">
            {[
              { id: 'all', label: 'All Events' },
              { id: 'deal_won', label: 'Deal Won' },
              { id: 'meeting', label: 'Meetings' },
              { id: 'email', label: 'Emails' },
              { id: 'call', label: 'Calls' },
              { id: 'automation', label: 'Automations' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1.5 rounded-md transition ${
                  filterType === tab.id
                    ? 'bg-gray-100 dark:bg-gray-100 text-white dark:text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-500 text-gray-500 hover:bg-gray-100 dark:hover:bg-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <span className="text-gray-500 font-mono text-[11px]">
          {filteredActivities.length} events found
        </span>
      </div>

      {/* Timeline Stream */}
      <div className="crm-card p-6 space-y-6">
        <div className="relative border-l-2 border-gray-200/50 border-gray-200 ml-4 space-y-6 pl-6">
          {filteredActivities.map((act) => (
            <div key={act.id} className="relative group">
              {/* Timeline Dot */}
              <div className="absolute -left-[33px] top-1 w-6 h-6 rounded-full bg-white dark:bg-gray-100 border-2 border-gray-200 border-gray-200 flex items-center justify-center shadow-xs">
                {getActivityIcon(act.type)}
              </div>

              {/* Event Content */}
              <div className="p-4 rounded-xl border border-gray-200/50/90 border-gray-200 bg-gray-100/40 dark:bg-gray-100/30 space-y-2 text-xs hover:border-gray-200 transition">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-gray-900 text-[13px]">{act.title}</span>
                    {act.relatedObject && (
                      <span className="badge-neutral font-mono text-[10.5px]">{act.relatedObject}</span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {act.timestamp}
                  </span>
                </div>

                <p className="text-gray-500 text-gray-500 text-[12px] leading-relaxed">{act.description}</p>

                <div className="flex items-center justify-between pt-2 border-t border-gray-200/50/60 border-gray-200/60 text-[11px] text-gray-500 font-mono">
                  <span>Logged by: {act.user}</span>
                  <span className="capitalize">{act.type.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



