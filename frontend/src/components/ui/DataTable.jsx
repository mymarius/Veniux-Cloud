import React from 'react';
import { Inbox } from 'lucide-react';

const alignClass = (align) => (align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left');

export function DataTable({ 
  columns = [], 
  data = [], 
  onRowClick, 
  loading = false, 
  emptyState,
  emptyMessage,
  flush = false,
  className = ""
}) {
  const getHeader = (col) => {
    if (typeof col.header === 'function') return col.header();
    return col.header || col.label || col.title || '';
  };

  const renderCellContent = (col, row, rowIndex) => {
    // 1. Standard custom render function
    if (typeof col.render === 'function') {
      return col.render(row, rowIndex);
    }

    // 2. TanStack-style cell renderer
    if (typeof col.cell === 'function') {
      let value;
      if (typeof col.accessorFn === 'function') {
        value = col.accessorFn(row);
      } else if (col.accessorKey) {
        value = row[col.accessorKey];
      } else if (col.key) {
        value = row[col.key];
      } else {
        value = row;
      }

      const info = {
        getValue: () => value,
        row: { original: row, index: rowIndex },
        table: {},
        column: col
      };

      return col.cell(info);
    }

    // 3. Simple key/accessorKey lookup
    const key = col.accessorKey || col.key;
    if (key && row[key] !== undefined && row[key] !== null) {
      return String(row[key]);
    }

    return null;
  };

  const colCount = columns.length || 1;

  return (
    <div className={`vx-table-wrap ${flush ? 'vx-table-flush' : ''} ${className}`}>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="vx-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th 
                  key={col.id || col.accessorKey || col.key || idx} 
                  scope="col"
                  className={`${alignClass(col.align)} ${col.className || col.headerClassName || ''}`}
                >
                  {getHeader(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Skeleton rows keep the table's height stable while data loads.
              Array.from({ length: 4 }, (_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} aria-hidden="true">
                  {columns.map((col, colIndex) => (
                    <td key={col.id || col.accessorKey || col.key || colIndex}><span className="vx-table-skeleton" style={{ width: `${45 + ((rowIndex + colIndex) % 4) * 12}%` }} /></td>
                  ))}
                </tr>
              ))
            ) : data && data.length > 0 ? (
              data.map((row, rowIndex) => (
                <tr 
                  key={row.id || rowIndex} 
                  onClick={() => onRowClick && onRowClick(row)}
                  data-clickable={onRowClick ? '' : undefined}
                >
                  {columns.map((col, colIndex) => (
                    <td 
                      key={col.id || col.accessorKey || col.key || colIndex} 
                      className={`${alignClass(col.align)} ${col.cellClassName || ''}`}
                      data-label={typeof getHeader(col)==='string'?getHeader(col):undefined}
                    >
                      {renderCellContent(col, row, rowIndex)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr className="vx-table-empty-row">
                <td colSpan={colCount}>
                  <div className="vx-table-empty">
                    <span><Inbox size={18} /></span>
                    <p>{emptyMessage || emptyState || 'Kayıt bulunamadı.'}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {loading && <span className="sr-only" role="status">Veriler yükleniyor…</span>}
    </div>
  );
}
