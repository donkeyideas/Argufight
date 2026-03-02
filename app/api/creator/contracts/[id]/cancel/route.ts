import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'
import { updateAdContract } from '@/lib/ads/contract-helpers'

// POST /api/creator/contracts/[id]/cancel - Cancel a contract
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
    const body = await request.json().catch(() => ({}))
    const cancellationReason = body.reason || 'Cancelled by creator'

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

    // Check if contract can be cancelled
    if (contract.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot cancel a completed contract' },
        { status: 400 }
      )
    }

    if (contract.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Contract is already cancelled' },
        { status: 400 }
      )
    }

    // Update contract to cancelled
    const updatedContract = await updateAdContract(contractId, {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: cancellationReason,
    })

    return NextResponse.json({
      success: true,
      contract: updatedContract,
      message: 'Contract cancelled',
    })
  } catch (error: any) {
    console.error('Failed to cancel contract:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel contract' },
      { status: 500 }
    )
  }
}
