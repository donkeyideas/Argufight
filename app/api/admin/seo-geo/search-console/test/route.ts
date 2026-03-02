import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { testGSCConnection } from '@/lib/seo/search-console'


export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await testGSCConnection()
    return NextResponse.json(result)
  } catch (error) {
    console.error('GSC test error:', error)
    const message = error instanceof Error ? error.message : 'Test failed'
    return NextResponse.json(
      { success: false, error: message, availableSites: [], siteAccessible: false, configuredSiteUrl: '' },
      { status: 500 }
    )
  }
}
