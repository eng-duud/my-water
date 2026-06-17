import Decimal from 'decimal.js';
import { DEFAULT_PRICING } from './constants';

interface BillingParams {
  workUnits: number;
  previousReading: Decimal | number | string;
  currentReading: Decimal | number | string;
  consumptionOverride?: Decimal | number | string;
  workUnitPrice?: Decimal | number | string;
  tier1Limit?: Decimal | number | string;
  tier1Price?: Decimal | number | string;
  tier2Price?: Decimal | number | string;
}

interface BillingResult {
  consumption: Decimal;
  workUnitsTotal: Decimal;
  tier1Units: Decimal;
  tier1Cost: Decimal;
  tier2Units: Decimal;
  tier2Cost: Decimal;
  totalAmount: Decimal;
}

export function calculateBill(params: BillingParams): BillingResult {
  const previous = new Decimal(params.previousReading);
  const current = new Decimal(params.currentReading);
  
  const wUnitPrice = new Decimal(params.workUnitPrice ?? DEFAULT_PRICING.workUnitPrice);
  const t1Limit = new Decimal(params.tier1Limit ?? DEFAULT_PRICING.tier1Limit);
  const t1Price = new Decimal(params.tier1Price ?? DEFAULT_PRICING.tier1Price);
  const t2Price = new Decimal(params.tier2Price ?? DEFAULT_PRICING.tier2Price);

  // Consumption = override if provided, else Current - Previous
  const consumption = params.consumptionOverride !== undefined
    ? new Decimal(params.consumptionOverride)
    : Decimal.max(current.minus(previous), new Decimal(0));
  
  // Work units fee
  const workUnitsTotal = new Decimal(params.workUnits).times(wUnitPrice);
  
  // Flat pricing: all units at 700 if consumption <= 4, all units at 1000 if > 4
  const { tier1Units, tier1Cost, tier2Units, tier2Cost } = consumption.lessThanOrEqualTo(t1Limit)
    ? {
        tier1Units: consumption,
        tier1Cost: consumption.times(t1Price),
        tier2Units: new Decimal(0),
        tier2Cost: new Decimal(0),
      }
    : {
        tier1Units: new Decimal(0),
        tier1Cost: new Decimal(0),
        tier2Units: consumption,
        tier2Cost: consumption.times(t2Price),
      };
  
  // Total Bill
  const totalAmount = workUnitsTotal.plus(tier1Cost).plus(tier2Cost);
  
  return {
    consumption,
    workUnitsTotal,
    tier1Units,
    tier1Cost,
    tier2Units,
    tier2Cost,
    totalAmount,
  };
}
