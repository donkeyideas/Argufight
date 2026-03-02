import { google, searchconsole_v1 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '@/lib/db/prisma'

interface GSCCredentials {
  clientId: string
  clientSecret: string
  refreshToken: string
  siteUrl: string
}

let cachedClient: searchconsole_v1.Searchconsole | null = null
let cachedCredentials: string | null = null

async function loadGSCCredentials(): Promise<GSCCredentials | null> {
  const settings = await prisma.adminSetting.findMany({
    where: {
      key: {
        in: [
          'seo_gsc_client_id',
          'seo_gsc_client_secret',
          'seo_gsc_refresh_token',
          'seo_gsc_site_url',
        ],
      },
    },
    select: { key: true, value: true },
  })

  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]))

  const clientId = map['seo_gsc_client_id']
  const clientSecret = map['seo_gsc_client_secret']
  const refreshToken = map['seo_gsc_refresh_token']
  const siteUrl = map['seo_gsc_site_url']

  if (!clientId || !clientSecret || !refreshToken || !siteUrl) {
    return null
  }

  return { clientId, clientSecret, refreshToken, siteUrl }
}

function createGSCClient(credentials: GSCCredentials): searchconsole_v1.Searchconsole {
  const credKey = `${credentials.clientId}:${credentials.refreshToken}`

  if (cachedClient && cachedCredentials === credKey) {
    return cachedClient
  }

  const oauth2Client = new OAuth2Client(
    credentials.clientId,
    credentials.clientSecret
  )
  oauth2Client.setCredentials({ refresh_token: credentials.refreshToken })

  cachedClient = google.searchconsole({ version: 'v1', auth: oauth2Client })
  cachedCredentials = credKey

  return cachedClient
}

export async function isGSCConnected(): Promise<boolean> {
  const credentials = await loadGSCCredentials()
  return credentials !== null
}

export async function getGSCSiteUrl(): Promise<string | null> {
  const credentials = await loadGSCCredentials()
  return credentials?.siteUrl || null
}

export interface GSCSearchAnalyticsRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GSCSearchAnalyticsResult {
  rows: GSCSearchAnalyticsRow[]
  totals: {
    clicks: number
    impressions: number
    ctr: number
    position: number
  }
}

export async function getSearchAnalytics(options: {
  startDate: string // YYYY-MM-DD
  endDate: string
  dimensions: ('query' | 'page' | 'country' | 'device' | 'date')[]
  rowLimit?: number
}): Promise<GSCSearchAnalyticsResult> {
  const credentials = await loadGSCCredentials()
  if (!credentials) {
    throw new Error('Google Search Console is not configured')
  }

  const client = createGSCClient(credentials)

  try {
    const response = await client.searchanalytics.query({
      siteUrl: credentials.siteUrl,
      requestBody: {
        startDate: options.startDate,
        endDate: options.endDate,
        dimensions: options.dimensions,
        rowLimit: options.rowLimit || 25,
        dataState: 'all',
      },
    })

    const rows: GSCSearchAnalyticsRow[] = (response.data.rows || []).map((row) => ({
      keys: row.keys || [],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }))

    // Calculate totals
    const totals = rows.reduce(
      (acc, row) => ({
        clicks: acc.clicks + row.clicks,
        impressions: acc.impressions + row.impressions,
        ctr: 0, // Calculated below
        position: 0, // Calculated below
      }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0 }
    )

    if (totals.impressions > 0) {
      totals.ctr = totals.clicks / totals.impressions
    }
    if (rows.length > 0) {
      totals.position =
        rows.reduce((sum, r) => sum + r.position * r.impressions, 0) /
        (totals.impressions || 1)
    }

    return { rows, totals }
  } catch (error: any) {
    // Check for invalid_grant error (expired/revoked refresh token)
    if (error?.message?.includes('invalid_grant')) {
      const customError: any = new Error('INVALID_REFRESH_TOKEN')
      customError.isTokenError = true
      throw customError
    }
    throw error
  }
}

