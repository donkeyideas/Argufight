/**
 * Monitoring and health check utilities
 */

import { logger } from './logger';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: 'ok' | 'error';
    cache: 'ok' | 'error';
    timestamp: string;
  };
}

export async function healthCheck(): Promise<HealthCheckResult> {
  const checks = {
    database: 'ok' as 'ok' | 'error',
    cache: 'ok' as 'ok' | 'error',
    timestamp: new Date().toISOString(),
  };

  // Check database
  try {
    const { prisma } = await import('@/lib/db/prisma');
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    checks.database = 'error';
    logger.error('Health check: Database connection failed', error as Error);
  }

  // Check cache (always ok for in-memory cache)
  checks.cache = 'ok';

  const status =
    checks.database === 'ok' && checks.cache === 'ok' ? 'healthy' : checks.database === 'error' ? 'unhealthy' : 'degraded';

  return {
    status,
    checks,
  };
}

// API metrics tracking
interface ApiMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  endpoints: Record<string, { count: number; errors: number; avgTime: number }>;
}

class MetricsCollector {
  private metrics: ApiMetrics = {
    requestCount: 0,
    errorCount: 0,
    averageResponseTime: 0,
    endpoints: {},
  };

  recordRequest(endpoint: string, duration: number, isError: boolean = false) {
    this.metrics.requestCount++;
    if (isError) {
      this.metrics.errorCount++;
    }

    if (!this.metrics.endpoints[endpoint]) {
      this.metrics.endpoints[endpoint] = {
        count: 0,
        errors: 0,
        avgTime: 0,
      };
    }

    const endpointMetrics = this.metrics.endpoints[endpoint];
    endpointMetrics.count++;
    if (isError) {
      endpointMetrics.errors++;
    }

    // Calculate running average
    endpointMetrics.avgTime = (endpointMetrics.avgTime * (endpointMetrics.count - 1) + duration) / endpointMetrics.count;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + duration) / this.metrics.requestCount;
  }

  getMetrics(): ApiMetrics {
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      endpoints: {},
    };
  }
}

export const metrics = new MetricsCollector();










