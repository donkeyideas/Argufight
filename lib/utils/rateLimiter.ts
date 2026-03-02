/**
 * Rate limiting utility
 * Simple in-memory rate limiter (for production, use Redis)
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private cleanupInterval: number | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000) as any as number;
  }

  private cleanup() {
    const now = Date.now();
    for (const key in this.store) {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    }
  }

  private getKey(identifier: string, config: RateLimitConfig): string {
    const window = Math.floor(Date.now() / config.windowMs);
    return `${identifier}:${window}`;
  }

  check(identifier: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetTime: number } {
    const key = this.getKey(identifier, config);
    const now = Date.now();
    const resetTime = (Math.floor(now / config.windowMs) + 1) * config.windowMs;

    if (!this.store[key]) {
      this.store[key] = {
        count: 0,
        resetTime,
      };
    }

    const entry = this.store[key];

    // Reset if window expired
    if (entry.resetTime < now) {
      entry.count = 0;
      entry.resetTime = resetTime;
    }

    entry.count++;

    const remaining = Math.max(0, config.maxRequests - entry.count);
    const allowed = entry.count <= config.maxRequests;

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime,
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store = {};
  }
}

// Default rate limit configurations
export const rateLimitConfigs = {
  // Strict limits for auth endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 requests per 15 minutes
  },
  // General API limits
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
  // Debate creation limits
  debateCreation: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 debates per hour
  },
  // Comment limits
  comments: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 comments per minute
  },
};

// Singleton instance
const rateLimiter = new RateLimiter();

export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  return rateLimiter.check(identifier, config);
}

// Middleware helper for Next.js API routes
export function withRateLimit(
  config: RateLimitConfig,
  getIdentifier: (request: Request) => string
) {
  return async (request: Request) => {
    const identifier = getIdentifier(request);
    const result = rateLimit(identifier, config);

    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetTime.toString(),
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    return null; // No rate limit error
  };
}

