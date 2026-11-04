export function linkCRMRecords(data) {
  const deals = data.deals || [];
  const companies = (data.companies || []).map(company => {
    const related = deals.filter(deal => String(deal.companyId) === String(company.id));
    const open = related.filter(deal => !['won', 'lost'].includes(deal.stage));
    return { ...company, openDealsCount: open.length, openDealsValue: open.reduce((sum, deal) => sum + Number(deal.value || 0), 0) };
  });
  const contacts = (data.contacts || []).map(contact => {
    const company = companies.find(row => String(row.id) === String(contact.companyId));
    const related = company ? deals.filter(deal => String(deal.companyId) === String(company.id)) : [];
    return { ...contact, companyName: company?.name || contact.companyName || '', dealsCount: related.length, totalDealValue: related.reduce((sum, deal) => sum + Number(deal.value || 0), 0) };
  });
  return { companies, contacts, deals: deals.map(deal => ({ ...deal, companyName: companies.find(row => String(row.id) === String(deal.companyId))?.name || deal.companyName || 'Bağımsız fırsat' })) };
}
