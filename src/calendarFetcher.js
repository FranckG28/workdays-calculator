import axios from 'axios';
import ical from 'node-ical';

/**
 * Fetch and parse an iCal calendar from a URL
 * @param {string} url - Payfit calendar URL
 * @returns {Promise<Object>} Parsed calendar object with events
 */
export async function fetchCalendar(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'Accept': 'text/calendar, application/calendar+json, */*'
      },
      responseType: 'text'
    });
    
    // Parse the iCal data
    const calendar = ical.parseICS(response.data);
    
    return calendar;
  } catch (error) {
    if (error.response) {
      throw new Error(`Failed to fetch calendar: HTTP ${error.response.status} - ${error.response.statusText}`);
    } else if (error.request) {
      throw new Error(`Failed to fetch calendar: No response received. Please check the URL.`);
    } else {
      throw new Error(`Failed to fetch calendar: ${error.message}`);
    }
  }
}

/**
 * Extract all events from a parsed calendar
 * @param {Object} calendar - Parsed iCal calendar object
 * @returns {Array} Array of event objects
 */
export function getEvents(calendar) {
  const events = [];
  
  for (const key in calendar) {
    if (calendar.hasOwnProperty(key)) {
      const component = calendar[key];
      if (component.type === 'VEVENT') {
        events.push(component);
      }
    }
  }
  
  return events;
}

