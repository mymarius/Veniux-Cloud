<?php
declare(strict_types=1);
?>
<header class="dp-header">
    <div class="dp-container dp-nav">
        <a class="dp-brand" href="/" aria-label="Veniux ana sayfa">
            <img class="dp-brand-logo" src="/assets/logo-40-v1.webp" srcset="/assets/logo-40-v1.webp 1x, /assets/logo-80-v1.webp 2x" alt="Veniux logosu" width="36" height="36" fetchpriority="high">
            <span>VENIUX</span>
        </a>

        <nav aria-label="Ana menü">
            <ul class="dp-nav-links">
                <li class="dp-nav-item">
                    <a class="dp-nav-link" href="/#ekosistem">
                        Çözümler <span class="caret">▾</span>
                    </a>
                    <div class="dp-dropdown">
                        <a href="/stok-yonetimi" class="dp-dropdown-item">
                            <span class="dp-dropdown-title">Stok Yönetimi</span>
                            <span class="dp-dropdown-desc">Barkod, envanter ve satın alma takibi</span>
                        </a>
                        <a href="/depo-yonetimi" class="dp-dropdown-item">
                            <span class="dp-dropdown-title">Depo & WMS</span>
                            <span class="dp-dropdown-desc">Mal kabul, dinamik raf ve transferler</span>
                        </a>
                        <a href="/market-pos" class="dp-dropdown-item">
                            <span class="dp-dropdown-title">Market / POS</span>
                            <span class="dp-dropdown-desc">Hızlı dokunmatik kasa ve fiş yazdırma</span>
                        </a>
                        <a href="/lot-miat-takibi" class="dp-dropdown-item">
                            <span class="dp-dropdown-title">Lot ve Miat Takibi</span>
                            <span class="dp-dropdown-desc">Parti takibi ve son kullanma kontrolü</span>
                        </a>
                    </div>
                </li>

                <li class="dp-nav-item">
                    <a class="dp-nav-link" href="/#ekosistem">
                        Ürünler <span class="caret">▾</span>
                    </a>
                    <div class="dp-dropdown">
                        <a href="/#ekosistem" class="dp-dropdown-item">
                            <span class="dp-dropdown-title">Veniux CRM</span>
                            <span class="dp-dropdown-desc">Müşteri ilişkileri ve cari hesap yönetimi</span>
                        </a>
                        <a href="/#ekosistem" class="dp-dropdown-item">
                            <span class="dp-dropdown-title">Veniux Satış Yönetimi</span>
                            <span class="dp-dropdown-desc">Sipariş, teklif ve iskonto süreçleri</span>
                        </a>
                        <a href="/#ekosistem" class="dp-dropdown-item">
                            <span class="dp-dropdown-title">Veniux Raporlama</span>
                            <span class="dp-dropdown-desc">Detaylı kârlılık ve ciro analitikleri</span>
                        </a>
                        <a href="/yapay-zeka" class="dp-dropdown-item">
                            <span class="dp-dropdown-title">Veniux Intelligence</span>
                            <span class="dp-dropdown-desc">Yapay zekâ stok tahmini ve anomali uyarıları</span>
                        </a>
                    </div>
                </li>

                <li class="dp-nav-item">
                    <a class="dp-nav-link" href="/fiyatlandirma" <?=$path==='/fiyatlandirma'?'aria-current="page"':''?>>
                        Fiyatlandırma
                    </a>
                </li>

                <li class="dp-nav-item">
                    <a class="dp-nav-link" href="/program-indir">
                        Kaynaklar <span class="caret">▾</span>
                    </a>
                    <div class="dp-dropdown">
                        <a href="/program-indir" class="dp-dropdown-item">
                            <span class="dp-dropdown-title">Program İndir</span>
                            <span class="dp-dropdown-desc">Windows ve Android kurulum paketleri</span>
                        </a>
                        <a href="/guncelleme-notlari" class="dp-dropdown-item">
                            <span class="dp-dropdown-title">Güncelleme Notları</span>
                            <span class="dp-dropdown-desc">En son sürüm değişiklikleri ve yenilikler</span>
                        </a>
                        <a href="/surum-arsivi" class="dp-dropdown-item">
                            <span class="dp-dropdown-title">Sürüm Arşivi</span>
                            <span class="dp-dropdown-desc">Geçmiş sürümler ve SHA-256 özetleri</span>
                        </a>
                        <a href="/sunucu-kurulumu" class="dp-dropdown-item">
                            <span class="dp-dropdown-title">Sunucu Kurulumu</span>
                            <span class="dp-dropdown-desc">Hostimux ve bağımsız sunucu kılavuzu</span>
                        </a>
                    </div>
                </li>

                <li class="dp-nav-item">
                    <a class="dp-nav-link" href="/#iletisim">İletişim</a>
                </li>
            </ul>
        </nav>

        <div class="dp-nav-actions">
            <button type="button" class="dp-search-btn" onclick="document.getElementById('search-dialog').showModal()" aria-label="Arama yap">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
            <a href="/giris" class="dp-btn dp-btn--ghost dp-btn--sm">Giriş Yap</a>
            <a href="/?request_type=demo#iletisim" class="dp-btn dp-btn--accent dp-btn--sm">Demo Talep Et →</a>
            <button class="dp-menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-drawer" aria-label="Menüyü aç" onclick="document.getElementById('mobile-drawer').showModal()">☰</button>
        </div>
    </div>
