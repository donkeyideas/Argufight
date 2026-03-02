/**
 * Google Analytics Data API (GA4) Integration
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data'

interface GoogleAnalyticsConfig {
  propertyId: string // GA4 Property ID (e.g., "123456789")
  credentials?: string // Service account JSON credentials
}

let analyticsClient: BetaAnalyticsDataClient | null = null

/**
 * Initialize Google Analytics client
 */
export function initGoogleAnalytics(propertyId: string, credentialsJson?: string): void {
  try {
    if (credentialsJson) {
      const credentials = JSON.parse(credentialsJson)
      analyticsClient = new BetaAnalyticsDataClient({
        credentials,
      })
    } else {
      // Use default credentials from environment
      analyticsClient = new BetaAnalyticsDataClient()
    }
  } catch (error) {
    console.error('Failed to initialize Google Analytics client:', error)
    analyticsClient = null
  }
}

/**
 * Get analytics data from Google Analytics
 */
export async function getGoogleAnalyticsData(
  propertyId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string, // YYYY-MM-DD
  credentialsJson?: string
) {
  if (!analyticsClient) {
    initGoogleAnalytics(propertyId, credentialsJson)
  }

  if (!analyticsClient) {
    throw new Error('Google Analytics client not initialized')
  }

  try {
    // Run report for sessions, users, and page views
    const [report] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate,
          endDate,
        },
      ],
      dimensions: [
        { name: 'date' },
        { name: 'sessionSource' },
        { name: 'deviceCategory' },
        { name: 'country' },
        { name: 'hour' },
        { name: 'pagePath' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'newUsers' },
      ],
    })

    return report
  } catch (error) {
    console.error('Google Analytics API error:', error)
    throw error
  }
}

/**
 * Format GA4 report data to our analytics format
 */
export function formatGA4Data(report: any, days: number) {
  if (!report || !report.rows) {
    return null
  }

  // Process rows to extract data
  const dailyData: Map<string, { sessions: number; users: number; pageViews: number }> = new Map()
  const trafficSources: Map<string, number> = new Map()
  const deviceBreakdown: Map<string, number> = new Map()
  const geographicData: Map<string, { sessions: number; users: number }> = new Map()
  const hourlyTraffic: Map<number, number> = new Map()
  const topPages: Map<string, { views: number; uniqueViews: number }> = new Map()

  let totalSessions = 0
  let totalUsers = 0
  let totalPageViews = 0
  let totalBounceRate = 0
  let totalAvgDuration = 0
  let totalNewUsers = 0

  for (const row of report.rows) {
    const date = row.dimensionValues[0]?.value || ''
    const source = row.dimensionValues[1]?.value || 'Direct'
    const device = row.dimensionValues[2]?.value || 'Unknown'
    const country = row.dimensionValues[3]?.value || 'Unknown'
    const hour = parseInt(row.dimensionValues[4]?.value || '0')
    const pagePath = row.dimensionValues[5]?.value || '/'

    const sessions = parseInt(row.metricValues[0]?.value || '0')
    const users = parseInt(row.metricValues[1]?.value || '0')
    const pageViews = parseInt(row.metricValues[2]?.value || '0')
    const bounceRate = parseFloat(row.metricValues[3]?.value || '0')
    const avgDuration = parseFloat(row.metricValues[4]?.value || '0')
    const newUsers = parseInt(row.metricValues[5]?.value || '0')

    // Daily data
    if (date) {
      const existing = dailyData.get(date) || { sessions: 0, users: 0, pageViews: 0 }
      dailyData.set(date, {
        sessions: existing.sessions + sessions,
        users: existing.users + users,
        pageViews: existing.pageViews + pageViews,
      })
    }

    // Traffic sources
    const sourceSessions = trafficSources.get(source) || 0
    trafficSources.set(source, sourceSessions + sessions)

    // Device breakdown
    const deviceSessions = deviceBreakdown.get(device) || 0
    deviceBreakdown.set(device, deviceSessions + sessions)

    // Geographic data
    if (country !== 'Unknown') {
      const geo = geographicData.get(country) || { sessions: 0, users: 0 }
      geographicData.set(country, {
        sessions: geo.sessions + sessions,
        users: geo.users + users,
      })
    }

    // Hourly traffic
    const hourSessions = hourlyTraffic.get(hour) || 0
    hourlyTraffic.set(hour, hourSessions + sessions)

    // Top pages
    const page = topPages.get(pagePath) || { views: 0, uniqueViews: 0 }
    topPages.set(pagePath, {
      views: page.views + pageViews,
      uniqueViews: page.uniqueViews + users,
    })

    // Totals
    totalSessions += sessions
    totalUsers += users
    totalPageViews += pageViews
    totalBounceRate += bounceRate
    totalAvgDuration += avgDuration
    totalNewUsers += newUsers
  }

  // Format traffic over time
  const trafficOverTime = Array.from(dailyData.entries())
    .map(([date, data]) => ({
      date: formatDateFromGA(date),
      sessions: data.sessions,
      users: data.users,
      pageViews: data.pageViews,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Format traffic sources
  const totalSourceSessions = Array.from(trafficSources.values()).reduce((a, b) => a + b, 0)
  const formattedTrafficSources = Array.from(trafficSources.entries())
    .map(([source, sessions]) => ({
      source,
      sessions,
      percentage: totalSourceSessions > 0 ? Math.round((sessions / totalSourceSessions) * 100) : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)

  // Format device breakdown
  const totalDeviceSessions = Array.from(deviceBreakdown.values()).reduce((a, b) => a + b, 0)
  const formattedDeviceBreakdown = Array.from(deviceBreakdown.entries())
    .map(([device, sessions]) => ({
      device,
      sessions,
      percentage: totalDeviceSessions > 0 ? Math.round((sessions / totalDeviceSessions) * 100) : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)

  // Format geographic data
  const formattedGeographicData = Array.from(geographicData.entries())
    .map(([country, data]) => ({
      country,
      sessions: data.sessions,
      users: data.users,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10)

  // Format hourly traffic
  const formattedHourlyTraffic = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    sessions: hourlyTraffic.get(i) || 0,
  }))

  // Format top pages
  const formattedTopPages = Array.from(topPages.entries())
    .map(([page, data]) => ({
      page,
      views: data.views,
      uniqueViews: data.uniqueViews,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)

  return {
    kpis: {
      sessions: totalSessions,
      users: totalUsers,
      pageViews: totalPageViews,
      bounceRate: totalBounceRate / (report.rows?.length || 1),
      avgSessionDuration: Math.round(totalAvgDuration / (report.rows?.length || 1)),
      newUsers: totalNewUsers,
      returningUsers: totalUsers - totalNewUsers,
    },
    trafficOverTime,
    trafficSources: formattedTrafficSources,
    deviceBreakdown: formattedDeviceBreakdown,
    topPages: formattedTopPages,
    geographicData: formattedGeographicData,
    hourlyTraffic: formattedHourlyTraffic,
  }
}

/**
 * Format date from GA4 format (YYYYMMDD) to display format
 */
function formatDateFromGA(gaDate: string): string {
  if (gaDate.length === 8) {
    const year = gaDate.substring(0, 4)
    const month = gaDate.substring(4, 6)
    const day = gaDate.substring(6, 8)
    const date = new Date(`${year}-${month}-${day}`)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      timeZone: 'America/New_York'
    })
  }
  return gaDate
}










