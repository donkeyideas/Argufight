import { cn } from '@/lib/cn';

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Separator({ orientation = 'horizontal', className }: SeparatorProps) {
  return (
    <div
      role="separator"
      className={cn(
        'bg-border',
        orientation === 'horizontal' ? 'h-px flex-1 min-w-0' : 'w-px self-stretch flex-shrink-0',
        className
      )}
    />
  );
}
