import veniuxLogo from '../assets/veniux-logo.png';
import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Layers, ShieldCheck, Server, Key } from 'lucide-react';

export function AuthShell({ eyebrow, title, description, children, footer }) {
  return (
    <div className="auth-workspace flex min-h-screen bg-slate-50">
      {/* Left Panel - Corporate Deep Slate */}
      <aside className="hidden w-[45%] flex-col justify-between bg-slate-900 p-10 text-white lg:flex xl:p-14 relative overflow-hidden">
        <div className="auth-flow" aria-hidden="true">
          <svg viewBox="0 0 640 960" preserveAspectRatio="xMidYMid slice">
            <g className="auth-flow-map">
              <path d="M-80 780H170V620H420V380H720M-60 850H250V710H510V480H720M-70 180H110V340H310V520H720" />
              <path d="M70 1040V810H350V660H570V-60M-80 420H190V140H710" />
              <g className="auth-flow-parcels">
                <rect x="150" y="600" width="40" height="40" rx="4" />
                <rect x="400" y="360" width="40" height="40" rx="4" />
                <rect x="230" y="690" width="40" height="40" rx="4" />
                <rect x="290" y="320" width="40" height="40" rx="4" />
              </g>
            </g>
            <g className="auth-flow-stream"><path d="M-80 780H170V620H420V380H720" /><path d="M-60 850H250V710H510V480H720" /></g>
          </svg>
          <div className="auth-flow-light" />
        </div>
        
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3 mb-20">
            <img src={veniuxLogo} alt="" className="h-11 w-11 object-contain" />
            <span>
              <span className="block text-2xl font-semibold tracking-tight text-white">Veniux Cloud</span>
              <span className="block text-[10px] font-bold uppercase tracking-[.2em] text-slate-400 mt-0.5">İş Yönetim Platformu</span>
            </span>
          </Link>

          <div className="max-w-md">
            <div className="auth-eyebrow inline-flex items-center gap-2 mb-6">
              <span className="auth-eyebrow-line" />
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">{eyebrow}</span>
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white mb-6">
              İşinizin her adımı,<br />tek çalışma alanında.
            </h1>
            <p className="text-sm leading-relaxed text-slate-400">
              Veniux; depolarınız, stok kayıtlarınız ve CRM ekipleriniz için tasarlanmış, günlük iş akışlarını bir araya getiren kurumsal yönetim platformudur.
            </p>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-6 pt-12 border-t border-slate-800">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-brand-500">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-200">Kurumsal Güvenlik</h4>
              <p className="mt-1 text-xs text-slate-400">Rol bazlı erişim ile ekiplerinize görevlerine uygun yetkiler tanımlayın.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-brand-500">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-200">Merkezi İş Yönetimi</h4>
              <p className="mt-1 text-xs text-slate-400">Tüm şube ve lokasyonlarınızı tek bir veritabanı altyapısında, birbirine karışmadan yönetin.</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Right Panel - White Form */}
      <main className="flex flex-1 items-center justify-center p-6 sm:p-10 relative">
        <div className="w-full max-w-md">
          {/* Mobile Brand */}
          <div className="mb-8 lg:hidden">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={veniuxLogo} alt="" className="h-11 w-11 object-contain" />
              <div>
                <span className="block text-xl font-semibold text-slate-900 leading-tight">Veniux Cloud</span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Enterprise</span>
              </div>
            </Link>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-500">{description}</p>
          </div>

          <div className="auth-form-card bg-white p-8 rounded-lg border border-slate-200 shadow-sm">
            {children}
          </div>

          {footer && (
            <div className="mt-8 text-center text-[13px] text-slate-500 font-medium">{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}
