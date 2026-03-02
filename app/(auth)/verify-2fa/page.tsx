import type { Metadata } from 'next';
import { VerifyTwoFAForm } from './verify-2fa-form';

export const metadata: Metadata = { title: 'Two-Factor Verification' };

export default function Verify2FAPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-[500] text-text">Verify identity</h2>
        <p className="text-xs text-text-3 mt-1">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>
      <VerifyTwoFAForm />
    </div>
  );
}