</header>

<!-- Mobile Navigation Drawer -->
<dialog id="mobile-drawer" class="mobile-drawer" aria-label="Mobil gezinme">
    <div class="drawer-top">
        <strong style="color:#E8EDF4;">MENÜ</strong>
        <button type="button" class="drawer-close" onclick="document.getElementById('mobile-drawer').close()" aria-label="Menüyü kapat">✕</button>
    </div>
    <nav class="mobile-menu" aria-label="Mobil bağlantılar">
        <a href="/#ekosistem">Çözümler & Modüller</a>
        <a href="/stok-yonetimi">Stok Yönetimi</a>
        <a href="/depo-yonetimi">Depo & WMS</a>
        <a href="/market-pos">Market / POS</a>
        <a href="/yapay-zeka">Veniux Intelligence</a>
        <a href="/fiyatlandirma">Fiyatlandırma</a>
        <a href="/program-indir">Programı İndir</a>
        <a href="/giris">Giriş Yap</a>
        <a href="/kayit">Hesap Oluştur</a>
        <a href="/?request_type=demo#iletisim" style="color:#F17A38; font-weight:700;">Demo Talep Et →</a>
    </nav>
</dialog>

<!-- Search Modal -->
<dialog id="search-dialog" class="dp-modal" aria-labelledby="search-modal-title">
    <div class="dp-modal-box" style="background:#0D1B2A; border:1px solid #263B50; border-radius:16px; padding:24px; max-width:540px; width:90%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
            <h3 id="search-modal-title" style="margin:0; font-size:18px; color:#E8EDF4;">Hızlı Arama</h3>
            <button type="button" onclick="document.getElementById('search-dialog').close()" style="background:none; border:none; color:#94A5B8; font-size:20px; cursor:pointer;" aria-label="Kapat">✕</button>
        </div>
        <div class="dp-form-group">
            <input type="search" class="dp-input" placeholder="Modül, özellik veya kılavuz ara..." autofocus oninput="const q=this.value.toLowerCase(); document.querySelectorAll('.search-result-item').forEach(el=>el.style.display=el.textContent.toLowerCase().includes(q)?'block':'none')">
        </div>
        <div class="search-results" style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow-y:auto; margin-top:14px;">
            <a href="/stok-yonetimi" class="search-result-item dp-dropdown-item"><strong>Veniux Stok & Envanter</strong><small>Ürün kartları, barkod, lot/miat</small></a>
            <a href="/depo-yonetimi" class="search-result-item dp-dropdown-item"><strong>Veniux Depo & WMS</strong><small>Mal kabul, raf yönetimi, transferler</small></a>
            <a href="/market-pos" class="search-result-item dp-dropdown-item"><strong>Market / POS Satış</strong><small>Dokunmatik satış, barkod, fiş ve kasa</small></a>
            <a href="/yapay-zeka" class="search-result-item dp-dropdown-item"><strong>Veniux Intelligence</strong><small>Yapay zekâ stok tahmini ve kararlar</small></a>
            <a href="/fiyatlandirma" class="search-result-item dp-dropdown-item"><strong>Paketler ve Fiyatlandırma</strong><small>Başlangıç, İşletme ve Kurumsal</small></a>
            <a href="/program-indir" class="search-result-item dp-dropdown-item"><strong>Program İndir</strong><small>Windows EXE ve Android APK</small></a>
        </div>
    </div>
</dialog>
