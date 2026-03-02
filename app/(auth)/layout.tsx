import { Swords } from 'lucide-react';
import { Providers } from '@/lib/providers';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen flex bg-bg">
        {/* Left panel — brand */}
        <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col flex-shrink-0 bg-surface border-r border-border p-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="h-8 w-8 rounded bg-accent flex items-center justify-center">
              <Swords size={16} className="text-accent-fg" />
            </div>
            <span className="text-base font-[300] tracking-[3px] uppercase">
              Argu<strong className="font-[600] text-accent">Fight</strong>
            </span>
          </div>

          {/* Headline */}
          <div className="mb-auto">
            <h1 className="display mb-4">
              Argue.<br />
              Win.<br />
              Prove&nbsp;it.
            </h1>
            <p className="text-sm text-text-3 leading-relaxed max-w-xs">
              The premier AI-judged debate platform. Challenge opponents,
              earn championship belts, and climb the global leaderboard.
            </p>
          </div>

          {/* Footer */}
          <p className="text-xs text-text-3">
            &copy; {new Date().getFullYear()} ArguFight
          </p>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>
      </div>
    </Providers>
  );
}
