/**
 * Sentry Error Monitoring
 * Tracks errors, performance, and API failures
 */

import * as Sentry from '@sentry/nextjs'

// Initialize Sentry (only once)
let initialized = false

export function initSentry() {
  if (initialized || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return
  }

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Environment
    environment: process.env.NODE_ENV || 'development',

    // Sample rate for error events (100% = capture all errors)
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Sample rate for performance monitoring
    // 0.1 = 10% of transactions (reduces costs)
    // Adjust based on traffic and budget
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
        delete event.request.headers['x-api-key']
      }

      // Remove sensitive query params
      if (event.request?.query_string && typeof event.request.query_string === 'string') {
        const sensitiveParams = ['token', 'password', 'secret', 'apiKey', 'api_key']
        sensitiveParams.forEach(param => {
          if (typeof event.request?.query_string === 'string' && event.request.query_string.includes(param)) {
            event.request.query_string = event.request.query_string
              .split('&')
              .filter((p: string) => !p.startsWith(param))
              .join('&')
          }
        })
      }

      return event
    },

    // Ignore specific errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'chrome-extension',
      'moz-extension',

      // Network errors
      'NetworkError',
      'Network request failed',
      'Failed to fetch',

      // Common non-critical errors
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',

      // Aborted requests
      'AbortError',
      'The user aborted a request',
    ],
  })

  initialized = true
  console.log('[Sentry] Monitoring initialized')
}

/**
 * Capture exception with context
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (!initialized) {
    initSentry()
  }

  if (context) {
    Sentry.setContext('additional', context)
  }

  Sentry.captureException(error)
}

/**
 * Capture message with severity level
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
) {
  if (!initialized) {
    initSentry()
  }

  if (context) {
    Sentry.setContext('additional', context)
  }

  Sentry.captureMessage(message, level)
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; username?: string }) {
  if (!initialized) {
    initSentry()
  }

  Sentry.setUser(user)
}

/**
 * Clear user context (on logout)
 */
export function clearUser() {
  if (!initialized) {
    return
  }

  Sentry.setUser(null)
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  data?: Record<string, any>
) {
  if (!initialized) {
    initSentry()
  }

  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  })
}

/**
 * Wrap async function with error tracking
 */
export function withSentry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  fnName?: string
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args)
    } catch (error) {
      captureException(error as Error, {
        function: fnName || fn.name,
        arguments: args,
      })
      throw error
    }
  }) as T
}

/**
 * Track slow queries (> 1 second)
 */
export function trackSlowQuery(query: string, duration: number, params?: any) {
  if (duration > 1000) {
    addBreadcrumb(
      `Slow query: ${duration}ms`,
      'database',
      'warning',
      {
        query,
        duration,
        params,
      }
    )

    if (duration > 5000) {
      captureMessage(
        `Very slow database query: ${duration}ms`,
        'warning',
        {
          query,
          duration,
          params,
        }
      )
    }
  }
}

/**
 * Track API request performance
 */
export function trackAPIRequest(
  endpoint: string,
  method: string,
  status: number,
  duration: number
) {
  addBreadcrumb(
    `${method} ${endpoint}: ${status} (${duration}ms)`,
    'http',
    status >= 400 ? 'error' : 'info',
    {
      endpoint,
      method,
      status,
      duration,
    }
  )

  // Alert on very slow API responses
  if (duration > 5000 && status < 400) {
    captureMessage(
      `Slow API response: ${method} ${endpoint} took ${duration}ms`,
      'warning',
      {
        endpoint,
        method,
        status,
        duration,
      }
    )
  }
}

export default {
  initSentry,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  withSentry,
  trackSlowQuery,
  trackAPIRequest,
}
