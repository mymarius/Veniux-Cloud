import { linkCRMRecords } from '../lib/crmRelations';
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import { useWorkspaceState } from '../hooks/useWorkspaceState';

const OPEN_STAGES = ['qualification', 'proposal', 'negotiation'];
const STAGE_LABELS = { qualification: 'Niteleme', proposal: 'Teklif', negotiation: 'Pazarlık', won: 'Kazanıldı' };
const sumValue = rows => rows.reduce((sum, row) => sum + Number(row.value || 0), 0);

// Personel kaydı + CRM kayıtları -> satış ekibi performansı.
function buildTeam(employees, deals, tasks, leads) {
  const people = employees
    .filter(e => e.status !== 'ayrildi' && String(e.fullName || '').trim())
    .map(e => ({ id: e.id, name: e.fullName.trim(), role: e.title || 'Personel', quotaQuarter: Number(e.salesQuota || 0) }));
  // Personel listesinde olmayan ama kayıtlarda geçen sahipler de ekipte görünür.
  const known = new Set(people.map(p => p.name));
  [...deals.map(d => d.salesRep), ...leads.map(l => l.owner), ...tasks.map(t => t.assignee)]
    .filter(name => name && name !== 'Atanmadı' && !known.has(name))
    .forEach(name => { known.add(name); people.push({ id: 'owner-' + name, name, role: 'Kayıt sahibi', quotaQuarter: 0 }); });
  return people.map(p => {
    const own = deals.filter(d => d.salesRep === p.name);
    const closedRevenue = sumValue(own.filter(d => d.stage === 'won'));
    return {
      ...p,
      closedRevenue,
      activePipeline: sumValue(own.filter(d => OPEN_STAGES.includes(d.stage))),
      openTasks: tasks.filter(t => t.assignee === p.name && t.status !== 'completed').length,
      quotaAttainment: p.quotaQuarter ? Math.round((closedRevenue / p.quotaQuarter) * 100) : 0
    };
  });
}

// Grafikler sabit örnek veri yerine gerçek fırsat ve aday kayıtlarından hesaplanır.
function buildAnalytics(deals, leads, team) {
  const monthlyTarget = team.reduce((sum, m) => sum + m.quotaQuarter, 0) / 3;
  const now = new Date();
  const revenueTimeline = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const mrr = sumValue(deals.filter(d => {
      if (d.stage !== 'won') return false;
      const at = new Date(d.closedAt || d.expectedCloseDate || d.createdAt || 0);
      return at >= start && at < end;
    }));
    return { month: start.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }), mrr, target: monthlyTarget || null };
  });
  const pipelineStageSummary = Object.keys(STAGE_LABELS).map(id => {
    const rows = deals.filter(d => d.stage === id);
    return { stage: STAGE_LABELS[id], value: sumValue(rows), count: rows.length };
  });
  const reached = [
    ['Aday müşteri', leads.length + deals.length],
    ['Fırsat', deals.length],
    ['Teklif', deals.filter(d => ['proposal', 'negotiation', 'won'].includes(d.stage)).length],
    ['Kazanıldı', deals.filter(d => d.stage === 'won').length]
  ];
  const funnelStages = reached.map(([name, value], i) => ({
    name, value, rate: !i ? '%100' : reached[i - 1][1] ? `%${Math.round((value / reached[i - 1][1]) * 100)}` : '—'
  }));
  return { revenueTimeline, pipelineStageSummary, funnelStages };
}
const CRMContext = createContext(null);

