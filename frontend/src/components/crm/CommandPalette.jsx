import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Building2,
  Users,
  DollarSign,
  Briefcase,
  CheckSquare,
  Plus,
  Moon,
  Sun,
  ArrowRight,
  Sparkles,
  Command,
  X
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';

export default function CommandPalette() {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    leads,
    deals,
    contacts,
    companies,
    setIsQuickCreateOpen,
    setQuickCreateType,
    darkMode,
    setDarkMode
  } = useCRM();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  // Filtered results
  const q = query.toLowerCase().trim();

  const filteredDeals = deals
    .filter((d) => !q || d.title.toLowerCase().includes(q) || d.companyName.toLowerCase().includes(q))
    .slice(0, 3)
    .map((d) => ({
      id: d.id,
      category: 'Deals',
      icon: DollarSign,
      title: d.title,
      subtitle: `${d.companyName} • $${Number(d.value).toLocaleString()}`,
      action: () => {
        navigate('/crm/deals');
        setIsCommandPaletteOpen(false);
      }
    }));

  const filteredContacts = contacts
    .filter((c) => !q || c.fullName.toLowerCase().includes(q) || c.companyName.toLowerCase().includes(q))
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      category: 'Contacts',
      icon: Users,
      title: c.fullName,
      subtitle: `${c.jobTitle} at ${c.companyName}`,
      action: () => {
        navigate(`/crm/contacts/${c.id}`);
        setIsCommandPaletteOpen(false);
      }
    }));

  const filteredCompanies = companies
    .filter((comp) => !q || comp.name.toLowerCase().includes(q) || comp.industry.toLowerCase().includes(q))
    .slice(0, 3)
    .map((comp) => ({
      id: comp.id,
      category: 'Companies',
      icon: Building2,
      title: comp.name,
      subtitle: `${comp.industry} • ${comp.employees} employees`,
      action: () => {
        navigate(`/crm/companies/${comp.id}`);
        setIsCommandPaletteOpen(false);
      }
    }));

  const quickActions = [
    {
      id: 'act-new-deal',
      category: 'Quick Actions',
      icon: Plus,
      title: 'Create New Deal',
      subtitle: 'Add high-value sales pipeline opportunity',
      action: () => {
        setQuickCreateType('deal');
        setIsQuickCreateOpen(true);
        setIsCommandPaletteOpen(false);
      }
    },
    {
      id: 'act-new-lead',
      category: 'Quick Actions',
      icon: Plus,
      title: 'Create New Lead',
      subtitle: 'Add inbound or outbound prospect',
      action: () => {
        setQuickCreateType('lead');
        setIsQuickCreateOpen(true);
        setIsCommandPaletteOpen(false);
      }
    },
    {
      id: 'act-new-task',
      category: 'Quick Actions',
      icon: CheckSquare,
      title: 'Create Task',
      subtitle: 'Assign task or follow-up item',
      action: () => {
        setQuickCreateType('task');
        setIsQuickCreateOpen(true);
        setIsCommandPaletteOpen(false);
      }
    },
    {
      id: 'act-toggle-dark',
      category: 'Preferences',
      icon: darkMode ? Sun : Moon,
      title: darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      subtitle: 'Toggle theme preference',
      action: () => {
        setDarkMode(!darkMode);
        setIsCommandPaletteOpen(false);
      }
    }
  ].filter((act) => !q || act.title.toLowerCase().includes(q));

  const allItems = [...filteredDeals, ...filteredContacts, ...filteredCompanies, ...quickActions];

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < allItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].action();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white dark:bg-gray-100 border border-gray-200/50 border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-gray-200/50 border-gray-200 gap-3">
          <Search className="w-5 h-5 text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search contacts, deals, companies..."
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-900 placeholder-slate-400 focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-0.5 text-[10.5px] font-mono font-medium rounded bg-gray-100 dark:bg-white text-gray-500 border border-gray-200/50 border-gray-200">
              ESC
            </kbd>
            <button
              onClick={() => setIsCommandPaletteOpen(false)}
              className="p-1 text-gray-500 hover:text-gray-500 dark:hover:text-gray-900 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-border/40 dark:divide-slate-800/50">
          {allItems.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs">
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-gray-500 text-gray-500" />
              <p className="font-semibold text-gray-900 text-gray-500">No results found for "{query}"</p>
              <p className="text-[11px] mt-0.5">Try searching for a contact name, company or deal title.</p>
            </div>
          ) : (
            <div className="space-y-0.5 py-1">
              {allItems.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={`${item.category}-${item.id}`}
                    onClick={() => item.action()}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-brand-500/10 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200'
                        : 'text-gray-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-1.5 rounded-md ${
                          isSelected
                            ? 'bg-brand-500 text-white'
                            : 'bg-gray-100 dark:bg-white text-gray-500 text-gray-500'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate text-[12.5px]">{item.title}</div>
                        <div className="text-[11px] text-gray-500 text-gray-500 truncate">{item.subtitle}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 bg-gray-100 dark:bg-white px-1.5 py-0.5 rounded">
                        {item.category}
                      </span>
                      {isSelected && <ArrowRight className="w-3.5 h-3.5 text-brand-500 dark:text-brand-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-gray-100 dark:bg-black/50 border-t border-gray-200/50 border-gray-200 flex items-center justify-between text-[11px] text-gray-500 font-mono">
          <div className="flex items-center gap-2">
            <span>^v to navigate</span>
            <span>•</span>
            <span>? to select</span>
            <span>•</span>
            <span>esc to close</span>
          </div>
          <div>Linear-style Universal Search</div>
        </div>
      </div>
    </div>
  );
}


