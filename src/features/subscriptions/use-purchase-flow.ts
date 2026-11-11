import { useCallback, useState } from 'react';

import { track } from '@/services/monitoring/analytics';
import type { PlanOption } from '@/services/payments/offerings';
import { purchasePlan, restorePlan } from '@/services/payments/purchases';

export type FlowMessageTone = 'success' | 'info' | 'error';

export interface FlowMessage {
  tone: FlowMessageTone;
  text: string;
}

export type BusyAction = 'purchase' | 'restore' | null;

export interface PurchaseFlow {
  busy: BusyAction;
  message: FlowMessage | null;
  clearMessage: () => void;
  /** Resolves true when Plus is now active. */
  purchase: (option: PlanOption) => Promise<boolean>;
  /** Resolves true when Plus is now active. */
  restore: () => Promise<boolean>;
}

/** Purchase + restore actions with calm, user-facing status messages and privacy-safe analytics. */
export function usePurchaseFlow(): PurchaseFlow {
  const [busy, setBusy] = useState<BusyAction>(null);
  const [message, setMessage] = useState<FlowMessage | null>(null);

  const purchase = useCallback(async (option: PlanOption): Promise<boolean> => {
    setBusy('purchase');
    setMessage(null);
    try {
      const outcome = await purchasePlan(option.pkg);
      if (outcome.status === 'purchased') {
        track({ name: 'purchase_completed', productId: outcome.productId });
        setMessage(
          outcome.isPlus
            ? { tone: 'success', text: 'Welcome to Faithscroll Plus. Thank you for supporting Faithscroll.' }
            : { tone: 'info', text: 'Thank you! Your purchase is being confirmed and Plus will unlock shortly.' },
        );
        return outcome.isPlus;
      }
      if (outcome.status === 'cancelled') return false;
      setMessage({ tone: outcome.error.kind === 'pending' ? 'info' : 'error', text: outcome.error.message });
      return false;
    } finally {
      setBusy(null);
    }
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    setBusy('restore');
    setMessage(null);
    try {
      const outcome = await restorePlan();
      if (outcome.status === 'failed') {
        setMessage({ tone: 'error', text: outcome.error.message });
        return false;
      }
      if (outcome.isPlus) {
        track({ name: 'purchase_restored' });
        setMessage({ tone: 'success', text: 'Your Faithscroll Plus subscription has been restored.' });
        return true;
      }
      setMessage({
        tone: 'info',
        text: 'We didn’t find an active Plus subscription for this store account. If you subscribed with a different account, sign in with it and try again.',
      });
      return false;
    } finally {
      setBusy(null);
    }
  }, []);

  const clearMessage = useCallback(() => setMessage(null), []);

  return { busy, message, clearMessage, purchase, restore };
}
