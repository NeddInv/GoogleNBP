import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message || 'Unexpected application error' };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Application ErrorBoundary Caught]:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearAndReset = () => {
    try {
      localStorage.removeItem('adgen-form-state');
      indexedDB.deleteDatabase('AdGenStorage');
    } catch (e) {
      console.error('Failed to clean storage', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div id="error-boundary-screen" className="min-h-screen bg-[#0c0f1d] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-[#15192e] border border-white/10 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
              !
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">Application Notice</h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                The interface encountered an unexpected issue while rendering. You can reload or reset stored form data to restore normal operation.
              </p>
            </div>

            {this.state.errorMessage && (
              <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-left overflow-x-auto max-h-40 text-xs font-mono text-red-300">
                {this.state.errorMessage}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                id="error-reload-button"
                onClick={this.handleReload}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition shadow-lg shadow-indigo-600/20 text-sm cursor-pointer"
              >
                Reload Application
              </button>
              <button
                id="error-reset-button"
                onClick={this.handleClearAndReset}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl transition border border-slate-700 text-sm cursor-pointer"
              >
                Reset Cache & Restart
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

