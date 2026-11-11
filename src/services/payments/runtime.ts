/** Whether RevenueCat was configured in this process. Kept tiny to avoid import cycles. */
let configured = false;

export function isPaymentsConfigured(): boolean {
  return configured;
}

export function setPaymentsConfigured(value: boolean): void {
  configured = value;
}
