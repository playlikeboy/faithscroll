import { Platform } from 'react-native';
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  PACKAGE_TYPE,
  type PurchasesOffering,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';

import { logger } from '@/lib/logger';

import { isPaymentsConfigured } from './runtime';

export type PlanPeriod = 'annual' | 'monthly';

/** A purchasable option as the paywall shows it. Prices are localized by the store. */
export interface PlanOption {
  /** RevenueCat package identifier (stable key). */
  id: string;
  productId: string;
  period: PlanPeriod;
  title: string;
  priceString: string;
  /** e.g. "per year". */
  periodLabel: string;
  /** Annual plans: the store-localized monthly equivalent, e.g. "₹125". */
  monthlyEquivalent: string | null;
  /** Only set when the store offers a free trial this user is eligible for, e.g. "7-day free trial". */
  trialLabel: string | null;
  pkg: PurchasesPackage;
}

const PERIOD_ORDER: Record<PlanPeriod, number> = { annual: 0, monthly: 1 };

function periodOf(pkg: PurchasesPackage): PlanPeriod | null {
  if (pkg.packageType === PACKAGE_TYPE.ANNUAL) return 'annual';
  if (pkg.packageType === PACKAGE_TYPE.MONTHLY) return 'monthly';
  const period = pkg.product.subscriptionPeriod;
  if (period === 'P1Y' || period === 'P12M') return 'annual';
  if (period === 'P1M') return 'monthly';
  return null;
}

const UNIT_WORDS: Record<string, string> = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' };

export function formatTrial(count: number, unit: string): string | null {
  const word = UNIT_WORDS[unit.toUpperCase()];
  if (!word || !Number.isFinite(count) || count <= 0) return null;
  return `${count}-${word} free trial`;
}

/** Free trial described by the store product, if any (Android: free phase; iOS: $0 intro offer). */
export function trialLabelFor(product: PurchasesStoreProduct): string | null {
  const freePhase = product.defaultOption?.freePhase;
  if (freePhase) {
    const cycles = freePhase.billingCycleCount ?? 1;
    return formatTrial(freePhase.billingPeriod.value * cycles, freePhase.billingPeriod.unit);
  }
  const intro = product.introPrice;
  if (intro && intro.price === 0) return formatTrial(intro.periodNumberOfUnits * Math.max(1, intro.cycles), intro.periodUnit);
  return null;
}

/** Map an offering to paywall options (annual first). Products in `noTrialFor` never show a trial. */
export function toPlanOptions(offering: PurchasesOffering, noTrialFor: ReadonlySet<string> = new Set()): PlanOption[] {
  const options: PlanOption[] = [];
  for (const pkg of offering.availablePackages) {
    const period = periodOf(pkg);
    if (!period || options.some((option) => option.period === period)) continue;
    const { product } = pkg;
    options.push({
      id: pkg.identifier,
      productId: product.identifier,
      period,
      title: period === 'annual' ? 'Yearly' : 'Monthly',
      priceString: product.priceString,
      periodLabel: period === 'annual' ? 'per year' : 'per month',
      monthlyEquivalent: period === 'annual' ? product.pricePerMonthString : null,
      trialLabel: noTrialFor.has(product.identifier) ? null : trialLabelFor(product),
      pkg,
    });
  }
  return options.sort((a, b) => PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period]);
}

/** iOS shows intro offers to everyone in StoreKit metadata; ask which products this user can't use. */
async function findIneligibleTrials(offering: PurchasesOffering): Promise<Set<string>> {
  if (Platform.OS !== 'ios') return new Set();
  const ids = offering.availablePackages.filter((pkg) => pkg.product.introPrice).map((pkg) => pkg.product.identifier);
  if (ids.length === 0) return new Set();
  try {
    const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(ids);
    return new Set(
      ids.filter((id) => eligibility[id]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE),
    );
  } catch (error) {
    // Unknown eligibility: hide the trial rather than promise one the store may not honour.
    logger.warn('Could not check trial eligibility', { message: error instanceof Error ? error.message : 'unknown' });
    return new Set(ids);
  }
}

/** Load the current offering's plans. Empty when payments aren't configured or no offering is set up. */
export async function loadPlanOptions(): Promise<PlanOption[]> {
  if (!isPaymentsConfigured()) return [];
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return [];
  return toPlanOptions(current, await findIneligibleTrials(current));
}
