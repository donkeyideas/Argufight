/**
 * Cron Job: Expire Pending Offers
 * Runs daily at 1 AM to expire offers past their expiration date
 *
 * Schedule: 0 1 * * * (daily at 1 AM)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyCronAuth } from '@/lib/auth/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    console.log('[Cron] Starting offer expiration check...')

    const now = new Date()

    // Find expired pending offers
    const expiredOffers = await prisma.offer.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: now,
        },
      },
      include: {
        advertiser: {
          select: { companyName: true, contactEmail: true },
        },
        creator: {
          select: { id: true, username: true, email: true, coins: true },
        },
        campaign: {
          select: { name: true },
        },
      },
    })

    console.log(`[Cron] Found ${expiredOffers.length} expired offers`)

    let expiredCount = 0
    const errors: string[] = []

    // Process each expired offer
    for (const offer of expiredOffers) {
      try {
        // Update offer status to EXPIRED
        await prisma.offer.update({
          where: { id: offer.id },
          data: { status: 'EXPIRED' },
        })

        expiredCount++
        console.log(`[Cron] Expired offer ${offer.id} (${offer.advertiser.companyName} → ${offer.creator.username})`)

        // Note: No refund needed - offers are not paid until they become contracts
        // Payment only happens after offer is accepted and converted to AdContract

        // Send notification to advertiser
        await prisma.notification.create({
          data: {
            userId: offer.advertiserId,
            type: 'OTHER',
            title: 'Offer Expired',
            message: `Your offer to ${offer.creator.username} for "${offer.campaign.name}" has expired`,
          },
        })

        // Send notification to creator
        await prisma.notification.create({
          data: {
            userId: offer.creator.id,
            type: 'OTHER',
            title: 'Offer Expired',
            message: `An offer from ${offer.advertiser.companyName} has expired`,
          },
        })

      } catch (error: any) {
        const errorMsg = `Failed to expire offer ${offer.id}: ${error.message}`
        console.error(`[Cron] ${errorMsg}`)
        errors.push(errorMsg)
      }
    }

    const summary = {
      success: true,
      timestamp: now.toISOString(),
      found: expiredOffers.length,
      expired: expiredCount,
      errors: errors.length > 0 ? errors : undefined,
    }

    console.log('[Cron] Offer expiration complete:', summary)

    return NextResponse.json(summary)

  } catch (error: any) {
    console.error('[Cron] Offer expiration failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to expire offers',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
