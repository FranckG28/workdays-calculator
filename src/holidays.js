import { startOfDay } from 'date-fns';

/**
 * Calculate Easter date for a given year using the computus algorithm
 * @param {number} year - Year
 * @returns {Date} Easter Sunday date
 */
function calculateEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month, day);
}

/**
 * Get all French public holidays for a given year
 * @param {number} year - Year
 * @param {boolean} alsaceMoselle - Include Alsace-Moselle specific holidays
 * @returns {Date[]} Array of holiday dates
 */
export function getFrenchHolidays(year, alsaceMoselle = false) {
  const holidays = [];
  
  // Fixed holidays (same every year)
  const fixedHolidays = [
    { month: 0, day: 1, name: "Jour de l'An" }, // 1er janvier
    { month: 4, day: 1, name: "Fête du Travail" }, // 1er mai
    { month: 4, day: 8, name: "Victoire 1945" }, // 8 mai
    { month: 6, day: 14, name: "Fête nationale" }, // 14 juillet
    { month: 7, day: 15, name: "Assomption" }, // 15 août
    { month: 10, day: 1, name: "Toussaint" }, // 1er novembre
    { month: 10, day: 11, name: "Armistice 1918" }, // 11 novembre
    { month: 11, day: 25, name: "Noël" }, // 25 décembre
  ];
  
  // Add fixed holidays
  for (const holiday of fixedHolidays) {
    holidays.push({
      date: startOfDay(new Date(year, holiday.month, holiday.day)),
      name: holiday.name
    });
  }
  
  // Calculate Easter (mobile holiday)
  const easter = calculateEaster(year);
  
  // Mobile holidays based on Easter
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  holidays.push({
    date: startOfDay(easterMonday),
    name: "Lundi de Pâques"
  });
  
  // Ascension (39 days after Easter)
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);
  holidays.push({
    date: startOfDay(ascension),
    name: "Ascension"
  });
  
  // Whit Monday (50 days after Easter)
  const whitMonday = new Date(easter);
  whitMonday.setDate(easter.getDate() + 50);
  holidays.push({
    date: startOfDay(whitMonday),
    name: "Lundi de Pentecôte"
  });
  
  // Alsace-Moselle specific holidays
  if (alsaceMoselle) {
    // Good Friday (Vendredi Saint) - 2 days before Easter
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);
    holidays.push({
      date: startOfDay(goodFriday),
      name: "Vendredi Saint"
    });
    
    // St. Stephen's Day (Saint-Étienne) - 26 décembre
    holidays.push({
      date: startOfDay(new Date(year, 11, 26)),
      name: "Saint-Étienne"
    });
  }
  
  return holidays;
}

/**
 * Get all French holidays within a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {boolean} alsaceMoselle - Include Alsace-Moselle specific holidays
 * @returns {Date[]} Array of holiday dates within the range
 */
export function getHolidaysInRange(startDate, endDate, alsaceMoselle = false) {
  const holidays = [];
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  
  // Get holidays for all years in the range
  for (let year = startYear; year <= endYear; year++) {
    const yearHolidays = getFrenchHolidays(year, alsaceMoselle);
    
    for (const holiday of yearHolidays) {
      const holidayDate = holiday.date;
      // Only include holidays within the date range
      if (holidayDate >= startDate && holidayDate <= endDate) {
        holidays.push(holidayDate);
      }
    }
  }
  
  return holidays;
}

/**
 * Check if a date is a French public holiday
 * @param {Date} date - Date to check
 * @param {boolean} alsaceMoselle - Include Alsace-Moselle specific holidays
 * @returns {boolean} True if the date is a holiday
 */
export function isFrenchHoliday(date, alsaceMoselle = false) {
  const year = date.getFullYear();
  const holidays = getFrenchHolidays(year, alsaceMoselle);
  const checkDate = startOfDay(date);
  
  return holidays.some(holiday => {
    const holidayDate = holiday.date;
    return holidayDate.getTime() === checkDate.getTime();
  });
}

/**
 * Get holiday name for a specific date
 * @param {Date} date - Date to check
 * @param {boolean} alsaceMoselle - Include Alsace-Moselle specific holidays
 * @returns {string|null} Holiday name or null if not a holiday
 */
export function getHolidayName(date, alsaceMoselle = false) {
  const year = date.getFullYear();
  const holidays = getFrenchHolidays(year, alsaceMoselle);
  const checkDate = startOfDay(date);
  
  const holiday = holidays.find(h => h.date.getTime() === checkDate.getTime());
  return holiday ? holiday.name : null;
}

