import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/utils/monitoring';

// GET /api/health - Health check endpoint
export async function GET() {
  try {
    const health = await healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    return NextResponse.json(health, { status: statusCode });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error.message,
      },
      { status: 503 }
    );
  }
}










