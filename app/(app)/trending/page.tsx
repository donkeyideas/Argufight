import type { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { Eye, MessageSquare, TrendingUp } from 'lucide-react';

export const metadata: Metadata = { title: 'Trending' };
export const dynamic = 'force-dynamic';
export const revalidate = 120;

export default async function TrendingPage() {
  const debates = await prisma.debate.findMany({
    where: {
      status: { in: ['ACTIVE', 'VERDICT_READY', 'COMPLETED'] },
      OR: [{ isPrivate: false }, { visibility: 'PUBLIC' }],
    },
    include: {
      challenger: { select: { username: true, avatarUrl: true, eloRating: true } },
      opponent:   { select: { username: true, avatarUrl: true, eloRating: true } },
      _count:     { select: { comments: true } },
    },
    orderBy: { viewCount: 'desc' },
    take: 30,
  });

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp size={16} className="text-accent" />
        <h1 className="heading-1">Trending Debates</h1>
      </div>

      <div className="space-y-3">
        {debates.map((debate, i) => (
          <Link key={debate.id} href={`/debate/${debate.id}`}>
            <Card hover padding="md" className="group">
              <div className="flex items-start gap-4">
                <span className="text-xl font-[200] text-text-3 w-8 flex-shrink-0 leading-tight">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge color={debate.status === 'ACTIVE' ? 'green' : debate.status === 'VERDICT_READY' ? 'blue' : 'muted'} dot>
                      {debate.status === 'ACTIVE' ? 'Live' : debate.status === 'VERDICT_READY' ? 'Verdict' : 'Completed'}
                    </Badge>
                    {debate.category && (
                      <Badge color="default">{debate.category}</Badge>
                    )}
                  </div>
                  <p className="text-sm font-[450] text-text leading-snug mb-3 group-hover:text-accent transition-colors">
                    {debate.topic}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Avatar src={debate.challenger.avatarUrl} fallback={debate.challenger.username} size="xs" />
                      <span className="text-[13px] text-text-3">{debate.challenger.username}</span>
                    </div>
                    <span className="text-[12px] text-text-3">vs</span>
                    <div className="flex items-center gap-1.5">
                      <Avatar src={debate.opponent?.avatarUrl} fallback={debate.opponent?.username} size="xs" />
                      <span className="text-[13px] text-text-3">{debate.opponent?.username ?? 'Open'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1 text-text-3">
                    <Eye size={11} />
                    <span className="text-[13px]">{(debate.viewCount ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1 text-text-3">
                    <MessageSquare size={11} />
                    <span className="text-[13px]">{debate._count.comments}</span>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}

        {debates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-text-3">No trending debates yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
