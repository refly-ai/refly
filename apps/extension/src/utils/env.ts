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

export class ReflyEnv {
  getExtensionVersion() {
    return browser.runtime.getManifest().version;
  }
  async tryGetTab(t) {
    try {
      return await browser.tabs.get(Number.parseInt(t));
    } catch {
      return null;
    }
  }
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
              : this.getDefaultOsType(n, t);
  }

  private getDefaultOsType(platform: string, userAgent: string) {
    console.error('unable to detect os type, use Windows as default', platform, userAgent);
    return 'Windows';
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
