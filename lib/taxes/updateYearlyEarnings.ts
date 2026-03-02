import { prisma } from '@/lib/db/prisma'

/**
 * Update yearly earnings for a creator based on completed contracts
 * This should be called whenever a contract is completed or payout is made
 */
export async function updateCreatorYearlyEarnings(creatorId: string) {
  try {
    // Get or create tax info
    let taxInfo = await prisma.creatorTaxInfo.findUnique({
      where: { creatorId },
    })

    if (!taxInfo) {
      taxInfo = await prisma.creatorTaxInfo.create({
        data: {
          creatorId,
          stripeAccountId: `temp_${creatorId}`,
          yearlyEarnings: {},
        },
      })
    }

    // Get all completed contracts for this creator
    const contracts = await prisma.adContract.findMany({
      where: {
        creatorId,
        status: 'COMPLETED',
        payoutSent: true,
      },
      select: {
        creatorPayout: true,
        signedAt: true,
        payoutDate: true,
      },
    })

    // Calculate earnings by year
    const yearlyEarnings: Record<string, number> = {}

    contracts.forEach((contract) => {
      // Use payoutDate if available, otherwise use signedAt
      const dateToUse = contract.payoutDate ? new Date(contract.payoutDate) : new Date(contract.signedAt)
      const year = dateToUse.getFullYear()
      const payout = Number(contract.creatorPayout || 0)
      
      if (!yearlyEarnings[year.toString()]) {
        yearlyEarnings[year.toString()] = 0
      }
      
      yearlyEarnings[year.toString()] += payout
    })

    // Update tax info
    await prisma.creatorTaxInfo.update({
      where: { id: taxInfo.id },
      data: {
        yearlyEarnings,
      },
    })

    return yearlyEarnings
  } catch (error) {
    console.error(`[updateCreatorYearlyEarnings] Error updating earnings for creator ${creatorId}:`, error)
    throw error
  }
}

/**
 * Get YTD earnings for a specific year
 */
export async function getCreatorYTDEarnings(creatorId: string, year: number): Promise<number> {
  try {
    const taxInfo = await prisma.creatorTaxInfo.findUnique({
      where: { creatorId },
    })

    if (!taxInfo) {
      return 0
    }

    const yearlyEarnings = taxInfo.yearlyEarnings as Record<string, number> || {}
    return yearlyEarnings[year.toString()] || 0
  } catch (error) {
    console.error(`[getCreatorYTDEarnings] Error getting YTD earnings for creator ${creatorId}:`, error)
    return 0
  }
}
