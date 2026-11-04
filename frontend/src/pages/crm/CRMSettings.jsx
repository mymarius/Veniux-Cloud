import React, { useState } from 'react';
import {
  Settings,
  Building2,
  Key,
  Shield,
  Palette,
  Sliders,
  Save,
  CheckCircle2,
  Sparkles,
  Sun,
  Moon,
  Layers,
  Database
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';

export default function CRMSettings() {
  const { activeWorkspace, darkMode, setDarkMode } = useCRM();

  const [workspaceName, setWorkspaceName] = useState(activeWorkspace.name);
  const [apiKey, setApiKey] = useState('vnx_live_99a818e8f203810293810283');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200/50 border-gray-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 text-gray-900">
            Workspace Settings & Configuration
          </h1>
          <p className="text-xs text-gray-500 text-gray-500 mt-1">
            Manage organization security, lead scoring algorithms, pipeline stages, and developer API keys.
          </p>
        </div>

        {savedSuccess && (
          <span className="badge-success font-bold flex items-center gap-1 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" /> Changes Saved
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: General Workspace */}
        <div className="crm-card p-6 space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-gray-900 text-gray-900 pb-3 border-b border-gray-200/50 border-gray-200">
            <Building2 className="w-4 h-4 text-brand-500" />
            <span>Organization Profile</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Workspace Name</label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="w-full crm-input"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Subscription Plan</label>
              <input
                type="text"
                disabled
                value="Enterprise Tier (200 Seats • Unlimited Pipelines)"
                className="w-full crm-input bg-gray-100 dark:bg-white text-gray-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Appearance & Dark Mode */}
        <div className="crm-card p-6 space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-gray-900 text-gray-900 pb-3 border-b border-gray-200/50 border-gray-200">
            <Palette className="w-4 h-4 text-purple-600" />
            <span>Appearance & Theme</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div>
              <div className="font-bold text-gray-900 text-gray-900">Dark Theme Interface</div>
              <div className="text-gray-500 text-[11px]">Toggle between High-Contrast Dark Mode and Clean Light Surface.</div>
            </div>

            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="btn-secondary"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'Light Theme' : 'Dark Theme'}</span>
            </button>
          </div>
        </div>

        {/* Section 3: Developer API & Webhooks */}
        <div className="crm-card p-6 space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-gray-900 text-gray-900 pb-3 border-b border-gray-200/50 border-gray-200">
            <Key className="w-4 h-4 text-amber-600" />
            <span>Developer API Keys</span>
          </div>

          <div className="space-y-2 text-xs">
            <label className="block font-semibold text-gray-900 text-gray-500">Live Production Secret Key</label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                readOnly
                value={apiKey}
                className="flex-1 crm-input font-mono bg-gray-100 dark:bg-white text-gray-500"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(apiKey);
                  alert('API Key copied to clipboard');
                }}
                className="btn-secondary text-xs"
              >
                Copy Key
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              Use this key to authenticate REST API requests from Zapier, Slack Bots, and custom data pipelines.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-2">
          <button type="submit" className="btn-primary">
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
}


