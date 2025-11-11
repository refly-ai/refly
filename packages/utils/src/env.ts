import { IRuntime } from '@refly/common-types';

export enum IENV {
  PRODUCTION = 'production',
  STAGING = 'staging',
  TEST = 'test',
  DEVELOPMENT = 'development',
}

export const getEnv = () => {
  const env = process.env.NODE_ENV;

  return env;
};

export const getOsType = () => {
  const t = navigator.userAgent;
  const n = navigator.platform;
  const a = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K', 'macOS'];
  const i = ['Win32', 'Win64', 'Windows', 'WinCE'];
  const s = ['iPhone', 'iPad', 'iPod'];
  return a.indexOf(n) !== -1
    ? 'OSX'
    : s.indexOf(n) !== -1
      ? 'IOS'
      : i.indexOf(n) !== -1
        ? 'Windows'
        : /Android/.test(t)
          ? 'Android'
          : /Linux/.test(n)
            ? 'Linux'
            : (() => {
                console.error('unable to detect os type, use Windows as default', n, t);
                return 'Windows';
              })();
};

export const isChrome = () => {
  const t = navigator.userAgent;
  const n = t.includes('Chrome') && t.includes('Safari');
  const a = t.includes('Edg');
  const i = t.includes('OPR');
  return n && !a && !i;
};

declare global {
  interface Window {
    ENV?: {
      API_URL?: string;
      COLLAB_URL?: string;
      STATIC_PUBLIC_ENDPOINT?: string;
      STATIC_PRIVATE_ENDPOINT?: string;
      SUBSCRIPTION_ENABLED?: boolean;
      CANVAS_TEMPLATE_ENABLED?: boolean;
      SENTRY_ENABLED?: boolean;
      ENV_TAG?: string;
    };

    ipcRenderer?: {
      invoke: (channel: string, args: any) => Promise<any>;
    };

    electronEnv?: {
      getApiBaseUrl: () => string;
      getCollabUrl: () => string;
      getPublicStaticEndpoint: () => string;
      getPrivateStaticEndpoint: () => string;
    };
  }
}

let runtime: IRuntime;

export const getRuntime = () => {
  return runtime;
};

export const setRuntime = (r: IRuntime) => {
  runtime = r;
};

export class ReflyEnv {
  getOsType() {
    const t = navigator.userAgent;
    const n = navigator.platform;
    const a = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K', 'macOS'];
    const i = ['Win32', 'Win64', 'Windows', 'WinCE'];
    const s = ['iPhone', 'iPad', 'iPod'];
    return a.indexOf(n) !== -1
      ? 'OSX'
      : s.indexOf(n) !== -1
        ? 'IOS'
        : i.indexOf(n) !== -1
          ? 'Windows'
          : /Android/.test(t)
            ? 'Android'
            : /Linux/.test(n)
              ? 'Linux'
              : (() => {
                  console.error('unable to detect os type, use Windows as default', n, t);
                  return 'Windows';
                })();
  }
  isChrome() {
    const t = navigator.userAgent;
    const n = t.includes('Chrome') && t.includes('Safari');
    const a = t.includes('Edg');
    const i = t.includes('OPR');
    return n && !a && !i;
  }

  getDefaultShortcutKey() {
    return 'b';
  }

  getDefaultSendShortcutKey() {
    return 'enter';
  }
}

export const reflyEnv = new ReflyEnv();