export async function getSitemapStatus(): Promise<
  Array<{ path: string; lastSubmitted: string | null; isPending: boolean; errors: number; warnings: number }>
> {
  const credentials = await loadGSCCredentials()
  if (!credentials) {
    throw new Error('Google Search Console is not configured')
  }

  const client = createGSCClient(credentials)

  try {
    const response = await client.sitemaps.list({
      siteUrl: credentials.siteUrl,
    })

    return (response.data.sitemap || []).map((sm) => ({
      path: sm.path || '',
      lastSubmitted: sm.lastSubmitted || null,
      isPending: sm.isPending || false,
      errors: Number(sm.errors) || 0,
      warnings: Number(sm.warnings) || 0,
    }))
  } catch (error: any) {
    // Check for invalid_grant error (expired/revoked refresh token)
    if (error?.message?.includes('invalid_grant')) {
      const customError: any = new Error('INVALID_REFRESH_TOKEN')
      customError.isTokenError = true
      throw customError
    }
    throw error
  }
}

// Diagnostic: test connection and list available sites
export async function testGSCConnection(): Promise<{
  success: boolean
  error?: string
  configuredSiteUrl: string
  availableSites: Array<{ siteUrl: string; permissionLevel: string }>
  siteAccessible: boolean
}> {
  const credentials = await loadGSCCredentials()
  if (!credentials) {
    return {
      success: false,
      error: 'Missing credentials (need client_id, client_secret, refresh_token, and site_url)',
      configuredSiteUrl: '',
      availableSites: [],
      siteAccessible: false,
    }
  }

  const client = createGSCClient(credentials)

  // Step 1: List all sites the user has access to
  let availableSites: Array<{ siteUrl: string; permissionLevel: string }> = []
  try {
    const sitesResponse = await client.sites.list()
    availableSites = (sitesResponse.data.siteEntry || []).map((s) => ({
      siteUrl: s.siteUrl || '',
      permissionLevel: s.permissionLevel || 'unknown',
    }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to list sites: ${msg}. Make sure the Search Console API is enabled in Google Cloud Console.`,
      configuredSiteUrl: credentials.siteUrl,
      availableSites: [],
      siteAccessible: false,
    }
  }

  // Step 2: Check if the configured site URL is in the list
  const siteAccessible = availableSites.some(
    (s) => s.siteUrl === credentials.siteUrl
  )

  if (!siteAccessible) {
    return {
      success: false,
      error: `Site URL "${credentials.siteUrl}" not found in your Search Console properties. Available sites are listed below - update the Site URL in Settings to match one of them exactly.`,
      configuredSiteUrl: credentials.siteUrl,
      availableSites,
      siteAccessible: false,
    }
  }

  // Step 3: Try a test analytics query to verify full access
  let queryError: string | null = null
  try {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 7)
    await client.searchanalytics.query({
      siteUrl: credentials.siteUrl,
      requestBody: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        dimensions: ['date'],
        rowLimit: 1,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    queryError = `Site URL matches but analytics query failed: ${msg}`
  }

  if (queryError) {
    return {
      success: false,
      error: queryError,
      configuredSiteUrl: credentials.siteUrl,
      availableSites,
      siteAccessible: true,
    }
  }

  return {
    success: true,
    configuredSiteUrl: credentials.siteUrl,
    availableSites,
    siteAccessible: true,
  }
}

// OAuth helpers
export function getOAuthUrl(clientId: string, clientSecret: string, redirectUri: string): string {
  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })
}

export async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<{ refreshToken: string }> {
  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)
  const { tokens } = await oauth2Client.getToken(code)

  if (!tokens.refresh_token) {
    throw new Error('No refresh token received. Make sure to request offline access with consent prompt.')
  }

  return { refreshToken: tokens.refresh_token }
}
