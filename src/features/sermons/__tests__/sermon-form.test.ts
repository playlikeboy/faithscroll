import { createTestDb } from '@/db/testing/create-test-db';

import { createSermonFromForm, updateSermonFromForm } from '../save-sermon-form';
import { emptySermonForm, sermonFormSchema, sermonToFormValues, type SermonFormValues } from '../sermon-form-schema';
import { createSeries, listSeries } from '../series-repository';
import { createSermon } from '../sermons-repository';

const base: SermonFormValues = {
  title: '',
  speaker: '',
  church: '',
  series: { kind: 'none' },
  sermonDate: '2026-11-08',
  mainPassage: null,
};

describe('sermonFormSchema', () => {
  test('accepts a form with every optional field blank', () => {
    expect(sermonFormSchema.safeParse(base).success).toBe(true);
  });

  test('requires a name for a new series and a real date', () => {
    const result = sermonFormSchema.safeParse({ ...base, series: { kind: 'new', title: ' ' }, sermonDate: '2026-02-30' });
    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((i) => i.message);
    expect(messages).toEqual(expect.arrayContaining(['Name the new series', 'Choose a valid date']));
  });

  test('rejects passages whose end precedes the start', () => {
    const result = sermonFormSchema.safeParse({ ...base, mainPassage: { text: 'x', startVerseId: 40018035, endVerseId: 40018021 } });
    expect(result.success).toBe(false);
  });

  test('emptySermonForm defaults to today with no series', () => {
    expect(emptySermonForm('2026-11-11')).toEqual({ ...base, sermonDate: '2026-11-11' });
  });
});

describe('createSermonFromForm', () => {
  test('creates a sermon with a default title when blank', () => {
    const db = createTestDb();
    const sermon = createSermonFromForm(db, sermonFormSchema.parse(base));
    expect(sermon.title).toBe('Sermon · 8 Nov 2026');
    expect(sermon.seriesId).toBeNull();
  });

  test('creates a new series atomically and links it', () => {
    const db = createTestDb();
    const values = sermonFormSchema.parse({ ...base, title: 'Grace', series: { kind: 'new', title: 'Living With Grace' } });

    const sermon = createSermonFromForm(db, values);

    const [series] = listSeries(db);
    expect(series.title).toBe('Living With Grace');
    expect(sermon.seriesId).toBe(series.id);
  });

  test('reuses an existing series picked from the list', () => {
    const db = createTestDb();
    const existing = createSeries(db, { title: 'Hope' });
    const sermon = createSermonFromForm(db, sermonFormSchema.parse({ ...base, series: { kind: 'existing', id: existing.id } }));
    expect(sermon.seriesId).toBe(existing.id);
  });
});

describe('updateSermonFromForm and sermonToFormValues', () => {
  test('round-trips a sermon through the form', () => {
    const db = createTestDb();
    const series = createSeries(db, { title: 'Hope' });
    const sermon = createSermon(db, {
      title: 'Grace',
      speaker: 'Ann',
      seriesId: series.id,
      sermonDate: '2026-11-01',
      mainPassage: { text: 'Romans 8:28', startVerseId: 45008028, endVerseId: 45008028 },
    });

    const values = sermonToFormValues(sermon);
    expect(values).toEqual({
      title: 'Grace',
      speaker: 'Ann',
      church: '',
      series: { kind: 'existing', id: series.id },
      sermonDate: '2026-11-01',
      mainPassage: { text: 'Romans 8:28', startVerseId: 45008028, endVerseId: 45008028 },
    });

    const updated = updateSermonFromForm(db, sermon.id, sermonFormSchema.parse({ ...values, speaker: 'Pastor Ann', series: { kind: 'none' } }));
    expect(updated).toMatchObject({ speaker: 'Pastor Ann', seriesId: null, mainPassage: 'Romans 8:28' });
  });
});
