import { normalizeResponse } from './normalizeResponse';
import axios from 'axios';
import { useEffect } from 'react';
import {isTerminalReauth} from '../lib/terminalReauth.mjs';
import * as readCache from '../lib/offlineReadCache.mjs';

// Use relative /api to benefit from Vite proxy or direct URL fallback
// Packaged web releases must not inherit a developer's .env loopback API.
const API_BASE_URL = window.veniuxMobile?.apiBase || window.veniuxDesktop?.apiBase || (window.location.protocol === 'file:' ? 'http://127.0.0.1:3000/api' : (import.meta.env.DEV && import.meta.env.VITE_API_URL) || '/api');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 12000,
});
if(window.veniuxMobile?.request)apiClient.defaults.adapter=async config=>{
 let body=config.data||'';
 if(body instanceof Blob||body instanceof ArrayBuffer){const bytes=new Uint8Array(body instanceof Blob?await body.arrayBuffer():body);if(bytes.length>20*1024*1024)throw new Error('Mobil dosya yüklemesi en fazla 20 MB olabilir.');let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));body={base64:btoa(binary)};}
 const target=new URL(apiClient.getUri(config),API_BASE_URL);
 const reply=await window.veniuxMobile.request(config.method||'get',target.pathname+target.search,config.headers.toJSON(),body,config.timeout||12000);
 const bytes=Uint8Array.from(atob(reply.body),c=>c.charCodeAt(0)),type=reply.headers['content-type']||'';
 let data=config.responseType==='blob'?new Blob([bytes],{type}):config.responseType==='arraybuffer'?bytes.buffer:new TextDecoder().decode(bytes);
 if(typeof data==='string'&&type.includes('json')){try{data=JSON.parse(data);}catch{}}
 const response={data,status:reply.status,statusText:'',headers:reply.headers,config,request:{}};
 if(reply.status>=400)throw new axios.AxiosError(data?.error||'İstek tamamlanamadı.','ERR_BAD_RESPONSE',config,null,response);
 return response;
};

// Add JWT token to requests & normalize URL
apiClient.interceptors.request.use(
  (config) => {
    // Normalize duplicate /api prefix
    if (config.url && config.url.startsWith('/api/')) {
      config.url = config.url.replace(/^\/api/, '');
    }

    // Kasa cihaz kimliği: tarayıcıda/uygulamada kalıcı, rastgele; kişisel veri içermez. Yalnız kasa isteklerine eklenir.
    if (/^\/scanner\//.test(config.url || '')) {
      let uid = null;
      try { uid = localStorage.getItem('veniux-pos-device'); if (!uid) { uid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2)); localStorage.setItem('veniux-pos-device', uid); } } catch { uid = null; }
      if (uid) { config.headers['x-veniux-device-uid'] = uid; config.headers['x-veniux-device-platform'] = window.veniuxMobile ? 'android' : window.veniuxDesktop?.isDesktop ? 'windows' : 'web'; }
    }
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      const tenant=sessionStorage.getItem('platform-tenant');
      if(tenant && !/^\/auth\/(login|register)/.test(config.url || '')) config.headers['x-tenant-id']=tenant;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: data synchronization & error handling
apiClient.interceptors.response.use(
  (response) => {
    const offline = Number(response.headers?.['x-veniux-offline-until']) || null;
    window.dispatchEvent(new CustomEvent('veniux-connection', { detail: { offlineUntil: offline, blocked: false } }));
    response.data = normalizeResponse(response.data);
    // Kasanın açılışta okuduğu birkaç GET'in son cevabı saklanır; ağ yokken sayfa yenilenirse bundan açılır.
    if (readCache.cacheable(response.config)) readCache.save(localStorage, response.config, response.data, readCache.tokenId(localStorage.getItem('token')));
    const method = response.config?.method?.toLowerCase();
    // Whenever a data mutating request succeeds, notify all subscriber pages
    if (method === 'post' || method === 'put' || method === 'patch' || method === 'delete') {
      const url = response.config?.url || '';
      // Don't broadcast for search queries or resolve endpoints
      if (url !== '/scanner/lookup' && !url.startsWith('/license/') && !url.includes('/barcode/resolve') && !url.includes('/login') && !url.includes('/register')) {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('veniux:data-mutated', {
              detail: { url, method, timestamp: Date.now() },
            })
          );
        }, 50);
      }
    }
    return response;
  },
  (error) => {
    // Ağ hatasında (sunucudan hiçbir cevap yok) izinli okumalar için son başarılı cevap kullanılır (en çok 24 saat).
    if (!error.response && readCache.cacheable(error.config)) {
      const hit = readCache.load(localStorage, error.config, readCache.tokenId(localStorage.getItem('token')));
      if (hit) return Promise.resolve({ data: hit.data, status: 200, statusText: 'OFFLINE_CACHE', headers: { 'x-veniux-offline-cache': '1' }, config: error.config, request: {} });
    }
    // Firma yöneticiler için 2FA'yı zorunlu kıldıysa güvenlik ayarlarına yönlendir (bir kez).
    if (error.response?.data?.code === 'MFA_SETUP_REQUIRED' && !/[?&]tab=security/.test(window.location.search + window.location.hash)) {
      if (window.location.protocol === 'file:') window.location.hash = '/settings?tab=security';
      else window.location.href = '/settings?tab=security';
    }
    if (error.response?.data?.code === 'LICENSE_UNAVAILABLE') window.dispatchEvent(new CustomEvent('veniux-connection', { detail: { offlineUntil: null, blocked: true } }));
    // Lisans yüklenmeden giden istekte cihaz başlığı yoktur; bu lisansın kapalı olduğunu göstermez, oturum silinmez.
    const sentDevice=Boolean(error.config?.headers?.['x-veniux-device-token']);
    if(error.response?.status===423&&(sentDevice||error.response.data?.code!=='LICENSE_REQUIRED')&&!error.response.data?.billing&&!isTerminalReauth(error.config)&&!/^\/license\//.test(error.config?.url||'')){
      localStorage.removeItem('token');localStorage.removeItem('user');sessionStorage.removeItem('platform-tenant');
      if(window.location.protocol==='file:')window.location.hash='/activate';
      else if(window.location.pathname!=='/activate')window.location.href='/activate';
    }
    if (error.response?.status === 401 && error.config?.url !== '/mobile/claim' && !isTerminalReauth(error.config)) {
      // Only redirect if user is not already on login/register page
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('platform-tenant');
        sessionStorage.removeItem('platform-tenant-name');
        if (window.location.protocol === 'file:') window.location.hash = '/login';
        else window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Custom React Hook to subscribe to cross-page data synchronization events.
 * Automatically triggers the refetch callback when data changes anywhere in the app.
 */
export function useDataSync(onSync, deps = []) {
  useEffect(() => {
    const handleSync = (e) => {
      if (typeof onSync === 'function') {
        onSync(e.detail);
      }
    };
    window.addEventListener('veniux:data-mutated', handleSync);
    return () => window.removeEventListener('veniux:data-mutated', handleSync);
  }, deps);
}

/**
 * Manually broadcast a data sync event to all active pages
 */
export function broadcastSync(source = 'manual') {
  window.dispatchEvent(
    new CustomEvent('veniux:data-mutated', {
      detail: { source, timestamp: Date.now() },
    })
  );
}

export default apiClient;
