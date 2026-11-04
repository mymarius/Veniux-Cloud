import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Mail,
  Phone,
  Building2,
  ChevronRight,
  Download
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { DataTable, StatusBadge, Dropdown } from '../../components/ui';

export default function CRMContacts() {
  const { contacts, setIsQuickCreateOpen, setQuickCreateType } = useCRM();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('all');
  const navigate = useNavigate();

  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.companyName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCompany = selectedCompany === 'all' || c.companyName === selectedCompany;
    return matchesSearch && matchesCompany;
  });

  const exportContactsCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,Name,Title,Company,Email,Phone,Status,Owner\n' +
      filteredContacts
        .map((c) => `"${c.fullName}","${c.jobTitle}","${c.companyName}","${c.email}","${c.phone}","${c.contactStatus}","${c.owner}"`)
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'contacts_export.csv');
    document.body.appendChild(link);
    link.click();
  };

  const columns = [
    {
      key: 'contact',
      label: 'Contact',
      render: (row) => (
        <div className="flex items-center gap-3">
          <img
            src={row.avatar}
            alt={row.fullName}
            className="w-8 h-8 rounded-full object-cover ring-1 ring-border"
          />
          <div>
            <div className="font-bold text-gray-900 text-[12.5px] group-hover:text-brand-500 transition">{row.fullName}</div>
            <div className="text-[11px] text-gray-500">{row.jobTitle}</div>
          </div>
        </div>
      )
    },
    {
      key: 'company',
      label: 'Company',
      render: (row) => (
        <div className="flex items-center gap-1.5 font-semibold text-gray-900">
          <Building2 className="w-3.5 h-3.5 text-gray-500" />
          <span>{row.companyName}</span>
        </div>
      )
    },
    {
      key: 'comm',
      label: 'Communication',
      render: (row) => (
        <div className="space-y-0.5 font-mono text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {row.email}</div>
          <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {row.phone}</div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status="info" text={row.contactStatus} />
    },
    { key: 'owner', label: 'Owner', render: (row) => <span className="font-medium text-gray-500">{row.owner}</span> },
    { key: 'pipeline', label: 'Active Pipeline', align: 'right', render: (row) => <span className="font-mono font-semibold text-gray-900 tabular-nums">${row.totalDealValue?.toLocaleString() || 0}</span> },
    { key: 'last_contact', label: 'Last Contacted', align: 'right', render: (row) => <span className="font-mono text-gray-500">{row.lastContacted}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <button className="p-1 text-gray-500 hover:text-brand-500 transition">
          <ChevronRight className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">Contacts Directory</h1>
            <StatusBadge status="info" text={`${contacts.length} Decision Makers`} />
          </div>
          <p className="text-xs text-gray-500 mt-1">Enterprise stakeholder profiles, contact intelligence, and deal relationships.</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={exportContactsCSV} className="btn-secondary">
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button onClick={() => { setQuickCreateType('contact'); setIsQuickCreateOpen(true); }} className="btn-primary">
            <Plus className="w-3.5 h-3.5" />
            <span>New Contact</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white border border-gray-200 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search contacts, title, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-lg outline-none focus:border-brand-500 transition"
            />
          </div>

          <Dropdown
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg outline-none focus:border-brand-500 min-w-[160px]"
          >
            <option value="all">All Companies</option>
            <option value="Stripe, Inc.">Stripe, Inc.</option>
            <option value="Vercel Inc.">Vercel Inc.</option>
            <option value="Supabase Inc.">Supabase Inc.</option>
            <option value="Datadog, Inc.">Datadog, Inc.</option>
            <option value="Figma, Inc.">Figma, Inc.</option>
            <option value="Ramp Financial">Ramp Financial</option>
          </Dropdown>
        </div>
        <span className="text-gray-500 font-mono text-[11px] px-2">{filteredContacts.length} contacts listed</span>
      </div>

      {/* Contacts Table */}
      <DataTable 
        columns={columns}
        data={filteredContacts}
        onRowClick={(row) => navigate(`/crm/contacts/${row.id}`)}
        emptyState="No contacts found."
      />
    </div>
  );
}
