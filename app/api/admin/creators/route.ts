import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


// GET /api/admin/creators - Get all creators
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()
    const status = searchParams.get('status') // 'all', 'active', 'pending_setup'

    const where: any = {
      isCreator: true,
    }

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Filter by status
    if (status === 'active') {
      where.creatorTaxInfo = {
        payoutEnabled: true,
      }
    } else if (status === 'pending_setup') {
      where.OR = [
        { creatorTaxInfo: null },
        { creatorTaxInfo: { payoutEnabled: false } },
        { creatorTaxInfo: { stripeAccountId: null } },
      ]
    }

    const creators = await prisma.user.findMany({
      where,
      include: {
        creatorTaxInfo: {
          select: {
            stripeAccountId: true,
            payoutEnabled: true,
            taxFormComplete: true,
            bankVerified: true,
            yearlyEarnings: true,
          },
        },
        _count: {
          select: {
            activeContracts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to 100 for performance
    })

    // Calculate total earnings for each creator
    const creatorsWithStats = await Promise.all(
      creators.map(async (creator) => {
        const contracts = await prisma.adContract.findMany({
          where: {
            creatorId: creator.id,
            payoutSent: true,
          },
          select: {
            creatorPayout: true,
          },
        })

        const totalEarned = contracts.reduce(
          (sum, contract) => sum + Number(contract.creatorPayout),
          0
        )

        const pendingContracts = await prisma.adContract.findMany({
          where: {
            creatorId: creator.id,
            payoutSent: false,
            escrowHeld: true,
          },
          select: {
            creatorPayout: true,
          },
        })

        const pendingPayout = pendingContracts.reduce(
          (sum, contract) => sum + Number(contract.creatorPayout),
          0
        )

        return {
          id: creator.id,
          username: creator.username,
          email: creator.email,
          eloRating: creator.eloRating,
          creatorStatus: creator.creatorStatus,
          totalDebates: creator.totalDebates,
          createdAt: creator.createdAt,
          stripeAccountId: creator.creatorTaxInfo?.stripeAccountId || null,
          payoutEnabled: creator.creatorTaxInfo?.payoutEnabled || false,
          taxFormComplete: creator.creatorTaxInfo?.taxFormComplete || false,
          bankVerified: creator.creatorTaxInfo?.bankVerified || false,
          totalContracts: creator._count.activeContracts,
          totalEarned,
          pendingPayout,
        }
      })
    )

    return NextResponse.json({ creators: creatorsWithStats })
  } catch (error: any) {
    console.error('Failed to fetch creators:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch creators' },
      { status: 500 }
    )
  }
}

