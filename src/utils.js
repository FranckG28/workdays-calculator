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
 * Determine if an event is a full-day event
 * @param {Object} event - iCal event object
 * @returns {boolean} True if all-day event
 */
export function isAllDayEvent(event) {
  // All-day events typically have DATE value type or span 24 hours
  const dtstart = event.start;
  const dtend = event.end;
  
  if (!dtstart || !dtend) return false;
  
  // Check if dates (no time component)
  const startIsDate = dtstart instanceof Date && dtstart.getHours() === 0 && dtstart.getMinutes() === 0;
  const endIsDate = dtend instanceof Date && dtend.getHours() === 0 && dtend.getMinutes() === 0;
  
  // If start and end are dates at midnight, check if they span multiple days
  if (startIsDate && endIsDate) {
    const hoursDiff = (dtend - dtstart) / (1000 * 60 * 60);
    return hoursDiff >= 24 || hoursDiff === 0; // 0 means single day all-day event
  }
  
  return false;
}

/**
 * Determine if an event covers a full working day (approximately 9:00-18:00)
 * @param {Object} event - iCal event object with start and end times
 * @returns {boolean} True if covers full working day
 */
export function isFullWorkingDay(event) {
  if (isAllDayEvent(event)) return true;
  
  if (!event.start || !event.end) return false;
  
  const start = new Date(event.start);
  const end = new Date(event.end);
  
  // Check if event starts early (before 10:00) and ends late (after 17:00)
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
  
  // Morning half-day: starts early, ends around noon (9:00-14:00)
  const isMorning = startHour <= 10 && endHour <= 14;
  
  // Afternoon half-day: starts around noon, ends late (13:00-18:00)
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
  if (!event.start || !event.end) return false;
  
  const eventStart = startOfDay(new Date(event.start));
  const eventEnd = endOfDay(new Date(event.end));
  const checkDate = startOfDay(date);
  
  // Event overlaps if checkDate falls within event range
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

