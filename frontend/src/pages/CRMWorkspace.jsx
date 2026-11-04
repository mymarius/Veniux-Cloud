import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import CRMDirectory from '../components/crm/workspace/CRMDirectory';
import CRMCharts from '../components/crm/workspace/CRMCharts';
import './BusinessDashboard.css';
import {
  BarChart3, Bell, Building2, ClipboardList, Handshake, LayoutDashboard,
  Plus, UserPlus, Users, Zap
} from 'lucide-react';
import { CRMProvider, useCRM } from '../context/CRMContext';
import { CrmOverview, CrmDeals, CrmLeads } from '../components/crm/workspace/CrmSections';
import CrmTasks from '../components/crm/workspace/CrmTasks';
import CrmAnalytics from '../components/crm/workspace/CrmAnalytics';
import CrmAutomations from '../components/crm/workspace/CrmAutomations';
import CrmNotifications from '../components/crm/workspace/CrmNotifications';
import CrmCreateModal from '../components/crm/workspace/CrmCreateModal';
import { ContactDrawer, CompanyDrawer } from '../components/crm/workspace/CrmDetailDrawer';
import StaffModule from '../components/crm/workspace/StaffModule';
import { useToast } from '../components/Toast';

const CRM_TABS = [
  { id: 'panel', label: 'CRM Paneli', icon: LayoutDashboard },
  { id: 'firsatlar', label: 'Fırsatlar', icon: Handshake },
  { id: 'adaylar', label: 'Aday Müşteriler', icon: UserPlus },
  { id: 'hesaplar', label: 'Şirketler', icon: Building2 },
  { id: 'kisiler', label: 'Kişiler', icon: Users },
  { id: 'aktiviteler', label: 'Aktiviteler', icon: ClipboardList },
  { id: 'gorevler', label: 'Görevler', icon: ClipboardList },
  { id: 'analitik', label: 'Analitik', icon: BarChart3 },
  { id: 'otomasyon', label: 'Otomasyon', icon: Zap },
  { id: 'personel', label: 'Personel Yönetimi', icon: Users }
];

const SUBTITLE = {
  panel: 'Müşteri ilişkilerinizin özeti ve satış performansınız',
  kisiler: 'İletişim kişileri, şirket bağlantıları ve müşteri detayları',
  aktiviteler: 'Müşteri görüşmeleri ve ekibinizin son hareketleri',
  firsatlar: 'Açık fırsatlar, aşama takibi ve tahmin',
  adaylar: 'Aday müşteri havuzu ve niteleme durumu',
  hesaplar: 'Kurumsal hesaplar ve yetkili kişiler',
  gorevler: 'Ekip görevleri, terminler ve öncelikler',
  analitik: 'Gelir, huni, kota ve dönüşüm analizi',
  otomasyon: 'Kurallar, bildirim tercihleri ve pipeline tanımları',
  personel: 'Kadro, vardiya, izin ve performans yönetimi'
};

/** Sekmeye göre "Yeni" butonunun varsayılan kayıt tipi. */
const DEFAULT_CREATE = {
  panel: 'deal',
  firsatlar: 'deal',
  adaylar: 'lead',
  hesaplar: 'company',
  kisiler: 'contact',
  gorevler: 'task'
};

const CREATED_LABEL = {
  deal: 'Fırsat oluşturuldu.',
  lead: 'Aday müşteri eklendi.',
  contact: 'Kişi kaydı oluşturuldu.',
  company: 'Şirket hesabı açıldı.',
  task: 'Görev oluşturuldu.'
};

