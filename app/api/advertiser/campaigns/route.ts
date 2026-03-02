import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { put } from '@vercel/blob'
import { validateCampaignDates } from '@/lib/ads/helpers'

/**
 * Get Eastern Timezone offset in minutes for a given date
 */
function getEasternTimezoneOffset(date: Date): number {
  // Create formatters for UTC and Eastern Time
  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  
  const easternFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  
  // Get UTC and Eastern time strings
  const utcParts = utcFormatter.formatToParts(date)
  const easternParts = easternFormatter.formatToParts(date)
  
  const utcHours = parseInt(utcParts.find(p => p.type === 'hour')?.value || '0')
  const utcMinutes = parseInt(utcParts.find(p => p.type === 'minute')?.value || '0')
  const easternHours = parseInt(easternParts.find(p => p.type === 'hour')?.value || '0')
  const easternMinutes = parseInt(easternParts.find(p => p.type === 'minute')?.value || '0')
  
  const utcTotalMinutes = utcHours * 60 + utcMinutes
  const easternTotalMinutes = easternHours * 60 + easternMinutes
  
  // Calculate offset (Eastern is behind UTC, so offset is negative)
  return easternTotalMinutes - utcTotalMinutes
}

// GET /api/advertiser/campaigns - Get advertiser's campaigns
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find advertiser by email
    const advertiser = await prisma.advertiser.findUnique({
      where: { contactEmail: user.email },
    })

    if (!advertiser) {
      return NextResponse.json({ error: 'Advertiser account not found' }, { status: 404 })
    }

    const now = new Date()

    // Auto-activate and auto-complete campaigns based on dates
    try {
      // Activate APPROVED campaigns that have reached their start date
      await prisma.campaign.updateMany({
        where: {
          advertiserId: advertiser.id,
          status: 'APPROVED',
          startDate: { lte: now },
          endDate: { gte: now },
        },
        data: {
          status: 'ACTIVE',
        },
      })

      // Complete ACTIVE campaigns that have passed their end date
      await prisma.campaign.updateMany({
        where: {
          advertiserId: advertiser.id,
          status: 'ACTIVE',
          endDate: { lt: now },
        },
        data: {
          status: 'COMPLETED',
        },
      })

      // Complete SCHEDULED campaigns that have passed their end date
      await prisma.campaign.updateMany({
        where: {
          advertiserId: advertiser.id,
          status: 'SCHEDULED',
          endDate: { lt: now },
        },
        data: {
          status: 'COMPLETED',
        },
      })
    } catch (error: any) {
      // Don't fail the request if auto-activation fails
      console.error('Failed to auto-activate/complete campaigns:', error)
    }

    // Get campaigns for this advertiser
    // Try to include impressions and clicks, but handle gracefully if relations don't exist
    let campaigns
    try {
      campaigns = await prisma.campaign.findMany({
        where: { advertiserId: advertiser.id },
        include: {
          impressions: {
            select: { id: true },
          },
          clicks: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    } catch (includeError: any) {
      // If include fails (e.g., relations don't exist), fetch without relations
      console.warn('[API /advertiser/campaigns GET] Failed to include relations, fetching without:', includeError.message)
      campaigns = await prisma.campaign.findMany({
        where: { advertiserId: advertiser.id },
        orderBy: { createdAt: 'desc' },
      })
    }

    // Format campaigns with impression and click counts
    // Handle paymentStatus gracefully - it may not exist if migration hasn't run
    const formattedCampaigns = campaigns.map((campaign: any) => {
      let paymentStatus = null
      try {
        paymentStatus = campaign.paymentStatus || null
      } catch (e) {
        // paymentStatus column doesn't exist, use null
        paymentStatus = null
      }
      
      return {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        paymentStatus: paymentStatus,
        budget: campaign.budget.toString(),
        startDate: campaign.startDate.toISOString(),
        endDate: campaign.endDate.toISOString(),
        impressionsDelivered: campaign.impressions?.length || 0,
        clicksDelivered: campaign.clicks?.length || 0,
      }
    })

    return NextResponse.json({ campaigns: formattedCampaigns })
  } catch (error: any) {
    console.error('[API /advertiser/campaigns GET] Failed to fetch campaigns:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    })
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch campaigns',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

// POST /api/advertiser/campaigns - Create new campaign
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find advertiser by email
    const advertiser = await prisma.advertiser.findUnique({
      where: { contactEmail: user.email },
    })

    if (!advertiser) {
      return NextResponse.json({ error: 'Advertiser account not found' }, { status: 404 })
    }

    if (advertiser.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Advertiser account not approved' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const name = formData.get('name') as string
    const type = formData.get('type') as string
    const category = formData.get('category') as string
    const budget = formData.get('budget') as string
    const startDate = formData.get('startDate') as string
    const endDate = formData.get('endDate') as string
    const destinationUrl = formData.get('destinationUrl') as string
    const ctaText = formData.get('ctaText') as string || 'Learn More'
    const file = formData.get('file') as File | null
    const bannerUrl = formData.get('bannerUrl') as string | null
    const adType = formData.get('adType') as string | null // BANNER, IN_FEED, SPONSORED_DEBATE (for PLATFORM_ADS)

    // Validation
    if (!name || !type || !category || !budget || !startDate || !endDate || !destinationUrl) {
      return NextResponse.json(
        { error: 'All required fields must be provided' },
        { status: 400 }
      )
    }

    // Parse dates in Eastern Time to prevent timezone shifts
    // Date input returns "YYYY-MM-DD", we need to create dates at midnight Eastern Time
    const startDateStr = startDate.includes('T') ? startDate.split('T')[0] : startDate
    const endDateStr = endDate.includes('T') ? endDate.split('T')[0] : endDate
    
    // Parse date components
    const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number)
    const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number)
    
    // Create dates representing midnight Eastern Time
    // We'll create a temporary date to determine the Eastern Time offset
    const tempStart = new Date(startYear, startMonth - 1, startDay)
    const tempEnd = new Date(endYear, endMonth - 1, endDay)
    
    // Get the Eastern Time offset for these dates (handles DST automatically)
    const startOffset = getEasternTimezoneOffset(tempStart)
    const endOffset = getEasternTimezoneOffset(tempEnd)
    
    // Create dates at midnight UTC, then adjust to Eastern Time
    // Eastern Time is UTC-5 (EST) or UTC-4 (EDT), so we add the offset
    const startFinal = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0))
    const endFinal = new Date(Date.UTC(endYear, endMonth - 1, endDay, 0, 0, 0))
    
    // Adjust to Eastern Time midnight (subtract offset since Eastern is behind UTC)
    const startAdjusted = new Date(startFinal.getTime() - (startOffset * 60 * 1000))
    const endAdjusted = new Date(endFinal.getTime() - (endOffset * 60 * 1000))
    
    const dateValidation = validateCampaignDates(startAdjusted, endAdjusted)
    if (!dateValidation.valid) {
      return NextResponse.json(
        { error: dateValidation.error },
        { status: 400 }
      )
    }

    // Handle banner upload
    let finalBannerUrl = ''
    if (file) {
      const blob = await put(`campaigns/${Date.now()}-${file.name}`, file, {
        access: 'public',
      })
      finalBannerUrl = blob.url
    } else if (bannerUrl) {
      finalBannerUrl = bannerUrl
    } else {
      return NextResponse.json(
        { error: 'Banner image is required' },
        { status: 400 }
      )
    }

    // Parse targeting (for creator sponsorships)
    let minELO: number | null = null
    let targetCategories: string[] = []
    let minFollowers: number | null = null
    let maxBudgetPerCreator: number | null = null

    if (type === 'CREATOR_SPONSORSHIP') {
      const minELOStr = formData.get('minELO') as string | null
      if (minELOStr) minELO = parseInt(minELOStr, 10)

      const targetCategoriesStr = formData.get('targetCategories') as string | null
      if (targetCategoriesStr) {
        try {
          targetCategories = JSON.parse(targetCategoriesStr)
        } catch {
          // Ignore parse errors
        }
      }

      const minFollowersStr = formData.get('minFollowers') as string | null
      if (minFollowersStr) minFollowers = parseInt(minFollowersStr, 10)

      const maxBudgetStr = formData.get('maxBudgetPerCreator') as string | null
      if (maxBudgetStr) maxBudgetPerCreator = parseFloat(maxBudgetStr)
    }

    // Create campaign
    // For PLATFORM_ADS, try PENDING_PAYMENT, fallback to PENDING_REVIEW if enum doesn't exist
    // For other types, status is PENDING_REVIEW
    let campaignStatus: any = type === 'PLATFORM_ADS' ? 'PENDING_PAYMENT' : 'PENDING_REVIEW'
    
    // Build campaign data
    // Note: paymentStatus, stripePaymentId, paidAt are optional until migration is complete
    const campaignData: any = {
      advertiserId: advertiser.id,
      name: name.trim(),
      type: type as any,
      category: category.trim(),
      budget: parseFloat(budget),
      startDate: startAdjusted,
      endDate: endAdjusted,
      destinationUrl: destinationUrl.trim(),
      ctaText: ctaText.trim(),
      bannerUrl: finalBannerUrl,
      minELO,
      targetCategories,
      minFollowers,
      maxBudgetPerCreator,
      status: campaignStatus,
    }

    // Add adType for PLATFORM_ADS (BANNER, IN_FEED, SPONSORED_DEBATE)
    if (type === 'PLATFORM_ADS' && adType) {
      campaignData.adType = adType
    }

    // Try to add paymentStatus for PLATFORM_ADS, but handle gracefully if column doesn't exist
    // We'll create the campaign first, then try to update paymentStatus if needed
    let campaign
    try {
      if (type === 'PLATFORM_ADS') {
        campaignData.paymentStatus = 'PENDING'
      }
      
      campaign = await prisma.campaign.create({
        data: campaignData,
      })
    } catch (createError: any) {
      console.error('[API /advertiser/campaigns POST] Create error:', {
        message: createError.message,
        code: createError.code,
        meta: createError.meta,
      })
      
      let retryData = { ...campaignData }
      let shouldRetry = false
      
      // Handle adType column not existing (if migration hasn't been applied yet)
      if (createError.message?.includes('ad_type') || createError.message?.includes('adType') || 
          (createError.code === 'P2022' && createError.meta?.column_name === 'ad_type')) {
        console.warn('[API /advertiser/campaigns POST] ad_type column not found, creating campaign without it')
        delete retryData.adType
        shouldRetry = true
      }
      
      // If paymentStatus column doesn't exist, or PENDING_PAYMENT enum doesn't exist, handle gracefully
      if (createError.message?.includes('payment_status') || (createError.code === 'P2022' && createError.meta?.column_name === 'payment_status')) {
        console.warn('[API /advertiser/campaigns POST] payment_status column not found, creating campaign without it')
        delete retryData.paymentStatus
        // Also try PENDING_REVIEW if PENDING_PAYMENT doesn't exist
        if (retryData.status === 'PENDING_PAYMENT') {
          retryData.status = 'PENDING_REVIEW'
        }
        shouldRetry = true
      }
      
      if (createError.message?.includes('PENDING_PAYMENT') || createError.message?.includes('enum')) {
        // If PENDING_PAYMENT enum value doesn't exist, use PENDING_REVIEW
        console.warn('[API /advertiser/campaigns POST] PENDING_PAYMENT status not found, using PENDING_REVIEW')
        retryData.status = 'PENDING_REVIEW'
        delete retryData.paymentStatus // Also remove paymentStatus if it was added
        shouldRetry = true
      }
      
      // Retry if we made any changes
      if (shouldRetry) {
        try {
          campaign = await prisma.campaign.create({
            data: retryData,
          })
          console.log('[API /advertiser/campaigns POST] Campaign created successfully after retry')
        } catch (retryError: any) {
          console.error('[API /advertiser/campaigns POST] Retry failed:', retryError.message)
          throw retryError
        }
      } else {
        // If we don't know how to handle this error, throw it
        throw createError
      }
    }

    // TODO: Send notification email to admins

    return NextResponse.json({ success: true, campaign }, { status: 201 })
  } catch (error: any) {
    console.error('[API /advertiser/campaigns POST] Failed to create campaign:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    })
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create campaign',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
