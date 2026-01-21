# Workdays Calculator

A Node.js tool to calculate total half-days worked by your tech team during a sprint period, accounting for vacations and school days from Payfit calendar exports.

## Features

- 📅 Fetches calendar data from Payfit iCal URL
- 👥 Automatically detects team members from calendar events
- 🎯 Filters events by date range (sprint period) and selected members
- 📊 Calculates half-days worked (Monday-Friday only, excluding weekends)
- 🏫 Handles both "École" (school day) and "Absence" (vacation/day off) events
- ⏰ Supports full-day and half-day events based on time ranges
- 🇫🇷 Automatically excludes French public holidays (supports standard France and Alsace-Moselle regions)

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

## Setup

Before running the script, create two files:

1. **`payfit-url.txt`** - Contains your Payfit calendar URL (one line):
   ```
   https://api.payfit.com/absences/calendar/your-calendar-id
   ```

2. **`team-members.txt`** - Contains your team member names (one per line):
   ```
   John Doe
   Peter Smith
   ```

## Usage

Run the script:
```bash
npm start
```

The script will interactively prompt you for:

1. **Sprint start date** - Date in YYYY-MM-DD format
2. **Sprint end date** - Date in YYYY-MM-DD format

The script automatically uses:
- **Payfit calendar URL** from `payfit-url.txt`
- **Region**: Alsace-Moselle (13 jours fériés)
- **Team members** from `team-members.txt`


## How It Works

### Event Format

The script expects Payfit calendar events to follow this naming format:
- `École - [Member Name]` - School day events
- `Absence - [Member Name]` - Vacation/day off events

### Half-Day Calculation

- **Full day worked**: No event for that day → 2 half-days
- **Half-day worked**: Half-day event (morning or afternoon) → 1 half-day
- **No day worked**: Full-day event (all-day or covers 9:00-18:00) → 0 half-days

The script automatically detects full-day vs half-day events based on:
- All-day events (no time component)
- Events covering full working day (starts before 10:00 and ends after 17:00)
- Events covering half day (morning: ends before 14:00, or afternoon: starts after 13:00)

### Weekdays Only

The calculation only considers weekdays (Monday-Friday). Weekends are automatically excluded.

### French Public Holidays

The script automatically excludes French public holidays from the calculation:

**Standard France (11 jours fériés):**
- Jour de l'An (1er janvier)
- Lundi de Pâques
- Fête du Travail (1er mai)
- Victoire 1945 (8 mai)
- Ascension
- Lundi de Pentecôte
- Fête nationale (14 juillet)
- Assomption (15 août)
- Toussaint (1er novembre)
- Armistice 1918 (11 novembre)
- Noël (25 décembre)

**Alsace-Moselle (13 jours fériés):**
- All standard French holidays, plus:
- Vendredi Saint (Good Friday - 2 days before Easter)
- Saint-Étienne (26 décembre)

The script automatically calculates mobile holidays (Easter-based) for any year. Holidays falling on weekends are already excluded since the calculation only considers weekdays.

## Project Structure

```
workdays-calculator/
├── index.js                    # Main entry point with interactive prompts
├── src/
│   ├── calendarFetcher.js      # Fetch and parse iCal feed
│   ├── eventParser.js          # Parse event titles and filter events
│   ├── workdaysCalculator.js   # Calculate half-days logic
│   ├── holidays.js             # French public holidays calculation
│   ├── fileReader.js           # Read team members from text file
│   └── utils.js                # Date utilities and helpers
├── package.json
└── README.md
```

## Dependencies

- `node-ical` - Parse iCalendar format
- `inquirer` - Interactive command-line prompts
- `axios` - HTTP client for fetching calendar
- `date-fns` - Date manipulation utilities

## Troubleshooting

**payfit-url.txt not found**: 
- Create a file named `payfit-url.txt` with your Payfit calendar URL on a single line

**No team members found**: 
- Check that your Payfit calendar URL in `payfit-url.txt` is correct and accessible
- Ensure events follow the format: `[Type] - [Member Name]`
- Verify that member names in `team-members.txt` match names in the calendar (case-insensitive)

**Invalid date format**:
- Use YYYY-MM-DD format (e.g., 2024-01-15)

**Calendar fetch error**:
- Verify the Payfit calendar URL in `payfit-url.txt` is publicly accessible or requires authentication
- Check your internet connection

## License

ISC

