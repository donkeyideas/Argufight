import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { MarketingHomePage } from '@/components/features/marketing/homepage';

/**
 * Root page:
 * - Authenticated users → /dashboard
 * - Visitors → marketing homepage
 */
export default async function RootPage() {
  const session = await getSession();

  if (session) {
    redirect('/dashboard');
  }

  return <MarketingHomePage />;
}
