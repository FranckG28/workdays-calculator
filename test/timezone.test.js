/**
 * Timezone reliability tests — all run with TZ=Europe/Paris (UTC+1/+2).
 * Tests guard against the UTC-shift bugs where toISOString() returned the
 * previous calendar day for dates parsed at local midnight in UTC+ zones.
 */
import { describe, it, expect } from 'vitest';
import { parseDate, formatDateLocal, getWeekdaysInRange, eventOverlapsDate, isAllDayEvent, isFullWorkingDay, getHalfDayInfo } from '../src/utils.js';
import { isFrenchHoliday, getHolidaysInRange, getFrenchHolidays } from '../src/holidays.js';
import { filterEventsByDateRange, getMemberEvents } from '../src/eventParser.js';
import { calculateTotalHalfDays } from '../src/workdaysCalculator.js';

// ---------------------------------------------------------------------------
// formatDateLocal
// ---------------------------------------------------------------------------
describe('formatDateLocal', () => {
  it('formats local date correctly (no UTC shift)', () => {
    const d = parseDate('2026-04-13');
    expect(formatDateLocal(d)).toBe('2026-04-13');
  });

  it('formats end-of-sprint date correctly', () => {
    const d = parseDate('2026-05-08');
    expect(formatDateLocal(d)).toBe('2026-05-08');
  });

  it('pads month and day with zeros', () => {
    const d = parseDate('2026-01-05');
    expect(formatDateLocal(d)).toBe('2026-01-05');
  });
});

