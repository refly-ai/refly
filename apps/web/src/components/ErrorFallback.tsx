import { memo } from 'react';
import { RefreshCw, AlertCircle, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ErrorFallbackProps {
  error: Error;
  componentStack?: string;
  eventId?: string;
  resetError?: () => void;
  isGlobal?: boolean;
}

/**
 * Error Fallback Component
 * Provides a user-friendly error UI that matches the Refly design system
 */
export const ErrorFallback = memo<ErrorFallbackProps>(
  ({ error, componentStack, resetError, isGlobal = false }) => {
    const navigate = useNavigate();

    const handleGoHome = () => {
      navigate('/');
      resetError?.();
    };

    const handleReload = () => {
      window.location.reload();
    };

    return (
      <div
        className="w-full h-full flex items-center justify-center min-h-screen"
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
              {isGlobal
                ? 'We encountered an unexpected error. Please refresh the page or return to the home page.'
                : 'Something went wrong while loading this page. Please try again or return to the home page.'}
            </p>

            {/* Error Details (only shown in development and test environments) */}
            {error &&
              (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && (
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
                    className="overflow-auto max-h-32 mt-2 whitespace-pre-wrap break-words"
                    style={{ color: 'var(--refly-Colorful-red)' }}
                  >
                    {error.message}
                    {componentStack && (
                      <>
                        {'\n\n'}
                        Component Stack:
                        {componentStack}
                      </>
                    )}
                    {error.stack && (
                      <>
                        {'\n\n'}
                        Stack Trace:
                        {error.stack}
                      </>
                    )}
                  </pre>
                </details>
              )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {resetError && !isGlobal && (
                <button
                  type="button"
                  onClick={resetError}
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
              )}
              <button
                type="button"
                onClick={handleGoHome}
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
                <Home className="w-4 h-4" />
                Go Home
              </button>
              <button
                type="button"
                onClick={handleReload}
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
                <RefreshCw className="w-4 h-4" />
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
  },
);

ErrorFallback.displayName = 'ErrorFallback';
