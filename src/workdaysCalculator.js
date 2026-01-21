import { 
  getWeekdaysInRange, 
  eventOverlapsDate,
  isFullWorkingDay,
  getHalfDayInfo
} from './utils.js';
import { getMemberEvents } from './eventParser.js';

/**
 * Calculate half-days worked for a single member on a specific date
 * @param {Array} memberEvents - All events for the member
 * @param {Date} date - Date to check
 * @returns {number} Number of half-days worked (0, 1, or 2)
 */
function calculateHalfDaysForDate(memberEvents, date) {
  // Find all events that overlap with this date
  const overlappingEvents = memberEvents.filter(event => 
    eventOverlapsDate(event, date)
  );
  
  // If no events, member worked full day (2 half-days)
  if (overlappingEvents.length === 0) {
    return 2;
  }
  
  // If multiple events, prioritize the longest one (likely full day)
  // Sort by duration (longest first)
  overlappingEvents.sort((a, b) => {
    const durationA = new Date(a.end || a.start) - new Date(a.start);
    const durationB = new Date(b.end || b.start) - new Date(b.start);
    return durationB - durationA;
  });
  
  const primaryEvent = overlappingEvents[0];
  
  // Check if it's a full working day
  if (isFullWorkingDay(primaryEvent)) {
    return 0; // No half-days worked
  }
  
  // Check if it's a half-day
  const halfDayInfo = getHalfDayInfo(primaryEvent);
  if (halfDayInfo.isHalfDay) {
    return 1; // One half-day worked
  }
  
  // If event doesn't clearly indicate half-day or full-day,
  // assume it's a full-day off for safety
  return 0;
}

/**
 * Calculate total half-days worked by all team members
 * @param {Array} events - All relevant events (filtered by date range and members)
 * @param {Array<string>} memberNames - Array of member names to calculate for
 * @param {Date} startDate - Sprint start date
 * @param {Date} endDate - Sprint end date
 * @param {boolean} alsaceMoselle - Include Alsace-Moselle specific holidays
 * @returns {Object} { totalHalfDays: number, breakdown: Object }
 */
export function calculateTotalHalfDays(events, memberNames, startDate, endDate, alsaceMoselle = false) {
  const weekdays = getWeekdaysInRange(startDate, endDate, alsaceMoselle);
  let totalHalfDays = 0;
  const breakdown = {};
  
  // Initialize breakdown for each member
  for (const memberName of memberNames) {
    breakdown[memberName] = {
      halfDays: 0,
      byDate: {}
    };
  }
  
  // For each member, calculate their half-days
  for (const memberName of memberNames) {
    // Get events for this member
    const memberEvents = getMemberEvents(events, memberName, startDate, endDate);
    
    let memberHalfDays = 0;
    
    // For each weekday, calculate half-days worked
    for (const weekday of weekdays) {
      const halfDays = calculateHalfDaysForDate(memberEvents, weekday);
      memberHalfDays += halfDays;
      
      // Store breakdown by date
      const dateKey = weekday.toISOString().split('T')[0];
      breakdown[memberName].byDate[dateKey] = halfDays;
    }
    
    breakdown[memberName].halfDays = memberHalfDays;
    totalHalfDays += memberHalfDays;
  }
  
  // Calculate days off for each member
  const totalWorkingDays = weekdays.length * 2; // Total half-days available per member
  
  for (const memberName of memberNames) {
    const memberData = breakdown[memberName];
    const halfDaysWorked = memberData.halfDays;
    const halfDaysOff = totalWorkingDays - halfDaysWorked;
    const daysOff = halfDaysOff / 2;
    const daysWorked = halfDaysWorked / 2;
    
    memberData.daysOff = daysOff;
    memberData.daysWorked = daysWorked;
    memberData.halfDaysOff = halfDaysOff;
  }
  
  return {
    totalHalfDays,
    breakdown,
    weekdaysCount: weekdays.length,
    totalWorkingDaysPerMember: totalWorkingDays
  };
}

