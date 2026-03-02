import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';

interface Props {
  params: Promise<{ username: string }>;
}

/**
 * Public username route: /username → /profile/[id]
 * Resolves username to user ID and redirects to the canonical profile URL.
 */
export default async function UsernamePage({ params }: Props) {
  const { username } = await params;

  // Skip Next.js internal routes and reserved paths
  const reserved = ['api', 'dashboard', 'debate', 'debates', 'leaderboard',
    'messages', 'profile', 'settings', 'tournaments', 'trending', 'upgrade',
    'support', 'admin', 'login', 'signup', 'about', 'privacy', 'terms'];
  if (reserved.includes(username.toLowerCase())) notFound();

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (!user) notFound();

  redirect(`/profile/${user.id}`);
}
