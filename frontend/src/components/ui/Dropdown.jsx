import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

/**
 * Yerel <select> yerine geçen açılır menü.
 *
 * Aynı API ile çalışır: value / onChange / disabled / required / name ve
 * çocuk olarak <option> (ve <optgroup>) alır. onChange, mevcut çağrı
 * yerlerinin bozulmaması için { target: { value, name } } gönderir.
 *
 *   <Dropdown value={x} onChange={(e) => setX(e.target.value)}>
 *     <option value="1">Bir</option>
 *   </Dropdown>
 *
 * Menü document.body'ye portal ile basılır; böylece overflow-hidden olan
 * kart ve tablo kapsayıcıları menüyü kesmez.
 */

const SEARCH_THRESHOLD = 8;

const flatten = (children) => {
  const out = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === 'optgroup') {
      out.push({ group: true, label: child.props.label });
      React.Children.forEach(child.props.children, (opt) => {
        if (React.isValidElement(opt) && opt.type === 'option') {
          out.push({
            value: String(opt.props.value ?? ''),
            label: opt.props.children,
            disabled: !!opt.props.disabled
          });
        }
      });
      return;
    }
    if (child.type === 'option') {
      out.push({
        value: String(child.props.value ?? ''),
        label: child.props.children,
        disabled: !!child.props.disabled
      });
    }
  });
  return out;
};

const asText = (label) => {
  if (label == null || label === false) return '';
  if (typeof label === 'string' || typeof label === 'number') return String(label);
  if (Array.isArray(label)) return label.map(asText).join('');
  if (React.isValidElement(label)) return asText(label.props.children);
  return '';
};

export function Dropdown({
  value,
  defaultValue,
  onChange,
  children,
  className = '',
  menuClassName = '',
  disabled = false,
  required = false,
  name,
  id,
  placeholder = 'Seçiniz…',
  align = 'start',
  ...rest
}) {
  const items = useMemo(() => flatten(children), [children]);
  const options = useMemo(() => items.filter((i) => !i.group), [items]);

  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = useState(() => String(defaultValue ?? ''));
  const current = isControlled ? String(value ?? '') : innerValue;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(-1);
  const [rect, setRect] = useState(null);

  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  const selected = options.find((o) => o.value === current);
  const withSearch = options.length > SEARCH_THRESHOLD;

  const visible = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLocaleLowerCase('tr');
    return items.filter((i) => !i.group && asText(i.label).toLocaleLowerCase('tr').includes(q));
  }, [items, query]);

  const selectableIndexes = useMemo(
    () => visible.reduce((acc, i, idx) => (!i.group && !i.disabled ? acc.concat(idx) : acc), []),
    [visible]
  );

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const above = r.top;
    const wanted = Math.min(324, 52 + visible.length * 34);
    const dropUp = below < wanted && above > below;
    setRect({
      left: align === 'end' ? r.right : r.left,
      top: dropUp ? r.top - 6 : r.bottom + 6,
      width: r.width,
      dropUp,
      max: Math.max(160, (dropUp ? above : below) - 18)
    });
  }, [align, visible.length]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onMove = () => place();
    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const idx = visible.findIndex((i) => !i.group && i.value === current);
    setCursor(idx >= 0 ? idx : (selectableIndexes[0] ?? -1));
    if (withSearch) requestAnimationFrame(() => searchRef.current?.focus());
    else requestAnimationFrame(() => menuRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || cursor < 0) return;
    menuRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor, open]);

  const commit = (option) => {
    if (!option || option.disabled) return;
    if (!isControlled) setInnerValue(option.value);
    setOpen(false);
    triggerRef.current?.focus();
    onChange?.({
      target: { value: option.value, name },
      currentTarget: { value: option.value, name }
    });
  };

  const step = (dir) => {
    if (!selectableIndexes.length) return;
    const pos = selectableIndexes.indexOf(cursor);
    const next = pos === -1
      ? selectableIndexes[0]
      : selectableIndexes[Math.min(selectableIndexes.length - 1, Math.max(0, pos + dir))];
    setCursor(next);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); return; }
    if (e.key === 'Tab') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); return; }
    if (e.key === 'Home') { e.preventDefault(); setCursor(selectableIndexes[0] ?? -1); return; }
    if (e.key === 'End') { e.preventDefault(); setCursor(selectableIndexes[selectableIndexes.length - 1] ?? -1); return; }
    if (e.key === 'Enter') { e.preventDefault(); commit(visible[cursor]); }
  };

  const label = selected ? selected.label : placeholder;

  const menu = open && rect ? createPortal(
    <div
      ref={menuRef}
      role="listbox"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={`vx-menu animate-scale-in ${menuClassName}`}
      style={{
        left: align === 'end' ? undefined : rect.left,
        right: align === 'end' ? Math.max(8, window.innerWidth - rect.left) : undefined,
        top: rect.dropUp ? undefined : rect.top,
        bottom: rect.dropUp ? window.innerHeight - rect.top : undefined,
        minWidth: Math.max(rect.width, 180),
        maxWidth: Math.max(rect.width, 380),
        maxHeight: rect.max
      }}
    >
      {withSearch && (
        <div className="vx-menu__search">
          <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ara…"
            className="vx-menu__searchinput"
          />
        </div>
      )}

      <div className="vx-menu__list custom-scrollbar">
        {visible.length === 0 && <div className="vx-menu__empty">Sonuç bulunamadı</div>}
        {visible.map((item, idx) =>
          item.group ? (
            <div key={`g-${idx}`} className="vx-menu__group">{item.label}</div>
          ) : (
            <button
              key={`${item.value}-${idx}`}
              type="button"
              data-idx={idx}
              role="option"
              aria-selected={item.value === current}
              disabled={item.disabled}
              onMouseEnter={() => setCursor(idx)}
              onClick={() => commit(item)}
              className={`vx-menu__item${item.value === current ? ' is-selected' : ''}${idx === cursor ? ' is-cursor' : ''}`}
            >
              <span className="vx-menu__label">{item.label}</span>
              {item.value === current && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.6} />}
            </button>
          )
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        {...rest}
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`vx-select ${className}`}
      >
        <span className={`vx-select__value${selected ? '' : ' is-placeholder'}`}>{label}</span>
        <ChevronDown className={`vx-select__chevron${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>

      {/* Form gönderimi ve native doğrulama korunsun diye gizli gerçek select */}
      <select
        className="vx-select__native"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        required={required}
        disabled={disabled}
        value={current}
        onChange={() => {}}
      >
        <option value="" />
        {options.map((o, i) => (
          <option key={`${o.value}-${i}`} value={o.value}>{asText(o.label)}</option>
        ))}
      </select>

      {menu}
    </>
  );
}

export default Dropdown;
