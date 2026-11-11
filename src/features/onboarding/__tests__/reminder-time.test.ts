import {
  DEFAULT_REMINDER_TIME,
  dateToTime,
  formatTime,
  isValidTime,
  timeToDate,
} from '@/features/onboarding/reminder-time';
import { readingGoalLabel } from '@/features/onboarding/steps';

describe('reminder time helpers', () => {
  test('validates HH:mm strings', () => {
    expect(isValidTime('07:30')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('7:30')).toBe(false);
    expect(isValidTime(null)).toBe(false);
  });

  test('round-trips a local time through a Date', () => {
    const date = timeToDate('21:05', new Date(2026, 10, 11, 9, 0));
    expect(date.getHours()).toBe(21);
    expect(date.getMinutes()).toBe(5);
    expect(date.getDate()).toBe(11);
    expect(dateToTime(date)).toBe('21:05');
  });

  test('falls back to the default time when malformed', () => {
    expect(dateToTime(timeToDate('nonsense'))).toBe(DEFAULT_REMINDER_TIME);
  });

  test('formats a readable time for the locale', () => {
    expect(formatTime('07:30', 'en-US')).toMatch(/7:30\sAM/u);
  });
});

describe('readingGoalLabel', () => {
  test('returns the option title or null', () => {
    expect(readingGoalLabel('daily_chapter')).toBe('A chapter a day');
    expect(readingGoalLabel(null)).toBeNull();
  });
});
