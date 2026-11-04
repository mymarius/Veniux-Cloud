import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { DataTable, StatusBadge, Input, Select, Dropdown } from '../../components/ui';

export default function CRMCompanies() {
  const { companies, addCompany } = useCRM();
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');
  const navigate = useNavigate();

  const filteredCompanies = companies.filter((comp) => {
    const matchesSearch =
      !searchQuery ||
      comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesIndustry = industryFilter === 'all' || comp.industry.includes(industryFilter);
    const matchesHealth = healthFilter === 'all' || comp.healthStatus === healthFilter;
    return matchesSearch && matchesIndustry && matchesHealth;
  });

  const getHealthBadgeStatus = (status) => {
    switch (status) {
      case 'champion': return 'success';
      case 'healthy': return 'info';
      case 'at_risk': default: return 'danger';
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Company Name & Tier',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-500 font-bold flex items-center justify-center text-xs shrink-0 border border-brand-500/20">
            {row.name.charAt(0)}
          </div>
          <div>
            <div className="font-bold text-gray-900 text-[12.5px]">{row.name}</div>
            <div className="text-[11px] text-gray-500 font-mono">{row.tier}</div>
          </div>
        </div>
      )
    },
    { key: 'industry', label: 'Industry', render: (row) => <span className="font-medium text-gray-500">{row.industry}</span> },
    {
      key: 'headcount',
      label: 'Headcount / Location',
      render: (row) => (
        <div className="space-y-0.5 font-mono text-[11px]">
          <div className="text-gray-900">{row.employees}</div>
          <div className="text-gray-500 text-[10.5px]">{row.location}</div>
        </div>
      )
    },
    { key: 'revenue', label: 'Annual Revenue', render: (row) => <span className="font-mono font-bold text-gray-900">{row.annualRevenue}</span> },
    {
      key: 'health',
      label: 'Health Status',
      render: (row) => <StatusBadge status={getHealthBadgeStatus(row.healthStatus)} text={row.healthStatus.replace('_', ' ')} />
    },
    { key: 'owner', label: 'Account Owner', render: (row) => <span className="font-medium text-gray-500">{row.accountOwner}</span> },
    {
      key: 'pipeline',
      label: 'Active Pipeline',
      align: 'right',
      render: (row) => <span className="font-mono font-semibold text-gray-900 tabular-nums">${row.openDealsValue.toLocaleString()}</span>
    },
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
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">
              Enterprise Accounts & Companies
            </h1>
            <StatusBadge status="info" text={`${companies.length} Corporate Accounts`} />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Global account intelligence, health telemetry, and revenue expansion opportunities.
          </p>
        </div>

        <button
          onClick={() => {
            const name = prompt('Company Name:');
            if (name) {
              addCompany({
                name,
                industry: 'Enterprise Software',
                employees: '500+',
                annualRevenue: '$50M',
                location: 'San Francisco, CA',
                tier: 'Growth Scale'
              });
            }
          }}
          className="btn-primary"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Account</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white border border-gray-200">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search companies, industry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-500 transition"
            />
          </div>

          <Dropdown
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-500"
          >
            <option value="all">All Industries</option>
            <option value="Financial">Financial Infrastructure</option>
            <option value="Cloud">Cloud & Developer</option>
            <option value="Design">Collaborative Design</option>
            <option value="Product">Product Management</option>
          </Dropdown>

          <Dropdown
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-500"
          >
            <option value="all">All Health Scores</option>
            <option value="champion">Champion</option>
            <option value="healthy">Healthy</option>
            <option value="at_risk">At Risk</option>
          </Dropdown>
        </div>

        <span className="text-gray-500 font-mono text-[11px] px-2">
          {filteredCompanies.length} accounts listed
        </span>
      </div>

      {/* Companies Table */}
      <DataTable 
        columns={columns}
        data={filteredCompanies}
        onRowClick={(row) => navigate(`/crm/companies/${row.id}`)}
        emptyState="No accounts found matching criteria."
      />
    </div>
  );
}
