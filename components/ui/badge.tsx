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
  accent:  'bg-[rgba(212,240,80,0.12)] text-accent border-[rgba(212,240,80,0.2)]',
  red:     'bg-[var(--red-muted)] text-[var(--red)] border-transparent',
  green:   'bg-[var(--green-muted)] text-[var(--green)] border-transparent',
  blue:    'bg-[var(--blue-muted)] text-[var(--blue)] border-transparent',
  amber:   'bg-[var(--amber-muted)] text-[var(--amber)] border-transparent',
  muted:   'bg-surface-2 text-text-3 border-transparent',
  default: 'bg-surface-3 text-text-2 border-border',
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
        'inline-flex items-center gap-1.5 border rounded-full font-[450]',
        'whitespace-nowrap leading-none',
        size === 'sm' && 'text-[13px] px-2 py-1',
        size === 'md' && 'text-xs px-2.5 py-1.5',
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
