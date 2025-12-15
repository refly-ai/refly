import { Statsig, StatsigUser } from '@statsig/statsig-node-core';

let statsig: Statsig | null = null;

export const setupStatsig = async () => {
  const secretKey = process.env.STATSIG_SECRET_KEY;
  if (!secretKey) {
    // STATSIG_SECRET_KEY not set - skip setup silently
    return;
  }

  statsig = new Statsig(secretKey, { environment: process.env.NODE_ENV });
  await statsig.initialize();
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
