import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { payoutToCreator } from '@/lib/stripe/stripe-client'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/contracts/[id]/payout
 * Manually trigger a payout for a specific contract
 * Admin only - allows manual payout processing
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params

    // Get contract with all necessary relations
    const contract = await prisma.adContract.findUnique({
      where: { id },
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

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // Verify contract is ready for payout
    if (contract.payoutSent) {
      return NextResponse.json(
        { error: 'Payout already sent for this contract' },
        { status: 400 }
      )
    }

    if (!contract.escrowHeld) {
      return NextResponse.json(
        { error: 'Payment not held in escrow for this contract' },
        { status: 400 }
      )
    }

    // Verify creator has Stripe account
    if (!contract.creator.creatorTaxInfo?.stripeAccountId) {
      return NextResponse.json(
        { error: 'Creator does not have Stripe account set up' },
        { status: 400 }
      )
    }

    // Verify payout is enabled
    if (!contract.creator.creatorTaxInfo.payoutEnabled) {
      return NextResponse.json(
        { error: 'Creator payouts are not enabled' },
        { status: 400 }
      )
    }

    // Process payout
    // Note: Payment is already captured (from Checkout Session), so we just transfer
    const transfer = await payoutToCreator(
      Number(contract.totalAmount), // Total amount
      Number(contract.platformFee), // Platform fee (will be deducted)
      contract.creator.creatorTaxInfo.stripeAccountId,
      `Campaign: ${contract.campaign.name} - Contract ${contract.id.substring(0, 8)}`
    )

    // Update contract
    const now = new Date()
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

    return NextResponse.json({
      success: true,
      message: 'Payout processed successfully',
      contract: {
        id: contract.id,
        totalAmount: Number(contract.totalAmount),
        platformFee: Number(contract.platformFee),
        creatorPayout: Number(contract.creatorPayout),
        transferId: transfer.id,
      },
    })
  } catch (error: any) {
    console.error('Failed to process payout:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process payout' },
      { status: 500 }
    )
  }
}

