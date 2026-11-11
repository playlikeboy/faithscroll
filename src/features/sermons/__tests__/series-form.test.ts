import { emptySeriesForm, seriesFormSchema, seriesToFormValues } from '../series-form-schema';

describe('seriesFormSchema', () => {
  test('requires a title and trims fields', () => {
    expect(seriesFormSchema.safeParse(emptySeriesForm()).success).toBe(false);
    const parsed = seriesFormSchema.parse({ ...emptySeriesForm(), title: '  Living With Grace ', speaker: ' Pastor John ' });
    expect(parsed).toMatchObject({ title: 'Living With Grace', speaker: 'Pastor John', description: '' });
  });

  test('limits the description length', () => {
    const result = seriesFormSchema.safeParse({ ...emptySeriesForm(), title: 'Grace', description: 'x'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  test('maps a stored series to form values', () => {
    const values = seriesToFormValues({
      id: 's',
      title: 'Grace',
      description: null,
      speaker: 'Ann',
      church: null,
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
      version: 1,
    });
    expect(values).toEqual({ title: 'Grace', description: '', speaker: 'Ann', church: '' });
  });
});
