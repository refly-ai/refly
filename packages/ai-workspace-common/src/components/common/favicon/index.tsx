import { serverOrigin } from '@refly/ui-kit';
import { useMemo } from 'react';
import { Mcp } from 'refly-icons';

export const Favicon = (props: { url: string; size?: number; isMcp?: boolean }) => {
  const { size = 12, url, isMcp = false } = props;
  // Fallback: render MCP icon if it's an MCP tool, otherwise render a generic icon
  if (isMcp) {
    return (
      <div style={{ width: size, height: size }} className="flex items-center justify-center">
        <Mcp size={size} color="var(--refly-text-1)" />
      </div>
    );
  }

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

  if (!faviconUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center bg-gray-100 rounded-sm"
      >
        <span className="text-xs text-gray-400">?</span>
      </div>
    );
  }

  return <img style={{ width: size, height: size }} src={faviconUrl} alt={`${url}`} />;
};