export const CRMProvider = ({ children }) => {
  const store = useWorkspaceState('crm', ['companies','contacts','leads','deals','tasks','activities','automations','notifications']);
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('crm_dark_mode');
    try { return saved ? JSON.parse(saved) : false; } catch { return false; }
  });

  // Active Workspace
  const [workspaces] = useState([
    { id: 'ws-1', name: 'Acme Enterprise Global', role: 'Owner', plan: 'Enterprise Pro', seats: '140/200' },
    { id: 'ws-2', name: 'Veniux Cloud US-East', role: 'Admin', plan: 'Scale Tier', seats: '45/50' },
    { id: 'ws-3', name: 'Starlight EMEA Sales', role: 'Member', plan: 'Growth', seats: '20/25' }
  ]);
  const [activeWorkspace, setActiveWorkspace] = useState(workspaces[0]);

  // Date Range filter
  const [dateRange, setDateRange] = useState('30d'); // '7d' | '30d' | 'quarter' | 'ytd'

  // Core Data States
  const linked = linkCRMRecords(store.data);
  const companies = linked.companies;
  const setCompanies = value => store.set('companies', value);
  const contacts = linked.contacts;
  const setContacts = value => store.set('contacts', value);
  const leads = store.data.leads;
  const setLeads = value => store.set('leads', value);
  const deals = linked.deals;
  const setDeals = value => store.set('deals', value);
  const tasks = store.data.tasks;
  const setTasks = value => store.set('tasks', value);
  const activities = store.data.activities;
  const setActivities = value => store.set('activities', value);
  const automations = store.data.automations;
  const setAutomations = value => store.set('automations', value);
  const notifications = store.data.notifications;
  const setNotifications = value => store.set('notifications', value);
  // Satış ekibi, Personel Yönetimi'ndeki aktif kadrodan gelir; böylece fırsat
  // sahipleri ve görev atamaları gerçek çalışanlara bağlanır.
  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    let active = true;
    api.get('/workspaces/hr')
      .then(({ data }) => { if (active) setEmployees(data?.data?.employees || []); })
      .catch(() => {}); // Görüntüleme yetkisindeki kullanıcılar personel listesini okuyamaz.
    return () => { active = false; };
  }, []);
  const teamMembers = useMemo(
    () => buildTeam(employees, store.data.deals, store.data.tasks, store.data.leads),
    [employees, store.data.deals, store.data.tasks, store.data.leads]
  );
  const analytics = useMemo(() => buildAnalytics(store.data.deals, store.data.leads, teamMembers), [store.data.deals, store.data.leads, teamMembers]);

  // Global Modals & Command Palette State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateType, setQuickCreateType] = useState('deal'); // 'deal' | 'lead' | 'contact' | 'task'
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Pinned favorites & Recent navigation items
  const [pinnedItems, setPinnedItems] = useState([
    { id: 'pin-1', name: 'Stripe Global Enterprise', type: 'deal', link: '/crm/deals' },
    { id: 'pin-2', name: 'Guillermo Rauch', type: 'contact', link: '/crm/contacts' },
    { id: 'pin-3', name: 'Q3 Enterprise Forecast', type: 'report', link: '/crm/analytics' }
  ]);

  const [recentItems, setRecentItems] = useState([
    { id: 'rec-1', name: 'Cyberdyne Systems (Lead)', link: '/crm/leads' },
    { id: 'rec-2', name: 'Figma Renewal Deal', link: '/crm/deals' },
    { id: 'rec-3', name: 'David Singleton', link: '/crm/contacts' }
  ]);

  // Sync Dark Mode with <html> tag
  useEffect(() => {
    localStorage.setItem('crm_dark_mode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Global Keyboard Shortcuts (CMD+K / CTRL+K, N for new, Esc)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }

      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsQuickCreateOpen(false);
        setIsNotificationDrawerOpen(false);
        setIsHelpModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- CRUD ACTIONS ---

  // Deals Management
  const addDeal = (newDeal) => {
    const deal = {
      id: crypto.randomUUID(),
      probability: newDeal.stage === 'won' ? 100 : newDeal.stage === 'lost' ? 0 : 50,
      lastActivity: 'Just now',
      tags: newDeal.tags || ['Enterprise'],
      pipelineId: 'pipe-enterprise',
      createdAt: new Date().toISOString(),
      ...newDeal
    };
    if (['won', 'lost'].includes(deal.stage)) deal.closedAt = deal.createdAt;
    setDeals([deal, ...deals]);

    // Log Activity
    logActivity({
      type: 'stage_change',
      title: `New Deal Created: ${deal.title} ($${Number(deal.value).toLocaleString()})`,
      description: `Assigned to ${deal.salesRep || 'Atanmadı'} at ${deal.companyName || 'Unknown Company'}`,
      relatedObject: deal.title,
      badgeColor: 'info'
    });
  };

  const updateDealStage = (dealId, newStage) => {
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id === dealId) {
          const probability = newStage === 'won' ? 100 : newStage === 'lost' ? 0 : d.probability;
          return {
            ...d,
            stage: newStage,
            probability,
            closedAt: ['won', 'lost'].includes(newStage) ? new Date().toISOString() : null,
            lastActivity: 'Just now'
          };
        }
        return d;
      })
    );

    const deal = deals.find((d) => d.id === dealId);
    if (deal) {
      logActivity({
        type: newStage === 'won' ? 'deal_won' : 'stage_change',
        title: `Deal Moved to ${newStage.toUpperCase().replace('_', ' ')}: ${deal.title}`,
        description: `Stage updated by Atanmadı. New probability: ${newStage === 'won' ? '100%' : 'Updated'}.`,
        relatedObject: deal.companyName,
        badgeColor: newStage === 'won' ? 'success' : newStage === 'lost' ? 'danger' : 'purple'
      });
    }
  };

  const deleteDeal = (dealId) => {
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
  };

  // Leads Management
  const addLead = (newLead) => {
    const lead = {
      id: crypto.randomUUID(),
      score: 0,
      status: 'new',
      lastActivity: 'Just now',
      createdDate: new Date().toISOString().slice(0, 10),
      ...newLead
    };
    setLeads([lead, ...leads]);

    logActivity({
      type: 'automation',
      title: `New Lead Ingested: ${lead.name} (${lead.company})`,
      description: `Lead Score calculated at ${lead.score}. Source: ${lead.source}.`,
      relatedObject: lead.company,
      badgeColor: 'purple'
    });
  };

  const updateLeadStatus = (leadId, newStatus) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus, lastActivity: 'Just now' } : l))
    );
  };

  const deleteLead = (leadId) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  };

  // Contacts Management
  const addContact = (newContact) => {
    const contact = {
      id: crypto.randomUUID(),
      contactStatus: 'Active Opportunity',
      owner: 'Atanmadı',
      leadScore: 0,
      notesCount: 0,
      dealsCount: 0,
      totalDealValue: 0,
      lastContacted: 'Just now',
      createdDate: new Date().toISOString().slice(0, 10),
      ...newContact
    };
    setContacts(prev => [contact, ...prev]);
  };

  // Companies Management
  const addCompany = (newCompany) => {
    const comp = {
      id: crypto.randomUUID(),
      healthStatus: 'healthy',
      accountOwner: 'Atanmadı',
      openDealsCount: 0,
      openDealsValue: 0,
      lastActivity: 'Just now',
      createdDate: new Date().toISOString().slice(0, 10),
      ...newCompany
    };
    setCompanies(prev => [comp, ...prev]);
  };

  // Tasks Management
  const addTask = (newTask) => {
    const task = {
      id: crypto.randomUUID(),
      status: 'todo',
      assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80',
      tags: ['General'],
      ...newTask
    };
    setTasks([task, ...tasks]);
  };

  const toggleTaskStatus = (taskId) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const nextStatus = t.status === 'completed' ? 'todo' : 'completed';
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  const deleteTask = (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // Activities Logging
  const logActivity = ({ type, title, description, relatedObject, badgeColor = 'info' }) => {
    const newAct = {
      id: crypto.randomUUID(),
      type: type || 'note',
      title,
      timestamp: new Date().toISOString(),
      user: 'Atanmadı',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80',
      description,
      relatedObject,
      badgeColor
    };
    setActivities(prev => [newAct, ...prev]);
  };

  // Notifications
  const markNotificationAsRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Automations Toggle
  const toggleAutomation = (id) => {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  return (
    <CRMContext.Provider
      value={{
        // Theme & Workspace
        darkMode,
        setDarkMode,
        workspaces,
        activeWorkspace,
        setActiveWorkspace,
        dateRange,
        setDateRange,

        // Data collections
        companies,
        contacts,
        leads,
        deals,
        tasks,
        activities,
        automations,
        notifications,
        teamMembers,
        revenueTimeline: analytics.revenueTimeline,
        pipelineStageSummary: analytics.pipelineStageSummary,
        funnelStages: analytics.funnelStages,

        flushChanges: store.flush,
        saving: store.saving,
        // Actions
        addDeal,
        updateDealStage,
        deleteDeal,
        addLead,
        updateLeadStatus,
        deleteLead,
        addContact,
        addCompany,
        addTask,
        toggleTaskStatus,
        deleteTask,
        logActivity,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        toggleAutomation,

        // Modals & Navigation
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isQuickCreateOpen,
        setIsQuickCreateOpen,
        quickCreateType,
        setQuickCreateType,
        isNotificationDrawerOpen,
        setIsNotificationDrawerOpen,
        isHelpModalOpen,
        setIsHelpModalOpen,
        pinnedItems,
        setPinnedItems,
        recentItems,
        setRecentItems
      }}
    >
      {store.error && <div role="alert" className="p-3 bg-red-50 text-red-700">{store.error} <button onClick={store.reload}>Yeniden yükle</button></div>}
      {store.saving && <div role="status" className="px-4 py-2 text-sm">Değişiklikler kaydediliyor…</div>}
      {store.loading ? <p className="p-4">Kayıtlar yükleniyor…</p> : children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
};
