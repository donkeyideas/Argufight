import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { CreateTournamentForm } from '@/components/features/tournaments/create-tournament-form';

export const metadata: Metadata = { title: 'Create Tournament' };

export default async function CreateTournamentPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-sm font-[500] text-text">Create tournament</h1>
        <p className="text-[13px] text-text-3 mt-0.5">Set up a bracket competition for the community</p>
      </div>
      <CreateTournamentForm userId={session.userId} coins={session.coins ?? 0} />
    </div>
  );
}
