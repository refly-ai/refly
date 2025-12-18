import { Statsig, StatsigUser } from '@statsig/statsig-node-core';

let statsig: Statsig | null = null;

type StatsigUserCustomValue = string | number | boolean | Array<string | number | boolean>;
type StatsigUserCustom = Record<string, StatsigUserCustomValue>;

export const setupStatsig = async () => {
  const secretKey = process.env.STATSIG_SECRET_KEY;
  if (!secretKey) {
    // STATSIG_SECRET_KEY not set - skip setup silently
    return;
  }

  statsig = new Statsig(secretKey, { environment: process.env.NODE_ENV });
  await statsig.initialize();
};

/**
 * Update Statsig user properties (User Properties in Statsig Console).
 * This is NOT event metadata.
 *
 * For server SDKs, user properties are recorded by identifying the user with a StatsigUser object.
 */
export const updateUserProperties = (
  user: { uid: string; email?: string },
  custom: StatsigUserCustom,
) => {
  if (!statsig) {
    return;
  }

  statsig.identify(new StatsigUser({ userID: user.uid, email: user.email, custom }));
};

export const logEvent = (
  user: { uid: string; email?: string },
  eventName: string,
  value?: string | number,
  metadata?: Record<string, any>,
) => {
  if (!statsig) {
    return;
  }

  statsig.logEvent(
    new StatsigUser({ userID: user.uid, email: user.email }),
    eventName,
    value,
    metadata,
  );
};
