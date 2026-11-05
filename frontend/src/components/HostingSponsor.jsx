import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import logo from '../assets/hostimux-sponsor.webp';
import { Modal } from './ui/Modal';
import './HostingSponsor.css';

export default function HostingSponsor({ compact = false }) {
  const [guide, setGuide] = useState(false);
  function visit(event) {
    if (window.veniuxDesktop?.openExternal) { event.preventDefault(); window.veniuxDesktop.openExternal('https://hostimux.com/'); }
    else if (window.VeniuxAndroid?.openSponsor) { event.preventDefault(); window.VeniuxAndroid.openSponsor(); }
  }
  return <>
    <aside className="hosting-credit" data-compact={compact} aria-label="Altyapı sponsoru Hostimux">
      <span className="hosting-credit-label">Altyapı sponsorumuz</span>
      <a className="hosting-logo-link" href="https://hostimux.com/" target="_blank" rel="sponsored noopener noreferrer" aria-label="Hostimux’u incele, yeni sekmede açılır" onClick={visit}><img src={logo} width="1780" height="447" alt="Hostimux Bilişim Hizmetleri" loading="lazy"/></a>
      <button className="hosting-guide-link" type="button" onClick={() => setGuide(true)}>Kurulum seçenekleri</button>
    </aside>
    <Modal isOpen={guide} onClose={() => setGuide(false)} title="Ayrı sunucu ile kurulum" subtitle="Sunucu ve bağlantıyı siz yönetirsiniz" icon={BookOpen} size="lg">
      <div className="hosting-guide-content">
        <p>Yeni Windows kurulumunda <strong>Ayrı sunucu kullanacağım</strong> seçeneğini işaretleyin. Bu bilgisayarda yerel veritabanı kurulumu başlatılmaz.</p>
        <ol><li><strong>Uygun sunucuyu seçin.</strong> Node.js 24 çalıştırabilen VDS/VPS veya bu desteği sağlayan bir hizmet gerekir. Her standart web hosting paketi uygun değildir; sağlayıcıdan uyumluluğu doğrulayın.</li><li><strong>Veniux sunucusunu hazırlayın.</strong> Veniux sunucu bileşenlerini kurun; veritabanını, alan adını ve geçerli HTTPS sertifikasını yapılandırın. Hosting satın almak bu kurulumu kendiliğinden tamamlamaz.</li><li><strong>Windows’a sunucu adresini girin.</strong> Örneğin <code>https://isletmeniz.example/api</code>. Bağlantı kontrolünden sonra programı aynı sunucudaki hesabınız ve geçerli lisansınızla açın.</li><li><strong>Eski kayıtları kontrollü taşıyın.</strong> Yeni sunucu seçmek verilerinizi otomatik aktarmaz. Önce yedek alın ve aktarımı ayrıca doğrulayın.</li></ol>
        <p>Hazır bir sunucunuz yoksa kurulum ekranından otomatik yerel kuruluma dönebilirsiniz. Mevcut kurulumların kayıtlı sunucu seçimi korunur.</p>
      </div>
    </Modal>
  </>;
}
