import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = { title: 'Reset Password' };

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-[500] text-text">Reset password</h2>
        <p className="text-xs text-text-3 mt-1">
          Enter a new password for your account.
        </p>
      </div>

      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="text-center py-4">
          <p className="text-xs text-text-3 mb-3">Invalid or expired reset link.</p>
          <Link href="/forgot-password" className="text-xs text-accent hover:underline">
            Request a new link
          </Link>
        </div>
      )}
    </div>
  );
}
