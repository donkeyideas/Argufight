import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/get-session';
import {
  ProfileForm,
  PasswordForm,
  TwoFactorCard,
  NotificationsCard,
  DangerZone,
} from '@/components/features/settings/settings-forms';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      email: true,
      bio: true,
      avatarUrl: true,
      passwordHash: true,
      totpEnabled: true,
    },
  });

  if (!user) redirect('/login');

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <h1 className="text-sm font-[500] text-text mb-6">Settings</h1>

      <div className="space-y-4">
        <ProfileForm
          user={{
            id: user.id,
            username: user.username,
            email: user.email,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
          }}
        />
        <PasswordForm hasPassword={!!user.passwordHash} />
        <TwoFactorCard totpEnabled={user.totpEnabled} />
        <NotificationsCard />
        <DangerZone />
      </div>
    </div>
  );
}
