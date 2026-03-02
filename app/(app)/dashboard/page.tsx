import type { Metadata } from 'next';
import { Suspense } from 'react';
import { after } from 'next/server';
import { getSession } from '@/lib/auth/get-session';
import { DashboardContent } from '@/components/features/dashboard/dashboard-content';
import { DashboardSkeleton } from '@/components/features/dashboard/dashboard-skeleton';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default async function DashboardPage() {
  const session = await getSession();

  // Trigger AI auto-accept in the background after response is sent.
  after(async () => {
    try {
      const { triggerAIAutoAccept } = await import('@/lib/ai/trigger-ai-accept');
      await triggerAIAutoAccept();
    } catch {
      // Non-critical background task
    }
  });

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent userId={session!.userId} />
    </Suspense>
  );
}
