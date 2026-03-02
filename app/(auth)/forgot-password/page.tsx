import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Reset Password',
};

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-[500] text-text">Reset password</h2>
        <p className="text-xs text-text-3 mt-1">
          Enter your email and we'll send you a reset link.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="text-xs text-center text-text-3">
        Remember it?{' '}
        <Link href="/login" className="text-accent hover:text-accent-2 font-[450] transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
