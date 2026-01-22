import { Statsig, StatsigUser } from '@statsig/statsig-node-core';

let statsig: Statsig | null = null;

export type StatsigUserCustomValue = string | number | boolean | Array<string | number | boolean>;
export type StatsigUserCustom = Record<string, StatsigUserCustomValue>;

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

  const cleanedCustom: Record<string, StatsigUserCustomValue> = {};
  for (const [key, value] of Object.entries(custom)) {
    if (value !== null && value !== undefined) {
      cleanedCustom[key] = value;
    }
  }

  try {
    statsig.identify(
      new StatsigUser({ userID: user.uid, email: user.email, custom: cleanedCustom }),
    );
  } catch (error) {
    console.error('Failed to update user properties:', error);
  }
};

/**
 * Convert all values in an object to strings recursively
 */
const convertMetadataToStrings = (obj: Record<string, any>): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = String(value ?? '');
    } else if (typeof value === 'object') {
      result[key] = JSON.stringify(value);
    } else {
      result[key] = String(value);
    }
  }
  return result;
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

  const stringMetadata = metadata ? convertMetadataToStrings(metadata) : undefined;

  statsig.logEvent(
    new StatsigUser({ userID: user.uid, email: user.email }),
    eventName,
    value,
    stringMetadata,
  );
};
