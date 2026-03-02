import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const secretKey = process.env.AUTH_SECRET;

/**
 * Get the current session with full user profile for use in Server Components.
 * Returns null if not authenticated.
 * Fetches coins + eloRating needed for the app shell.
 */
export async function getSession() {
  if (!secretKey) return null;

  const cookieStore = await cookies();
  const sessionJWT = cookieStore.get('session')?.value;
  if (!sessionJWT) return null;

  try {
    const encodedKey = new TextEncoder().encode(secretKey);
    const { payload } = await jwtVerify(sessionJWT, encodedKey);
    const { sessionToken } = payload as { sessionToken: string };

    const { prisma } = await import('@/lib/db/prisma');

    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: {
        user: {
          select: {
            id:        true,
            email:     true,
            username:  true,
            avatarUrl: true,
            isAdmin:   true,
            coins:     true,
            eloRating: true,
            isBanned:  true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) return null;
    if (session.userId !== session.user.id) return null;

    return {
      userId:    session.userId,
      sessionId: session.id,
      username:  session.user.username,
      email:     session.user.email,
      avatarUrl: session.user.avatarUrl,
      isAdmin:   session.user.isAdmin,
      coins:     session.user.coins,
      eloRating: session.user.eloRating,
      isBanned:  session.user.isBanned,
    };
  } catch {
    return null;
  }
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>;
