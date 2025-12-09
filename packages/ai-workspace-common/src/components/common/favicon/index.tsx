import { serverOrigin } from '@refly/ui-kit';
import { useMemo } from 'react';
import { Mcp } from 'refly-icons';

export const Favicon = (props: { url: string; size?: number }) => {
  const { size = 12, url } = props;

  const faviconUrl = useMemo(() => {
    if (!url || url.trim() === '') {
      return null;
    }

    try {
      const { host } = new URL(url);
      return `${serverOrigin}/v1/misc/favicon?domain=${host}`;
    } catch (_error) {
      // Invalid URL, return null to indicate fallback behavior
      return null;
    }
  }, [url]);

  // Fallback: render MCP icon when favicon URL is not available
  if (!faviconUrl) {
    return (
      <div style={{ width: size, height: size }} className="flex items-center justify-center">
        <Mcp size={size} color="var(--refly-text-1)" />
      </div>
    );
  }

  return <img style={{ width: size, height: size }} src={faviconUrl} alt={`${url}`} />;
};
