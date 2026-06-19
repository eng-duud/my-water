import Decimal from 'decimal.js';
import { DEFAULT_PRICING } from './constants';

interface BillingParams {
  workUnits: number | string | Decimal;
  previousReading: Decimal | number | string;
  currentReading: Decimal | number | string;
  consumptionOverride?: Decimal | number | string;
  workUnitPrice?: Decimal | number | string;
  tier1Limit?: Decimal | number | string;
  tier1Price?: Decimal | number | string;
  tier2Price?: Decimal | number | string;
  serviceFee?: Decimal | number | string;
  fine?: Decimal | number | string;
  exemption?: Decimal | number | string;
}

interface BillingResult {
  consumption: Decimal;
  workUnitsTotal: Decimal;
  tier1Units: Decimal;
  tier1Cost: Decimal;
  tier2Units: Decimal;
  tier2Cost: Decimal;
  serviceFee: Decimal;
  fine: Decimal;
  exemption: Decimal;
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
  
  // Work units fee (separate flat fee, not added to tiered consumption)
  const workUnitsTotal = new Decimal(params.workUnits).times(wUnitPrice);
  
  // Progressive tiered pricing (based on regular consumption only)
  const tier1Units = Decimal.min(consumption, t1Limit);
  const tier1Cost = tier1Units.times(t1Price);
  const tier2Units = Decimal.max(consumption.minus(t1Limit), new Decimal(0));
  const tier2Cost = tier2Units.times(t2Price);
  
  const serviceFee = new Decimal(params.serviceFee ?? 0);
  const fine = new Decimal(params.fine ?? 0);
  const exemption = new Decimal(params.exemption ?? 0);
  
  // Minimum fee floor: 1,000 YER applied on consumption cost
  const rawConsumptionCost = tier1Cost.plus(tier2Cost);
  const MINIMUM_FEE = new Decimal(1000);
  const adjustedConsumptionCost = Decimal.max(rawConsumptionCost, MINIMUM_FEE);

  // Total Bill = work units fee + adjusted consumption cost + service fees + fines - exemptions
  const totalAmount = workUnitsTotal.plus(adjustedConsumptionCost).plus(serviceFee).plus(fine).minus(exemption);
  
  return {
    consumption,
    workUnitsTotal,
    tier1Units,
    tier1Cost,
    tier2Units,
    tier2Cost,
    serviceFee,
    fine,
    exemption,
    totalAmount,
  };
}


