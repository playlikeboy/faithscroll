import { dateToTimeOfDay, formatTimeLabel, formatTimeOfDay, parseTimeOfDay, timeOfDayToDate } from '../time-of-day';

describe('time of day', () => {
  it('parses HH:mm', () => {
    expect(parseTimeOfDay('07:30')).toEqual({ hour: 7, minute: 30 });
    expect(parseTimeOfDay('7:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseTimeOfDay(' 23:59 ')).toEqual({ hour: 23, minute: 59 });
  });

  it.each([null, undefined, '', '24:00', '12:60', '7pm', '12:5', 'ab:cd'])('rejects %p', (value) => {
    expect(parseTimeOfDay(value)).toBeNull();
  });

  it('formats and round-trips through Date', () => {
    expect(formatTimeOfDay({ hour: 6, minute: 5 })).toBe('06:05');
    const date = timeOfDayToDate({ hour: 21, minute: 15 }, new Date(2026, 10, 11, 3, 0, 0));
    expect(dateToTimeOfDay(date)).toEqual({ hour: 21, minute: 15 });
    expect(date.getDate()).toBe(11);
  });

  it('produces a readable label', () => {
    expect(formatTimeLabel({ hour: 7, minute: 30 })).toMatch(/7.*30/);
  });
});
