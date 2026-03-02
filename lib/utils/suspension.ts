/**
 * Check if a user is currently suspended
 * A user is suspended if bannedUntil is set and the date hasn't passed yet
 */
export function isUserSuspended(bannedUntil: Date | null | undefined): boolean {
  if (!bannedUntil) {
    return false
  }
  
  const now = new Date()
  return new Date(bannedUntil) > now
}

/**
 * Get the number of days remaining in a suspension
 */
export function getSuspensionDaysRemaining(bannedUntil: Date | null | undefined): number | null {
  if (!bannedUntil) {
    return null
  }
  
  const now = new Date()
  const endDate = new Date(bannedUntil)
  
  if (endDate <= now) {
    return null // Suspension has expired
  }
  
  const diffTime = endDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays
}

/**
 * Format suspension message for display
 */
export function formatSuspensionMessage(bannedUntil: Date | null | undefined): string | null {
  if (!bannedUntil) {
    return null
  }
  
  const daysRemaining = getSuspensionDaysRemaining(bannedUntil)
  
  if (daysRemaining === null) {
    return null // Suspension expired
  }
  
  if (daysRemaining === 0) {
    return 'Your suspension will be lifted today'
  }
  
  if (daysRemaining === 1) {
    return 'Your suspension will be lifted in 1 day'
  }
  
  return `Your suspension will be lifted in ${daysRemaining} days`
}










