/**
 * Timezone utilities for Eastern Time
 */

/**
 * Get current date/time in Eastern Time
 * Returns a Date object representing the current time in Eastern Time
 */
export function getEasternTime(): Date {
  const now = new Date()
  // Get Eastern Time string and parse it
  const easternString = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  return new Date(easternString)
}

/**
 * Get start of day in Eastern Time
 */
export function getStartOfDayEastern(date?: Date): Date {
  const baseDate = date || new Date()
  // Get the date string in Eastern Time
  const easternDateStr = baseDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' })
  const [month, day, year] = easternDateStr.split('/')
  const easternDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`)
  // Adjust for timezone offset
  const offset = baseDate.getTimezoneOffset() - getEasternOffset(baseDate)
  easternDate.setMinutes(easternDate.getMinutes() - offset)
  return easternDate
}

/**
 * Get end of day in Eastern Time
 */
export function getEndOfDayEastern(date?: Date): Date {
  const start = getStartOfDayEastern(date)
  start.setHours(23, 59, 59, 999)
  return start
}

/**
 * Get Eastern Time offset in minutes
 */
function getEasternOffset(date: Date): number {
  // Create a date formatter for Eastern Time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'longOffset',
  })
  
  // Get Eastern Time
  const easternDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
  
  // Calculate offset
  return (easternDate.getTime() - utcDate.getTime()) / (1000 * 60)
}

/**
 * Format date for display in Eastern Time
 */
export function formatDateEastern(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    ...options,
  })
}

/**
 * Format date for Google Analytics (YYYY-MM-DD) in Eastern Time
 */
export function formatDateForGA(date: Date): string {
  // Get date components in Eastern Time
  const easternDateStr = date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  
  // Parse MM/DD/YYYY format
  const [month, day, year] = easternDateStr.split('/')
  return `${year}-${month}-${day}`
}

/**
 * Convert UTC date to Eastern Time Date object
 */
export function utcToEastern(utcDate: Date): Date {
  const easternString = utcDate.toLocaleString('en-US', { timeZone: 'America/New_York' })
  return new Date(easternString)
}

/**
 * Convert Eastern Time date to UTC Date object
 */
export function easternToUTC(easternDate: Date): Date {
  // Get the time in Eastern
  const easternTime = easternDate.toLocaleString('en-US', { timeZone: 'America/New_York' })
  // Get the same time in UTC
  const utcTime = new Date(easternTime).toLocaleString('en-US', { timeZone: 'UTC' })
  return new Date(utcTime)
}

