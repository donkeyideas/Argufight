import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign In',
};

export default function LoginPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-[500] text-text">Sign in</h2>
        <p className="text-xs text-text-3 mt-1">
          Welcome back. Enter your credentials to continue.
        </p>
      </div>

      <LoginForm />

      {/* Footer links */}
      <div className="flex flex-col gap-2 text-xs text-center">
        <Link
          href="/forgot-password"
          className="text-text-3 hover:text-text-2 transition-colors"
        >
          Forgot your password?
        </Link>
        <p className="text-text-3">
          No account?{' '}
          <Link
            href="/signup"
            className="text-accent hover:text-accent-2 transition-colors font-[450]"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
