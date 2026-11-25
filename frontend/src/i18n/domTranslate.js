// Ekrandaki Türkçe metinleri, seçili dilde sözlükte tam karşılığı varsa yerinde çevirir (DOM düzeyinde).
// t() ile sarılmamış ya da kod içinde üretilen sabit metinleri de kapsar; yalnız metin düğümü ve görünen öznitelikler değişir,
// yapıya dokunulmaz (React ile çakışmaz). Dil Türkçeye dönünce özgün metin geri yazılır.
import { LOCALES, getLanguage, subscribeLanguage } from './index.js';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT', 'SVG']);
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const has = (table, key) => Object.prototype.hasOwnProperty.call(table, key);

// Yalnız tam eşleşme (baştaki/sondaki boşluk korunur). Eşleşme yoksa null.
export function translateExact(table, raw) {
  if (typeof raw !== 'string' || raw.length > 600) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 2 || !has(table, trimmed)) return null;
  const out = table[trimmed];
  if (out === trimmed) return null;
  const lead = raw.slice(0, raw.indexOf(trimmed)), tail = raw.slice(raw.indexOf(trimmed) + trimmed.length);
  return lead + out + tail;
}

const skipped = node => {
  for (let el = node.nodeType === 1 ? node : node.parentElement; el; el = el.parentElement) {
    if (SKIP_TAGS.has(el.tagName?.toUpperCase())) return true;
    if (el.isContentEditable || el.hasAttribute?.('data-no-i18n')) return true;
  }
  return false;
};

export function startDomTranslation(doc = typeof document === 'undefined' ? null : document) {
  if (!doc || typeof MutationObserver === 'undefined') return () => {};
  const originals = new WeakMap(); // düğüm/öznitelik -> özgün Türkçe
  const attrOriginals = new WeakMap();
  let observer = null, queue = new Set(), scheduled = false;

  const textNode = (node, table) => {
    if (skipped(node)) return;
    const current = node.nodeValue, next = translateExact(table, current);
    if (next !== null && next !== current) { originals.set(node, current); node.nodeValue = next; }
  };
  const element = (el, table) => {
    for (const name of ATTRS) {
      const value = el.getAttribute?.(name);
      if (value == null) continue;
      const next = translateExact(table, value);
      if (next !== null && next !== value) {
        const map = attrOriginals.get(el) || {}; if (!(name in map)) map[name] = value; attrOriginals.set(el, map);
        el.setAttribute(name, next);
      }
    }
    if (el.tagName === 'INPUT' && ['button', 'submit'].includes(el.type) && el.value) {
      const next = translateExact(table, el.value); if (next !== null) el.value = next;
    }
  };
  const walk = (root, table) => {
    if (!root) return;
    if (root.nodeType === 3) return textNode(root, table);
    if (root.nodeType !== 1 || skipped(root)) return;
    element(root, table);
    const walker = doc.createTreeWalker(root, 1 | 4); // elementler ve metin
    for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (n.nodeType === 3) textNode(n, table); else if (!SKIP_TAGS.has(n.tagName?.toUpperCase())) element(n, table); }
  };
  const restore = () => {
    const walker = doc.createTreeWalker(doc.body, 1 | 4);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === 3) { const o = originals.get(n); if (o !== undefined) { n.nodeValue = o; originals.delete(n); } }
      else { const map = attrOriginals.get(n); if (map) { for (const [name, value] of Object.entries(map)) n.setAttribute(name, value); attrOriginals.delete(n); } }
    }
  };
  const flush = () => {
    scheduled = false;
    const table = LOCALES[getLanguage()];
    const batch = queue; queue = new Set();
    if (!table || !Object.keys(table).length) return;
    if (observer) observer.disconnect();
    try { for (const node of batch) if (node.isConnected !== false) walk(node, table); } finally { observe(); }
  };
  // Zamanlayıcı kullanılır: sekme arka plandayken requestAnimationFrame çalışmaz.
  const enqueue = node => { queue.add(node); if (!scheduled) { scheduled = true; setTimeout(flush, 30); } };
  const observe = () => {
    if (!observer) observer = new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'childList') r.addedNodes.forEach(enqueue);
        else if (r.type === 'characterData') enqueue(r.target);
        else if (r.type === 'attributes') enqueue(r.target);
      }
    });
    observer.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  const sync = () => {
    const table = LOCALES[getLanguage()];
    if (table && Object.keys(table).length) { observe(); enqueue(doc.body); }
    else { if (observer) observer.disconnect(); restore(); }
  };
  const stop = subscribeLanguage(sync);
  if (doc.body) sync(); else doc.addEventListener('DOMContentLoaded', sync, { once: true });
  return () => { stop(); if (observer) observer.disconnect(); };
}
