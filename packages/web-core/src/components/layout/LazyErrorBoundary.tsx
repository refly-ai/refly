import { Component, ReactNode, lazy, Suspense } from 'react';
import type { ErrorBoundary as SentryErrorBoundary } from '@sentry/react';

interface FallbackErrorBoundaryProps {
  children: ReactNode;
}

interface FallbackErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Lightweight Fallback ErrorBoundary
 * Used before Sentry ErrorBoundary loads
 */
class FallbackErrorBoundary extends Component<
  FallbackErrorBoundaryProps,
  FallbackErrorBoundaryState
> {
  constructor(props: FallbackErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): FallbackErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Simple error logging without Sentry dependency
    console.error('Error caught by fallback boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ marginBottom: '16px', color: '#ff4d4f' }}>Something went wrong</h2>
          <p style={{ marginBottom: '16px', color: '#666' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          {/* biome-ignore lint/a11y/useButtonType: <explanation> */}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0E9F77',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface LazyErrorBoundaryProps {
  children: ReactNode;
}

// Lazy load Sentry ErrorBoundary at module scope (only created once)
const SentryErrorBoundaryLazy = lazy<typeof SentryErrorBoundary>(() =>
  import('@sentry/react')
    .then((module) => ({
      default: module.ErrorBoundary,
    }))
    .catch((error) => {
      console.warn('Failed to load Sentry ErrorBoundary, using fallback:', error);
      // Return FallbackErrorBoundary on load failure
      return {
        default: FallbackErrorBoundary as any,
      };
    }),
);

/**
 * Lazy-loaded ErrorBoundary component
 *
 * Features:
 * 1. Non-blocking initial render - Uses lightweight Fallback ErrorBoundary first
 * 2. Async Sentry ErrorBoundary loading - Loads full error tracking in background
 * 3. Graceful degradation - Falls back to FallbackErrorBoundary if Sentry fails to load
 */
export const LazyErrorBoundary = ({ children }: LazyErrorBoundaryProps) => {
  return (
    <FallbackErrorBoundary>
      <Suspense fallback={children}>
        <SentryErrorBoundaryLazy>{children}</SentryErrorBoundaryLazy>
      </Suspense>
    </FallbackErrorBoundary>
  );
};
