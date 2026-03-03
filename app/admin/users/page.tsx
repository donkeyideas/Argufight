import { prisma } from '@/lib/db/prisma';
import { AdminUsersClient } from './admin-users-client';

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      username: true,
      email: true,
      avatarUrl: true,
      eloRating: true,
      totalDebates: true,
      debatesWon: true,
      debatesLost: true,
      isAdmin: true,
      isBanned: true,
      bannedUntil: true,
      employeeRole: true,
      isAI: true,
      coins: true,
      isCreator: true,
      createdAt: true,
      subscription: {
        select: { tier: true, status: true },
      },
    },
  });

  // Serialize dates for client component
  const serialized = users.map(u => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    bannedUntil: u.bannedUntil?.toISOString() ?? null,
  }));

  return <AdminUsersClient initialUsers={serialized} />;
}
