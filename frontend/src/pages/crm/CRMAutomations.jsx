import React, { useState } from 'react';
import {
  Zap,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  ArrowDown,
  Mail,
  Users,
  MessageSquare,
  Clock,
  Settings,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';

export default function CRMAutomations() {
  const { automations, toggleAutomation } = useCRM();

  const [selectedAutomation, setSelectedAutomation] = useState(automations[0]);
  const [testLog, setTestLog] = useState([]);
  const [isTesting, setIsTesting] = useState(false);

  const runTestSimulation = () => {
    setIsTesting(true);
    setTestLog([]);

    const steps = [
      '? [Trigger Evaluated] Lead score >= 80 matched (Sarah Connor, Cyberdyne Systems - Score: 94)',
      '?? [Action Executed] Assigned to Senior AE Sarah Jenkins via Round-Robin load balancer',
      '?? [Action Executed] Personalized welcome email dispatched via Gmail Enterprise API',
      '?? [Action Executed] Webhook posted to Slack channel #sales-enterprise-hot (HTTP 200 OK)',
      '? [Workflow Finished] Execution completed in 142ms with 0 errors.'
    ];

    steps.forEach((msg, idx) => {
      setTimeout(() => {
        setTestLog((prev) => [...prev, msg]);
        if (idx === steps.length - 1) setIsTesting(false);
      }, (idx + 1) * 350);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-200/50 border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 text-gray-900">
              Workflow Automation Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400 text-xs font-bold font-mono border border-purple-200 dark:border-purple-800">
              {automations.filter((a) => a.enabled).length} Active Rules
            </span>
          </div>
          <p className="text-xs text-gray-500 text-gray-500 mt-1">
            Visual workflow automation engine. Connect triggers, conditions, automated emails, and Slack notifications.
          </p>
        </div>

        <button
          onClick={() => alert('Opening visual rule designer canvas')}
          className="btn-primary"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Workflow</span>
        </button>
      </div>

      {/* Main Split View: Workflow List & Visual Builder Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Automations List (1 Col) */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">
            Configured Workflows
          </div>

          {automations.map((auto) => {
            const isSelected = selectedAutomation?.id === auto.id;
            return (
              <div
                key={auto.id}
                onClick={() => setSelectedAutomation(auto)}
                className={`p-4 rounded-xl border cursor-pointer transition space-y-2 text-xs ${
                  isSelected
                    ? 'bg-brand-500/10/70 dark:bg-blue-950/30 border-blue-500 dark:border-blue-700 shadow-xs'
                    : 'bg-white dark:bg-gray-100 border-gray-200/50 border-gray-200 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 text-gray-900 text-[13px]">{auto.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAutomation(auto.id);
                    }}
                    className="text-gray-500 hover:text-gray-500"
                  >
                    {auto.enabled ? (
                      <span className="badge-success font-bold font-mono text-[9.5px]">ENABLED</span>
                    ) : (
                      <span className="badge-neutral font-bold font-mono text-[9.5px]">PAUSED</span>
                    )}
                  </button>
                </div>

                <p className="text-gray-500 text-gray-500 text-[11.5px] line-clamp-2">{auto.trigger}</p>

                <div className="flex items-center justify-between pt-1 border-t border-gray-200/50 border-gray-200 text-[10.5px] font-mono text-gray-500">
                  <span>{auto.runsCount} executions</span>
                  <span>Last run: {auto.lastRun}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Visual Node Builder & Live Tester (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {selectedAutomation && (
            <div className="crm-card p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200/50 border-gray-200">
                <div>
                  <h3 className="font-bold text-base text-gray-900 text-gray-900">
                    {selectedAutomation.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Visual Graph Representation</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={runTestSimulation}
                    disabled={isTesting}
                    className="btn-accent text-xs"
                  >
                    <Play className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Simulating...' : 'Test Workflow'}</span>
                  </button>
                </div>
              </div>

              {/* Visual Node Graph */}
              <div className="space-y-3 py-2 max-w-xl mx-auto">
                {selectedAutomation.steps?.map((step, idx) => (
                  <React.Fragment key={step.id}>
                    <div
                      className={`p-4 rounded-xl border shadow-xs text-xs space-y-1 ${
                        step.type === 'trigger'
                          ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                          : 'bg-white dark:bg-gray-100 border-gray-200/50 border-gray-200 text-gray-900 dark:text-gray-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase font-mono text-[10px] tracking-wider text-gray-500">
                          Step #{idx + 1} • {step.type.toUpperCase()}
                        </span>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="font-semibold text-[13px]">{step.label}</div>
                    </div>

                    {idx < selectedAutomation.steps.length - 1 && (
                      <div className="flex justify-center">
                        <ArrowDown className="w-5 h-5 text-gray-500 dark:text-gray-900" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Real-Time Test Simulation Output Terminal */}
              {testLog.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-950 text-green-600 font-mono text-xs space-y-1.5 border border-gray-200 shadow-inner animate-in fade-in">
                  <div className="flex items-center justify-between text-gray-500 pb-1 border-b border-gray-200 text-[11px]">
                    <span>? Live Workflow Execution Stream</span>
                    <span>Status: {isTesting ? 'Running...' : 'Done'}</span>
                  </div>
                  {testLog.map((log, lIdx) => (
                    <div key={lIdx} className="leading-relaxed">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




