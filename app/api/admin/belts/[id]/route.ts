import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// DELETE /api/admin/belts/[id] - Delete a belt (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySessionWithDb()
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Check if belt exists
    const belt = await prisma.belt.findUnique({
      where: { id },
      include: {
        currentHolder: {
          select: { username: true },
        },
        challenges: {
          where: {
            status: 'PENDING',
          },
          select: { id: true },
        },
      },
    })

    if (!belt) {
      return NextResponse.json(
        { error: 'Belt not found' },
        { status: 404 }
      )
    }

    // Check for blocking conditions
    if (belt.currentHolderId) {
      return NextResponse.json(
        { 
          error: `Cannot delete belt with current holder. Please transfer or remove the holder first. Current holder: ${belt.currentHolder?.username || 'Unknown'}` 
        },
        { status: 400 }
      )
    }

    if (belt.challenges.length > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete belt with pending challenges. Please resolve or cancel ${belt.challenges.length} pending challenge(s) first.` 
        },
        { status: 400 }
      )
    }

    if (belt.isStaked) {
      return NextResponse.json(
        { 
          error: 'Cannot delete belt that is currently staked in a debate or tournament. Please unstake it first.' 
        },
        { status: 400 }
      )
    }

    // Delete the belt (BeltHistory will cascade delete automatically)
    await prisma.belt.delete({
      where: { id },
    })

    return NextResponse.json({ 
      success: true,
      message: `Belt "${belt.name}" has been deleted successfully.` 
    })
  } catch (error: any) {
    console.error('Failed to delete belt:', error)
    
    // Handle foreign key constraint errors
    if (error.code === 'P2003' || error.message?.includes('Foreign key constraint')) {
      return NextResponse.json(
        { error: 'Cannot delete belt due to existing references. Please remove all challenges and related data first.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to delete belt' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/belts/[id] - Update a belt (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySessionWithDb()
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const {
      name,
      type,
      category,
      coinValue,
      designImageUrl,
      designColors,
      sponsorName,
      sponsorLogoUrl,
    } = body
    
    console.log('=== PUT /api/admin/belts/[id] ===')
    console.log('Belt ID:', id)
    console.log('Received designImageUrl:', designImageUrl)
    console.log('designImageUrl type:', typeof designImageUrl)
    console.log('designImageUrl after trim:', designImageUrl?.trim())

    // Validate belt type if provided
    if (type) {
      const validTypes = ['ROOKIE', 'CATEGORY', 'CHAMPIONSHIP', 'UNDEFEATED', 'TOURNAMENT']
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: `Invalid belt type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (type !== undefined) updateData.type = type as any
    if (category !== undefined) updateData.category = category || null
    if (coinValue !== undefined) updateData.coinValue = parseInt(coinValue) || 0
    if (designImageUrl !== undefined) {
      const trimmedUrl = designImageUrl?.trim() || null
      updateData.designImageUrl = trimmedUrl
      console.log('Setting designImageUrl to:', trimmedUrl)
    }
    if (designColors !== undefined) updateData.designColors = designColors || null
    if (sponsorName !== undefined) updateData.sponsorName = sponsorName.trim() || null
    if (sponsorLogoUrl !== undefined) updateData.sponsorLogoUrl = sponsorLogoUrl.trim() || null
    
    console.log('Update data object:', updateData)
    console.log('designImageUrl in updateData:', updateData.designImageUrl)

    // Update belt
    const belt = await prisma.belt.update({
      where: { id },
      data: updateData,
    })
    
    console.log('Belt updated successfully')
    console.log('Updated belt designImageUrl:', belt.designImageUrl)
    console.log('Full updated belt:', belt)

    return NextResponse.json({ belt })
  } catch (error: any) {
    console.error('Failed to update belt:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update belt' },
      { status: 500 }
    )
  }
}
