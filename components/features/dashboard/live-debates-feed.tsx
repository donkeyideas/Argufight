'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';

type DebateCategory = 'SPORTS' | 'POLITICS' | 'TECH' | 'ENTERTAINMENT' | 'SCIENCE' | 'MUSIC' | 'OTHER';
type TabId = 'live' | 'trending' | 'following';

interface DebateRow {
  id: string;
  topic: string;
  category: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  spectatorCount: number;
  challenger: { username: string; avatarUrl?: string | null };
  opponent:   { username: string; avatarUrl?: string | null } | null;
}

interface Props {
  debates: DebateRow[];
}

const CATEGORIES: { id: DebateCategory | 'ALL'; label: string }[] = [
  { id: 'ALL',           label: 'All' },
  { id: 'POLITICS',      label: 'Politics' },
  { id: 'SCIENCE',       label: 'Science' },
  { id: 'TECH',          label: 'Technology' },
  { id: 'SPORTS',        label: 'Sports' },
  { id: 'ENTERTAINMENT', label: 'Entertainment' },
  { id: 'MUSIC',         label: 'Music' },
  { id: 'OTHER',         label: 'Other' },
];

const categoryLabel: Record<string, string> = {
  SPORTS:        'Sports',
  POLITICS:      'Politics',
  TECH:          'Technology',
  ENTERTAINMENT: 'Entertainment',
  SCIENCE:       'Science',
  MUSIC:         'Music',
  OTHER:         'Other',
};

export function LiveDebatesFeed({ debates }: Props) {
  const [tab,      setTab]      = useState<TabId>('live');
  const [category, setCategory] = useState<DebateCategory | 'ALL'>('ALL');

  const sorted =
    tab === 'trending'
      ? [...debates].sort((a, b) => b.spectatorCount - a.spectatorCount)
      : debates;

  const filtered =
    category === 'ALL'
      ? sorted
      : sorted.filter((d) => d.category === category);

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-border mb-3.5" style={{ gap: 0 }}>
        {([
          { id: 'live',      label: 'Live Debates' },
          { id: 'trending',  label: 'Trending' },
          { id: 'following', label: 'Following' },
        ] as { id: TabId; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3.5 py-2 text-[15px] font-[500] tracking-[0.3px] -mb-px border-b transition-colors duration-150 cursor-pointer',
              tab === t.id
                ? 'text-text border-accent'
                : 'text-text-3 border-transparent hover:text-text-2'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Category filter chips */}
      <div className="flex gap-1.5 flex-wrap mb-3.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              'text-[12px] font-[500] uppercase tracking-[0.5px] px-2.5 py-[3px] rounded-[20px] border transition-all duration-150 cursor-pointer',
              category === c.id
                ? 'border-accent text-accent bg-[rgba(212,240,80,0.06)]'
                : 'border-border text-text-3 hover:border-border-2 hover:text-text-2'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Following tab placeholder */}
      {tab === 'following' && (
        <p className="text-[14px] text-text-3 py-6">
          Follow other debaters to see their live battles here.
        </p>
      )}

      {/* Debate rows */}
      {tab !== 'following' && (
        filtered.length === 0 ? (
          <p className="text-[14px] text-text-3 py-4">No live debates in this category right now.</p>
        ) : (
          filtered.map((debate) => (
            <Link
              key={debate.id}
              href={`/debate/${debate.id}`}
              className="grid gap-3 py-3 border-b border-border hover:pl-1.5 transition-all cursor-pointer items-center"
              style={{ gridTemplateColumns: '1fr auto' }}
            >
              {/* Left */}
              <div className="overflow-hidden">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[13px] font-[600] uppercase tracking-[1px] text-text-3">
                    {categoryLabel[debate.category] ?? debate.category}
                  </span>
                </div>
                {/* Avatars + vs */}
                <div className="flex items-center gap-2 mb-1">
                  <Avatar
                    src={debate.challenger.avatarUrl}
                    fallback={debate.challenger.username}
                    size="sm"
                  />
                  <span className="text-[12px] text-text-3">vs</span>
                  <Avatar
                    src={debate.opponent?.avatarUrl}
                    fallback={debate.opponent?.username ?? '?'}
                    size="sm"
                  />
                </div>
                <p className="text-[16px] text-text whitespace-nowrap overflow-hidden text-ellipsis">
                  &ldquo;{debate.topic}&rdquo;
                </p>
              </div>

              {/* Right */}
              <div className="text-right flex-shrink-0">
                {debate.status === 'WAITING' ? (
                  <div className="text-[13px] font-[600] uppercase tracking-[0.5px] border border-[rgba(212,240,80,0.3)] text-accent bg-[rgba(212,240,80,0.06)] rounded-[20px] px-2.5 py-0.5 whitespace-nowrap inline-block">
                    Open
                  </div>
                ) : (
                  <div className="text-[13px] font-[500] text-text-3 border border-border rounded-[20px] px-2 py-0.5 mb-0.5 whitespace-nowrap inline-block">
                    Round {debate.currentRound} / {debate.totalRounds}
                  </div>
                )}
                <p className="text-[13px] text-text-3 mt-0.5">
                  {debate.status === 'WAITING' ? 'Waiting for opponent' : `${debate.spectatorCount} watching`}
                </p>
              </div>
            </Link>
          ))
        )
      )}
    </div>
  );
}
