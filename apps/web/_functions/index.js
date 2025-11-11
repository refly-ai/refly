/**
 * Cloudflare Pages Function to proxy landing page requests
 * This function intercepts requests to the root path (/) and proxies them to the landing page
 * while keeping the original URL in the browser address bar
 */

// Target landing page URL
const LANDING_PAGE_URL = 'https://refly.framer.website/';

/**
 * Handle incoming requests
 * @param {Object} context - The request context from Cloudflare Pages
 * @param {Request} context.request - The incoming request object
 * @param {Function} context.next - Function to pass control to the next handler
 * @returns {Promise<Response>} The proxied response
 */
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Only handle root path requests
  // Note: This function only matches the root path (/) due to file system routing
  // Other paths like /app, /dashboard will not trigger this function
  if (url.pathname !== '/') {
    // Pass control to Pages for normal handling
    return context.next();
  }

  try {
    // Create a new request to the landing page
    const targetUrl = new URL(LANDING_PAGE_URL);
    const proxyRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        // Set Host header to target domain
        Host: targetUrl.host,
        // Add forwarding headers for reference
        'X-Forwarded-Host': url.host,
        'X-Forwarded-Proto': url.protocol.slice(0, -1), // Remove trailing ':'
        'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
      },
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    });

    // Fetch the landing page content
    const response = await fetch(proxyRequest);

    // Clone the response headers
    const responseHeaders = new Headers(response.headers);

    // Create a new response with the fetched content
    // This ensures the browser sees the original URL (yourdomain.com/)
    const proxiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

    return proxiedResponse;
  } catch (error) {
    // If proxying fails, return an error response
    console.error('Error proxying landing page:', error);
    return new Response('Failed to load landing page', {
      status: 500,
      statusText: 'Internal Server Error',
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
}
