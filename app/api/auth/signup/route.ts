import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { isValidEmail, isValidPassword, isValidUsername } from '@/lib/utils/validation'

export async function POST(request: NextRequest) {
  try {
    const { username, email, password } = await request.json()

    // Validation
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      )
    }

    if (!isValidUsername(username)) {
      // Check if it's a blocked username
      const { isBlockedUsername } = await import('@/lib/utils/validation')
      if (isBlockedUsername(username)) {
        return NextResponse.json(
          { error: 'This username is reserved and cannot be used' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens' },
        { status: 400 }
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and contain at least one letter and one number' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username },
        ],
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: existingUser.email === email ? 'Email already in use' : 'Username already taken' },
        { status: 409 }
      )
    }

    // Check if email/username is on waiting list
    let onWaitingList = false
    try {
      const waitingListEntry = await (prisma as any).waitingList?.findFirst({
        where: {
          OR: [
            { email },
            { username },
          ],
        },
      })
      onWaitingList = !!waitingListEntry
    } catch {
      // Try raw SQL
      try {
        const result = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`
          SELECT id FROM waiting_list
          WHERE email = ? OR username = ?
          LIMIT 1
        `, email, username)
        onWaitingList = result.length > 0
      } catch {
        // Table doesn't exist, continue
      }
    }

    if (onWaitingList) {
      return NextResponse.json(
        { error: 'This email or username is already on the waiting list' },
        { status: 409 }
      )
    }

    // Check user limit
    let userLimit = 0
    try {
      const userLimitSetting = await prisma.adminSetting.findUnique({
        where: { key: 'user_limit' },
      })
      userLimit = userLimitSetting ? parseInt(userLimitSetting.value) : 0
    } catch (error) {
      // AdminSetting table might not exist yet, default to unlimited
      console.log('AdminSetting table not found, defaulting to unlimited users')
      userLimit = 0
    }

    if (userLimit > 0) {
      // Count active users (not banned)
      const currentUserCount = await prisma.user.count({
        where: {
          isBanned: false,
        },
      })

      if (currentUserCount >= userLimit) {
        // Add to waiting list
        const passwordHash = await hashPassword(password)

        // Get next position in waiting list
        let nextPosition = 1
        try {
          const lastEntry = await (prisma as any).waitingList?.findFirst({
            where: { approved: false },
            orderBy: { position: 'desc' },
            select: { position: true },
          })
          nextPosition = lastEntry ? lastEntry.position + 1 : 1
        } catch {
          // Try raw SQL
          try {
            const result = await prisma.$queryRawUnsafe<Array<{ position: number }>>(`
              SELECT position FROM waiting_list
              WHERE approved = 0
              ORDER BY position DESC
              LIMIT 1
            `)
            nextPosition = result.length > 0 ? result[0].position + 1 : 1
          } catch {
            // Table doesn't exist, position is 1
          }
        }

        // Add to waiting list
        try {
          await (prisma as any).waitingList?.create({
            data: {
              email,
              username,
              passwordHash,
              position: nextPosition,
              notified: false,
              approved: false,
            },
          })
        } catch {
          // Try raw SQL
          const crypto = require('crypto')
          const waitingListId = crypto.randomUUID()
          await prisma.$executeRawUnsafe(`
            INSERT INTO waiting_list (id, email, username, password_hash, position, notified, approved, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
          `, waitingListId, email, username, passwordHash, nextPosition, new Date().toISOString(), new Date().toISOString())
        }

        return NextResponse.json(
          {
            error: 'User limit reached',
            message: 'We have reached our user limit. You have been added to the waiting list. We will notify you when a spot becomes available.',
            waitingList: true,
            position: nextPosition,
          },
          { status: 403 }
        )
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
      },
    })

    // Create session
    try {
      await createSession(user.id)
    } catch (sessionError) {
      console.error('Session creation error:', sessionError)
      // If session creation fails, delete the user we just created to avoid orphaned accounts
      await prisma.user.delete({ where: { id: user.id } })
      throw new Error(`Failed to create session: ${sessionError instanceof Error ? sessionError.message : String(sessionError)}`)
    }

    // Automatically create FREE subscription
    try {
      await prisma.userSubscription.create({
        data: {
          userId: user.id,
          tier: 'FREE',
          status: 'ACTIVE',
          billingCycle: null,
        },
      })

      // Create appeal limit for Free tier (4/month)
      await prisma.appealLimit.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          monthlyLimit: 4,
          currentCount: 0,
        },
        update: {
          monthlyLimit: 4,
        },
      })
    } catch (subscriptionError) {
      console.error('Failed to create free subscription:', subscriptionError)
      // Don't fail signup if subscription creation fails - user can still use the app
    }

    // Return user (without password)
    const { passwordHash: _, ...userWithoutPassword } = user

    return NextResponse.json({
      user: userWithoutPassword,
    }, { status: 201 })
  } catch (error) {
    console.error('Signup error:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Check for common issues
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // Provide helpful error messages for common issues
    let userFriendlyError = 'Internal server error'
    let errorDetails = errorMessage
    
    if (errorMessage.includes('Can\'t reach database server') || 
        errorMessage.includes('P1001') ||
        errorMessage.includes('connection')) {
      userFriendlyError = 'Database connection failed'
      errorDetails = 'Please check DATABASE_URL environment variable'
    } else if (errorMessage.includes('does not exist') || 
               errorMessage.includes('relation') ||
               errorMessage.includes('P2021')) {
      userFriendlyError = 'Database table not found'
      errorDetails = 'Please run database migrations: npx prisma migrate deploy'
    } else if (errorMessage.includes('AUTH_SECRET') || 
               errorMessage.includes('secret')) {
      userFriendlyError = 'Authentication configuration error'
      errorDetails = 'Please check AUTH_SECRET environment variable'
    }
    
    return NextResponse.json(
      { 
        error: userFriendlyError,
        details: process.env.NODE_ENV === 'production' ? errorDetails : errorMessage,
        // Only include stack in development
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