const CRM_PATHS = { panel: 'dashboard', firsatlar: 'deals', adaylar: 'leads', hesaplar: 'companies', kisiler: 'contacts', aktiviteler: 'activities', gorevler: 'tasks', analitik: 'analytics', otomasyon: 'automations', personel: 'team' };
function WorkspaceInner() {
  const { section = 'dashboard', id } = useParams();
  const navigate = useNavigate();
  const tab = Object.keys(CRM_PATHS).find(key => CRM_PATHS[key] === section);
  const { deals, leads, companies, tasks, notifications } = useCRM();
  const { showToast } = useToast();

  const [createType, setCreateType] = useState(null);
  const [contactId, setContactId] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const counts = useMemo(
    () => ({
      firsatlar: deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length,
      adaylar: leads.length,
      hesaplar: companies.length,
      gorevler: tasks.filter((t) => t.status !== 'completed').length
    }),
    [deals, leads, companies, tasks]
  );

  const goTab = (id) => navigate('/crm/' + (CRM_PATHS[id] || 'dashboard'));

  const openCreate = (type) => setCreateType(type || DEFAULT_CREATE[tab] || 'deal');
  const openContact = (id) => { setCompanyId(null); setContactId(id); };

  if (!tab) return <Navigate to="/crm/dashboard" replace />;
  return (
    <div className="crm-pages animate-fade-in space-y-5 pb-10" data-testid="page-crm-workspace">
      {/* Sayfa başlığı */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
              MÜŞTERİ İLİŞKİLERİ / VENIUX
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">
            {CRM_TABS.find((t) => t.id === tab)?.label}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">{SUBTITLE[tab]}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setNotifOpen(true)}
            data-testid="button-crm-notifications"
            title="CRM bildirimleri"
            className="relative flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold tabular-nums text-white">
                {unreadCount}
              </span>
            )}
          </button>
          {DEFAULT_CREATE[tab] && (
            <button onClick={() => openCreate()} data-testid="button-crm-create" className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors">
              <Plus className="h-3.5 w-3.5" /> Yeni kayıt
            </button>
          )}
        </div>
      </div>

      <nav aria-label="CRM gezinme" className="crm-breadcrumb"><Link to="/dashboard">Operasyon merkezi</Link><span>/</span><Link to="/crm/dashboard">CRM</Link><span>/</span><strong>{CRM_TABS.find(t => t.id === tab)?.label}</strong></nav>
      {tab === 'panel' && <><CRMCharts /><div className="crm-page-links">{CRM_TABS.filter(t => ['firsatlar','adaylar','hesaplar','kisiler','gorevler','aktiviteler'].includes(t.id)).map(t => <Link key={t.id} to={'/crm/' + CRM_PATHS[t.id]}><t.icon size={18}/><span>{t.label}</span><strong>{counts[t.id] ?? '→'}</strong></Link>)}</div></>}
      {tab === 'panel' && <CrmOverview onGoTab={goTab} onCreate={openCreate} />}
      {tab === 'firsatlar' && <CrmDeals onCreate={openCreate} />}
      {tab === 'adaylar' && <CrmLeads onCreate={openCreate} />}
      {['hesaplar','kisiler','aktiviteler'].includes(tab) && <CRMDirectory key={tab} kind={tab} onCreate={openCreate} />}
      {section === 'companies' && id && <CompanyDrawer companyId={id} onClose={() => navigate('/crm/companies')} onOpenContact={contact => navigate('/crm/contacts/' + contact)} />}
      {section === 'contacts' && id && <ContactDrawer contactId={id} onClose={() => navigate('/crm/contacts')} />}
      {tab === 'gorevler' && <CrmTasks onCreate={openCreate} />}
      {tab === 'analitik' && <CrmAnalytics />}
      {tab === 'otomasyon' && <CrmAutomations />}
      {tab === 'personel' && <StaffModule />}

      <CrmCreateModal
        isOpen={!!createType}
        type={createType}
        onClose={() => setCreateType(null)}
        onCreated={(kind) => showToast(CREATED_LABEL[kind] || 'Kayıt oluşturuldu.', 'success')}
      />
      {contactId && <ContactDrawer contactId={contactId} onClose={() => setContactId(null)} />}
      {companyId && (
        <CompanyDrawer companyId={companyId} onClose={() => setCompanyId(null)} onOpenContact={openContact} />
      )}
      <CrmNotifications isOpen={notifOpen} onClose={() => setNotifOpen(false)} onGoTab={goTab} />
    </div>
  );
}

export default function CRMWorkspace() {
  return (
    <CRMProvider>
      <WorkspaceInner />
    </CRMProvider>
  );
}
