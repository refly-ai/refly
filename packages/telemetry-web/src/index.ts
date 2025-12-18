import { StatsigClient } from '@statsig/js-client';
import type { StatsigUser } from '@statsig/js-client';
import { StatsigSessionReplayPlugin } from '@statsig/session-replay';
import { StatsigAutoCapturePlugin } from '@statsig/web-analytics';
import Cookie from 'js-cookie';
import { UID_COOKIE } from '@refly/utils';

let statsigClient: StatsigClient | null = null;

const getUserID = () => Cookie.get(UID_COOKIE);

export const setupStatsig = async () => {
  const clientKey = process.env.VITE_STATSIG_CLIENT_KEY;
  if (!clientKey) {
    console.warn('VITE_STATSIG_CLIENT_KEY is not set, skipping statsig setup');
    return;
  }

  statsigClient = new StatsigClient(
    clientKey,
    { userID: getUserID() },
    {
      environment: { tier: process.env.NODE_ENV },
      plugins: [new StatsigSessionReplayPlugin(), new StatsigAutoCapturePlugin()],
    },
  );

  await statsigClient.initializeAsync();
  console.log(`statsig initialized for env: ${process.env.NODE_ENV}`);
};

/**
 * Update Statsig user properties (User Properties in Statsig Console).
 * This is NOT event metadata.
 */
export const updateUserProperties = (custom: NonNullable<StatsigUser['custom']>) => {
  if (!statsigClient) {
    return;
  }

  // Fire-and-forget: update the Statsig user object (including custom user properties).
  void statsigClient.updateUserAsync({ userID: getUserID(), custom });
};

export const logEvent = (
  eventName: string,
  value?: string | number | null,
  metadata?: Record<string, any>,
) => {
  if (!statsigClient) {
    return;
  }

  statsigClient.logEvent(eventName, value ?? undefined, metadata);
};
