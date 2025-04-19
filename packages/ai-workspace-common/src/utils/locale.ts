import { safeParseJSON } from '@refly/utils/parse';

export const mapDefaultLocale = (locale: string) => {
  if (locale?.toLocaleLowerCase()?.startsWith('zh')) {
    return 'zh-CN';
  }

  return 'en';
};

export const getLocale = () => {
  const settings = safeParseJSON(localStorage.getItem('refly-local-settings'));
  return settings?.uiLocale || 'en';
};
