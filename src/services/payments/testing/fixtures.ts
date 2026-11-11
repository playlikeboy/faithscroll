/**
 * Test-only fixtures for RevenueCat objects. Never import from app code.
 */
import type {
  CustomerInfo,
  PurchasesEntitlementInfo,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesStoreProduct,
} from 'react-native-purchases';

export function makeEntitlement(overrides: Partial<PurchasesEntitlementInfo> = {}): PurchasesEntitlementInfo {
  return {
    identifier: 'plus',
    isActive: true,
    willRenew: true,
    periodType: 'NORMAL',
    latestPurchaseDate: '2026-11-01T00:00:00.000Z',
    originalPurchaseDate: '2026-11-01T00:00:00.000Z',
    expirationDate: '2099-01-01T00:00:00.000Z',
    store: 'APP_STORE',
    productIdentifier: 'faithscroll_plus_yearly',
    productPlanIdentifier: null,
    isSandbox: true,
    unsubscribeDetectedAt: null,
    billingIssueDetectedAt: null,
    ...overrides,
  } as PurchasesEntitlementInfo;
}

export function makeCustomerInfo(plus: PurchasesEntitlementInfo | null = null, managementURL: string | null = null): CustomerInfo {
  const all = plus ? { plus } : {};
  const active = plus?.isActive ? { plus } : {};
  return { entitlements: { all, active, verification: 'NOT_REQUESTED' }, managementURL } as unknown as CustomerInfo;
}

export function makeProduct(overrides: Partial<PurchasesStoreProduct> = {}): PurchasesStoreProduct {
  return {
    identifier: 'faithscroll_plus_monthly',
    title: 'Faithscroll Plus',
    description: '',
    price: 3.99,
    priceString: '$3.99',
    pricePerMonthString: '$3.99',
    currencyCode: 'USD',
    introPrice: null,
    discounts: null,
    subscriptionPeriod: 'P1M',
    defaultOption: null,
    subscriptionOptions: null,
    ...overrides,
  } as PurchasesStoreProduct;
}

export function makePackage(packageType: string, product: PurchasesStoreProduct, identifier?: string): PurchasesPackage {
  return {
    identifier: identifier ?? `$rc_${packageType.toLowerCase()}`,
    packageType,
    product,
    offeringIdentifier: 'default',
  } as unknown as PurchasesPackage;
}

export function makeOffering(packages: PurchasesPackage[]): PurchasesOffering {
  return { identifier: 'default', availablePackages: packages } as unknown as PurchasesOffering;
}
