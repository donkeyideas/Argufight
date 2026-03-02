import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'
import { updateAdContract } from '@/lib/ads/contract-helpers'

// POST /api/creator/contracts/[id]/complete - Mark contract as completed
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySessionWithDb()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: contractId } = await params

    // Get the contract
    const contract = await prisma.adContract.findUnique({
      where: { id: contractId },
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // Verify the contract belongs to this creator
    if (contract.creatorId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if contract can be completed
    if (contract.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Contract is already completed' },
        { status: 400 }
      )
    }

    if (contract.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot complete a cancelled contract' },
        { status: 400 }
      )
    }

    // Update contract to completed
    const updatedContract = await updateAdContract(contractId, {
      status: 'COMPLETED',
      completedAt: new Date(),
    })

    return NextResponse.json({
      success: true,
      contract: updatedContract,
      message: 'Contract marked as completed',
    })
  } catch (error: any) {
    console.error('Failed to complete contract:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to complete contract' },
      { status: 500 }
    )
  }
}
