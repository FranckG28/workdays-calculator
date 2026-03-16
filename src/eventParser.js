import { isDateInRange, isAllDayEvent } from './utils.js';
import { CONFIG, EVENT_TITLE_PATTERN } from './config.js';
import { startOfDay, endOfDay } from 'date-fns';

/**
 * Parse an event title to extract type and member name
 * Expected format: "[Type] - [Member Name]"
 * @param {string} title - Event title
 * @returns {Object|null} { type: string, memberName: string } or null if format doesn't match
 */
export function parseEventTitle(title) {
  if (!title || typeof title !== 'string') {
    return null;
  }
  
  const trimmed = title.trim();
  
  // Try to match format: "Type - Member Name"
  const match = trimmed.match(EVENT_TITLE_PATTERN);
  
  if (!match) {
    return null;
  }
  
  const [, type, memberName] = match;
  
  return {
    type: type.trim(),
    memberName: memberName.trim()
  };
}

/**
 * Extract all unique member names from events
 * @param {Array} events - Array of iCal event objects
 * @returns {Set<string>} Set of unique member names
 */
export function extractMemberNames(events) {
  const members = new Set();
  
  for (const event of events) {
    const summary = event.summary || '';
    const parsed = parseEventTitle(summary);
    
    if (parsed && CONFIG.EVENT_TYPES.includes(parsed.type)) {
      members.add(parsed.memberName);
    }
  }
  
  return members;
}

/**
 * Filter events by date range (includes events that overlap with the range)
 * @param {Array} events - Array of iCal event objects
 * @param {Date} startDate - Start date (inclusive)
 * @param {Date} endDate - End date (inclusive)
 * @returns {Array} Filtered events
 */
export function filterEventsByDateRange(events, startDate, endDate) {
  const rangeStart = startOfDay(startDate);
  const rangeEnd = endOfDay(endDate);

  return events.filter(event => {
    if (!event.start) return false;

    const eventStart = startOfDay(new Date(event.start));

    // Determine event's last active day
    let eventLastDay;
    if (isAllDayEvent(event) && event.end) {
      // All-day events: end is exclusive, so last active day is end - 1 day
      const rawEnd = startOfDay(new Date(event.end));
      if (rawEnd > eventStart) {
        eventLastDay = new Date(rawEnd);
        eventLastDay.setDate(eventLastDay.getDate() - 1);
      } else {
        eventLastDay = eventStart;
      }
    } else if (event.end) {
      eventLastDay = endOfDay(new Date(event.end));
    } else {
      eventLastDay = eventStart;
    }

    // Event overlaps range if it starts before range ends AND ends after range starts
    return eventStart <= rangeEnd && eventLastDay >= rangeStart;
  });
}

/**
 * Filter events by selected members
 * @param {Array} events - Array of iCal event objects
 * @param {Array<string>} selectedMembers - Array of member names to include
 * @returns {Array} Filtered events
 */
export function filterEventsByMembers(events, selectedMembers) {
  const memberSet = new Set(selectedMembers.map(m => m.toLowerCase()));
  
  return events.filter(event => {
    const summary = event.summary || '';
    const parsed = parseEventTitle(summary);
    
    if (!parsed) return false;
    
    // Only include configured event types
    if (!CONFIG.EVENT_TYPES.includes(parsed.type)) {
      return false;
    }
    
    // Check if member is in selected list (case-insensitive)
    return memberSet.has(parsed.memberName.toLowerCase());
  });
}

/**
 * Get events for a specific member and date range
 * @param {Array} events - Array of iCal event objects
 * @param {string} memberName - Member name
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Filtered events for the member
 */
export function getMemberEvents(events, memberName, startDate, endDate) {
  // First filter by date range
  const dateFiltered = filterEventsByDateRange(events, startDate, endDate);
  
  // Then filter by member
  return filterEventsByMembers(dateFiltered, [memberName]);
}

/**
 * Get all relevant events (École or Absence) for selected members in date range
 * @param {Array} events - Array of iCal event objects
 * @param {Array<string>} selectedMembers - Array of member names
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Filtered events
 */
export function getRelevantEvents(events, selectedMembers, startDate, endDate) {
  // Filter by date range first
  const dateFiltered = filterEventsByDateRange(events, startDate, endDate);
  
  // Then filter by members
  return filterEventsByMembers(dateFiltered, selectedMembers);
}

