import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../api/client';
import { createOfflineQueue, createSender, isNetworkFailure } from './offlineQueue.mjs';
import { downloadCatalog, buildIndex, findProduct } from './offlineCatalog.mjs';
import { salesStore, catalogStore } from './offlineStore';

const HEARTBEAT_MS = 12000, CATALOG_TTL_MS = 6 * 3600000, CATALOG_AT_KEY = 'veniux:offline-catalog-at';
const queue = createOfflineQueue(salesStore);

// Bağlantı: tarayıcı "çevrimdışı" diyorsa veya sunucunun /health adresine 4 sn içinde hiçbir cevap gelmiyorsa çevrimdışı.
// Sunucu cevap veriyorsa (503 dahil) bağlantı vardır; satış hatalarını normal akış ele alır.
async function reachable() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try { const response = await fetch('/health', { cache: 'no-store', signal: AbortSignal.timeout(4000) }); return !(response.status >= 502 && response.status <= 504); } catch { return false; }
}
const networkFailure = isNetworkFailure;
const sendSale = createSender((path, body, config) => api.post(path, body, config));

export function useOffline({ enabled = true } = {}) {
  const [online, setOnline] = useState(true), [counts, setCounts] = useState({ total: 0, pending: 0, conflict: 0 }), [flushing, setFlushing] = useState(false);
  const [catalog, setCatalog] = useState({ ready: false, size: 0, updating: false }), [lastSummary, setLastSummary] = useState(null);
  const index = useRef(new Map()), flushLock = useRef(false), wasOnline = useRef(true), misses = useRef(0);

  const refreshCounts = useCallback(async () => { try { setCounts(await queue.counts()); } catch { /* depo yoksa sayaç sıfır kalır */ } }, []);

  const flush = useCallback(async () => {
    if (flushLock.current) return null;
    flushLock.current = true; setFlushing(true);
    try {
      const summary = await queue.flush(sendSale);
      setLastSummary(summary); await refreshCounts(); return summary;
    } finally { flushLock.current = false; setFlushing(false); }
  }, [refreshCounts]);

  const loadIndex = useCallback(async () => {
    try { const items = await catalogStore.getAll(); index.current = buildIndex(items); setCatalog(c => ({ ...c, ready: items.length > 0, size: items.length })); } catch { /* önbellek yok */ }
  }, []);

  const updateCatalog = useCallback(async () => {
    setCatalog(c => ({ ...c, updating: true }));
    try {
      const result = await downloadCatalog(async after => (await api.get('/scanner/pro/catalog', { params: { after, limit: 100 } })).data);
      if (result.complete && result.items.length) { await catalogStore.replaceAll(result.items); localStorage.setItem(CATALOG_AT_KEY, String(Date.now())); await loadIndex(); }
    } catch { /* indirme yarıda kalırsa eski liste durur */ }
    finally { setCatalog(c => ({ ...c, updating: false })); }
  }, [loadIndex]);

  useEffect(() => { if (enabled) { refreshCounts(); loadIndex(); } }, [enabled, refreshCounts, loadIndex]);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    const check = async () => {
      const ok = await reachable();
      if (!live) return;
      // Tek kayıp yoklama çevrimdışı sayılmaz (yanlış alarm); art arda iki kayıp veya tarayıcının "çevrimdışı" demesi sayılır.
      misses.current = ok ? 0 : misses.current + 1;
      const offlineNow = !ok && (misses.current >= 2 || navigator.onLine === false);
      setOnline(!offlineNow);
      if (!offlineNow && !wasOnline.current) flush();
      wasOnline.current = !offlineNow;
    };
    const timer = setInterval(check, HEARTBEAT_MS);
    window.addEventListener('online', check); window.addEventListener('offline', check);
    return () => { live = false; clearInterval(timer); window.removeEventListener('online', check); window.removeEventListener('offline', check); };
  }, [enabled, flush]);
  useEffect(() => {
    if (!enabled || !online) return;
    const at = Number(localStorage.getItem(CATALOG_AT_KEY) || 0);
    if (!at || Date.now() - at > CATALOG_TTL_MS) updateCatalog();
  }, [enabled, online, updateCatalog]);

  const localLookup = useCallback(code => findProduct(index.current, code), []);
  const enqueue = useCallback(async sale => { const record = await queue.enqueue(sale); await refreshCounts(); return record; }, [refreshCounts]);
  return useMemo(() => ({ online, counts, flushing, catalog, lastSummary, flush, enqueue, localLookup, networkFailure }), [online, counts, flushing, catalog, lastSummary, flush, enqueue, localLookup]);
}
