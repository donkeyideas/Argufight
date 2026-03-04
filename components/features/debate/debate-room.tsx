'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Shield, CheckCircle, XCircle, Minus, Clock, Eye } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface DebateRoomProps {
  debate: any;
  currentUserId: string | null;
}

const statusColors: Record<string, string> = {
  WAITING:        'muted',
  ACTIVE:         'green',
  COMPLETED:      'default',
  VERDICT_READY:  'blue',
  APPEALED:       'amber',
  CANCELLED:      'red',
};

const statusLabels: Record<string, string> = {
  WAITING:       'Waiting',
  ACTIVE:        'Active',
  COMPLETED:     'Completed',
  VERDICT_READY: 'Verdict ready',
  APPEALED:      'Under appeal',
  CANCELLED:     'Cancelled',
};

export function DebateRoom({ debate, currentUserId }: DebateRoomProps) {
  const { success, error: toastError } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statement, setStatement] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState(searchParams.get('tab') === 'verdict' ? 'verdict' : 'arguments');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isParticipant =
    currentUserId === debate.challengerId || currentUserId === debate.opponentId;
  const isChallenger  = currentUserId === debate.challengerId;
  const canSubmit     = isParticipant && debate.status === 'ACTIVE';

  // Poll every 30s while waiting for the AI to respond
  const currentRoundStmts = debate.statements.filter(
    (s: any) => s.round === (debate.currentRound ?? 1)
  );
  const humanSubmittedThisRound = currentRoundStmts.some(
    (s: any) => s.authorId === currentUserId
  );
  const aiId = debate.challengerId === currentUserId ? debate.opponentId : debate.challengerId;
  const aiSubmittedThisRound = currentRoundStmts.some(
    (s: any) => s.authorId === aiId
  );
  const waitingForAI =
    isParticipant && debate.status === 'ACTIVE' && humanSubmittedThisRound && !aiSubmittedThisRound;

  useEffect(() => {
    if (!waitingForAI) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => {
      router.refresh();
    }, 30_000); // refresh every 30s so after() re-fires on the server
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [waitingForAI, router]);

  // Spectator heartbeat — ping every 20s so the count stays live
  useEffect(() => {
    const ping = () => {
      fetch(`/api/debates/${debate.id}/spectate`, { method: 'POST' }).catch(() => {});
    };
    ping(); // initial ping on mount
    const interval = setInterval(ping, 20_000);
    return () => clearInterval(interval);
  }, [debate.id]);
  const verdicts: any[] = debate.verdicts ?? [];
  const challengerWinCount = verdicts.filter((v: any) => v.decision === 'CHALLENGER_WINS').length;
  const opponentWinCount   = verdicts.filter((v: any) => v.decision === 'OPPONENT_WINS').length;
  const majorityDecision   =
    verdicts.length === 0 ? null
    : challengerWinCount > opponentWinCount ? 'CHALLENGER_WINS'
    : opponentWinCount > challengerWinCount ? 'OPPONENT_WINS'
    : 'TIE';

  const myStatements  = debate.statements.filter((s: any) => s.authorId === currentUserId);
  const roundsSubmitted = myStatements.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!statement.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/debates/${debate.id}/statements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: statement }),
      });
      if (!res.ok) {
        const d = await res.json();
        toastError('Failed to submit', d.error ?? 'Please try again');
        return;
      }
      success('Argument submitted');
      setStatement('');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAccept() {
    const res = await fetch(`/api/debates/${debate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' }),
    });
    if (res.ok) {
      success('Challenge accepted');
      router.refresh();
    } else {
      toastError('Failed to accept challenge');
    }
  }

  return (
    <div className="flex flex-col w-full" style={{ height: 'calc(100vh - 58px)' }}>
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center gap-3 px-5 flex-shrink-0 bg-bg">
        <Link href="/dashboard" className="text-text-3 hover:text-text-2 transition-colors">
          <ChevronLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-[450] text-text leading-tight line-clamp-1">{debate.topic}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge color={statusColors[debate.status] as any} dot>
            {statusLabels[debate.status] ?? debate.status}
          </Badge>
          {debate.viewCount > 0 && (
            <span className="text-[13px] text-text-3 flex items-center gap-1">
              <Eye size={11} />
              {debate.viewCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Participants bar */}
          <div className="border-b border-border px-5 py-2.5 flex items-center gap-4 flex-shrink-0">
            <ParticipantPill
              user={debate.challenger}
              position={debate.challengerPosition}
              isCurrentUser={debate.challengerId === currentUserId}
              won={majorityDecision === 'CHALLENGER_WINS'}
              lost={majorityDecision === 'OPPONENT_WINS'}
            />
            <span className="text-xs text-text-3 font-[500]">vs</span>
            <ParticipantPill
              user={debate.opponent}
              position={debate.opponentPosition}
              isCurrentUser={debate.opponentId === currentUserId}
              won={majorityDecision === 'OPPONENT_WINS'}
              lost={majorityDecision === 'CHALLENGER_WINS'}
            />
            {debate.totalRounds && (
              <div className="ml-auto text-right">
                <p className="text-[13px] text-text-3">
                  Round {debate.currentRound ?? 1} of {debate.totalRounds}
                </p>
              </div>
            )}
          </div>

          {/* Tabs: arguments / verdict */}
          <div className="border-b border-border px-5 pt-3 flex-shrink-0">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-fit">
                <TabsTrigger value="arguments">Arguments ({debate.statements.length})</TabsTrigger>
                {verdicts.length > 0 && (
                  <TabsTrigger value="verdict">Verdict ({verdicts.length})</TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </div>

          {/* Arguments feed */}
          {tab === 'arguments' && (
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Accept challenge banner */}
              {debate.status === 'WAITING' && currentUserId === debate.opponentId && (
                <Card padding="md" className="border-[rgba(212,240,80,0.2)] bg-[rgba(212,240,80,0.04)]">
                  <p className="text-sm font-[450] text-text mb-1">
                    You've been challenged to a debate
                  </p>
                  <p className="text-xs text-text-3 mb-3">{debate.topic}</p>
                  <Button variant="accent" size="sm" onClick={handleAccept}>
                    Accept challenge
                  </Button>
                </Card>
              )}

              {debate.statements.length === 0 && debate.status === 'ACTIVE' && (
                <div className="text-center py-8">
                  <p className="text-xs text-text-3">No arguments yet. Be the first to submit.</p>
                </div>
              )}

              {/* Waiting for AI indicator */}
              {waitingForAI && (
                <div className="flex gap-3 mb-4">
                  <Avatar src={debate.opponent?.avatarUrl ?? debate.challenger?.avatarUrl} fallback={debate.opponent?.username ?? debate.challenger?.username} size="sm" />
                  <div className="space-y-1">
                    <p className="text-[14px] text-text-3">{aiId === debate.opponentId ? debate.opponent?.username : debate.challenger?.username}</p>
                    <div className="bg-surface-2 rounded-[var(--radius)] rounded-tl-[var(--radius-sm)] px-4 py-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-text-3 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-text-3 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-text-3 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Statement bubbles grouped by round */}
              {groupByRound(debate.statements).map(({ round, statements }) => (
                <div key={round}>
                  <div className="flex items-center gap-3 my-4">
                    <Separator />
                    <span className="label whitespace-nowrap">Round {round}</span>
                    <Separator />
                  </div>
                  {statements.map((s: any) => {
                    const isMe = s.authorId === currentUserId;
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          'flex gap-3 mb-4',
                          isMe ? 'flex-row-reverse' : 'flex-row'
                        )}
                      >
                        <Avatar src={s.author.avatarUrl} fallback={s.author.username} size="sm" />
                        <div className={cn('max-w-[70%] space-y-1', isMe && 'items-end flex flex-col')}>
                          <p className="text-[14px] text-text-3">{s.author.username}</p>
                          <div
                            className={cn(
                              'rounded-[var(--radius)] px-3.5 py-3 text-[16px] text-text leading-relaxed',
                              isMe
                                ? 'bg-accent text-[var(--accent-fg)] rounded-tr-[var(--radius-sm)]'
                                : 'bg-surface-2 rounded-tl-[var(--radius-sm)]'
                            )}
                          >
                            {s.content}
                          </div>
                          <p className="text-[13px] text-text-3" suppressHydrationWarning>
                            {new Date(s.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Verdict tab */}
          {tab === 'verdict' && verdicts.length > 0 && (
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {/* Overall scoreboard */}
              {(() => {
                const totalC = verdicts.reduce((s: number, v: any) => s + (v.challengerScore ?? 0), 0);
                const totalO = verdicts.reduce((s: number, v: any) => s + (v.opponentScore ?? 0), 0);
                const winColor = majorityDecision === 'TIE' ? 'var(--blue)'
                  : majorityDecision === 'CHALLENGER_WINS' ? 'var(--green)' : 'var(--green)';
                const cColor = majorityDecision === 'CHALLENGER_WINS' ? 'var(--green)'
                  : majorityDecision === 'OPPONENT_WINS' ? 'var(--red)' : 'var(--blue)';
                const oColor = majorityDecision === 'OPPONENT_WINS' ? 'var(--green)'
                  : majorityDecision === 'CHALLENGER_WINS' ? 'var(--red)' : 'var(--blue)';
                return (
                  <div className="rounded-[var(--radius)] border border-border bg-surface mb-2 overflow-hidden">
                    {/* Result header */}
                    <div className="flex items-center justify-center gap-2 py-2.5 border-b border-border bg-surface-2">
                      {majorityDecision === 'TIE' ? (
                        <span className="text-[13px] font-[600] uppercase tracking-[1px] text-[var(--blue)]">Draw</span>
                      ) : (
                        <>
                          <Avatar
                            src={majorityDecision === 'CHALLENGER_WINS' ? debate.challenger.avatarUrl : debate.opponent?.avatarUrl}
                            fallback={majorityDecision === 'CHALLENGER_WINS' ? debate.challenger.username : (debate.opponent?.username ?? 'Opponent')}
                            size="xs"
                          />
                          <span className="text-[13px] font-[600] uppercase tracking-[1px]" style={{ color: winColor }}>
                            {majorityDecision === 'CHALLENGER_WINS' ? debate.challenger.username : (debate.opponent?.username ?? 'Opponent')} wins
                          </span>
                          <span className="text-[12px] text-text-3">
                            ({challengerWinCount}–{opponentWinCount} judges)
                          </span>
                        </>
                      )}
                    </div>
                    {/* Score row */}
                    <div className="grid grid-cols-2">
                      <div className="flex flex-col items-center py-5 border-r border-border">
                        <Avatar src={debate.challenger.avatarUrl} fallback={debate.challenger.username} size="lg" />
                        <p className="text-[13px] text-text-3 mt-1.5 mb-2">{debate.challenger.username}</p>
                        <p className="font-[200] leading-none" style={{ fontSize: 48, color: cColor }}>{totalC}</p>
                        <p className="text-[12px] text-text-3 mt-1 uppercase tracking-[0.5px]">{debate.challengerPosition ?? 'For'}</p>
                      </div>
                      <div className="flex flex-col items-center py-5">
                        <Avatar src={debate.opponent?.avatarUrl} fallback={debate.opponent?.username ?? '?'} size="lg" />
                        <p className="text-[13px] text-text-3 mt-1.5 mb-2">{debate.opponent?.username ?? 'Opponent'}</p>
                        <p className="font-[200] leading-none" style={{ fontSize: 48, color: oColor }}>{totalO}</p>
                        <p className="text-[12px] text-text-3 mt-1 uppercase tracking-[0.5px]">{debate.opponentPosition ?? 'Against'}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Per-judge header */}
              <p className="label pt-1">Judge verdicts ({verdicts.length})</p>

              {verdicts.map((v: any, i: number) => {
                const judgeInitials = (v.judge?.name ?? 'J')
                  .split(' ')
                  .slice(0, 2)
                  .map((w: string) => w[0])
                  .join('')
                  .toUpperCase();
                return (
                  <Card key={v.id ?? i} padding="lg">
                    <div className="flex items-center gap-3 mb-4">
                      {v.judge?.avatarUrl ? (
                        <img src={v.judge.avatarUrl} alt={v.judge.name ?? 'Judge'} className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-surface-2 border border-border flex items-center justify-center text-[14px] font-[600] text-text-2 flex-shrink-0">
                          {judgeInitials}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-[500] text-text">{v.judge?.name ?? 'AI Judge'}</p>
                        {v.judge?.personality && (
                          <p className="text-[13px] text-text-3">{v.judge.personality}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {v.decision !== 'TIE' && (
                          <Avatar
                            src={v.decision === 'CHALLENGER_WINS' ? debate.challenger.avatarUrl : debate.opponent?.avatarUrl}
                            fallback={v.decision === 'CHALLENGER_WINS' ? debate.challenger.username : (debate.opponent?.username ?? 'Opponent')}
                            size="xs"
                          />
                        )}
                        <span className={cn(
                          'text-[13px] font-[600] uppercase tracking-[0.5px]',
                          v.decision === 'TIE' ? 'text-text-3'
                          : v.decision === 'CHALLENGER_WINS' ? (isChallenger ? 'text-[var(--green)]' : 'text-[var(--red)]')
                          : isChallenger ? 'text-[var(--red)]' : 'text-[var(--green)]'
                        )}>
                          {v.decision === 'TIE' ? 'Tie' : 'wins'}
                        </span>
                      </div>
                    </div>
                    <Separator className="mb-4" />
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-surface-2 rounded-[var(--radius)] p-3 flex items-center gap-3">
                        <Avatar
                          src={debate.challenger.avatarUrl}
                          fallback={debate.challenger.username}
                          size="sm"
                        />
                        <div>
                          <p className="text-xl font-[200] text-text leading-none">{v.challengerScore ?? '—'}</p>
                          <p className="text-[13px] text-text-3 mt-1">{debate.challengerPosition ?? 'FOR'}</p>
                        </div>
                      </div>
                      <div className="bg-surface-2 rounded-[var(--radius)] p-3 flex items-center gap-3">
                        <Avatar
                          src={debate.opponent?.avatarUrl}
                          fallback={debate.opponent?.username ?? 'Opponent'}
                          size="sm"
                        />
                        <div>
                          <p className="text-xl font-[200] text-text leading-none">{v.opponentScore ?? '—'}</p>
                          <p className="text-[13px] text-text-3 mt-1">{debate.opponentPosition ?? 'AGAINST'}</p>
                        </div>
                      </div>
                    </div>
                    {v.reasoning && (
                      <div>
                        <p className="label mb-2">Reasoning</p>
                        <p className="text-[16px] text-text-2 leading-relaxed whitespace-pre-wrap">
                          {v.reasoning}
                        </p>
                      </div>
                    )}
                  </Card>
                );
              })}

              {isParticipant && (
                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" size="sm">
                    <Shield size={12} />
                    Appeal verdict
                  </Button>
                  <Button variant="secondary" size="sm" href={`/debate/${debate.id}`}>
                    Request rematch
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Submit argument form */}
          {canSubmit && tab === 'arguments' && (
            <form
              onSubmit={handleSubmit}
              className="border-t border-border px-5 pt-3 pb-4 flex-shrink-0 bg-bg"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[14px] text-text-3">
                  Round {(debate.currentRound ?? 1)} · Your argument
                </p>
                <p className="text-[14px] text-text-3">
                  {statement.length} chars
                </p>
              </div>
              <Textarea
                placeholder="Make your argument..."
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                className="w-full min-h-[140px] max-h-[320px] resize-y mb-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) handleSubmit(e as any);
                }}
              />
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-text-3">⌘ + Enter to submit</p>
                <Button
                  variant="accent"
                  size="sm"
                  type="submit"
                  loading={submitting}
                  disabled={!statement.trim()}
                >
                  Submit
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Right sidebar — debate info */}
        <div className="w-60 border-l border-border flex-shrink-0 overflow-y-auto hidden xl:block">
          <div className="p-4 space-y-4">
            <div>
              <p className="label mb-2">Debate info</p>
              <div className="space-y-2">
                <InfoRow label="Category" value={debate.category ?? 'General'} />
                <InfoRow label="Rounds" value={debate.totalRounds} />
                <InfoRow label="Mode" value={debate.speedMode ? 'Speed' : 'Standard'} />
                {debate.hasBeltAtStake && (
                  <InfoRow label="Belt at stake" value="Yes" accent />
                )}
              </div>
            </div>

            <Separator />

            <div>
              <p className="label mb-2">Spectating</p>
              <p className="text-[15px] text-text-3">
                {debate.spectatorCount ?? 0} watching
              </p>
            </div>

            <Separator />

            <div>
              <p className="label mb-2">Timeline</p>
              <div className="space-y-1.5">
                <InfoRow
                  label="Started"
                  value={
                    debate.startedAt
                      ? new Date(debate.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : '—'
                  }
                />
                {debate.endedAt && (
                  <InfoRow
                    label="Ended"
                    value={new Date(debate.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ParticipantPill({
  user,
  position,
  isCurrentUser,
  won,
  lost,
}: {
  user: any;
  position?: string;
  isCurrentUser: boolean;
  won?: boolean;
  lost?: boolean;
}) {
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-surface-2 border border-dashed border-border flex items-center justify-center">
          <span className="text-[12px] text-text-3">?</span>
        </div>
        <span className="text-xs text-text-3">Open</span>
      </div>
    );
  }
  return (
    <div className={cn('flex items-center gap-2', isCurrentUser && 'font-[500]')}>
      <Avatar src={user.avatarUrl} fallback={user.username} size="sm" />
      <div>
        <div className="flex items-center gap-1.5">
          <p className={cn('text-[15px] leading-tight', isCurrentUser ? 'text-accent' : 'text-text')}>
            {user.username}
          </p>
          {won && <CheckCircle size={12} className="text-[var(--green)]" />}
          {lost && <XCircle size={12} className="text-[var(--red)]" />}
        </div>
        {position && (
          <p className="text-[13px] text-text-3 capitalize leading-tight">
            {position.toLowerCase()}
          </p>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[14px] text-text-3">{label}</p>
      <p className={cn('text-[14px] font-[450]', accent ? 'text-accent' : 'text-text-2')}>
        {String(value)}
      </p>
    </div>
  );
}

function groupByRound(statements: any[]) {
  const rounds: Record<number, any[]> = {};
  for (const s of statements) {
    const r = s.round ?? 1;
    if (!rounds[r]) rounds[r] = [];
    rounds[r].push(s);
  }
  return Object.entries(rounds)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([round, statements]) => ({ round: Number(round), statements }));
}
