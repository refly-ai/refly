/**
 * Pricing constants for subscription plans
 * These prices are currently hardcoded and should match Stripe configuration
 */
export const SUBSCRIPTION_PRICES = {
  plus: {
    monthly: 19.9,
    yearly: 15.9,
    yearlyTotal: 190,
  },
  starter: {
    monthly: 24.9,
    yearly: 19.9,
    yearlyTotal: 238.8,
  },
  maker: {
    monthly: 49.9,
    yearly: 39.9,
    yearlyTotal: 478.8,
  },
} as const;

/**
 * Get the base monthly price for a plan (rounded down for discount calculations)
 */
export const getBaseMonthlyPrice = (plan: keyof typeof SUBSCRIPTION_PRICES): number => {
  return Math.floor(SUBSCRIPTION_PRICES[plan].monthly);
};