// ---------------------------------------------------------------------------
// parseDate
// ---------------------------------------------------------------------------
describe('parseDate', () => {
  it('returns correct local year/month/day for YYYY-MM-DD', () => {
    const d = parseDate('2026-04-13');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // April = 3
    expect(d.getDate()).toBe(13);
  });

  it('returns correct local date for December 31', () => {
    const d = parseDate('2025-12-31');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });

  it('throws on invalid date', () => {
    expect(() => parseDate('not-a-date')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// getWeekdaysInRange — core sprint calculation
// ---------------------------------------------------------------------------
describe('getWeekdaysInRange', () => {
  it('includes both start and end dates when they are weekdays', () => {
    // 2026-04-13 = Monday, 2026-04-17 = Friday
    const days = getWeekdaysInRange(parseDate('2026-04-13'), parseDate('2026-04-17'));
    expect(days).toHaveLength(5);
    expect(formatDateLocal(days[0])).toBe('2026-04-13');
    expect(formatDateLocal(days[4])).toBe('2026-04-17');
  });

  it('excludes weekends', () => {
    // 2026-04-13 Mon to 2026-04-19 Sun = 5 weekdays
    const days = getWeekdaysInRange(parseDate('2026-04-13'), parseDate('2026-04-19'));
    expect(days).toHaveLength(5);
    const dayNames = days.map(d => d.getDay());
    dayNames.forEach(d => expect(d).not.toBe(0)); // no Sunday
    dayNames.forEach(d => expect(d).not.toBe(6)); // no Saturday
  });

  it('excludes national holidays (Alsace-Moselle)', () => {
    // Sprint 2026-04-13 to 2026-05-08 has 2 holidays: May 1 + May 8
    const days = getWeekdaysInRange(parseDate('2026-04-13'), parseDate('2026-05-08'), true);
    expect(days).toHaveLength(18);
    const keys = days.map(formatDateLocal);
    expect(keys).not.toContain('2026-05-01'); // Fête du Travail
    expect(keys).not.toContain('2026-05-08'); // Victoire 1945
  });

  it('excludes Vendredi Saint in Alsace-Moselle mode', () => {
    // Easter 2026 = April 5, Good Friday = April 3
    const days = getWeekdaysInRange(parseDate('2026-04-03'), parseDate('2026-04-03'), true);
    expect(days).toHaveLength(0);
  });

  it('does NOT exclude Vendredi Saint outside Alsace-Moselle', () => {
    const days = getWeekdaysInRange(parseDate('2026-04-03'), parseDate('2026-04-03'), false);
    expect(days).toHaveLength(1);
  });

  it('day keys are correct local dates (not UTC-shifted)', () => {
    const days = getWeekdaysInRange(parseDate('2026-04-13'), parseDate('2026-04-13'));
    expect(days).toHaveLength(1);
    expect(formatDateLocal(days[0])).toBe('2026-04-13');
  });
});

// ---------------------------------------------------------------------------
// isFrenchHoliday
// ---------------------------------------------------------------------------
describe('isFrenchHoliday', () => {
  it('detects May 1 as holiday', () => {
    expect(isFrenchHoliday(parseDate('2026-05-01'))).toBe(true);
  });

  it('detects May 8 as holiday', () => {
    expect(isFrenchHoliday(parseDate('2026-05-08'))).toBe(true);
  });

  it('detects Easter Monday 2026 (April 6)', () => {
    expect(isFrenchHoliday(parseDate('2026-04-06'))).toBe(true);
  });

  it('does NOT flag regular workday as holiday', () => {
    expect(isFrenchHoliday(parseDate('2026-04-13'))).toBe(false);
  });

  it('detects Good Friday only in Alsace-Moselle mode', () => {
    expect(isFrenchHoliday(parseDate('2026-04-03'), false)).toBe(false);
    expect(isFrenchHoliday(parseDate('2026-04-03'), true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getHolidaysInRange
// ---------------------------------------------------------------------------
describe('getHolidaysInRange', () => {
  it('finds 2 holidays in sprint period (May 1 + May 8)', () => {
    const h = getHolidaysInRange(parseDate('2026-04-13'), parseDate('2026-05-08'));
    expect(h).toHaveLength(2);
    const keys = h.map(formatDateLocal);
    expect(keys).toContain('2026-05-01');
    expect(keys).toContain('2026-05-08');
  });

  it('end date holiday is included', () => {
    // May 8 is the end date — must be included
    const h = getHolidaysInRange(parseDate('2026-05-08'), parseDate('2026-05-08'));
    expect(h).toHaveLength(1);
  });

  it('start date holiday is included', () => {
    const h = getHolidaysInRange(parseDate('2026-05-01'), parseDate('2026-05-01'));
    expect(h).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// eventOverlapsDate — all-day (exclusive end) and timed events
// ---------------------------------------------------------------------------
describe('eventOverlapsDate', () => {
  const allDayEvent = (startStr, endStr) => ({
    datetype: 'date',
    start: parseDate(startStr),
    end: parseDate(endStr),
  });

  const timedEvent = (startHour, endHour, dateStr) => {
    const d = parseDate(dateStr);
    const s = new Date(d); s.setHours(startHour, 0, 0, 0);
    const e = new Date(d); e.setHours(endHour, 0, 0, 0);
    return { start: s, end: e };
  };

  it('all-day single day overlaps correct date', () => {
    // iCal all-day: start=Apr13, end=Apr14 (exclusive)
    const event = allDayEvent('2026-04-13', '2026-04-14');
    expect(eventOverlapsDate(event, parseDate('2026-04-13'))).toBe(true);
    expect(eventOverlapsDate(event, parseDate('2026-04-14'))).toBe(false);
    expect(eventOverlapsDate(event, parseDate('2026-04-12'))).toBe(false);
  });

  it('all-day multi-day overlaps all days in range', () => {
    const event = allDayEvent('2026-04-13', '2026-04-16'); // Apr 13-15 inclusive
    expect(eventOverlapsDate(event, parseDate('2026-04-13'))).toBe(true);
    expect(eventOverlapsDate(event, parseDate('2026-04-15'))).toBe(true);
    expect(eventOverlapsDate(event, parseDate('2026-04-16'))).toBe(false);
  });

  it('timed event overlaps its day', () => {
    const event = timedEvent(8, 12, '2026-04-13');
    expect(eventOverlapsDate(event, parseDate('2026-04-13'))).toBe(true);
    expect(eventOverlapsDate(event, parseDate('2026-04-14'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isFullWorkingDay / getHalfDayInfo
// ---------------------------------------------------------------------------
describe('isFullWorkingDay', () => {
  it('all-day event without half-day keywords = full day', () => {
    const event = { datetype: 'date', start: parseDate('2026-04-13'), end: parseDate('2026-04-14'), summary: 'Absence - Jean Dupont' };
    expect(isFullWorkingDay(event)).toBe(true);
  });

  it('all-day event with "matin" keyword = NOT full day', () => {
    const event = { datetype: 'date', start: parseDate('2026-04-13'), end: parseDate('2026-04-14'), summary: 'Absence matin - Jean Dupont' };
    expect(isFullWorkingDay(event)).toBe(false);
  });
});

describe('getHalfDayInfo', () => {
  it('detects "demi-journée" keyword', () => {
    const event = { datetype: 'date', start: parseDate('2026-04-13'), end: parseDate('2026-04-14'), summary: 'Absence demi-journée - Jean' };
    expect(getHalfDayInfo(event).isHalfDay).toBe(true);
  });

  it('detects "après-midi" keyword as afternoon', () => {
    const event = { datetype: 'date', start: parseDate('2026-04-13'), end: parseDate('2026-04-14'), summary: 'Absence après-midi - Jean' };
    const info = getHalfDayInfo(event);
    expect(info.isHalfDay).toBe(true);
    expect(info.isAfternoon).toBe(true);
    expect(info.isMorning).toBe(false);
  });

  it('non-half-day all-day event returns false', () => {
    const event = { datetype: 'date', start: parseDate('2026-04-13'), end: parseDate('2026-04-14'), summary: 'École - Jean' };
    expect(getHalfDayInfo(event).isHalfDay).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterEventsByDateRange
// ---------------------------------------------------------------------------
describe('filterEventsByDateRange', () => {
  const makeEvent = (startStr, endStr, summary = 'Absence - Alice') => ({
    datetype: 'date',
    start: parseDate(startStr),
    end: parseDate(endStr),
    summary,
  });

  it('includes event that starts on range start', () => {
    const events = [makeEvent('2026-04-13', '2026-04-14')];
    const result = filterEventsByDateRange(events, parseDate('2026-04-13'), parseDate('2026-04-17'));
    expect(result).toHaveLength(1);
  });

  it('includes event that ends on range end', () => {
    const events = [makeEvent('2026-04-17', '2026-04-18')];
    const result = filterEventsByDateRange(events, parseDate('2026-04-13'), parseDate('2026-04-17'));
    expect(result).toHaveLength(1);
  });

  it('excludes event starting after range end', () => {
    const events = [makeEvent('2026-04-18', '2026-04-19')];
    const result = filterEventsByDateRange(events, parseDate('2026-04-13'), parseDate('2026-04-17'));
    expect(result).toHaveLength(0);
  });

  it('excludes event ending before range start', () => {
    const events = [makeEvent('2026-04-10', '2026-04-12')]; // end=Apr12 exclusive → last day = Apr11
    const result = filterEventsByDateRange(events, parseDate('2026-04-13'), parseDate('2026-04-17'));
    expect(result).toHaveLength(0);
  });

  it('includes multi-day event overlapping range start', () => {
    const events = [makeEvent('2026-04-10', '2026-04-15')]; // Apr 10-14 inclusive
    const result = filterEventsByDateRange(events, parseDate('2026-04-13'), parseDate('2026-04-17'));
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// calculateTotalHalfDays — integration
// ---------------------------------------------------------------------------
describe('calculateTotalHalfDays', () => {
  const makeAllDayEvent = (startStr, endStr, member, { description = '' } = {}) => ({
    datetype: 'date',
    start: parseDate(startStr),
    end: parseDate(endStr),
    summary: `Absence - ${member}`,
    description,
  });

  it('full sprint no absences = 2 half-days per day per member', () => {
    // 2026-04-13 to 2026-04-17 = 5 weekdays, no holidays
    const result = calculateTotalHalfDays([], ['Alice'], parseDate('2026-04-13'), parseDate('2026-04-17'));
    expect(result.weekdaysCount).toBe(5);
    expect(result.breakdown.Alice.halfDays).toBe(10);
    expect(result.breakdown.Alice.daysWorked).toBe(5);
  });

  it('full-day absence removes 2 half-days', () => {
    const events = [makeAllDayEvent('2026-04-13', '2026-04-14', 'Alice')];
    const result = calculateTotalHalfDays(events, ['Alice'], parseDate('2026-04-13'), parseDate('2026-04-17'));
    expect(result.breakdown.Alice.halfDays).toBe(8); // 10 - 2
    expect(result.breakdown.Alice.daysWorked).toBe(4);
  });

  it('half-day absence removes 1 half-day', () => {
    // Half-day info is in description, not summary type (summary must match EVENT_TYPES)
    const events = [makeAllDayEvent('2026-04-13', '2026-04-14', 'Alice', { description: 'matin' })];
    const result = calculateTotalHalfDays(events, ['Alice'], parseDate('2026-04-13'), parseDate('2026-04-17'));
    expect(result.breakdown.Alice.halfDays).toBe(9);
    expect(result.breakdown.Alice.daysWorked).toBe(4.5);
  });

  it('dateKey in breakdown uses correct local date (no UTC shift)', () => {
    const result = calculateTotalHalfDays([], ['Alice'], parseDate('2026-04-13'), parseDate('2026-04-13'));
    const keys = Object.keys(result.breakdown.Alice.byDate);
    expect(keys).toContain('2026-04-13');
    expect(keys).not.toContain('2026-04-12'); // would appear with UTC shift bug
  });

  it('sprint with 2 holidays counted correctly', () => {
    // 2026-04-13 to 2026-05-08 (Alsace-Moselle): 18 working days
    const result = calculateTotalHalfDays([], ['Alice'], parseDate('2026-04-13'), parseDate('2026-05-08'), true);
    expect(result.weekdaysCount).toBe(18);
  });
});
