import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Topnav } from '@/components/layout/topnav';
import { ProfilePanel } from '@/components/layout/profile-panel';
import { ProfilePanelSkeleton } from '@/components/layout/profile-panel-skeleton';
import { RankingsPanel } from '@/components/layout/rankings-panel';
import { RankingsPanelSkeleton } from '@/components/layout/rankings-panel-skeleton';
import { Providers } from '@/lib/providers';
import { getSession } from '@/lib/auth/get-session';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <Providers>
      <div className="min-h-screen bg-bg">
        {/* Sticky top nav */}
        <Topnav
          user={{
            id:        session.userId,
            username:  session.username ?? 'User',
            avatarUrl: session.avatarUrl ?? null,
            coins:     session.coins ?? 0,
            eloRating: session.eloRating ?? 1200,
            isAdmin:   session.isAdmin ?? false,
          }}
        />

        {/* 3-column shell — sticky panels, scrollable center */}
        <div
          className="grid"
          style={{ gridTemplateColumns: '220px 1fr 220px' }}
        >
          {/* Left: Profile panel — streams in independently */}
          <Suspense fallback={<ProfilePanelSkeleton />}>
            <ProfilePanel userId={session.userId} />
          </Suspense>

          {/* Center: page content */}
          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 overflow-x-hidden overflow-y-auto"
            style={{ minHeight: 'calc(100vh - 58px)' }}
          >
            {children}
          </main>

          {/* Right: Rankings / Belts / Tournaments — streams in independently */}
          <Suspense fallback={<RankingsPanelSkeleton />}>
            <RankingsPanel userId={session.userId} />
          </Suspense>
        </div>
      </div>
    </Providers>
  );
}
