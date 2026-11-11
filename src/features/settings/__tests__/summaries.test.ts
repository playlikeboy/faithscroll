import { appVersionLabel, formatVersion, reminderSummary, themeLabel } from '@/features/settings/summaries';

describe('settings summaries', () => {
  test('labels the theme preference', () => {
    expect(themeLabel('system')).toBe('System');
    expect(themeLabel('dark')).toBe('Dark');
  });

  test('summarises the daily reminder without implying it is on', () => {
    expect(reminderSummary('07:30', false)).toBe('Off');
    expect(reminderSummary(null, true)).toBe('Off');
    expect(reminderSummary('bad', true)).toBe('Off');
    expect(reminderSummary('07:30', true)).toMatch(/^Daily at 7:30/);
  });

  test('formats the version with an optional build number', () => {
    expect(formatVersion('1.2.0', '14')).toBe('1.2.0 (14)');
    expect(formatVersion('1.2.0', null)).toBe('1.2.0');
    expect(formatVersion(undefined, undefined)).toBe('1.0.0');
    expect(appVersionLabel()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
