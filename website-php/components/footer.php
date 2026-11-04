<?php
declare(strict_types=1);
?>
<footer class="dp-footer">
    <div class="dp-container">
        <div class="dp-footer-grid">
            <div class="dp-footer-brand">
                <a class="dp-brand" href="/" aria-label="Veniux ana sayfa">
                    <img class="dp-brand-logo" src="/assets/logo-40-v1.webp" alt="Veniux logosu" width="32" height="32">
                    <span>VENIUX</span>
                </a>
                <p>İşletmenizin tüm akışını tek ekosistemde birleştiren, yüksek performanslı ve güvenilir kurumsal yönetim platformu.</p>
                <div style="display:flex; align-items:center; gap:8px; margin-top:16px; font-size:12px; color:#2CA58D; font-weight:700;">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#2CA58D;"></span>
                    Tüm Sistemler Operasyonel
                </div>
            </div>

            <div class="dp-footer-col">
                <h4>Çözümler</h4>
                <ul class="dp-footer-links">
                    <li><a href="/stok-yonetimi">Stok Yönetimi</a></li>
                    <li><a href="/depo-yonetimi">Depo & WMS</a></li>
                    <li><a href="/market-pos">Market / POS Satış</a></li>
                    <li><a href="/lot-miat-takibi">Lot ve Miat Takibi</a></li>
                </ul>
            </div>

            <div class="dp-footer-col">
                <h4>Ürün Ailesi</h4>
                <ul class="dp-footer-links">
                    <li><a href="/#ekosistem">Veniux CRM</a></li>
                    <li><a href="/#ekosistem">Satış Yönetimi</a></li>
                    <li><a href="/#ekosistem">Raporlama</a></li>
                    <li><a href="/yapay-zeka">Veniux Intelligence</a></li>
                </ul>
            </div>

            <div class="dp-footer-col">
                <h4>Kaynaklar</h4>
                <ul class="dp-footer-links">
                    <li><a href="/program-indir">Program İndir</a></li>
                    <li><a href="/fiyatlandirma">Fiyatlandırma</a></li>
                    <li><a href="/guncelleme-notlari">Güncelleme Notları</a></li>
                    <li><a href="/surum-arsivi">Sürüm Arşivi</a></li>
                    <li><a href="/sunucu-kurulumu">Sunucu Kurulumu</a></li>
                </ul>
            </div>

            <div class="dp-footer-col">
                <h4>Hesap & Hukuki</h4>
                <ul class="dp-footer-links">
                    <li><a href="/giris">Giriş Yap</a></li>
                    <li><a href="/kayit">Kayıt Ol</a></li>
                    <li><a href="/kullanim-kosullari">Kullanım Koşulları</a></li>
                    <li><a href="/gizlilik-politikasi">Gizlilik Politikası</a></li>
                    <li><a href="/kvkk-aydinlatma">KVKK Aydınlatma</a></li>
                    <li><a href="/cerez-politikasi">Çerez Politikası</a></li>
                </ul>
            </div>
        </div>

        <div class="dp-footer-bottom">
            <div>
                © <?=date('Y')?> Veniux. Tüm hakları saklıdır. Türkiye'de geliştirilmiştir.
            </div>
            <div style="display:flex; gap:20px; align-items:center;">
                <a href="https://discord.gg/WQyxdp7MKW" target="_blank" rel="noopener noreferrer" style="display:flex; align-items:center; gap:6px;">
                    Discord Topluluğu ↗
                </a>
                <a href="/#iletisim">İletişim & Destek</a>
                <button type="button" class="text-link" data-cookie-open style="background:none; border:none; color:inherit; cursor:pointer; font-size:inherit; padding:0;">Çerez Tercihleri</button>
            </div>
        </div>
    </div>
</footer>
<?php require __DIR__.'/../cookie-consent.php'; ?>
