import { IENV, getEnv } from './env';

const overrideLocalDev = false;

export let SENTRY_DSN =
  'https://3a105c6104e4c4de3ead00dc11f16623@o4507205453414400.ingest.us.sentry.io/4507209639133184';

export const SERVER_PROD_DOMAIN = 'https://api.refly.ai';
export const SERVER_STAGING_DOMAIN = 'https://staging-api.refly.ai';
export const SERVER_DEV_DOMAIN = 'http://localhost:3000';

export const WS_SERVER_PROD_DOMAIN = 'wss://collab.refly.ai';
export const WS_SERVER_STAGING_DOMAIN = 'wss://staging-collab.refly.ai';
export const WS_SERVER_DEV_DOMAIN = 'ws://localhost:1234';

export const CLIENT_PROD_APP_DOMAIN = 'https://refly.ai';
export const CLIENT_STAGING_APP_DOMAIN = 'https://staging.refly.ai';
export const CLIENT_DEV_APP_DOMAIN = 'http://localhost:5173';

export const CLIENT_DEV_COOKIE_DOMAIN = 'http://localhost:3000';
export const CLIENT_PROD_COOKIE_DOMAIN = '.refly.ai';

export const getCookieOrigin = () => {
  if (overrideLocalDev) {
    return CLIENT_DEV_APP_DOMAIN;
  }
  return getEnv() === IENV.DEVELOPMENT ? CLIENT_DEV_COOKIE_DOMAIN : CLIENT_PROD_COOKIE_DOMAIN;
};

export const getExtensionId = () => {
  if (overrideLocalDev) {
    return 'lecbjbapfkinmikhadakbclblnemmjpd';
  }

  return getEnv() === IENV.DEVELOPMENT ? 'lecbjbapfkinmikhadakbclblnemmjpd' : 'lecbjbapfkinmikhadakbclblnemmjpd';
};

export const getServerOrigin = () => {
  // return PROD_DOMAIN
  if (overrideLocalDev) {
    return CLIENT_DEV_COOKIE_DOMAIN;
  }
  if (window?.location?.hostname === 'staging.refly.ai') {
    return SERVER_STAGING_DOMAIN;
  }
  return getEnv() === IENV.DEVELOPMENT ? SERVER_DEV_DOMAIN : SERVER_PROD_DOMAIN;
};

export const getWsServerOrigin = () => {
  if (overrideLocalDev) {
    return WS_SERVER_DEV_DOMAIN;
  }
  if (window?.location?.hostname === 'staging.refly.ai') {
    return WS_SERVER_STAGING_DOMAIN;
  }
  return getEnv() === IENV.DEVELOPMENT ? WS_SERVER_DEV_DOMAIN : WS_SERVER_PROD_DOMAIN;
};

export const getClientOrigin = () => {
  if (overrideLocalDev) {
    return CLIENT_DEV_APP_DOMAIN;
  }

  return getEnv() === IENV.DEVELOPMENT ? CLIENT_DEV_APP_DOMAIN : CLIENT_PROD_APP_DOMAIN;
};

export function safeParseURL(url: string) {
  try {
    const urlObj = new URL(url);

    return urlObj?.origin;
  } catch (err) {
    return url || '';
  }
}
