import { cn } from '@/lib/cn';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  className?: string;
  accent?: boolean;
}

export function StatCard({
  label,
  value,
  trend,
  trendLabel,
  icon,
  className,
  accent = false,
}: StatCardProps) {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;

  return (
    <div
      className={cn(
        'bg-surface border border-border rounded-[var(--radius)] p-4',
        accent && 'border-[rgba(212,240,80,0.2)] bg-[rgba(212,240,80,0.04)]',
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="label">{label}</p>
        {icon && <span className="text-text-3">{icon}</span>}
      </div>
      <p
        className={cn(
          'text-2xl font-[300] leading-none',
          accent ? 'text-accent' : 'text-text'
        )}
      >
        {value}
      </p>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {isPositive ? (
            <TrendingUp size={11} className="text-[var(--green)]" />
          ) : isNegative ? (
            <TrendingDown size={11} className="text-[var(--red)]" />
          ) : (
            <Minus size={11} className="text-text-3" />
          )}
          <span
            className={cn(
              'text-[13px]',
              isPositive ? 'text-[var(--green)]' : isNegative ? 'text-[var(--red)]' : 'text-text-3'
            )}
          >
            {isPositive ? '+' : ''}{trend}%{trendLabel ? ` ${trendLabel}` : ''}
          </span>
        </div>
      )}
    </div>
  );
}
