import { holdLicenseDuringOutage } from '../lib/licenseGrace.mjs';
import {browserDeviceInfo} from '../lib/browserDevice';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../api/client';
import {verifyOfflineLicense} from '../api/licenseVerification';

const LicenseContext = createContext(null);

const generateBrowserFingerprint = () => browserDeviceInfo();

export function LicenseProvider({ children }) {
  const [license, setLicense] = useState(null);
  const [hardwareInfo, setHardwareInfo] = useState(generateBrowserFingerprint());
  const [isLicensed, setIsLicensed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [graceDaysRemaining, setGraceDaysRemaining] = useState(14);
  const [error, setError] = useState(null);
  const [centralRequired, setCentralRequired] = useState(Boolean(window.veniuxDesktop?.centralLicenseRequired));
  const initialized = useRef(false);
  // Ağ kesintisinde lisansın korunması için son başarılı doğrulama zamanı ve durumu (lib/licenseGrace.mjs).
  // Son başarılı doğrulama zamanı sayfa yenilense de kalsın (çevrimdışı yenilemede kasa etkinleştirme ekranına atılmasın).
  const storedGood = (() => { try { return Number(localStorage.getItem('veniux:license-good-at') || 0) || 0; } catch { return 0; } })();
  const lastGoodAt = useRef(storedGood), licensedRef = useRef(storedGood > 0);
  const holdOnOutage = error => holdLicenseDuringOutage({ error, licensedBefore: licensedRef.current, lastGoodAt: lastGoodAt.current });

  const isDesktop = typeof window !== 'undefined' && Boolean(window.veniuxDesktop?.isDesktop);

  useEffect(() => {
    initLicense();
    const timer=setInterval(initLicense,30*1000);
    return ()=>clearInterval(timer);
  }, []);

  const initLicense = async () => {
    if (!initialized.current) setLoading(true);
    try {
      // The desktop identity is available before the local API finishes starting.
      let hw = hardwareInfo;
      if(isDesktop) {
        hw=await window.veniuxDesktop.getHardwareInfo();
        if(!/^HW-[A-F0-9]{32}$/.test(hw?.fingerprint || ''))throw new Error('Windows cihaz kimliği doğrulanamadı. Programı yeniden açın.');
        setHardwareInfo(hw);
      }
      const policy = (await api.get('/license/policy')).data;
      if(window.veniuxDesktop?.centralLicenseRequired && (!policy.central_required || policy.offline_allowed)) {
        setCentralRequired(true);
        throw new Error('Bağlı sunucu merkezi lisans denetimi için güncellenmeli. İşlemler açılmadı; veritabanı hedefi değiştirilmedi.');
      }
      setCentralRequired(Boolean(policy.central_required));

      // 2. Try loading cached license token
      let cachedToken = null;
      if (isDesktop && window.veniuxDesktop?.loadCachedLicense) {
        cachedToken = await window.veniuxDesktop.loadCachedLicense();
      } else {
        const stored = localStorage.getItem('veniux_license_token');
        if (stored) {
          try { cachedToken = JSON.parse(stored); } catch (e) {}
        }
      }

      if (!cachedToken || !cachedToken.payload) {
        setIsLicensed(false);
        setLicense(null);
        setLoading(false);
        return;
      }

      // 3. Verify Offline Validity
      const payload = cachedToken.payload;
      if(policy.central_required) {
        api.defaults.headers.common['x-veniux-device-token']=payload.device_token;
        api.defaults.headers.common['x-device-id']=hw.fingerprint;
      }
      const expiresAt = new Date(payload.expires_at).getTime();
      const now = Date.now();

      if (expiresAt < now) {
        setIsLicensed(false);
        setLicense({ ...payload, status: 'EXPIRED' });
        setError('Lisansınızın süresi dolmuştur.');
        setLoading(false);
        return;
      }

      // 4. Try Online Validation with Central Server
      try {
        const valRes = await api.post('/license/validate', {
          license_key: payload.license_key,
          device_token: payload.device_token,
          device_fingerprint: hw.fingerprint
        });

        if (valRes.data?.valid) {
          const freshPayload = valRes.data.token.payload;
          setLicense(freshPayload);
          setIsLicensed(true);
          licensedRef.current = true; lastGoodAt.current = Date.now();
          try { localStorage.setItem('veniux:license-good-at', String(lastGoodAt.current)); } catch { /* depo yoksa yalnız bellekte tutulur */ }
          setIsOfflineMode(false);

          // Update local cache
          if (isDesktop && window.veniuxDesktop?.saveCachedLicense) {
            await window.veniuxDesktop.saveCachedLicense(valRes.data.token);
          } else {
            localStorage.setItem('veniux_license_token', JSON.stringify(valRes.data.token));
          }
        } else {
          setIsLicensed(false);
          setLicense(valRes.data?.token?.payload || payload);
          setIsOfflineMode(false);
          if(isDesktop)await window.veniuxDesktop.clearCachedLicense();
          localStorage.removeItem('veniux_license_token');
          setError('Lisans sunucu tarafından geçersiz kılındı.');
        }
      } catch (networkErr) {
        if (holdOnOutage(networkErr)) { setIsLicensed(true); setIsOfflineMode(true); if (payload) setLicense(payload); return; }
        if(policy.central_required || networkErr.response || !(await verifyOfflineLicense(cachedToken,hw.fingerprint))){
          setIsLicensed(false);
          setIsOfflineMode(false);
          setLicense(null);
          setError(networkErr.response?.data?.error||'Lisans doğrulanamadı. Sunucu bağlantısı gerekli.');
          return;
        }
        // Fallback to Offline Grace Mode if network is unavailable
        console.warn('License server unreachable, entering offline grace mode:', networkErr.message);
        setIsOfflineMode(true);
        setIsLicensed(true);
        setLicense(payload);

        // Calculate days since last validation
        const lastValidated = payload.timestamp;
        const daysPassed = Math.floor((now - lastValidated) / (1000 * 60 * 60 * 24));
        const remaining = Math.max(0, (payload.grace_period_days || 14) - daysPassed);
        setGraceDaysRemaining(remaining);
      }
    } catch (err) {
      if (holdOnOutage(err)) { setIsLicensed(true); setIsOfflineMode(true); return; }
      console.error('License initialization error:', err);
      setIsLicensed(false);
      setError(err.message);
    } finally {
      initialized.current = true;
      setLoading(false);
    }
  };

  const activateLicenseKey = async (key) => {
    setLoading(true);
    setError(null);
    try {
      key=key.trim().toUpperCase();
      if(key.startsWith('HW-'))throw new Error('Bu kod cihaz kimliğidir. Lisans merkezinden verilen VNX- ile başlayan lisans anahtarını girin.');
      let hw=hardwareInfo;
      if(isDesktop) {
        hw=await window.veniuxDesktop.getHardwareInfo();
        if(!/^HW-[A-F0-9]{32}$/.test(hw?.fingerprint || ''))throw new Error('Windows cihaz kimliği doğrulanamadı. Programı yeniden açın.');
        setHardwareInfo(hw);
      }
      if(!isDesktop){const policy=(await api.get('/license/policy')).data;if(policy.central_required&&!policy.browser_access)throw new Error('Bu sunucuda web cihaz erişimi henüz etkin değil.');if(!/^HW-[A-F0-9]{32}$/.test(hw.fingerprint||''))throw new Error('Tarayıcı cihaz kaydı saklanamadı. Bu site için depolamaya izin verin.');}
      if(window.veniuxDesktop?.centralLicenseRequired) {
        const policy=(await api.get('/license/policy')).data;
        if(!policy.central_required || policy.offline_allowed)throw new Error('Bağlı sunucu merkezi lisans denetimi için güncellenmeli.');
      }
      const res = await api.post('/license/activate', {
        license_key: key,
        device_fingerprint: hw.fingerprint,
        device_name: hw.deviceName,
        os_info: hw.osInfo,
        app_version: window.veniuxDesktop?.appVersion || 'web'
      });

      if (res.data?.success && res.data?.token) {
        const tokenData = res.data.token;
        if(tokenData.payload.device_token) {
          api.defaults.headers.common['x-veniux-device-token']=tokenData.payload.device_token;
          api.defaults.headers.common['x-device-id']=hw.fingerprint;
        }
        setLicense(tokenData.payload);
        setIsLicensed(true);
        setIsOfflineMode(false);

        // Save in secure storage
        if (isDesktop && window.veniuxDesktop?.saveCachedLicense) {
          await window.veniuxDesktop.saveCachedLicense(tokenData);
        } else {
          localStorage.setItem('veniux_license_token', JSON.stringify(tokenData));
        }

        return { success: true, data: res.data };
      } else {
        throw new Error('Aktivasyon tamamlanamadı.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Aktivasyon hatası';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const deactivateCurrentDevice = async () => {
    if (!license) return;
    try {
      await api.post('/license/deactivate', {
        license_key: license.license_key,
        device_fingerprint: hardwareInfo.fingerprint
      });

      if (isDesktop && window.veniuxDesktop?.clearCachedLicense) {
        await window.veniuxDesktop.clearCachedLicense();
      }
      localStorage.removeItem('veniux_license_token');
      setIsLicensed(false);
      setLicense(null);
      delete api.defaults.headers.common['x-veniux-device-token'];
      delete api.defaults.headers.common['x-device-id'];
    } catch (e) {
      console.error('Deactivate error:', e);
    }
  };

  const hasFeature = (featureName) => {
    if (!isLicensed || !license?.enabled_features) return false;
    return Boolean(license.enabled_features[featureName]);
  };

  return (
    <LicenseContext.Provider
      value={{
        license,
        centralRequired,
        isLicensed,
        loading,
        error,
        hardwareInfo,
        isDesktop,
        isOfflineMode,
        graceDaysRemaining,
        activateLicenseKey,
        deactivateCurrentDevice,
        refreshLicense: initLicense,
        hasFeature
      }}
    >
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
}
