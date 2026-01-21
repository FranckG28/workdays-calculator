/**
 * Configuration file for the workdays calculator
 */

export const CONFIG = {
  // File paths
  FILES: {
    PAYFIT_URL: 'payfit-url.txt',
    TEAM_MEMBERS: 'team-members.txt'
  },
  
  // Event types to track in Payfit calendar
  // Event title format: "[Type] - [Member Name]"
  EVENT_TYPES: ['École', 'Absence'],
  
  // Region settings
  REGION: {
    DEFAULT: 'alsace-moselle', // 'alsace-moselle' or 'france-standard'
    ALSACE_MOSELLE: true
  }
};

// Build regex pattern dynamically from event types
const eventTypesPattern = CONFIG.EVENT_TYPES.map(type => type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
export const EVENT_TITLE_PATTERN = new RegExp(`^(${eventTypesPattern})\\s*-\\s*(.+)$`);

