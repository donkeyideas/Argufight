import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { payoutToCreator, capturePaymentIntent } from '@/lib/stripe/stripe-client'

/**
 * Combined cron job to:
 * 1. Process completed advertising contracts and release payouts
 * 2. Mark expired offers as EXPIRED
 * 
 * Expected cron schedule: Daily at 2 AM UTC
 * vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/process-ad-tasks",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { verifyCronAuth } = await import('@/lib/auth/cron-auth')
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const now = new Date()
    const results = {
      payouts: {
        processed: 0,
        errors: [] as Array<{ contractId: string; error: string }>,
      },
      expiredOffers: {
        count: 0,
        error: null as string | null,
      },
    }

    // ===== PROCESS AD PAYOUTS =====
    try {
      const completedContracts = await prisma.adContract.findMany({
        where: {
          status: 'ACTIVE',
          endDate: { lte: now },
          payoutSent: false,
          escrowHeld: true,
        },
        include: {
          creator: {
            include: {
              creatorTaxInfo: true,
            },
          },
          campaign: {
            select: {
              name: true,
            },
          },
          advertiser: {
            select: {
              companyName: true,
            },
          },
        },
      })

      console.log(`Found ${completedContracts.length} contracts ready for payout`)

      for (const contract of completedContracts) {
        try {
          // Verify creator has Stripe account set up
          if (!contract.creator.creatorTaxInfo?.stripeAccountId) {
            console.error(`Creator ${contract.creatorId} does not have Stripe account`)
            results.payouts.errors.push({
              contractId: contract.id,
              error: 'Creator Stripe account not set up',
            })
            continue
          }

          // Verify payout is enabled
          if (!contract.creator.creatorTaxInfo.payoutEnabled) {
            console.error(`Payouts not enabled for creator ${contract.creatorId}`)
            results.payouts.errors.push({
              contractId: contract.id,
              error: 'Creator payouts not enabled',
            })
            continue
          }

          // First, capture the payment intent (release from escrow)
          if (contract.stripePaymentId) {
            await capturePaymentIntent(contract.stripePaymentId)
          }

          // Then transfer to creator
          const transfer = await payoutToCreator(
            Number(contract.totalAmount),
            Number(contract.platformFee),
            contract.creator.creatorTaxInfo.stripeAccountId,
            `Campaign: ${contract.campaign.name} - Contract ${contract.id}`
          )

          // Update contract
          await prisma.adContract.update({
            where: { id: contract.id },
            data: {
              status: 'COMPLETED',
              completedAt: now,
              payoutSent: true,
              payoutDate: now,
              stripePayoutId: transfer.id,
            },
          })

          // Update creator's yearly earnings
          const currentYear = new Date().getFullYear()
          const yearlyEarnings = contract.creator.creatorTaxInfo.yearlyEarnings as Record<string, number> || {}
          const yearKey = currentYear.toString()
          yearlyEarnings[yearKey] = (yearlyEarnings[yearKey] || 0) + Number(contract.creatorPayout)

          await prisma.creatorTaxInfo.update({
            where: { creatorId: contract.creatorId },
            data: {
              yearlyEarnings,
            },
          })

          results.payouts.processed++
          console.log(`Processed payout for contract ${contract.id}: $${contract.creatorPayout}`)
        } catch (error: any) {
          console.error(`Failed to process contract ${contract.id}:`, error)
          results.payouts.errors.push({
            contractId: contract.id,
            error: error.message || 'Unknown error',
          })
        }
      }
    } catch (error: any) {
      results.payouts.errors.push({
        contractId: 'GLOBAL',
        error: `Payout processing error: ${error.message}`,
      })
    }

    // ===== CHECK EXPIRED OFFERS =====
    try {
      const expiredOffers = await prisma.offer.updateMany({
        where: {
          status: 'PENDING',
          expiresAt: { lt: now },
        },
        data: {
          status: 'EXPIRED',
        },
      })

      results.expiredOffers.count = expiredOffers.count
      console.log(`Marked ${expiredOffers.count} offers as expired`)
    } catch (error: any) {
      results.expiredOffers.error = error.message || 'Unknown error'
      console.error('Failed to check expired offers:', error)
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    })
  } catch (error: any) {
    console.error('Cron job failed:', error)
    return NextResponse.json(
      { error: error.message || 'Cron job failed' },
      { status: 500 }
    )
  }
}

