import { prisma } from '@/lib/db/prisma'

/**
 * Check if Platform Ads are enabled
 */
export async function isPlatformAdsEnabled(): Promise<boolean> {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'ADS_PLATFORM_ENABLED' },
    })
    return setting?.value === 'true'
  } catch (error) {
    console.error('Failed to check platform ads enabled:', error)
    return false
  }
}

/**
 * Check if Creator Marketplace is enabled
 */
export async function isCreatorMarketplaceEnabled(): Promise<boolean> {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'ADS_CREATOR_MARKETPLACE_ENABLED' },
    })
    return setting?.value === 'true'
  } catch (error) {
    console.error('Failed to check creator marketplace enabled:', error)
    return false
  }
}

/**
 * Get creator eligibility requirements
 */
export async function getCreatorEligibility(): Promise<{
  minELO: number
  minDebates: number
  minAgeMonths: number
}> {
  try {
    const [minELO, minDebates, minAge] = await Promise.all([
      prisma.adminSetting.findUnique({ where: { key: 'CREATOR_MIN_ELO' } }),
      prisma.adminSetting.findUnique({ where: { key: 'CREATOR_MIN_DEBATES' } }),
      prisma.adminSetting.findUnique({ where: { key: 'CREATOR_MIN_ACCOUNT_AGE_MONTHS' } }),
    ])

    return {
      minELO: parseInt(minELO?.value || '1500', 10),
      minDebates: parseInt(minDebates?.value || '10', 10),
      minAgeMonths: parseInt(minAge?.value || '3', 10),
    }
  } catch (error) {
    console.error('Failed to get creator eligibility:', error)
    // Return defaults
    return {
      minELO: 1500,
      minDebates: 10,
      minAgeMonths: 3,
    }
  }
}

/**
 * Get platform fee for a creator tier
 */
export async function getPlatformFee(
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'
): Promise<number> {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: `CREATOR_FEE_${tier}` },
    })

    // Default fees if not set
    const defaults: Record<string, number> = {
      BRONZE: 25,
      SILVER: 20,
      GOLD: 15,
      PLATINUM: 10,
    }

    return parseInt(setting?.value || defaults[tier].toString(), 10)
  } catch (error) {
    console.error(`Failed to get platform fee for ${tier}:`, error)
    // Return defaults
    const defaults: Record<string, number> = {
      BRONZE: 25,
      SILVER: 20,
      GOLD: 15,
      PLATINUM: 10,
    }
    return defaults[tier]
  }
}

/**
 * Initialize default admin settings for advertising
 * Call this once to set up default values
 */
export async function initializeAdvertisingSettings(adminUserId: string): Promise<void> {
  const defaultSettings = [
    { key: 'ADS_PLATFORM_ENABLED', value: 'false', description: 'Enable Platform Ads', category: 'advertising' },
    { key: 'ADS_CREATOR_MARKETPLACE_ENABLED', value: 'false', description: 'Enable Creator Marketplace', category: 'advertising' },
    { key: 'CREATOR_MIN_ELO', value: '1500', description: 'Minimum ELO for creator eligibility', category: 'advertising' },
    { key: 'CREATOR_MIN_DEBATES', value: '10', description: 'Minimum debates for creator eligibility', category: 'advertising' },
    { key: 'CREATOR_MIN_ACCOUNT_AGE_MONTHS', value: '3', description: 'Minimum account age (months) for creator eligibility', category: 'advertising' },
    { key: 'CREATOR_FEE_BRONZE', value: '25', description: 'Platform fee percentage for Bronze tier creators', category: 'advertising' },
    { key: 'CREATOR_FEE_SILVER', value: '20', description: 'Platform fee percentage for Silver tier creators', category: 'advertising' },
    { key: 'CREATOR_FEE_GOLD', value: '15', description: 'Platform fee percentage for Gold tier creators', category: 'advertising' },
    { key: 'CREATOR_FEE_PLATINUM', value: '10', description: 'Platform fee percentage for Platinum tier creators', category: 'advertising' },
  ]

  for (const setting of defaultSettings) {
    await prisma.adminSetting.upsert({
      where: { key: setting.key },
      update: {
        // Don't update if already exists
      },
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
        category: setting.category,
        updatedBy: adminUserId,
      },
    })
  }
}

