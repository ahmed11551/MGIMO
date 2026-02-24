import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg-main text-slate-900">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-100 flex items-center justify-center">
              <AlertTriangle size={32} className="text-rose-600" />
            </div>
            <h1 className="font-display font-bold text-xl mb-2">Что-то пошло не так</h1>
            <p className="text-slate-500 text-sm mb-6">
              Произошла ошибка. Попробуйте обновить страницу или вернуться позже.
            </p>
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-white font-medium hover:bg-brand-secondary transition-colors"
            >
              <RefreshCw size={18} />
              Обновить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
