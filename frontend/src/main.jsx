import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles.scss';
import './enterprise.css';
import './theme-dark.css';
import './desktop.css';
import './workspace-refinement.css';
import './product-design.css';
import './native-refinement.css';
import App from './App.jsx';
import DesktopSetup from './components/DesktopSetup';
import InteractionMotion from './components/InteractionMotion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initAppearance } from './lib/appearance';
import {mobilePairing} from './lib/mobilePairing';

if(window.veniuxMobile) document.documentElement.dataset.mobile = 'true';
initAppearance();

function renderApp(){createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {window.veniuxDesktop?.setupRequired ? <DesktopSetup/> : <App />}
      <InteractionMotion />
    </ErrorBoundary>
  </StrictMode>,
);}
mobilePairing().then(renderApp).catch(error=>createRoot(document.getElementById('root')).render(<main className="mobile-connection-error p-8 space-y-5"><h1 className="text-2xl font-bold">Mobil giriş tamamlanamadı</h1><p>{error.response?.data?.error||error.message}</p><button className="btn-primary" onClick={()=>window.VeniuxAndroid?.resetPairing?.()}>Yeni QR kodu okut</button></main>));

import './card-refinement.css';
import './mobile-app.css';
import './veniux-brand.css';
import './design-system.css';

import './mobile-professional.css';
import './vx-foundation.css';
