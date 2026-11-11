import { fireEvent, render, screen } from '@testing-library/react-native';

import { LegalFooter, LimitsTable, PlanPicker, StatusMessage, SubscriptionStatusCard } from '@/components/paywall';
import type { PlanOption } from '@/services/payments/offerings';

const options = [
  {
    id: '$rc_annual',
    productId: 'yearly',
    period: 'annual',
    title: 'Yearly',
    priceString: '$29.99',
    periodLabel: 'per year',
    monthlyEquivalent: '$2.50',
    trialLabel: '7-day free trial',
  },
  {
    id: '$rc_monthly',
    productId: 'monthly',
    period: 'monthly',
    title: 'Monthly',
    priceString: '$3.99',
    periodLabel: 'per month',
    monthlyEquivalent: null,
    trialLabel: null,
  },
] as unknown as PlanOption[];

describe('PlanPicker', () => {
  test('shows plans as radios with the first selected by default', async () => {
    const onSelect = jest.fn();
    await render(<PlanPicker plans={{ kind: 'ready', options }} selectedId={null} onSelect={onSelect} />);

    const yearly = screen.getByRole('radio', {
      name: 'Yearly, $29.99 per year, about $2.50 a month, includes a 7-day free trial',
    });
    expect(yearly.props.accessibilityState).toMatchObject({ checked: true });

    await fireEvent.press(screen.getByRole('radio', { name: 'Monthly, $3.99 per month' }));
    expect(onSelect).toHaveBeenCalledWith('$rc_monthly');
  });

  test('marks the chosen plan', async () => {
    await render(<PlanPicker plans={{ kind: 'ready', options }} selectedId="$rc_monthly" onSelect={jest.fn()} />);

    expect(screen.getByRole('radio', { name: 'Monthly, $3.99 per month' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  test('explains when subscriptions are not available in this build', async () => {
    await render(<PlanPicker plans={{ kind: 'unavailable' }} selectedId={null} onSelect={jest.fn()} />);

    expect(screen.getByText('Subscriptions aren’t available in this version')).toBeTruthy();
  });

  test('offers retry on load errors and empty offerings', async () => {
    const retry = jest.fn();
    const { rerender } = await render(<PlanPicker plans={{ kind: 'error', retry }} selectedId={null} onSelect={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    await rerender(<PlanPicker plans={{ kind: 'empty', retry }} selectedId={null} onSelect={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(retry).toHaveBeenCalledTimes(2);
  });

  test('shows a loading state', async () => {
    await render(<PlanPicker plans={{ kind: 'loading' }} selectedId={null} onSelect={jest.fn()} />);

    expect(screen.getByLabelText('Loading plans')).toBeTruthy();
  });
});

test('LimitsTable reads each row as one sentence', async () => {
  await render(<LimitsTable rows={[{ feature: 'Deep Study', free: '5', plus: '100' }]} notes={['Resets monthly.']} />);

  expect(screen.getByLabelText('Deep Study: 5 free, 100 with Plus, each month')).toBeTruthy();
  expect(screen.getByText('Resets monthly.')).toBeTruthy();
});

test('StatusMessage announces errors as alerts and renders nothing without a message', async () => {
  const { rerender } = await render(<StatusMessage message={{ tone: 'error', text: 'Check your connection' }} />);
  expect(screen.getByRole('alert', { name: 'Check your connection' })).toBeTruthy();

  await rerender(<StatusMessage message={null} />);
  expect(screen.queryByText('Check your connection')).toBeNull();
});

test('LegalFooter links to terms and privacy', async () => {
  const onOpenTerms = jest.fn();
  const onOpenPrivacy = jest.fn();
  await render(<LegalFooter disclosure="Renews automatically." onOpenTerms={onOpenTerms} onOpenPrivacy={onOpenPrivacy} />);

  await fireEvent.press(screen.getByRole('link', { name: 'Terms of Use' }));
  await fireEvent.press(screen.getByRole('link', { name: 'Privacy Policy' }));

  expect(onOpenTerms).toHaveBeenCalled();
  expect(onOpenPrivacy).toHaveBeenCalled();
  expect(screen.getByText('Renews automatically.')).toBeTruthy();
});

test('SubscriptionStatusCard shows plan, detail and payment warnings', async () => {
  await render(
    <SubscriptionStatusCard
      isPlus
      summary={{ planLabel: 'Faithscroll Plus', detail: 'Renews on March 1, 2027.', warning: 'Update your payment method.' }}
    />,
  );

  expect(screen.getByLabelText('Current plan: Faithscroll Plus. Renews on March 1, 2027.')).toBeTruthy();
  expect(screen.getByRole('alert', { name: 'Update your payment method.' })).toBeTruthy();
});
