import inquirer from 'inquirer';
import fs from 'fs/promises';
import { CONFIG } from './src/config.js';
import { fetchCalendar, getEvents } from './src/calendarFetcher.js';
import { extractMemberNames, getRelevantEvents } from './src/eventParser.js';
import { calculateTotalHalfDays } from './src/workdaysCalculator.js';
import { parseDate } from './src/utils.js';
import { getHolidaysInRange, getHolidayName } from './src/holidays.js';
import { readMembersFromFile } from './src/fileReader.js';

/**
 * Read or create Payfit calendar URL file
 */
async function getCalendarUrl() {
  try {
    const urlContent = await fs.readFile(CONFIG.FILES.PAYFIT_URL, 'utf-8');
    const url = urlContent.trim();
    
    if (!url) {
      // File exists but is empty, ask user to fill it
      console.log(`\n📝 ${CONFIG.FILES.PAYFIT_URL} is empty. Please provide your Payfit calendar URL.`);
      const { url } = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'Enter your Payfit calendar URL:',
          validate: (input) => {
            if (!input || input.trim() === '') {
              return 'Please enter a valid URL';
            }
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL';
            }
          }
        }
      ]);
      
      await fs.writeFile(CONFIG.FILES.PAYFIT_URL, url.trim() + '\n', 'utf-8');
      console.log(`✓ Saved Payfit URL to ${CONFIG.FILES.PAYFIT_URL}`);
      return url.trim();
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL format in ${CONFIG.FILES.PAYFIT_URL}`);
    }
    
    return url;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, create it and ask user
      console.log(`\n📝 Creating ${CONFIG.FILES.PAYFIT_URL}...`);
      console.log('Please provide your Payfit calendar URL.');
      console.log('You can find it in Payfit under Calendar Export / iCal.');
      
      const { url } = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'Enter your Payfit calendar URL:',
          validate: (input) => {
            if (!input || input.trim() === '') {
              return 'Please enter a valid URL';
            }
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL';
            }
          }
        }
      ]);
      
      await fs.writeFile(CONFIG.FILES.PAYFIT_URL, url.trim() + '\n', 'utf-8');
      console.log(`✓ Created ${CONFIG.FILES.PAYFIT_URL} with your Payfit URL`);
      return url.trim();
    }
    throw error;
  }
}

/**
 * Prompt user for date range
 */
async function promptForDateRange() {
  const { startDate, endDate } = await inquirer.prompt([
    {
      type: 'input',
      name: 'startDate',
      message: 'Enter sprint start date (YYYY-MM-DD):',
      validate: (input) => {
        if (!input || input.trim() === '') {
          return 'Please enter a valid date';
        }
        try {
          parseDate(input.trim());
          return true;
        } catch (error) {
          return 'Please enter a valid date in YYYY-MM-DD format';
        }
      }
    },
    {
      type: 'input',
      name: 'endDate',
      message: 'Enter sprint end date (YYYY-MM-DD):',
      validate: (input) => {
        if (!input || input.trim() === '') {
          return 'Please enter a valid date';
        }
        try {
          parseDate(input.trim());
          return true;
        } catch (error) {
          return 'Please enter a valid date in YYYY-MM-DD format';
        }
      }
    }
  ]);
  
  return {
    startDate: parseDate(startDate.trim()),
    endDate: parseDate(endDate.trim())
  };
}

/**
 * Read or create team members file
 */
async function getMembersFromFile(availableMembers) {
  // Convert Set to Array if needed
  const availableArray = Array.isArray(availableMembers) 
    ? availableMembers 
    : Array.from(availableMembers);
  
  const filePath = CONFIG.FILES.TEAM_MEMBERS;
  let fileMembers;
  
  try {
    fileMembers = await readMembersFromFile(filePath);
  } catch (error) {
    if (error.code === 'ENOENT' || error.message.includes('not found')) {
      // File doesn't exist, create it
      console.log(`\n📝 Creating ${CONFIG.FILES.TEAM_MEMBERS}...`);
      console.log(`Found ${availableArray.length} team member(s) in the calendar:`);
      availableArray.sort().forEach((member, index) => {
        console.log(`  ${index + 1}. ${member}`);
      });
      
      const { selectedMembers } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedMembers',
          message: `Select team members to include (saved to ${CONFIG.FILES.TEAM_MEMBERS}):`,
          choices: availableArray.map(member => ({
            name: member,
            value: member,
            checked: true
          })),
          validate: (input) => {
            if (input.length === 0) {
              return 'Please select at least one team member';
            }
            return true;
          }
        }
      ]);
      
      // Write selected members to file
      const fileContent = selectedMembers.join('\n') + '\n';
      await fs.writeFile(filePath, fileContent, 'utf-8');
      console.log(`✓ Created ${CONFIG.FILES.TEAM_MEMBERS} with ${selectedMembers.length} member(s)`);
      
      return selectedMembers;
    }
    throw error;
  }
  
  // Match file members to available members (case-insensitive)
  const matchedMembers = [];
  const notFound = [];
  
  for (const fileMember of fileMembers) {
    // Try exact match first
    if (availableArray.includes(fileMember)) {
      matchedMembers.push(fileMember);
    } else {
      // Try case-insensitive match
      const found = availableArray.find(av => 
        av.toLowerCase() === fileMember.toLowerCase()
      );
      if (found) {
        matchedMembers.push(found);
      } else {
        notFound.push(fileMember);
      }
    }
  }
  
  if (matchedMembers.length === 0) {
    console.log('\n⚠️  No matching members found in calendar.');
    console.log('Members in file:', fileMembers.join(', '));
    console.log(`\nPlease update ${CONFIG.FILES.TEAM_MEMBERS} with valid member names.`);
    process.exit(1);
  }
  
  if (notFound.length > 0) {
    console.log('\n⚠️  Warning: Some members from file were not found in calendar:');
    notFound.forEach(member => console.log(`  - ${member}`));
  }
  
  return matchedMembers;
}

/**
 * Main execution function
 */
async function main() {
  console.log('📅 Payfit Workdays Calculator\n');
  console.log('This script calculates total half-days worked by your team');
  console.log('during a sprint period, accounting for vacations and school days.\n');
  
  try {
    // Step 1: Get calendar URL from file (create if doesn't exist)
    const calendarUrl = await getCalendarUrl();
    
    // Step 2: Fetch and parse calendar
    console.log('\n📥 Fetching calendar...');
    const calendar = await fetchCalendar(calendarUrl);
    const allEvents = getEvents(calendar);
    console.log(`✓ Found ${allEvents.length} events in calendar`);
    
    // Step 3: Extract member names
    const availableMembers = extractMemberNames(allEvents);
    
    // Step 4: Get date range
    const { startDate, endDate } = await promptForDateRange();
    
    // Validate date range
    if (startDate > endDate) {
      console.error('\n❌ Error: Start date must be before or equal to end date');
      process.exit(1);
    }
    
    // Step 5: Always use Alsace-Moselle for public holidays
    const alsaceMoselle = CONFIG.REGION.ALSACE_MOSELLE;
    console.log('\n✓ Region: Alsace-Moselle (13 jours fériés)');
    
    // Step 6: Always load members from team-members.txt file (create if doesn't exist)
    const selectedMembers = await getMembersFromFile(availableMembers);
    console.log(`✓ Using ${selectedMembers.length} member(s) from ${CONFIG.FILES.TEAM_MEMBERS}`);
    
    // Step 7: Filter relevant events
    console.log('\n🔍 Filtering events...');
    const relevantEvents = getRelevantEvents(allEvents, selectedMembers, startDate, endDate);
    const eventTypesStr = CONFIG.EVENT_TYPES.join(' or ');
    console.log(`✓ Found ${relevantEvents.length} relevant events (${eventTypesStr}) for selected members`);
    
    // Get holidays in range for information
    const holidays = getHolidaysInRange(startDate, endDate, alsaceMoselle);
    const workingDayHolidays = holidays.filter(h => {
      const dayOfWeek = h.getDay();
      return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
    });
    
    if (workingDayHolidays.length > 0) {
      console.log(`✓ Found ${workingDayHolidays.length} public holiday(s) falling on weekdays in the period`);
    }
    
    // Step 8: Calculate half-days
    console.log('\n📊 Calculating half-days worked...');
    const result = calculateTotalHalfDays(
      relevantEvents,
      selectedMembers,
      startDate,
      endDate,
      alsaceMoselle
    );
    
    // Step 9: Display results (simple format for copy-paste)
    console.log('\n' + '='.repeat(60));
    console.log('📈 RESULTS (Copy-friendly format)');
    console.log('='.repeat(60));
    console.log(`\nPeriod: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    const holidaysText = workingDayHolidays.length > 0 
      ? `${result.weekdaysCount} (${workingDayHolidays.length} holidays)`
      : `${result.weekdaysCount}`;
    console.log(`Working days in period: ${holidaysText}`);
    console.log(`Team members: ${selectedMembers.length}`);
    
    // One line per member showing days worked
    console.log('');
    for (const [member, data] of Object.entries(result.breakdown)) {
      console.log(`${member}: ${data.daysWorked.toFixed(1)} days worked`);
    }
    
    // Total full days
    const totalFullDays = (result.totalHalfDays / 2).toFixed(1);
    console.log(`\nTotal: ${totalFullDays} full days worked`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();

