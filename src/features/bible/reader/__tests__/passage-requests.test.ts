import {
  cancelPassageRequest,
  createPassageRequest,
  hasPendingPassageRequest,
  resolvePassageRequest,
} from '@/features/bible/reader/passage-requests';
import { idsToRange } from '@/features/bible/verse-id';

describe('passage request registry', () => {
  test('resolves the caller with the chosen range', async () => {
    const { id, promise } = createPassageRequest();
    const range = idsToRange(45_008_028, 45_008_030);

    expect(hasPendingPassageRequest(id)).toBe(true);
    expect(resolvePassageRequest(id, range)).toBe(true);

    await expect(promise).resolves.toEqual(range);
    expect(hasPendingPassageRequest(id)).toBe(false);
  });

  test('cancel resolves with null', async () => {
    const { id, promise } = createPassageRequest();
    expect(cancelPassageRequest(id)).toBe(true);
    await expect(promise).resolves.toBeNull();
  });

  test('settles only once; later calls are ignored', async () => {
    const { id, promise } = createPassageRequest();
    resolvePassageRequest(id, idsToRange(1_001_001));

    expect(cancelPassageRequest(id)).toBe(false);
    expect(resolvePassageRequest(id, idsToRange(2_001_001))).toBe(false);
    await expect(promise).resolves.toEqual(idsToRange(1_001_001));
  });

  test('ids are unique and unknown ids are ignored', () => {
    const a = createPassageRequest();
    const b = createPassageRequest();
    expect(a.id).not.toBe(b.id);
    expect(resolvePassageRequest('missing', null)).toBe(false);
    cancelPassageRequest(a.id);
    cancelPassageRequest(b.id);
  });
});
