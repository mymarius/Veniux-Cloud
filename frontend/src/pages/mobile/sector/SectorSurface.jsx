import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import './sector-desktop.css';

// Sektör ekranları iki yüzeyde çalışır: telefonda /m/... (tam ekran telefon uygulaması), masaüstünde /sektor/... (Veniux düzeni içinde, geniş çalışma alanı).
// Veri ve iş mantığı aynıdır; yalnız yerleşim ve başlık değişir.
export const SurfaceContext = createContext({ desktop: false });
export const useSurface = () => useContext(SurfaceContext);

// Telefondaki /m/yol adresini masaüstü karşılığına çevirir.
export const sectorPath = (desktop, path) => (desktop ? path.replace(/^\/m(?=\/|$)/, '/sektor') : path);

const phoneQuery = '(max-width:760px)';
const isPhone = () => Boolean(window.veniuxMobile) || window.matchMedia(phoneQuery).matches;

export function DesktopSurface({ children }) {
  const [phone, setPhone] = useState(isPhone);
  const location = useLocation();
  useEffect(() => {
    if (window.veniuxMobile) return undefined;
    const query = window.matchMedia(phoneQuery), update = () => setPhone(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  // Dar ekranda ve uygulamada telefon yüzeyine geçilir.
  if (phone) return <Navigate to={location.pathname.replace(/^\/sektor(?=\/|$)/, '/m') + location.search} replace />;
  return <SurfaceContext.Provider value={{ desktop: true }}><div className="sd" data-surface="desktop">{children}</div></SurfaceContext.Provider>;
}
