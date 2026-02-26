import { StyleProvider, createCache } from '@ant-design/cssinjs';
import { ConfigProvider } from 'antd';
import { useConfigProviderStore } from '../store/useConfigProviderStore';

export const cssinjsCache = createCache();

export function ReflyConfigProvider({ children }: { children: React.ReactNode }) {
  const theme = useConfigProviderStore((state) => state.theme);
  return (
    <StyleProvider cache={cssinjsCache}>
      <ConfigProvider theme={theme}>{children}</ConfigProvider>
    </StyleProvider>
  );
}
