import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { BetaAnalyticsDataClient } from '@google-analytics/data'

export const dynamic = 'force-dynamic'

// POST /api/admin/settings/test-google-analytics - Test Google Analytics connection
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get Google Analytics settings
    const [apiKeySetting, propertyIdSetting] = await Promise.all([
      prisma.adminSetting.findUnique({ where: { key: 'GOOGLE_ANALYTICS_API_KEY' } }),
      prisma.adminSetting.findUnique({ where: { key: 'GOOGLE_ANALYTICS_PROPERTY_ID' } }),
    ])

    const credentialsJson = apiKeySetting?.value || null
    const propertyId = propertyIdSetting?.value || null

    // Validate inputs
    if (!propertyId) {
      return NextResponse.json({
        success: false,
        error: 'Google Analytics Property ID is required',
      })
    }

    if (!credentialsJson) {
      return NextResponse.json({
        success: false,
        error: 'Google Analytics Service Account JSON is required',
      })
    }

    // Validate JSON format
    let credentials
    try {
      credentials = JSON.parse(credentialsJson)
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON format. Please ensure you pasted the Service Account JSON (not the gtag.js script). The JSON should start with {"type": "service_account", ...}',
      })
    }

    // Check if it looks like a service account JSON
    if (!credentials.type || credentials.type !== 'service_account') {
      return NextResponse.json({
        success: false,
        error: 'Invalid Service Account JSON. The JSON should have "type": "service_account". Make sure you downloaded the JSON key file from Google Cloud Console, not the gtag.js script.',
      })
    }

    // Check required fields
    if (!credentials.project_id || !credentials.private_key || !credentials.client_email) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Service Account JSON. Missing required fields (project_id, private_key, or client_email).',
      })
    }

    // Try to initialize the client
    let analyticsClient
    try {
      analyticsClient = new BetaAnalyticsDataClient({
        credentials,
      })
    } catch (initError: any) {
      return NextResponse.json({
        success: false,
        error: `Failed to initialize Google Analytics client: ${initError.message || 'Unknown error'}`,
      })
    }

    // Try to make a test API call (get today's data)
    try {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD

      const [report] = await analyticsClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [
          {
            startDate: todayStr,
            endDate: todayStr,
          },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
        ],
        limit: 1,
      })

      return NextResponse.json({
        success: true,
        message: `✅ Connection successful! Successfully connected to Google Analytics Property ${propertyId}.`,
        propertyId,
        serviceAccountEmail: credentials.client_email,
        testData: {
          sessions: report.rows?.[0]?.metricValues?.[0]?.value || '0',
          users: report.rows?.[0]?.metricValues?.[1]?.value || '0',
        },
      })
    } catch (apiError: any) {
      // Provide helpful error messages
      let errorMessage = apiError.message || 'Unknown error'
      
      if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('403')) {
        errorMessage = 'Permission denied. Make sure the service account email has been added to your GA4 property with at least "Viewer" role. Service account email: ' + credentials.client_email
      } else if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('404')) {
        errorMessage = `Property ID "${propertyId}" not found. Please verify the Property ID in Google Analytics Admin → Property Settings.`
      } else if (errorMessage.includes('INVALID_ARGUMENT')) {
        errorMessage = 'Invalid Property ID format. Property ID should be a number (e.g., "123456789").'
      }

      return NextResponse.json({
        success: false,
        error: `Google Analytics API error: ${errorMessage}`,
        details: apiError.message,
      })
    }
  } catch (error: any) {
    console.error('Google Analytics test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to test Google Analytics connection',
      },
      { status: 500 }
    )
  }
}

