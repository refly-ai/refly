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
 * 轻量级 Fallback ErrorBoundary
 * 在 Sentry ErrorBoundary 加载之前使用
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
    // 简单的错误日志，不依赖 Sentry
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

/**
 * 懒加载的 ErrorBoundary 组件
 *
 * 特点：
 * 1. 不阻塞初始渲染 - 先用轻量级 Fallback ErrorBoundary
 * 2. 异步加载 Sentry ErrorBoundary - 在后台加载完整的错误追踪
 * 3. 加载失败时降级 - 如果 Sentry 加载失败，继续使用 Fallback
 */
export const LazyErrorBoundary = ({ children }: LazyErrorBoundaryProps) => {
  // 懒加载 Sentry ErrorBoundary
  const SentryErrorBoundaryLazy = lazy<typeof SentryErrorBoundary>(() =>
    import('@sentry/react')
      .then((module) => ({
        default: module.ErrorBoundary,
      }))
      .catch((error) => {
        console.warn('Failed to load Sentry ErrorBoundary, using fallback:', error);
        // 加载失败时，返回 FallbackErrorBoundary
        return {
          default: FallbackErrorBoundary as any,
        };
      }),
  );

  return (
    <FallbackErrorBoundary>
      <Suspense fallback={children}>
        <SentryErrorBoundaryLazy>{children}</SentryErrorBoundaryLazy>
      </Suspense>
    </FallbackErrorBoundary>
  );
};
