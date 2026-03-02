import { prisma } from '@/lib/db/prisma'
import { NextResponse } from 'next/server'

// Public endpoint - no authentication required
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // Test connection
    await prisma.$connect()
    
    // Simple query
    const userCount = await prisma.user.count()
    
    return NextResponse.json({ 
      success: true, 
      userCount,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasDirectUrl: !!process.env.DIRECT_URL,
      databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) || 'NOT SET',
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasDirectUrl: !!process.env.DIRECT_URL,
      databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) || 'NOT SET',
    }, { status: 500 })
  }
}
