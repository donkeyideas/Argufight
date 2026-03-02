import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { isPlatformAdsEnabled, isCreatorMarketplaceEnabled } from '@/lib/ads/config'

// GET /api/ads/select?placement=PROFILE_BANNER&userId=...
export async function GET(request: NextRequest) {
  console.log('🔵 [AdSelect API] ========== ROUTE CALLED ==========')
  console.log('🔵 [AdSelect API] URL:', request.url)
  try {
    const { searchParams } = new URL(request.url)
    const placement = searchParams.get('placement') as string
    const userId = searchParams.get('userId')
    const debateId = searchParams.get('debateId')

    if (!placement) {
      return NextResponse.json({ error: 'Placement is required' }, { status: 400 })
    }

    const now = new Date()

    // Check if ads are enabled
    const [platformEnabled, marketplaceEnabled] = await Promise.all([
      isPlatformAdsEnabled(),
      isCreatorMarketplaceEnabled(),
    ])

    // Priority: Creator contracts > Platform ads > Direct Ads (always available)
    // 1. Try Creator Marketplace contracts first
    if (marketplaceEnabled && userId) {
      const creatorContract = await prisma.adContract.findFirst({
        where: {
          status: 'ACTIVE',
          placement: placement as any,
          startDate: { lte: now },
          endDate: { gte: now },
          creator: {
            id: userId,
            profileBannerAvailable: placement === 'PROFILE_BANNER' ? true : undefined,
            postDebateAvailable: placement === 'POST_DEBATE' ? true : undefined,
            debateWidgetAvailable: placement === 'DEBATE_WIDGET' ? true : undefined,
          },
        },
        include: {
          campaign: {
            select: {
              id: true,
              bannerUrl: true,
              destinationUrl: true,
              ctaText: true,
            },
          },
        },
        orderBy: { signedAt: 'desc' },
      })

      if (creatorContract && creatorContract.campaign?.bannerUrl) {
        return NextResponse.json({
          ad: {
            id: creatorContract.id,
            bannerUrl: creatorContract.campaign.bannerUrl,
            destinationUrl: creatorContract.campaign.destinationUrl,
            ctaText: creatorContract.campaign.ctaText,
            contractId: creatorContract.id,
            campaignId: creatorContract.campaignId,
          },
        })
      }
    }

    // 2. Try Platform Ads (advertiser campaigns)
    // Platform Ads should work like Direct Ads - filter by placement/adType
    if (platformEnabled) {
      try {
        // Map placement to Platform Ads adType (same as Direct Ads)
        const placementToAdType: Record<string, string[]> = {
          'PROFILE_BANNER': ['BANNER'],
          'POST_DEBATE': ['SPONSORED_DEBATE', 'BANNER'],
          'DEBATE_WIDGET': ['SPONSORED_DEBATE', 'BANNER'],
          'IN_FEED': ['IN_FEED', 'BANNER'],
          'LEADERBOARD_SPONSORED': ['BANNER'],
        }

        const adTypes = placementToAdType[placement] || ['BANNER']

        // Try each ad type in order (same priority as Direct Ads)
        for (const adType of adTypes) {
          try {
            console.log(`[AdSelect API] Trying Platform Ad type: ${adType} for placement: ${placement}`)
            
            // Get active Platform Ads campaigns matching this adType
            const platformCampaigns = await prisma.campaign.findMany({
              where: {
                type: 'PLATFORM_ADS',
                status: 'ACTIVE',
                startDate: { lte: now },
                endDate: { gte: now },
                adType: adType, // Filter by adType to match placement
                bannerUrl: { not: null },
              },
              select: {
                id: true,
                bannerUrl: true,
                destinationUrl: true,
                ctaText: true,
                createdAt: true,
                adType: true,
              },
              orderBy: { createdAt: 'desc' },
            })

            if (platformCampaigns.length > 0) {
              // ROTATION LOGIC: Round-robin selection
              const hourIndex = Math.floor(Date.now() / (1000 * 60 * 60))
              const placementHash = placement.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
              const rotationIndex = (hourIndex + placementHash) % platformCampaigns.length
              const selectedCampaign = platformCampaigns[rotationIndex]

              console.log(`[AdSelect API] ✅ Platform Ad selected: ${selectedCampaign.id} (${adType}) for placement: ${placement}`)

              return NextResponse.json({
                ad: {
                  id: selectedCampaign.id,
                  bannerUrl: selectedCampaign.bannerUrl!,
                  destinationUrl: selectedCampaign.destinationUrl,
                  ctaText: selectedCampaign.ctaText,
                  contractId: '',
                  campaignId: selectedCampaign.id,
                },
              })
            } else {
              console.log(`[AdSelect API] No Platform Ads found for type: ${adType}, placement: ${placement}`)
            }
          } catch (error: any) {
            console.error(`[AdSelect API] Error querying Platform Ads type ${adType}:`, error)
            continue // Try next ad type
          }
        }
      } catch (error: any) {
        // If Platform Ads query fails (e.g., adType field doesn't exist yet), skip it
        console.log(`[AdSelect API] Platform Ads query failed, skipping:`, error.message)
        // Continue to Direct Ads
      }
    }

    // 3. Direct Ads (Advertisement table) - ALWAYS available, admin-created
    // Map placement to advertisement type
    const placementToAdType: Record<string, string[]> = {
      'PROFILE_BANNER': ['BANNER'],
      'POST_DEBATE': ['SPONSORED_DEBATE', 'BANNER'],
      'DEBATE_WIDGET': ['SPONSORED_DEBATE', 'BANNER'],
      'IN_FEED': ['IN_FEED', 'BANNER'],
      'LEADERBOARD_SPONSORED': ['BANNER'],
    }

    const adTypes = placementToAdType[placement] || ['BANNER']

    // Try each ad type in order
    for (const adType of adTypes) {
      try {
        console.log(`[AdSelect API] Trying Direct Ad type: ${adType} for placement: ${placement}`)
        
        // Fetch ad and filter for creativeUrl in JavaScript (Prisma doesn't handle null checks well)
        const directAd = await prisma.advertisement.findFirst({
          where: {
            type: adType,
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

        console.log(`[AdSelect API] Direct Ad query result for ${adType}:`, directAd ? { id: directAd.id, hasImage: !!directAd.creativeUrl, status: directAd.status, startDate: directAd.startDate, endDate: directAd.endDate } : 'null')

        // Filter for creativeUrl in JavaScript
        if (directAd && directAd.creativeUrl) {
          // Ensure target URL has protocol
          let destinationUrl = directAd.targetUrl || ''
          if (destinationUrl && !destinationUrl.match(/^https?:\/\//i)) {
            destinationUrl = `https://${destinationUrl}`
          }

          console.log(`[AdSelect API] ✅ Returning Direct Ad: ${directAd.id} (${adType})`)
          return NextResponse.json({
            ad: {
              id: directAd.id,
              bannerUrl: directAd.creativeUrl,
              destinationUrl: destinationUrl,
              ctaText: 'Learn More',
              contractId: '',
              campaignId: '',
              adId: directAd.id,
            },
          })
        } else if (directAd && !directAd.creativeUrl) {
          console.log(`[AdSelect API] ⚠️  Direct Ad ${directAd.id} (${adType}) found but has no creativeUrl`)
        }
      } catch (error: any) {
        console.error(`[AdSelect API] Error querying ${adType}:`, error)
        // Continue to next ad type instead of crashing
        continue
      }
    }

    // No ad found
    console.log(`[AdSelect API] ❌ No ad found for placement: ${placement}`)
    return NextResponse.json({ ad: null })
  } catch (error: any) {
    console.error('[AdSelect API] ❌ CRITICAL ERROR:', error)
    console.error('[AdSelect API] Error stack:', error.stack)
    console.error('[AdSelect API] Error message:', error.message)
    console.error('[AdSelect API] Error name:', error.name)
    return NextResponse.json(
      { 
        error: 'Failed to select ad',
        message: error.message || 'Unknown error',
        ad: null 
      }, 
      { status: 500 }
    )
  }
}
