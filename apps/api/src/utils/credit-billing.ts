import { CreditBilling } from '@refly/openapi-schema';

type LegacyCreditBilling = Partial<CreditBilling> & {
  unitCost?: number;
};

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

export const normalizeCreditBilling = (raw: unknown): CreditBilling | undefined => {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const legacy = raw as LegacyCreditBilling;

  const fallbackUnitCost = parseNumber(legacy.unitCost);
  let inputCost = parseNumber(legacy.inputCost);
  let outputCost = parseNumber(legacy.outputCost);

  if (inputCost === undefined && fallbackUnitCost !== undefined) {
    const half = fallbackUnitCost / 2;
    inputCost = half;
  }
  if (outputCost === undefined && fallbackUnitCost !== undefined) {
    const half = fallbackUnitCost / 2;
    outputCost = half;
  }

  const cacheReadCost = parseNumber(legacy.cacheReadCost);
  const cacheWriteCost = parseNumber(legacy.cacheWriteCost);

  const normalized: CreditBilling = {
    unit: typeof legacy.unit === 'string' ? legacy.unit : 'request',
    inputCost,
    outputCost,
    cacheReadCost,
    cacheWriteCost,
    minCharge: parseNumber(legacy.minCharge) ?? 0,
  };

  if (typeof legacy.isEarlyBirdFree === 'boolean') {
    normalized.isEarlyBirdFree = legacy.isEarlyBirdFree;
  }

  return normalized;
};
