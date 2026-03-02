/**
 * Utility functions for handling Eastern Time (ET) timezone
 * Handles both EST (Eastern Standard Time) and EDT (Eastern Daylight Time)
 */

/**
 * Convert a UTC Date object to Eastern Timezone string for datetime-local input
 * Format: YYYY-MM-DDTHH:mm
 */
export function toEasternDateTimeLocal(date: Date): string {
  // Use Intl.DateTimeFormat to get Eastern time components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  
  const parts = formatter.formatToParts(date)
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  const hour = parts.find(p => p.type === 'hour')?.value
  const minute = parts.find(p => p.type === 'minute')?.value
  
  return `${year}-${month}-${day}T${hour}:${minute}`
}

/**
 * Get current date/time in Eastern Timezone formatted for datetime-local input
 */
export function getEasternTimeLocal(): string {
  return toEasternDateTimeLocal(new Date())
}

/**
 * Convert a datetime-local string (assumed to be in Eastern time) to a UTC Date object
 * The datetime-local input doesn't include timezone info, so we treat it as Eastern time
 * and convert it to UTC for storage in the database
 * 
 * This function works by:
 * 1. Parsing the datetime-local string
 * 2. Creating a date string that represents that time in Eastern timezone
 * 3. Using the timezone offset to convert to UTC
 */
export function fromEasternDateTimeLocal(dateTimeLocal: string): Date {
  // Parse the datetime-local string (YYYY-MM-DDTHH:mm)
  const [datePart, timePart] = dateTimeLocal.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)
  
  // Create a date string in ISO format
  const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  
  // We need to convert from Eastern time to UTC
  // Strategy: Create a date object, then adjust it based on the timezone offset
  // We'll use a test date to determine the offset
  
  // Create a test date in UTC that we'll check
  let testDate = new Date(`${dateString}Z`)
  
  // Use Intl to format this UTC date in Eastern timezone
  const easternFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  
  // Iteratively adjust until we find the UTC time that corresponds to our Eastern time
  let iterations = 0
  const maxIterations = 20
  
  while (iterations < maxIterations) {
    const easternStr = easternFormatter.format(testDate)
    const parts = easternStr.split(', ')
    const datePart = parts[0] // MM/DD/YYYY
    const timePart = parts[1] // HH:MM
    
    const [eMonth, eDay, eYear] = datePart.split('/').map(Number)
    const [eHour, eMinute] = timePart.split(':').map(Number)
    
    // Check if we match the target
    if (eYear === year && eMonth === month && eDay === day && eHour === hours && eMinute === minutes) {
      return testDate
    }
    
    // Calculate the difference
    const targetTime = new Date(year, month - 1, day, hours, minutes).getTime()
    const actualTime = new Date(eYear, eMonth - 1, eDay, eHour, eMinute).getTime()
    const diffMs = targetTime - actualTime
    
    // Adjust the test date
    testDate = new Date(testDate.getTime() + diffMs)
    
    iterations++
  }
  
  // If we couldn't find an exact match, return the best guess
  return testDate
}

/**
 * Get minimum datetime-local value (current time in Eastern) for input min attribute
 */
export function getMinEasternDateTimeLocal(): string {
  return getEasternTimeLocal()
}
