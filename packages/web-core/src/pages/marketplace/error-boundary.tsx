import { Component, type ReactNode } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component for Marketplace page
 * Catches rendering errors and provides a user-friendly fallback UI with retry functionality
 */
export class MarketplaceErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console for debugging
    console.error('Marketplace Error Boundary caught an error:', error, errorInfo);

    // You can also log to external error tracking service here
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      // Default fallback UI using Refly design system
      return (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: 'var(--refly-bg-body-z0)' }}
        >
          <div className="max-w-lg w-full mx-6">
            <div
              className="rounded-2xl p-8 border"
              style={{
                background: 'var(--refly-bg-content-z2)',
                borderColor: 'var(--refly-Card-Border)',
              }}
            >
              {/* Error Icon */}
              <div className="flex justify-center mb-6">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--refly-Colorful-red-light)' }}
                >
                  <AlertCircle className="w-7 h-7" style={{ color: 'var(--refly-Colorful-red)' }} />
                </div>
              </div>

              {/* Error Title */}
              <h2
                className="text-xl font-semibold text-center mb-3"
                style={{ color: 'var(--refly-text-0)' }}
              >
                Something went wrong
              </h2>

              {/* Error Description */}
              <p className="text-sm text-center mb-6" style={{ color: 'var(--refly-text-2)' }}>
                We encountered an unexpected error. Please try again.
              </p>

              {/* Error Details (collapsible in development) */}
              {this.state.error && process.env.NODE_ENV === 'development' && (
                <details
                  className="mb-6 p-3 rounded-lg border text-xs"
                  style={{
                    background: 'var(--refly-bg-control-z0)',
                    borderColor: 'var(--refly-Card-Border)',
                  }}
                >
                  <summary
                    className="cursor-pointer font-medium mb-2"
                    style={{ color: 'var(--refly-text-1)' }}
                  >
                    Error Details
                  </summary>
                  <pre
                    className="overflow-auto max-h-32 mt-2"
                    style={{ color: 'var(--refly-Colorful-red)' }}
                  >
                    {this.state.error.message}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 font-medium rounded-lg transition-all duration-200"
                  style={{
                    background: 'var(--refly-primary-default)',
                    color: '#ffffff',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--refly-primary-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--refly-primary-default)';
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 font-medium rounded-lg transition-all duration-200 border"
                  style={{
                    background: 'var(--refly-tertiary-default)',
                    color: 'var(--refly-text-0)',
                    borderColor: 'var(--refly-Card-Border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--refly-tertiary-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--refly-tertiary-default)';
                  }}
                >
                  Reload Page
                </button>
              </div>

              {/* Help Text */}
              <p className="text-xs text-center mt-6" style={{ color: 'var(--refly-text-3)' }}>
                If the problem persists, please contact support.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
