import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { testConnection } from '@/lib/social/publisher'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { platform } = await request.json()
    if (!platform) return NextResponse.json({ error: 'platform is required' }, { status: 400 })

    const result = await testConnection(platform)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('test-connection error:', error)
    return NextResponse.json({ error: error.message ?? 'Connection test failed' }, { status: 500 })
  }
}
