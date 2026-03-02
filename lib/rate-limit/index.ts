/**
 * Rate Limiting with Upstash Redis
 * Prevents API abuse and DDoS attacks
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Redis client
const redis = process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    })
  : null

// Warn if rate limiting is not configured
if (!redis && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  Rate limiting not configured. Set UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN')
}

/**
 * General API Rate Limit: 100 requests per minute per IP
 */
export const generalRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'ratelimit:general',
    })
  : null

/**
 * Auth Endpoints Rate Limit: 5 requests per 15 minutes per IP
 * Protects login, signup, password reset endpoints
 */
export const authRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      analytics: true,
      prefix: 'ratelimit:auth',
    })
  : null

/**
 * AI Endpoints Rate Limit: 10 requests per hour per user
 * Protects expensive AI operations (verdicts, moderation)
 */
export const aiRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      analytics: true,
      prefix: 'ratelimit:ai',
    })
  : null

/**
 * File Upload Rate Limit: 20 uploads per hour per user
 */
export const uploadRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 h'),
      analytics: true,
      prefix: 'ratelimit:upload',
    })
  : null

/**
 * Debate Creation Rate Limit: 30 debates per day per user
 */
export const debateCreationRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '24 h'),
      analytics: true,
      prefix: 'ratelimit:debate',
    })
  : null

/**
 * Check rate limit for a given identifier
 * Returns { success: boolean, limit: number, remaining: number, reset: Date }
 */
export async function checkRateLimit(
  ratelimit: Ratelimit | null,
  identifier: string
): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: Date
}> {
  // If rate limiting is not configured, allow all requests
  if (!ratelimit) {
    return {
      success: true,
      limit: 999999,
      remaining: 999999,
      reset: new Date(Date.now() + 60000),
    }
  }

  try {
    const result = await ratelimit.limit(identifier)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: new Date(result.reset),
    }
  } catch (error) {
    console.error('[Rate Limit] Error checking rate limit:', error)
    // On error, allow request but log the issue
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: new Date(),
    }
  }
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string {
  // Try various headers (Vercel, Cloudflare, etc.)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Fallback
  return 'unknown'
}

/**
 * Rate limit middleware for API routes
 * Usage:
 *   const result = await rateLimitMiddleware(request, 'general')
 *   if (!result.success) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
 */
export async function rateLimitMiddleware(
  request: Request,
  limitType: 'general' | 'auth' | 'ai' | 'upload' | 'debate' = 'general',
  identifier?: string
): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: Date
  headers: Record<string, string>
}> {
  // Select appropriate rate limiter
  let ratelimit: Ratelimit | null = null
  switch (limitType) {
    case 'general':
      ratelimit = generalRateLimit
      break
    case 'auth':
      ratelimit = authRateLimit
      break
    case 'ai':
      ratelimit = aiRateLimit
      break
    case 'upload':
      ratelimit = uploadRateLimit
      break
    case 'debate':
      ratelimit = debateCreationRateLimit
      break
  }

  // Use provided identifier or default to IP address
  const id = identifier || getClientIP(request)

  // Check rate limit
  const result = await checkRateLimit(ratelimit, id)

  // Prepare headers
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.getTime().toString(),
  }

  if (!result.success) {
    headers['Retry-After'] = Math.ceil((result.reset.getTime() - Date.now()) / 1000).toString()
  }

  return {
    ...result,
    headers,
  }
}

/**
 * Create rate-limited API handler
 *
 * Example usage:
 * ```typescript
 * export const POST = withRateLimit('auth', async (req) => {
 *   // Your handler code
 *   return Response.json({ success: true })
 * })
 * ```
 */
export function withRateLimit(
  limitType: 'general' | 'auth' | 'ai' | 'upload' | 'debate',
  handler: (request: Request) => Promise<Response>,
  getIdentifier?: (request: Request) => Promise<string>
) {
  return async (request: Request): Promise<Response> => {
    // Get identifier (IP or custom)
    const identifier = getIdentifier ? await getIdentifier(request) : undefined

    // Check rate limit
    const result = await rateLimitMiddleware(request, limitType, identifier)

    // If rate limit exceeded, return 429
    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: result.headers['Retry-After'],
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...result.headers,
          },
        }
      )
    }

    // Execute handler with rate limit headers
    try {
      const response = await handler(request)

      // Add rate limit headers to response
      Object.entries(result.headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return response
    } catch (error) {
      console.error('[Rate Limit] Handler error:', error)
      throw error
    }
  }
}

export default {
  checkRateLimit,
  getClientIP,
  rateLimitMiddleware,
  withRateLimit,
  generalRateLimit,
  authRateLimit,
  aiRateLimit,
  uploadRateLimit,
  debateCreationRateLimit,
}
