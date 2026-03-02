'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
      <AlertTriangle size={28} className="text-[var(--red)]" />
      <div className="text-center">
        <p className="text-sm font-[450] text-text mb-1">Something went wrong</p>
        <p className="text-xs text-text-3">{error.message || 'Please try again'}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={reset}>Try again</Button>
    </div>
  );
}
