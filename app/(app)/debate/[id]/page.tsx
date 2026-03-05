import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { after } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/get-session';
import { DebateRoom } from '@/components/features/debate/debate-room';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const debate = await prisma.debate.findUnique({
    where: { id },
    select: { topic: true },
  });
  return {
    title: debate ? `${debate.topic.slice(0, 60)}${debate.topic.length > 60 ? '…' : ''}` : 'Debate',
  };
}

function DebateSkeleton() {
  return (
    <div className="h-full flex flex-col">
      <div className="h-14 border-b border-border px-5 flex items-center gap-3">
        <Skeleton height={16} width={200} />
        <Skeleton height={20} width={60} className="ml-auto" rounded />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-5 space-y-4 overflow-y-auto">
          {[0,1,2].map(i => (
            <div key={i} className={`flex gap-3 ${i % 2 === 1 ? 'flex-row-reverse' : ''}`}>
              <Skeleton width={32} height={32} rounded />
              <div className="flex-1 max-w-lg space-y-1.5">
                <Skeleton height={10} width={80} />
                <Skeleton height={60} className="rounded-[var(--radius)]" />
              </div>
            </div>
          ))}
        </div>
        <div className="w-64 border-l border-border p-4 hidden xl:block">
          <Skeleton height={12} width={80} className="mb-3" />
          {[0,1,2].map(i => (
            <div key={i} className="flex gap-2 py-2">
              <Skeleton width={24} height={24} rounded />
              <Skeleton height={10} className="flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function DebatePage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();

  const debate = await prisma.debate.findUnique({
    where: { id },
    include: {
      challenger: {
        select: { id: true, username: true, avatarUrl: true, eloRating: true, isAdmin: true },
      },
      opponent: {
        select: { id: true, username: true, avatarUrl: true, eloRating: true },
      },
      statements: {
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
        },
        orderBy: [{ round: 'asc' }, { createdAt: 'asc' }],
      },
      verdicts: {
        include: {
          judge: { select: { name: true, personality: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!debate) notFound();

  // Trigger AI response in the background after page is served.
  // Every page load re-checks whether the AI's delay has passed and it's their turn.
  if (debate.status === 'ACTIVE') {
    after(async () => {
      try {
        const { triggerAIResponseForDebate } = await import('@/lib/ai/trigger-ai-response');
        await triggerAIResponseForDebate(id);
      } catch {
        // Non-critical
      }
    });
  }

  // For private debates, only participants (and admins) can view
  if (
    debate.isPrivate &&
    session?.userId !== debate.challengerId &&
    session?.userId !== debate.opponentId &&
    !session?.isAdmin
  ) {
    redirect('/dashboard');
  }

  return <DebateRoom debate={debate} currentUserId={session?.userId ?? null} />;
}
