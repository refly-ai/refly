import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

/**
 * OAuth Callback Page
 * Handles OAuth redirect from third-party services (e.g., Composio)
 * Signals the parent window about OAuth completion via localStorage
 */
export const OAuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing OAuth authorization...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get all URL parameters
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        console.log('OAuth callback received:', {
          code: code ? 'present' : 'missing',
          state,
          error,
          errorDescription,
        });

        // Check if there's an error from OAuth provider
        if (error) {
          console.error('OAuth error:', error, errorDescription);
          setStatus('error');
          setMessage(errorDescription || error || 'Authorization failed');
          return;
        }

        // Check if we have the authorization code
        if (!code) {
          console.error('No authorization code received');
          setStatus('error');
          setMessage('No authorization code received');
          return;
        }

        // Retrieve pending OAuth info from localStorage
        const pendingOAuthStr = localStorage.getItem('composio_pending_oauth');
        if (!pendingOAuthStr) {
          console.error('No pending OAuth found in localStorage');
          setStatus('error');
          setMessage('OAuth session not found. Please try again.');
          return;
        }

        const pendingOAuth = JSON.parse(pendingOAuthStr);
        console.log('Pending OAuth info:', pendingOAuth);

        // Signal completion to the parent window via localStorage
        // This will trigger a storage event in other tabs/windows
        localStorage.setItem(
          'composio_oauth_completed',
          JSON.stringify({
            app: pendingOAuth.app,
            toolKey: pendingOAuth.toolKey,
            code,
            state,
            timestamp: Date.now(),
          }),
        );

        console.log('OAuth completion signal sent');

        setStatus('success');
        setMessage('Authorization successful! You can close this window now.');

        // Auto-close the window after 2 seconds
        setTimeout(() => {
          window.close();
        }, 2000);
      } catch (error) {
        console.error('Error handling OAuth callback:', error);
        setStatus('error');
        setMessage('Failed to process OAuth callback');
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
        {status === 'processing' && (
          <>
            <Spin size="large" />
            <p className="mt-4 text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircleOutlined className="text-6xl text-green-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Success!</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <CloseCircleOutlined className="text-6xl text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600">{message}</p>
            <button
              type="button"
              onClick={() => window.close()}
              className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md"
            >
              Close Window
            </button>
          </>
        )}
      </div>
    </div>
  );
};
