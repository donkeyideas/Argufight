import { NextRequest, NextResponse } from 'next/server';

// In-memory rate limit store (use Redis in production)
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(rateLimitStore).forEach((key) => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  });
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: NextRequest) => string;
}

const defaultOptions: RateLimitOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later.',
};

export function rateLimit(options: Partial<RateLimitOptions> = {}) {
  const opts = { ...defaultOptions, ...options };

  return async (req: NextRequest): Promise<NextResponse | null> => {
    // Generate key for rate limiting (IP address or user ID)
    const key = opts.keyGenerator
      ? opts.keyGenerator(req)
      : req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown';

    const now = Date.now();
    const record = rateLimitStore[key];

    // Check if record exists and is still valid
    if (record && record.resetTime > now) {
      // Increment count
      record.count += 1;

      // Check if limit exceeded
      if (record.count > opts.max) {
        return NextResponse.json(
          {
            error: opts.message,
            retryAfter: Math.ceil((record.resetTime - now) / 1000),
          },
          {
            status: 429,
            headers: {
              'Retry-After': Math.ceil((record.resetTime - now) / 1000).toString(),
              'X-RateLimit-Limit': opts.max.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(record.resetTime).toISOString(),
            },
          }
        );
      }
    } else {
      // Create new record
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + opts.windowMs,
      };
    }

    // Return null to continue (no rate limit exceeded)
    return null;
  };
}

// Pre-configured rate limiters
export const rateLimiters = {
  // Strict rate limit for auth endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 minutes
    message: 'Too many authentication attempts, please try again later.',
  }),

  // Standard rate limit for API endpoints
  api: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
  }),

  // Lenient rate limit for public endpoints
  public: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per 15 minutes
  }),

  // Very strict rate limit for sensitive operations
  strict: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour
    message: 'Rate limit exceeded for this operation.',
  }),
};

// Middleware helper for Next.js API routes
export async function withRateLimit(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>,
  limiter: (req: NextRequest) => Promise<NextResponse | null> = rateLimiters.api
): Promise<NextResponse> {
  const rateLimitResponse = await limiter(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  return handler(req);
}

