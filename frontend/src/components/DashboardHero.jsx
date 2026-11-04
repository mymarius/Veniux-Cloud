import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FolderSearch, Plus, ScanLine, ShieldCheck, ClipboardList, Sparkles } from 'lucide-react';
import apiClient from '../api/client';
import { useToast } from './Toast';

export function DashboardHero({ onStockEntry, onRefresh }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  return (
    <section 
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8" 
      data-testid="dashboard-hero"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-center">
        {/* Left Content */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Sisteme Hoş Geldiniz
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> 
              Sistem Çevrimiçi
            </span>
          </div>

          <p className="text-sm text-slate-500 max-w-xl">
            Tesisinizin mevcut depo kapasitesi, stok hareketleri ve operasyonel verileri eşzamanlı olarak takip edilmektedir.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <button 
              onClick={onStockEntry} 
              className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Hızlı Stok Girişi
            </button>
            <button 
              onClick={onRefresh} 
              className="inline-flex h-10 items-center gap-2 rounded-md bg-white border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <ArrowRight className="h-4 w-4 text-slate-400" /> Raporlara Git
            </button>
          </div>
        </div>

        {/* Right Status Panel */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Ağ & Servis Durumu</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Stabil
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-200/70 text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">Güvenli Bağlantı</p>
                <p className="mt-0.5 text-[11px] text-slate-500">256-bit şifreleme aktif</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-200/70 text-slate-600">
                <ClipboardList className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">Veritabanı Senkronizasyonu</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Gerçek zamanlı kayıt</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}