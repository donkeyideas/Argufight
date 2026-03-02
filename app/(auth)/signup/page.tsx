import type { Metadata } from 'next';
import Link from 'next/link';
import { SignupForm } from './signup-form';

export const metadata: Metadata = { title: 'Create Account' };

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-[500] text-text">Create account</h2>
        <p className="text-xs text-text-3 mt-1">
          Join thousands of debaters. Free to start.
        </p>
      </div>

      <SignupForm />

      <p className="text-[13px] text-text-3 text-center">
        Already have an account?{' '}
        <Link href="/login" className="text-accent hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
