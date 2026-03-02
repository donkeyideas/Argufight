import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { metrics } from '@/lib/utils/monitoring';

// GET /api/metrics - Get API metrics (admin only)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(token);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin
    const { prisma } = await import('@/lib/db/prisma');
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const apiMetrics = metrics.getMetrics();

    return NextResponse.json(apiMetrics);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to get metrics' }, { status: 500 });
  }
}










