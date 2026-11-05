import veniuxLogo from '../assets/veniux-logo.webp';
import React from 'react';
import { Link } from 'react-router-dom';

export function AuthShell({ title, description, children, footer }) {
  return (
    <div className="auth-workspace vx-auth">
      <aside className="vx-shelf-side" aria-hidden="true">
        <p>Raf boşalmadan haberin olsun.</p>
        <div className="vx-shelf-tag"><b>Filtre kahve 250 g</b><strong>46<small>,00 ₺</small></strong><i /></div>
      </aside>
      <main className="vx-auth-column">
        <Link to="/" className="vx-auth-brand">
          <img src={veniuxLogo} alt="" />
          <span>Veniux Cloud</span>
        </Link>
        <h1>{title}</h1>
        <p className="vx-auth-description">{description}</p>
        <div className="auth-form-card vx-auth-form">{children}</div>
        {footer && <div className="vx-auth-footer">{footer}</div>}
      </main>
    </div>
  );
}
