import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';

// /profile → redirect to current user's profile
export default async function ProfileRedirect() {
  const session = await getSession();
  redirect(`/profile/${session!.userId}`);
}
