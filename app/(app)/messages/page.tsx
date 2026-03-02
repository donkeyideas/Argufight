import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/get-session';
import { MessagesUI } from '@/components/features/messages/messages-ui';

export const metadata: Metadata = { title: 'Messages' };

export default async function MessagesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ user1Id: session.userId }, { user2Id: session.userId }],
    },
    include: {
      user1: { select: { id: true, username: true, avatarUrl: true } },
      user2: { select: { id: true, username: true, avatarUrl: true } },
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 50,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 border-b border-border flex items-center px-5 flex-shrink-0">
        <h1 className="text-sm font-[500] text-text">Messages</h1>
      </div>
      <MessagesUI conversations={conversations} currentUserId={session.userId} />
    </div>
  );
}
