import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// SIMPLE BANNER AD API - Direct query, no complexity
export async function GET(request: NextRequest) {
  try {
    console.log('[Banner API] Fetching BANNER ad...')
    
    // Simple query: get the first ACTIVE BANNER ad with valid dates
    const now = new Date()
    const ad = await prisma.advertisement.findFirst({
      where: {
        type: 'BANNER',
        status: 'ACTIVE',
        OR: [
          { startDate: null, endDate: null }, // No date restrictions
          { startDate: { lte: now }, endDate: { gte: now } }, // Within date range
          { startDate: null, endDate: { gte: now } }, // No start, but not expired
          { startDate: { lte: now }, endDate: null }, // Started but no end
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    console.log('[Banner API] Found ad:', ad ? { id: ad.id, hasImage: !!ad.creativeUrl, creativeUrl: ad.creativeUrl } : 'null')

    if (ad && ad.creativeUrl) {
      let destinationUrl = ad.targetUrl || ''
      if (destinationUrl && !destinationUrl.match(/^https?:\/\//i)) {
        destinationUrl = `https://${destinationUrl}`
      }

      console.log('[Banner API] ✅ Returning ad:', ad.id, 'with image:', ad.creativeUrl)
      return NextResponse.json(
        {
          ad: {
            id: ad.id,
            bannerUrl: ad.creativeUrl,
            destinationUrl: destinationUrl,
            ctaText: 'Learn More',
            adId: ad.id,
          },
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      )
    }

    console.log('[Banner API] ❌ No ad found')
    return NextResponse.json(
      { ad: null },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error: any) {
    console.error('[Banner API] Error:', error)
    return NextResponse.json({ ad: null }, { status: 500 })
  }
}
