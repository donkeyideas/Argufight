import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { Providers } from '@/lib/providers';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) redirect('/login');
  if (!session.isAdmin) redirect('/dashboard');

  return (
    <Providers>
      <div className="flex h-screen overflow-hidden bg-bg">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </Providers>
  );
}
