import type { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/get-session';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';
import { BookMarked } from 'lucide-react';

export const metadata: Metadata = { title: 'Saved Debates' };

export default async function SavedDebatesPage() {
  const session = await getSession();

  const saved = await prisma.debateSave.findMany({
    where: { userId: session!.userId },
    include: {
      debate: {
        include: {
          challenger: { select: { username: true, avatarUrl: true } },
          opponent:   { select: { username: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="heading-1 mb-1">Saved Debates</h1>
        <p className="text-xs text-text-3">{saved.length} saved</p>
      </div>

      {saved.length === 0 ? (
        <EmptyState
          icon={<BookMarked size={32} />}
          title="No saved debates"
          description="Save debates you want to revisit by clicking the bookmark icon."
        />
      ) : (
        <div className="space-y-2">
          {saved.map(({ debate, createdAt }) => (
            <Link key={debate.id} href={`/debate/${debate.id}`}>
              <Card hover padding="md" className="group">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        color={debate.status === 'ACTIVE' ? 'green' : debate.status === 'VERDICT_READY' ? 'blue' : 'muted'}
                        dot
                      >
                        {debate.status.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                      {debate.category && <Badge color="default">{debate.category}</Badge>}
                    </div>
                    <p className="text-xs font-[450] text-text leading-snug mb-2 group-hover:text-accent transition-colors line-clamp-2">
                      {debate.topic}
                    </p>
                    <div className="flex items-center gap-2">
                      <Avatar src={debate.challenger.avatarUrl} fallback={debate.challenger.username} size="xs" />
                      <span className="text-[13px] text-text-3">{debate.challenger.username}</span>
                      <span className="text-[12px] text-text-3">vs</span>
                      <span className="text-[13px] text-text-3">{debate.opponent?.username ?? 'Open'}</span>
                    </div>
                  </div>
                  <p className="text-[13px] text-text-3 flex-shrink-0">
                    {new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
