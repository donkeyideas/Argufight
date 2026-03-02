import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { generateUniqueSlug } from '@/lib/utils/slug'
import crypto from 'crypto'

// GET /api/debates - List debates
export async function GET(request: NextRequest) {
  try {
    // Run background tasks after response is sent using after()
    // This is more reliable than fire-and-forget fetches in Vercel serverless
    after(async () => {
      try {
        // Process expired debates
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
        fetch(`${baseUrl}/api/debates/process-expired`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => {})

        // AI auto-accept open challenges
        const { triggerAIAutoAccept } = await import('@/lib/ai/trigger-ai-accept')
        await triggerAIAutoAccept()
      } catch {
        // Background task failure is non-critical
      }
    })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const userId = searchParams.get('userId')
    const shareToken = searchParams.get('shareToken') // For accessing private debates
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100 per page
    const skip = (page - 1) * limit
    
    // Get current user session for access control
    const session = await verifySession()
    const currentUserId = session ? getUserIdFromSession(session) : null
    
    // Check if current user is admin
    let isAdmin = false
    if (currentUserId) {
      const user = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { isAdmin: true },
      })
      isAdmin = user?.isAdmin || false
    }

    const where: any = {}

    if (status && status !== 'ALL') {
      // Handle comma-separated statuses (e.g., "COMPLETED,VERDICT_READY")
      if (status.includes(',')) {
        where.status = {
          in: status.split(',').map(s => s.trim())
        }
      } else {
        where.status = status
      }
    }

    if (category && category !== 'ALL') {
      where.category = category
    }

    if (userId) {
      // Get debate IDs where user is a participant via DebateParticipant (for GROUP/tournament debates)
      const participantDebates = await prisma.debateParticipant.findMany({
        where: {
          userId: userId,
          status: { in: ['ACCEPTED', 'ACTIVE', 'INVITED'] }, // Include active participants
        },
        select: {
          debateId: true,
        },
      })
      const participantDebateIds = participantDebates.map(p => p.debateId)

      // Include debates where user is challenger, opponent, OR a participant in GROUP debates
      const orConditions: any[] = [
        { challengerId: userId },
        { opponentId: userId },
      ]
      
      if (participantDebateIds.length > 0) {
        orConditions.push({ id: { in: participantDebateIds } })
      }
      
      where.OR = orConditions
    }

    // Privacy filtering: Exclude private debates unless:
    // 1. User is an admin (admins can see all debates)
    // 2. User is a participant (challenger or opponent)
    // 3. shareToken matches
    // 4. User is querying their own debates (userId matches currentUserId)
    if (isAdmin) {
      // Admins can see all debates (public and private) - no filter needed
    } else if (!shareToken && (!userId || userId !== currentUserId)) {
      where.isPrivate = false // Only show public debates in general listings
    } else if (shareToken) {
      // If shareToken is provided, only return debates with matching token
      where.shareToken = shareToken
    } else if (userId && userId === currentUserId) {
      // User viewing their own debates - show all (public and private)
      // No additional filter needed
    }

    // Get total count for pagination
    const total = await prisma.debate.count({ where })

    const debates = await prisma.debate.findMany({
      where,
      select: {
        id: true,
        topic: true,
        category: true,
        status: true,
        challengerId: true,
        opponentId: true,
        winnerId: true,
        endedAt: true,
        createdAt: true,
        verdictReached: true,
        verdictDate: true,
        challengeType: true,
        invitedUserIds: true,
        currentRound: true,
        totalRounds: true,
        roundDeadline: true,
        spectatorCount: true,
        challengerPosition: true,
        opponentPosition: true,
        isPrivate: true,
        shareToken: true,
        challenger: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            eloRating: true,
          }
        },
        opponent: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            eloRating: true,
          }
        },
        images: {
          select: {
            id: true,
            url: true,
            alt: true,
            caption: true,
            order: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        statements: {
          select: {
            id: true,
            round: true,
            authorId: true,
          },
        },
        tournamentMatch: {
          select: {
            id: true,
            tournament: {
              select: {
                id: true,
                name: true,
                format: true,
                currentRound: true,
                totalRounds: true,
              },
            },
            round: {
              select: {
                roundNumber: true,
              },
            },
          },
        },
        participants: {
          select: {
            id: true,
            userId: true,
            status: true,
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                eloRating: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    })

    // Add hasNoStatements flag to each debate
    const debatesWithFlags = debates.map(debate => ({
      ...debate,
      hasNoStatements: !debate.statements || debate.statements.length === 0,
    }))

    return NextResponse.json({
      debates: debatesWithFlags,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Failed to fetch debates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch debates' },
      { status: 500 }
    )
  }
}

// POST /api/debates - Create debate
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      topic, 
      description, 
      category, 
      challengerPosition, 
      totalRounds, 
      speedMode,
      allowCopyPaste = true,
      isPrivate = false,
      challengeType = 'OPEN',
      invitedUserIds = null,
      beltId = null,
    } = body

    // Validate required fields
    if (!topic || !category || !challengerPosition) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate challenge type
    if (!['OPEN', 'DIRECT', 'GROUP'].includes(challengeType)) {
      return NextResponse.json(
        { error: 'Invalid challenge type' },
        { status: 400 }
      )
    }

    // Validate direct/group challenge requirements
    if (challengeType === 'DIRECT') {
      if (!invitedUserIds || !Array.isArray(invitedUserIds) || invitedUserIds.length !== 1) {
        return NextResponse.json(
          { error: 'Direct challenge requires exactly one invited user' },
          { status: 400 }
        )
      }
    }

    if (challengeType === 'GROUP') {
      if (!invitedUserIds || !Array.isArray(invitedUserIds) || invitedUserIds.length === 0) {
        return NextResponse.json(
          { error: 'Group challenge requires at least one invited user' },
          { status: 400 }
        )
      }
      if (invitedUserIds.length > 10) {
        return NextResponse.json(
          { error: 'Group challenge can have at most 10 invited users' },
          { status: 400 }
        )
      }
    }

    // Get userId first
    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if challenger is suspended
    const challenger = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, bannedUntil: true, username: true },
    })

    if (!challenger) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if challenger is currently suspended
    if (challenger.bannedUntil && new Date(challenger.bannedUntil) > new Date()) {
      const daysRemaining = Math.ceil((new Date(challenger.bannedUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      return NextResponse.json(
        { 
          error: 'You are currently suspended from debating',
          suspensionDaysRemaining: daysRemaining,
          suspensionEndDate: challenger.bannedUntil,
        },
        { status: 403 }
      )
    }

    // Verify invited users exist and are not suspended
    if (invitedUserIds && invitedUserIds.length > 0) {
      const invitedUsers = await prisma.user.findMany({
        where: {
          id: { in: invitedUserIds },
        },
        select: { id: true, username: true, bannedUntil: true },
      })

      if (invitedUsers.length !== invitedUserIds.length) {
        return NextResponse.json(
          { error: 'One or more invited users not found' },
          { status: 400 }
        )
      }

      // Check if any invited users are suspended
      const suspendedUsers = invitedUsers.filter(user => 
        user.bannedUntil && new Date(user.bannedUntil) > new Date()
      )

      if (suspendedUsers.length > 0) {
        return NextResponse.json(
          { 
            error: `One or more invited users are currently suspended: ${suspendedUsers.map(u => u.username).join(', ')}`,
          },
          { status: 400 }
        )
      }
    }

    // Determine opponent position (opposite of challenger)
    const opponentPosition = challengerPosition === 'FOR' ? 'AGAINST' : 'FOR'

    // Calculate round duration (24 hours default, 1 hour for speed mode)
    const roundDuration = speedMode ? 3600000 : 86400000 // milliseconds

    // For direct challenges, set the opponent immediately
    let opponentId = null
    if (challengeType === 'DIRECT' && invitedUserIds && invitedUserIds.length === 1) {
      opponentId = invitedUserIds[0]
    }

    // Generate share token for private debates
    let shareToken = null
    if (isPrivate) {
      // Generate a secure random token (32 characters, URL-safe)
      shareToken = crypto.randomBytes(24).toString('base64url')
    }

    // Validate and check belt if provided
    let belt = null
    if (beltId) {
      // Check if belt system is enabled
      if (process.env.ENABLE_BELT_SYSTEM !== 'true') {
        return NextResponse.json(
          { error: 'Belt system is not enabled' },
          { status: 403 }
        )
      }

      belt = await prisma.belt.findUnique({
        where: { id: beltId },
      })

      if (!belt) {
        return NextResponse.json(
          { error: 'Belt not found' },
          { status: 404 }
        )
      }

      // Validate belt ownership
      if (belt.currentHolderId !== userId) {
        return NextResponse.json(
          { error: 'You do not own this belt' },
          { status: 403 }
        )
      }

      // Validate belt can be staked
      if (belt.isStaked) {
        return NextResponse.json(
          { error: 'Belt is already staked' },
          { status: 400 }
        )
      }

      if (belt.status !== 'ACTIVE' && belt.status !== 'MANDATORY') {
        return NextResponse.json(
          { error: `Cannot stake belt with status: ${belt.status}` },
          { status: 400 }
        )
      }
    }

    // Generate SEO-friendly slug
    let slug = generateUniqueSlug(topic)
    // Ensure slug is unique
    let slugExists = await prisma.debate.findUnique({ where: { slug } })
    let counter = 1
    while (slugExists) {
      slug = generateUniqueSlug(topic, Math.random().toString(36).substring(2, 8))
      slugExists = await prisma.debate.findUnique({ where: { slug } })
      counter++
      if (counter > 100) {
        // Fallback to UUID-based slug if too many collisions
        slug = generateUniqueSlug(topic, crypto.randomBytes(4).toString('hex'))
        break
      }
    }

    // Try to create debate with Prisma first
    let debate
    try {
      debate = await prisma.debate.create({
        data: {
          topic,
          slug,
          description: description || null,
          category: category as any, // Cast to enum type
          challengerId: userId,
          challengerPosition,
          opponentPosition,
          opponentId,
          totalRounds: totalRounds || 5,
          roundDuration,
          speedMode: speedMode || false,
          allowCopyPaste: allowCopyPaste !== false, // Default to true
          isPrivate: isPrivate || false,
          shareToken,
          challengeType,
          invitedUserIds: invitedUserIds ? JSON.stringify(invitedUserIds) : null,
          invitedBy: challengeType !== 'OPEN' ? userId : null,
          status: challengeType === 'DIRECT' ? 'WAITING' : 'WAITING',
          hasBeltAtStake: beltId !== null,
          beltStakeType: beltId ? 'MANUAL' : null,
        },
        include: {
          challenger: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              eloRating: true,
            }
          },
        },
      })
    } catch (error: any) {
      // If Prisma fails due to enum constraint (e.g., MUSIC not in enum) or missing column, use raw SQL
      if (error.message?.includes('Invalid value for enum') || 
          error.message?.includes('Unknown arg') ||
          error.message?.includes('does not exist') ||
          error.code === 'P2003' ||
          error.code === 'P2022') {
        console.log('Category not in enum, using raw SQL:', category)
        
        const debateId = crypto.randomUUID()
        const now = new Date().toISOString()
        
        // Get list of columns that exist in the database
        const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`
          PRAGMA table_info(debates)
        `)
        const columnNames = columns.map(c => c.name)
        
        // Build dynamic INSERT statement based on existing columns
        const insertColumns = [
          'id', 'topic', 'description', 'category', 'challenger_id', 'challenger_position',
          'opponent_position', 'opponent_id', 'total_rounds', 'round_duration', 'speed_mode',
          'challenge_type', 'invited_user_ids', 'invited_by', 'status', 'created_at', 'updated_at'
        ].filter(col => columnNames.includes(col))
        
        // Add belt fields if they exist
        if (columnNames.includes('has_belt_at_stake')) {
          insertColumns.push('has_belt_at_stake')
        }
        if (columnNames.includes('belt_stake_type')) {
          insertColumns.push('belt_stake_type')
        }
        
        // Add view_count if it exists
        if (columnNames.includes('view_count')) {
          insertColumns.push('view_count')
        }
        
        const placeholders = insertColumns.map(() => '?').join(', ')
        const values = [
          debateId,
          topic.trim(),
          description?.trim() || null,
          category.toUpperCase(),
          userId,
          challengerPosition,
          opponentPosition,
          opponentId,
          totalRounds || 5,
          roundDuration,
          speedMode ? 1 : 0,
          challengeType,
          invitedUserIds ? JSON.stringify(invitedUserIds) : null,
          challengeType !== 'OPEN' ? userId : null,
          'WAITING',
          now,
          now,
        ]
        
        // Add belt values if columns exist
        if (columnNames.includes('has_belt_at_stake')) {
          values.push(beltId ? 1 : 0)
        }
        if (columnNames.includes('belt_stake_type')) {
          values.push(beltId ? 'MANUAL' : null)
        }
        
        // Add view_count default if column exists
        if (columnNames.includes('view_count')) {
          values.push(0)
        }
        
        await prisma.$executeRawUnsafe(`
          INSERT INTO debates (${insertColumns.join(', ')})
          VALUES (${placeholders})
        `, ...values)
        
        // Fetch the created debate with relations
        debate = await prisma.debate.findUnique({
          where: { id: debateId },
          include: {
            challenger: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                eloRating: true,
              }
            },
            opponent: opponentId ? {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                eloRating: true,
              }
            } : undefined,
          },
        })
      } else {
        // Re-throw if it's a different error
        throw error
      }
    }

    // For GROUP challenges, create DebateParticipant records for all invited users
    if (challengeType === 'GROUP' && invitedUserIds && invitedUserIds.length > 0 && debate) {
      // Assign positions: alternate between FOR and AGAINST
      // Challenger is already FOR, so first invited user gets AGAINST, second gets FOR, etc.
      const participantData = invitedUserIds.map((invitedUserId: string, index: number) => {
        // Alternate positions: index 0 = AGAINST, index 1 = FOR, index 2 = AGAINST, etc.
        const position = index % 2 === 0 ? 'AGAINST' : 'FOR'
        return {
          debateId: debate.id,
          userId: invitedUserId,
          position: position as any,
          status: 'INVITED',
        }
      })

      // Also add challenger as a participant
      participantData.push({
        debateId: debate.id,
        userId: userId,
        position: challengerPosition as any,
        status: 'ACCEPTED', // Challenger automatically accepts
      })

      await prisma.debateParticipant.createMany({
        data: participantData,
      })
    }

    // Create notifications for invited users (with push notifications)
    if (invitedUserIds && invitedUserIds.length > 0 && debate) {
      const challenger = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      })

      // Import the notification function
      const { createDebateNotification } = await import('@/lib/notifications/debateNotifications')

      // Create notifications for each invited user (this will also send push notifications)
      for (const invitedUserId of invitedUserIds) {
        const notificationType = challengeType === 'DIRECT' ? 'DEBATE_INVITATION' : 'DEBATE_GROUP_INVITATION'
        const title = challengeType === 'DIRECT' 
          ? 'Direct Challenge Received'
          : 'Group Challenge Invitation'
        const message = challengeType === 'DIRECT'
          ? `${challenger?.username || 'Someone'} has challenged you to a debate: "${topic}"`
          : `${challenger?.username || 'Someone'} has invited you to a group challenge: "${topic}"`

        await createDebateNotification(
          debate.id,
          invitedUserId,
          notificationType,
          title,
          message
        )
      }
    }

    if (!debate) {
      return NextResponse.json(
        { error: 'Failed to create debate' },
        { status: 500 }
      )
    }

    // Trigger AI auto-accept after the response is sent (for OPEN challenges)
    if (challengeType === 'OPEN') {
      after(async () => {
        try {
          const { triggerAIAutoAccept } = await import('@/lib/ai/trigger-ai-accept')
          await triggerAIAutoAccept()
        } catch {
          // Background task failure is non-critical
        }
      })
    }

    // Update belt if staked
    if (beltId && belt && debate) {
      try {
        await prisma.belt.update({
          where: { id: beltId },
          data: {
            isStaked: true,
            status: 'STAKED',
            stakedInDebateId: debate.id,
          },
        })
      } catch (error: any) {
        console.error('Failed to stake belt:', error)
        // Don't fail the debate creation if belt staking fails
        // The belt will remain unstaked but the debate will be created
      }
    }

    return NextResponse.json(debate, { status: 201 })
  } catch (error) {
    console.error('Failed to create debate:', error)
    return NextResponse.json(
      { error: 'Failed to create debate' },
      { status: 500 }
    )
  }
}

