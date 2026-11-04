import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Kanban,
  UserPlus,
  Users,
  Building2,
  CheckSquare,
  Activity,
  Calendar,
  BarChart3,
  Zap,
  ShieldCheck,
  Settings,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  Bell,
  Sun,
  Moon,
  HelpCircle,
  LogOut,
  Command,
  Bookmark,
  Clock,
  Sparkles,
  ExternalLink,
  SlidersHorizontal,
  ChevronLeft,
  X,
  Menu
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import CommandPalette from './CommandPalette';
import QuickCreateModal from './QuickCreateModal';
import NotificationDrawer from './NotificationDrawer';

export default function CRMLayout({ children }) {
  const {
    darkMode,
    setDarkMode,
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    dateRange,
    setDateRange,
    notifications,
    setIsCommandPaletteOpen,
    setIsQuickCreateOpen,
    setQuickCreateType,
    setIsNotificationDrawerOpen,
    pinnedItems,
    recentItems
  } = useCRM();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [quickCreateDropdownOpen, setQuickCreateDropdownOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  const navigationGroups = [
    {
      title: 'CORE CRM',
      items: [
        { name: 'Dashboard', path: '/crm/dashboard', icon: LayoutDashboard },
        { name: 'Sales Pipeline', path: '/crm/deals', icon: Kanban, badge: 'Hot' },
        { name: 'Leads', path: '/crm/leads', icon: UserPlus },
        { name: 'Contacts', path: '/crm/contacts', icon: Users },
        { name: 'Companies', path: '/crm/companies', icon: Building2 }
      ]
    },
    {
      title: 'EXECUTION & TASKS',
      items: [
        { name: 'Tasks & Follow-ups', path: '/crm/tasks', icon: CheckSquare },
        { name: 'Activity Timeline', path: '/crm/activities', icon: Activity }
      ]
    },
    {
      title: 'INTELLIGENCE & SCALE',
      items: [
        { name: 'Reports & Analytics', path: '/crm/analytics', icon: BarChart3 },
        { name: 'Workflow Automations', path: '/crm/automations', icon: Zap },
        { name: 'Sales Team', path: '/crm/team', icon: ShieldCheck },
        { name: 'Settings', path: '/crm/settings', icon: Settings }
      ]
    }
  ];

  const getBreadcrumbTitle = () => {
    const p = location.pathname;
    if (p.includes('/deals')) return 'Sales Pipeline & Deals';
    if (p.includes('/leads')) return 'Lead Management';
    if (p.includes('/contacts')) return 'Contacts Directory';
    if (p.includes('/companies')) return 'Enterprise Companies';
    if (p.includes('/tasks')) return 'Task Management';
    if (p.includes('/activities')) return 'Activity Timeline';
    if (p.includes('/analytics')) return 'Executive Analytics & Reports';
    if (p.includes('/automations')) return 'Workflow Automation Center';
    if (p.includes('/team')) return 'Sales Team Leaderboard';
    if (p.includes('/settings')) return 'Workspace Settings';
    return 'Executive Overview';
  };

  return (
    <div className="flex h-screen bg-gray-100 text-gray-900 overflow-hidden font-sans select-none antialiased">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed md:sticky top-0 h-screen z-50 flex flex-col justify-between transition-all duration-200 bg-white/90 backdrop-blur-xl border-r border-gray-200 shrink-0 ${
          sidebarCollapsed ? 'w-[68px]' : 'w-64'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Top Header & Workspace Switcher */}
        <div className="flex flex-col">
          {/* Logo Bar */}
          <div className="h-14 flex items-center justify-between px-3.5 border-b border-gray-200 bg-white">
            <div
              className="flex items-center gap-2.5 overflow-hidden cursor-pointer"
              onClick={() => navigate('/crm/dashboard')}
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-500 to-amber-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm shadow-brand-500/30">
                V
              </div>
              {!sidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm tracking-tight text-gray-900 leading-tight font-mono">
                    VENIUX <span className="text-brand-500 text-[10px] font-mono font-bold ml-1 bg-brand-50 px-1.5 py-0.5 rounded-full border border-brand-200/60">CRM</span>
                  </span>
                  <span className="text-[9px] text-gray-400 font-mono truncate uppercase mt-0.5">Enterprise Edition</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex p-1.5 text-gray-400 hover:text-gray-900 rounded-full hover:bg-gray-100 transition"
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform duration-200 ${sidebarCollapsed ? '' : 'rotate-180'}`}
              />
            </button>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1.5 text-gray-400 hover:text-gray-900 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Workspace Switcher */}
          {!sidebarCollapsed && (
            <div className="p-2.5 border-b border-gray-200 relative">
              <button
                type="button"
                onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-gray-50/80 hover:border-brand-500/50 border border-gray-200/80 text-left transition group shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-brand-50 border border-brand-500/20 text-brand-500 font-bold text-[10px] flex items-center justify-center shrink-0">
                    {activeWorkspace.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11.5px] font-bold text-gray-900 truncate">{activeWorkspace.name}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{activeWorkspace.plan}</div>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-900 transition" />
              </button>

              {/* Workspace Dropdown */}
              {workspaceDropdownOpen && (
                <div className="absolute top-full left-2.5 right-2.5 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-1 text-xs space-y-0.5 animate-fade-in">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Switch Workspace
                  </div>
                  {workspaces.map((ws) => (
                    <div
                      key={ws.id}
                      onClick={() => {
                        setActiveWorkspace(ws);
                        setWorkspaceDropdownOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-md cursor-pointer flex items-center justify-between transition ${
                        ws.id === activeWorkspace.id
                          ? 'bg-brand-500 text-white font-semibold'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <span className="truncate">{ws.name}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        ws.id === activeWorkspace.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {ws.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Main Navigation */}
          <nav className="p-2 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)]">
            {navigationGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-0.5">
                {!sidebarCollapsed && (
                  <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono">
                    {group.title}
                  </div>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all group ${
                          isActive
                            ? 'bg-brand-500 text-white font-semibold shadow-md shadow-primary/20'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                        }`
                      }
                      title={sidebarCollapsed ? item.name : undefined}
                    >
                      <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                        location.pathname === item.path ? 'text-white' : 'text-gray-500 group-hover:text-brand-500'
                      }`} />
                      {!sidebarCollapsed && <span className="flex-1 truncate">{item.name}</span>}
                      {!sidebarCollapsed && item.badge && (
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full leading-none ${
                          location.pathname === item.path
                            ? 'bg-white/20 text-white'
                            : 'bg-red-50 text-red-500 border border-danger/30'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}

            {/* Pinned Favorites Section */}
            {!sidebarCollapsed && pinnedItems.length > 0 && (
              <div className="pt-2 border-t border-gray-200 space-y-1">
                <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono flex items-center gap-1">
                  <Bookmark className="w-3 h-3 text-yellow-600" /> Pinned Items
                </div>
                {pinnedItems.map((pin) => (
                  <div
                    key={pin.id}
                    onClick={() => navigate(pin.link)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer flex items-center justify-between group transition"
                  >
                    <span className="truncate">{pin.name}</span>
                    <span className="text-[9px] uppercase font-mono text-gray-500 opacity-0 group-hover:opacity-100 transition">
                      {pin.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </nav>
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-gray-200 bg-white">
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-gray-100 border border-gray-200">
              <div className="flex items-center gap-2 min-w-0 pl-1">
                <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center font-bold text-xs shrink-0">
                  SJ
                </div>
                <div className="min-w-0 text-left">
                  <div className="text-xs font-bold text-gray-900 truncate">Sarah Jenkins</div>
                  <div className="text-[10px] text-gray-500 font-mono truncate uppercase">Lead AE • Online</div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-1.5 text-gray-500 hover:text-brand-500 rounded-lg hover:bg-white transition"
                  title={darkMode ? 'Light Mode' : 'Dark Mode'}
                >
                  {darkMode ? <Sun className="w-3.5 h-3.5 text-yellow-600" /> : <Moon className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div
                className="w-8 h-8 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer"
                onClick={() => setDarkMode(!darkMode)}
                title="Sarah Jenkins (Click to toggle theme)"
              >
                SJ
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden bg-gray-100">
        {/* Top Navbar */}
        <header className="h-14 sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-4 md:px-6 flex items-center justify-between shadow-sm">
          {/* Left: Mobile Toggle & Breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <span className="font-semibold text-gray-900">{activeWorkspace.name}</span>
              <span className="text-border">/</span>
              <span className="text-brand-500 font-semibold">{getBreadcrumbTitle()}</span>
            </div>
          </div>

          {/* Center: Command Palette Trigger Button */}
          <div className="hidden lg:flex items-center max-w-md w-full mx-4">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-xs text-gray-500 hover:text-gray-900 hover:border-brand-500/50 transition shadow-sm group"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-gray-500 group-hover:text-brand-500 transition" />
                <span>Search deals, contacts, companies...</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px]">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-500">
                  Ctrl+K
                </kbd>
              </div>
            </button>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Date Range Selector */}
            <div className="hidden sm:flex items-center gap-1 p-0.5 rounded-lg bg-gray-100 border border-gray-200 text-[11px] font-semibold font-mono">
              {[
                { id: '7d', label: '7D' },
                { id: '30d', label: '30D' },
                { id: 'quarter', label: 'QTR' },
                { id: 'ytd', label: 'YTD' }
              ].map((range) => (
                <button
                  key={range.id}
                  onClick={() => setDateRange(range.id)}
                  className={`px-2.5 py-1 rounded transition ${
                    dateRange === range.id
                      ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>

            {/* Quick Create Dropdown */}
            <div className="relative">
              <button
                onClick={() => setQuickCreateDropdownOpen(!quickCreateDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-500-hover text-white text-xs font-semibold shadow-md shadow-primary/20 transition font-mono"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Oluştur</span>
                <ChevronDown className="w-3 h-3 opacity-80" />
              </button>

              {quickCreateDropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-xl shadow-xl py-1 text-xs z-50 animate-fade-in font-medium">
                  <button
                    onClick={() => {
                      setQuickCreateType('deal');
                      setIsQuickCreateOpen(true);
                      setQuickCreateDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-gray-900 hover:bg-gray-100 flex items-center gap-2 transition"
                  >
                    <Kanban className="w-4 h-4 text-brand-500" /> New Deal
                  </button>
                  <button
                    onClick={() => {
                      setQuickCreateType('lead');
                      setIsQuickCreateOpen(true);
                      setQuickCreateDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-gray-900 hover:bg-gray-100 flex items-center gap-2 transition"
                  >
                    <UserPlus className="w-4 h-4 text-green-600" /> New Lead
                  </button>
                  <button
                    onClick={() => {
                      setQuickCreateType('contact');
                      setIsQuickCreateOpen(true);
                      setQuickCreateDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-gray-900 hover:bg-gray-100 flex items-center gap-2 transition"
                  >
                    <Users className="w-4 h-4 text-yellow-600" /> New Contact
                  </button>
                  <button
                    onClick={() => {
                      setQuickCreateType('task');
                      setIsQuickCreateOpen(true);
                      setQuickCreateDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-gray-900 hover:bg-gray-100 flex items-center gap-2 transition"
                  >
                    <CheckSquare className="w-4 h-4 text-red-500" /> New Task
                  </button>
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => setIsNotificationDrawerOpen(true)}
              className="p-2 text-gray-500 hover:text-brand-500 bg-gray-100 rounded-lg transition relative border border-gray-200 shadow-sm"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-bg" />
              )}
            </button>
          </div>
        </header>

        {/* Dynamic Page Container */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
          {children}
        </main>
      </div>

      {/* Global Modals */}
      <CommandPalette />
      <QuickCreateModal />
      <NotificationDrawer />
    </div>
  );
}
