import { CreatorStatus } from '@prisma/client'
import { getPlatformFee, getCreatorEligibility } from './config'

// Re-export for client-side use
export { getCreatorEligibility, getPlatformFee } from './config'

/**
 * Calculate platform fee and creator payout based on creator status
 */
export async function calculatePlatformFee(
  creatorStatus: CreatorStatus | null,
  amount: number
): Promise<{ platformFee: number; creatorPayout: number }> {
  // Default to BRONZE if no status
  const tier = creatorStatus || 'BRONZE'
  
  const feePercentage = await getPlatformFee(tier)
  const platformFee = (amount * feePercentage) / 100
  const creatorPayout = amount - platformFee

  return { platformFee, creatorPayout }
}

/**
 * Determine creator status based on ELO
 */
export function getCreatorStatus(eloRating: number): CreatorStatus | null {
  if (eloRating >= 2500) return 'PLATINUM'
  if (eloRating >= 2000) return 'GOLD'
  if (eloRating >= 1500) return 'SILVER'
  return 'BRONZE'
}

/**
 * Check if user is eligible to become creator
 */
export async function isEligibleForCreator(
  eloRating: number,
  accountAge: Date,
  totalDebates: number
): Promise<{ eligible: boolean; reasons: string[] }> {
  const { minELO, minDebates, minAgeMonths } = await getCreatorEligibility()
  
  const accountAgeMonths = (new Date().getTime() - accountAge.getTime()) / (1000 * 60 * 60 * 24 * 30)
  
  const reasons: string[] = []
  
  if (eloRating < minELO) {
    reasons.push(`ELO rating must be at least ${minELO} (current: ${eloRating})`)
  }
  
  if (totalDebates < minDebates) {
    reasons.push(`Must have at least ${minDebates} debates (current: ${totalDebates})`)
  }
  
  if (accountAgeMonths < minAgeMonths) {
    reasons.push(`Account must be at least ${minAgeMonths} months old (current: ${Math.floor(accountAgeMonths)} months)`)
  }
  
  return {
    eligible: reasons.length === 0,
    reasons,
  }
}

/**
 * Validate campaign dates
 */
export function validateCampaignDates(
  startDate: Date,
  endDate: Date
): { valid: boolean; error?: string } {
  const now = new Date()

  if (startDate < now) {
    return { valid: false, error: 'Start date must be in the future' }
  }

  if (endDate <= startDate) {
    return { valid: false, error: 'End date must be after start date' }
  }

  const durationDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  if (durationDays < 7) {
    return { valid: false, error: 'Campaign must be at least 7 days' }
  }

  if (durationDays > 365) {
    return { valid: false, error: 'Campaign cannot exceed 365 days' }
  }

  return { valid: true }
}

