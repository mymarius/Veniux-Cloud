import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-gray-900">
          <div className="max-w-md w-full p-8 rounded-xl bg-gray-100 border border-gray-200 text-center shadow-2xl space-y-5">
            <div className="w-16 h-16 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Bir Şeyler Ters Gitti</h2>
              <p className="text-xs text-gray-500 mt-1">
                Beklenmeyen bir arayüz hatası yakalandı. Sayfayı yenileyebilir veya Dashboard'a dönebilirsiniz.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-slate-950 text-rose-300 font-mono text-xs text-left max-h-32 overflow-y-auto border border-gray-200">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 bg-white hover:bg-slate-700 text-gray-900 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Yenile
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 bg-brand-500 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-900/40"
              >
                <Home className="w-3.5 h-3.5" /> Dashboard'a Dön
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

