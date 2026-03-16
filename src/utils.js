import { 
  startOfDay, 
  endOfDay, 
  isWeekend, 
  isWithinInterval,
  parseISO
} from 'date-fns';
import { isFrenchHoliday } from './holidays.js';

/**
 * Check if a date is a weekday (Monday-Friday)
 * @param {Date} date - The date to check
 * @returns {boolean} True if weekday, false otherwise
 */
export function isWeekday(date) {
  return !isWeekend(date);
}

/**
 * Get all weekdays (Mon-Fri) within a date range, excluding public holidays
 * @param {Date} startDate - Start date (inclusive)
 * @param {Date} endDate - End date (inclusive)
 * @param {boolean} alsaceMoselle - Include Alsace-Moselle specific holidays
 * @returns {Date[]} Array of weekday dates (excluding holidays)
 */
export function getWeekdaysInRange(startDate, endDate, alsaceMoselle = false) {
  const weekdays = [];
  const current = startOfDay(startDate);
  const end = endOfDay(endDate);
  
  while (current <= end) {
    if (isWeekday(current) && !isFrenchHoliday(current, alsaceMoselle)) {
      weekdays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  return weekdays;
}

/**
 * Check if a date falls within a range (inclusive)
 * @param {Date} date - Date to check
 * @param {Date} startDate - Range start
 * @param {Date} endDate - Range end
 * @returns {boolean} True if within range
 */
export function isDateInRange(date, startDate, endDate) {
  return isWithinInterval(date, {
    start: startOfDay(startDate),
    end: endOfDay(endDate)
  });
}

/**
 * Half-day keywords to search for in event summary/description
 * Covers common Payfit patterns in French
 */
const HALF_DAY_PATTERNS = [
  /demi[- ]?journ[ée]e/i,
  /1\/2\s*journ[ée]e/i,
  /0[.,]5\s*jour/i,
  /\bmatin\b/i,
  /\bapr[èe]s[- ]?midi\b/i,
  /\bam\b/i,
  /\bpm\b/i,
  /half[- ]?day/i,
];

const MORNING_PATTERNS = [
  /\bmatin\b/i,
  /\bam\b/i,
  /\bmorning\b/i,
];

const AFTERNOON_PATTERNS = [
  /\bapr[èe]s[- ]?midi\b/i,
  /\bpm\b/i,
  /\bafternoon\b/i,
];

/**
 * Check if an event's text metadata indicates a half-day
 * @param {Object} event - iCal event object
 * @returns {Object} { isHalfDay: boolean, isMorning: boolean, isAfternoon: boolean }
 */
function detectHalfDayFromText(event) {
  const textsToCheck = [
    event.summary || '',
    event.description || '',
  ].join(' ');

  const isHalfDay = HALF_DAY_PATTERNS.some(pattern => pattern.test(textsToCheck));

  if (!isHalfDay) {
    return { isHalfDay: false, isMorning: false, isAfternoon: false };
  }

  const isMorning = MORNING_PATTERNS.some(pattern => pattern.test(textsToCheck));
  const isAfternoon = AFTERNOON_PATTERNS.some(pattern => pattern.test(textsToCheck));

  return { isHalfDay: true, isMorning, isAfternoon };
}

/**
 * Determine if an event is a full-day event (all-day in iCal sense)
 * @param {Object} event - iCal event object
 * @returns {boolean} True if all-day event
 */
export function isAllDayEvent(event) {
  const dtstart = event.start;
  const dtend = event.end;

  if (!dtstart || !dtend) return false;

  // node-ical sets datetype = 'date' for VALUE=DATE (all-day) events
  if (event.datetype === 'date' || dtstart.dateOnly) {
    return true;
  }

  // Fallback: check if dates are at midnight
  const startIsDate = dtstart instanceof Date && dtstart.getHours() === 0 && dtstart.getMinutes() === 0;
  const endIsDate = dtend instanceof Date && dtend.getHours() === 0 && dtend.getMinutes() === 0;

  if (startIsDate && endIsDate) {
    const hoursDiff = (dtend - dtstart) / (1000 * 60 * 60);
    return hoursDiff >= 24 || hoursDiff === 0;
  }

  return false;
}

/**
 * Determine if an event covers a full working day
 * @param {Object} event - iCal event object with start and end times
 * @returns {boolean} True if covers full working day
 */
export function isFullWorkingDay(event) {
  // First check if text metadata indicates a half-day
  const halfDayText = detectHalfDayFromText(event);
  if (halfDayText.isHalfDay) return false;

  if (isAllDayEvent(event)) return true;

  if (!event.start || !event.end) return false;

  const start = new Date(event.start);
  const end = new Date(event.end);
  const startHour = start.getHours();
  const endHour = end.getHours();

  return startHour <= 10 && endHour >= 17;
}

/**
 * Determine if an event is a half-day (morning or afternoon)
 * @param {Object} event - iCal event object with start and end times
 * @returns {Object} { isHalfDay: boolean, isMorning: boolean, isAfternoon: boolean }
 */
export function getHalfDayInfo(event) {
  // Check text metadata first (handles all-day events from Payfit)
  const halfDayText = detectHalfDayFromText(event);
  if (halfDayText.isHalfDay) {
    return halfDayText;
  }

  if (isAllDayEvent(event) || isFullWorkingDay(event)) {
    return { isHalfDay: false, isMorning: false, isAfternoon: false };
  }

  if (!event.start || !event.end) {
    return { isHalfDay: false, isMorning: false, isAfternoon: false };
  }

  const start = new Date(event.start);
  const end = new Date(event.end);
  const startHour = start.getHours();
  const endHour = end.getHours();

  // Morning half-day: starts early, ends around noon
  const isMorning = startHour <= 10 && endHour <= 14;

  // Afternoon half-day: starts around noon, ends late
  const isAfternoon = startHour >= 13 && endHour >= 17;

  const isHalfDay = isMorning || isAfternoon;

  return { isHalfDay, isMorning, isAfternoon };
}

/**
 * Check if an event overlaps with a specific date
 * @param {Object} event - iCal event object
 * @param {Date} date - Date to check
 * @returns {boolean} True if event overlaps with date
 */
export function eventOverlapsDate(event, date) {
  if (!event.start) return false;

  const eventStart = startOfDay(new Date(event.start));
  const checkDate = startOfDay(date);

  // For all-day events, the end date in iCal is EXCLUSIVE (the day after the last day)
  // e.g., a 1-day event on March 10 has start=March 10, end=March 11
  if (isAllDayEvent(event)) {
    const eventEnd = event.end ? startOfDay(new Date(event.end)) : eventStart;
    // Exclusive end: checkDate must be >= start and < end
    if (eventEnd > eventStart) {
      return checkDate >= eventStart && checkDate < eventEnd;
    }
    // If end == start (single day), just check start
    return checkDate.getTime() === eventStart.getTime();
  }

  // For timed events, use inclusive range
  if (!event.end) return checkDate.getTime() === eventStart.getTime();
  const eventEnd = endOfDay(new Date(event.end));
  return checkDate >= eventStart && checkDate <= eventEnd;
}

/**
 * Parse a date string in various formats
 * @param {string} dateStr - Date string to parse
 * @returns {Date} Parsed date
 */
export function parseDate(dateStr) {
  // Try ISO format first (YYYY-MM-DD)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const date = parseISO(dateStr);
    // Validate the parsed date is valid
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${dateStr}. Please use YYYY-MM-DD format (e.g., 2025-01-15)`);
    }
    return date;
  }
  
  // Try common formats
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}. Please use YYYY-MM-DD format (e.g., 2025-01-15)`);
  }
  
  return date;
}

