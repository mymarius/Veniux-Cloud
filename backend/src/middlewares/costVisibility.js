// Existing admin/manager roles own commercial cost visibility. Apply at the
// response boundary so nested lot data and serialized sale snapshots cannot
// accidentally bypass the same rule used by the gross-profit endpoint.
const hidden = new Set(['purchase_price', 'unit_purchase_price', 'purchase_price_tax_basis', 'purchase_vat_rate', 'cost_price', 'unit_cost', 'unit_cost_cents', 'cost_cents', 'cost_basis', 'inventory_value', 'stock_valuation', 'total_warehouse_value', 'total_valuation', 'total_value', 'cost_snapshot', 'gross_profit', 'gross_profit_cents']);
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || Object.prototype.toString.call(value) !== '[object Object]') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (hidden.has(key) || /^(cost_|known_cost_|unknown_cost_|has_unknown_cost|gross_profit_|blocked_return_cost_)/.test(key)) continue;
    if (key.endsWith('_json') && typeof item === 'string') {
      try { result[key] = JSON.stringify(redact(JSON.parse(item))); } catch { result[key] = item; }
    } else result[key] = redact(item);
  }
  return result;
}
module.exports = function costVisibility(req, res) {
  if (['admin', 'manager'].includes(req.user.role)) return;
  const json = res.json.bind(res);
  res.json = value => json(redact(value));
};
module.exports.redact = redact;
