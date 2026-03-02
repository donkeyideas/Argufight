import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'

export const dynamic = 'force-dynamic'

// POST /api/admin/seo/sitemap/regenerate - Force sitemap regeneration
export async function POST() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // In Next.js, sitemap is generated on-demand, so we just return success
    // The sitemap will be regenerated on the next request
    return NextResponse.json({
      success: true,
      message: 'Sitemap will be regenerated on next access',
    })
  } catch (error) {
    console.error('Failed to regenerate sitemap:', error)
    return NextResponse.json(
      { error: 'Failed to regenerate sitemap' },
      { status: 500 }
    )
  }
}

