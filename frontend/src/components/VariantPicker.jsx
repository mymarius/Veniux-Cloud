import { cellQty } from '../lib/variantGroups.mjs';

// Kasada beden/renk seçimi: tek dokunuşla doğru çeşit sepete girer. Stoğu bilinen ve biten çeşit sönük görünür.
export default function VariantPicker({ group, disabled, onPick }) {
  const colors = group.hasColor ? group.colors : [null];
  const rowOf = (size, color) => group.rows.find(r => r.size === size && (group.hasColor ? (r.color || '-') === color : true));
  return <div className="pos-variants" role="group" aria-label={group.base + ' çeşitleri'}>
    <table><thead><tr><th>{group.hasColor ? 'Beden' : 'Seçenek'}</th>{group.hasColor && colors.map(c => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{group.sizes.map(size => <tr key={size}><th>{size}</th>{colors.map(c => {
        const row = rowOf(size, c), qty = cellQty(group, size, c), out = qty !== null && qty <= 0;
        return <td key={c || 'x'}>{row ? <button type="button" disabled={disabled} data-out={out ? '1' : '0'} onClick={() => onPick(row)}><b>{qty === null ? 'Ekle' : qty}</b></button> : <span aria-hidden="true">—</span>}</td>;
      })}</tr>)}</tbody></table>
  </div>;
}
