import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
    };
  }

  override render() {
    if (this.state.hasError) {
      let parsedDetails: Record<string, unknown> | null = null;
      try {
        parsedDetails = JSON.parse(this.state.errorMessage);
      } catch {
        parsedDetails = null;
      }

      return (
        <div className="min-h-screen bg-[#F0F9F5] flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-3xl border border-red-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-7 h-7 shrink-0" />
              <h2 className="text-lg font-extrabold text-slate-900">
                Application or Firestore Security Rule Error
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              Siaam Store encountered an error while processing a database or UI operation.
            </p>
            {parsedDetails ? (
              <pre className="text-xs bg-slate-900 text-emerald-300 p-3.5 rounded-xl overflow-x-auto">
                {JSON.stringify(parsedDetails, null, 2)}
              </pre>
            ) : (
              <div className="text-xs bg-red-50 text-red-800 p-3.5 rounded-xl font-mono break-words">
                {this.state.errorMessage}
              </div>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="w-full py-3 rounded-xl bg-[#00A86B] hover:bg-[#059669] text-white font-bold text-sm flex items-center justify-center gap-2 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Siaam Store
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
