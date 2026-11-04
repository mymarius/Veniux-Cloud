// Warehouse and bin records describe overlapping stock, not additive quantities.
export function summarizeProductStock(product, breakdown = {}) {
  const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const quantity = Array.isArray(product.warehouse_stocks)
    ? product.warehouse_stocks.reduce((sum, row) => sum + numeric(row.quantity), 0)
    : numeric(breakdown.on_hand);
  const reserved = numeric(breakdown.reserved);
  return {
    total_quantity: quantity,
    available_quantity: Math.max(0, quantity - reserved),
    total_reserved: reserved,
    location_count: breakdown.locations?.length ?? 0
  };
}
