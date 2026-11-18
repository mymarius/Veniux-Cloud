// Varyantlı ürünler "Ad · Beden · Renk" adıyla açılır; bu adlardan grup ve beden/renk tablosu çıkarılır.
export const SEP = ' · ';

export function parseVariant(name) {
  const parts = String(name || '').split(SEP).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return { base: parts[0], size: parts[1], color: parts[2] || null };
}

// En az iki çeşidi olan taban adlar grup sayılır; tek başına kalan ürün normal ürün gibi görünür.
export function groupVariants(products) {
  const byBase = new Map();
  for (const p of products || []) {
    const v = parseVariant(p.name);
    if (!v) continue;
    if (!byBase.has(v.base)) byBase.set(v.base, []);
    byBase.get(v.base).push({ ...v, id: p.id, sku: p.sku, qty: Number(p.total_quantity || 0), price: Number(p.sale_price || 0) });
  }
  const groups = [];
  for (const [base, rows] of byBase) {
    if (rows.length < 2) continue;
    const hasColor = rows.some(r => r.color);
    groups.push({ base, rows, hasColor, total: rows.reduce((s, r) => s + r.qty, 0),
      sizes: [...new Set(rows.map(r => r.size))], colors: hasColor ? [...new Set(rows.map(r => r.color || '-'))] : [] });
  }
  return groups;
}

// Liste için: grup üyeleri tek satıra iner, diğer ürünler olduğu gibi kalır.
export function collapseVariants(products) {
  const groups = groupVariants(products), members = new Set(groups.flatMap(g => g.rows.map(r => r.id)));
  const seen = new Set(), out = [];
  for (const p of products || []) {
    if (!members.has(p.id)) { out.push(p); continue; }
    const g = groups.find(x => x.rows.some(r => r.id === p.id));
    if (seen.has(g.base)) continue;
    seen.add(g.base);
    out.push({ id: 'grup:' + g.base, name: g.base, sku: g.rows.length + ' çeşit', category: p.category, unit: 'adet', total_quantity: g.total, min_stock_level: 0, __group: g });
  }
  return out;
}

export function cellQty(group, size, color) {
  const r = group.rows.find(x => x.size === size && (group.hasColor ? (x.color || '-') === color : true));
  return r ? r.qty : null;
}
