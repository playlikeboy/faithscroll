import { LINKABLE_TYPES } from '@/db/schema';

import { linkedItemHref, passageHref } from '../routes';

describe('routes', () => {
  test('maps every linkable type to a route', () => {
    const hrefs = LINKABLE_TYPES.map((type) => linkedItemHref(type, 'a b'));
    expect(hrefs).toEqual([
      '/sermons/a%20b',
      '/sermons/series/a%20b',
      '/journal/a%20b',
      '/prayers/a%20b',
      '/library/actions',
      '/bible/note/a%20b',
      '/library/saved',
    ]);
  });

  test('opens the reader at the first verse of a passage', () => {
    expect(passageHref(43003016)).toBe('/bible/read/43/3?verse=16');
  });
});
