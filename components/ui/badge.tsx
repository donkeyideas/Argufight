import { cn } from '@/lib/cn';

type BadgeColor = 'accent' | 'red' | 'green' | 'blue' | 'amber' | 'muted' | 'default';

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

const colorStyles: Record<BadgeColor, string> = {
  accent:  'text-accent',
  red:     'text-[var(--red)]',
  green:   'text-[var(--green)]',
  blue:    'text-[var(--blue)]',
  amber:   'text-[var(--amber)]',
  muted:   'text-text-3',
  default: 'text-text-2',
};

const dotColors: Record<BadgeColor, string> = {
  accent:  'bg-accent',
  red:     'bg-[var(--red)]',
  green:   'bg-[var(--green)]',
  blue:    'bg-[var(--blue)]',
  amber:   'bg-[var(--amber)]',
  muted:   'bg-text-3',
  default: 'bg-text-2',
};

export function Badge({
  children,
  color = 'default',
  size = 'sm',
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-[500] uppercase tracking-[0.5px]',
        'whitespace-nowrap leading-none',
        size === 'sm' && 'text-[12px]',
        size === 'md' && 'text-[13px]',
        colorStyles[color],
        className
      )}
    >
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', dotColors[color])}
        />
      )}
      {children}
    </span>
  );
}
