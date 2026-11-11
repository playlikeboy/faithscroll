import {
  DEFAULT_PICKER_TYPES,
  isLinkRequestPending,
  openLinkRequest,
  parseLinkPickerParams,
  resolveLinkRequest,
  toLinkPickerParams,
} from '../link-picker-registry';

describe('link picker registry', () => {
  test('resolves a pending request exactly once', async () => {
    const promise = openLinkRequest('req-1');
    expect(isLinkRequestPending('req-1')).toBe(true);

    expect(resolveLinkRequest('req-1', { type: 'sermon', id: 's1', title: 'Grace' })).toBe(true);
    expect(resolveLinkRequest('req-1', null)).toBe(false);

    await expect(promise).resolves.toEqual({ type: 'sermon', id: 's1', title: 'Grace' });
    expect(isLinkRequestPending('req-1')).toBe(false);
  });

  test('resolves with null on cancel', async () => {
    const promise = openLinkRequest('req-2');
    resolveLinkRequest('req-2', null);
    await expect(promise).resolves.toBeNull();
  });

  test('re-opening the same id cancels the earlier request', async () => {
    const first = openLinkRequest('req-3');
    const second = openLinkRequest('req-3');
    resolveLinkRequest('req-3', { type: 'prayer_entry', id: 'p', title: 'P' });
    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toEqual(expect.objectContaining({ id: 'p' }));
  });
});

describe('picker params', () => {
  test('round-trips options through string route params', () => {
    const params = toLinkPickerParams('abc-123', {
      exclude: { type: 'journal_entry', id: 'j-1' },
      types: ['sermon', 'prayer_entry'],
      title: 'Link a sermon',
    });

    expect(parseLinkPickerParams(params)).toEqual({
      requestId: 'abc-123',
      exclude: { type: 'journal_entry', id: 'j-1' },
      types: ['sermon', 'prayer_entry'],
      title: 'Link a sermon',
    });
  });

  test('applies defaults and rejects malformed input', () => {
    expect(parseLinkPickerParams({})).toBeNull();
    expect(parseLinkPickerParams({ requestId: 'bad id!' })).toBeNull();
    expect(parseLinkPickerParams({ requestId: ['r1', 'r2'], excludeType: 'bogus', excludeId: 'x', types: 'nope,,' })).toEqual({
      requestId: 'r1',
      exclude: null,
      types: DEFAULT_PICKER_TYPES,
      title: 'Link',
    });
  });
});
