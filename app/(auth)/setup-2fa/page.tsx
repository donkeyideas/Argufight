import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { SetupTwoFAForm } from './setup-2fa-form';

export const metadata: Metadata = { title: 'Set Up Two-Factor Auth' };

export default async function Setup2FAPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-[500] text-text">Set up 2FA</h2>
        <p className="text-xs text-text-3 mt-1">
          Scan the QR code with your authenticator app to protect your account.
        </p>
      </div>
      <SetupTwoFAForm userId={session.userId} />
    </div>
  );
}
