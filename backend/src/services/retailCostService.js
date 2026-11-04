// Amounts are integer cents. Sales snapshots are never repriced from today's catalog.
const SCALE = 1000000;
const round = (n, d) => Number((BigInt(n) + BigInt(d) / 2n) / BigInt(d));
const qty = v => Math.round(Number(v) * SCALE);
const vatValid = require('./retailVatService').validRate;
const ex = (cents, vat) => round(BigInt(cents) * 100n, 100 + Number(vat));
function unit(price, basis, vat) {
  if (price == null || !Number.isFinite(Number(price)) || Number(price) < 0 || Number(price) > 1000000 || !['exclusive', 'inclusive'].includes(basis) || !vatValid(vat)) return null;
  const cents = Math.round(Number(price) * 100),
    rate = Number(vat);
  return basis === 'exclusive' ? {
    net: cents * SCALE,
    inc: round(BigInt(cents) * BigInt(SCALE) * (100n + BigInt(rate)), 100)
  } : {
    inc: cents * SCALE,
    net: round(BigInt(cents) * BigInt(SCALE) * 100n, 100 + rate)
  };
}
async function snapshot(tx, tenant, line) {
  const p = (await tx.query('SELECT category,purchase_price,purchase_price_tax_basis,kdv_orani FROM products WHERE id=$1 AND tenant_id=$2', [line.product_id, tenant])).rows[0];
  line.category = p.category || 'Genel';
  line.vat_rate = vatValid(p.kdv_orani) ? Number(p.kdv_orani) : null;
  line.gross_ex_vat_cents = line.vat_rate === null ? null : ex(line.gross_cents, line.vat_rate);
  line.net_ex_vat_cents = line.vat_rate === null ? null : ex(line.net_cents, line.vat_rate);
  line.discount_ex_vat_cents = line.vat_rate === null ? null : line.gross_ex_vat_cents - line.net_ex_vat_cents;
  line.refunded_ex_vat_cents = 0;
  line.vat_version = 1;
  const parts = [];
  for (const a of line.lot_allocations) {
    let u = null,
      method = 'unknown';
    if (a.lot_id) {
      const receipts = (await tx.query(`SELECT i.received_qty,i.unit_purchase_price,i.purchase_price_tax_basis,i.purchase_vat_rate FROM wms_inbound_items i JOIN inventory_lots l ON l.id=i.lot_id AND l.tenant_id=i.tenant_id WHERE i.tenant_id=$1 AND i.product_id=$2 AND l.lot_number=$3 AND i.status='completed'`, [tenant, line.product_id, a.lot_number])).rows;
      const units = receipts.map(r => unit(r.unit_purchase_price, r.purchase_price_tax_basis, r.purchase_vat_rate));
      if (receipts.length && units.every(Boolean)) {
        const total = receipts.reduce((s, r) => s + BigInt(qty(r.received_qty)), 0n);
        if (total > 0n) u = {
          net: round(receipts.reduce((s, r, i) => s + BigInt(units[i].net) * BigInt(qty(r.received_qty)), 0n), total),
          inc: round(receipts.reduce((s, r, i) => s + BigInt(units[i].inc) * BigInt(qty(r.received_qty)), 0n), total)
        };
        method = 'lot_receipt_weighted_average';
      }
    } else {
      u = unit(p.purchase_price, p.purchase_price_tax_basis, p.kdv_orani);
      method = 'product_purchase_at_sale';
    }
    const amount = v => round(BigInt(v) * BigInt(qty(a.quantity)), BigInt(SCALE) * BigInt(SCALE));
    parts.push({
      lot_id: a.lot_id,
      lot_number: a.lot_number || null,
      quantity: a.quantity,
      returned_quantity: 0,
      known: !!u,
      method: u ? method : 'unknown',
      cost_ex_vat_cents: u ? amount(u.net) : null,
      cost_inc_vat_cents: u ? amount(u.inc) : null
    });
  }
  line.cost_snapshot = {
    version: 1,
    parts
  };
}
function reversal(line, quantity, totalQty) {
  const cumulativeGross=Math.min(line.net_cents,round(BigInt(line.net_cents)*BigInt(qty(totalQty)),qty(line.quantity)));
  const netEx = line.net_ex_vat_cents == null ? null : line.vat_version===1
    ? cumulativeGross-(line.net_cents?round(BigInt(line.net_cents-line.net_ex_vat_cents)*BigInt(cumulativeGross),line.net_cents):0)
    : round(BigInt(line.net_ex_vat_cents) * BigInt(qty(totalQty)), qty(line.quantity));
  const refundEx = netEx === null ? null : netEx - (line.refunded_ex_vat_cents || 0);
  if (netEx !== null) line.refunded_ex_vat_cents = netEx;
  let left = quantity;
  const parts = [];
  for (const p of line.cost_snapshot?.parts || []) {
    const take = Math.min(left, p.quantity - p.returned_quantity);
    if (take <= 0) continue;
    const before = p.returned_quantity,
      after = Number((before + take).toFixed(6));
    const delta = amount => round(BigInt(amount) * BigInt(qty(after)), qty(p.quantity)) - round(BigInt(amount) * BigInt(qty(before)), qty(p.quantity));
    parts.push({
      lot_id: p.lot_id,
      quantity: take,
      known: p.known,
      method: p.method,
      cost_ex_vat_cents: p.known ? delta(p.cost_ex_vat_cents) : null,
      cost_inc_vat_cents: p.known ? delta(p.cost_inc_vat_cents) : null
    });
    p.returned_quantity = after;
    left = Number((left - take).toFixed(6));
  }
  return {
    refund_ex_vat_cents: refundEx,
    cost_parts: parts,
    cost_version: line.cost_snapshot?.version || null
  };
}
module.exports = {
  snapshot,
  reversal,
  ex,
  vatValid
};
