import { cn } from '@/lib/cn';
import Image from 'next/image';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: AvatarSize;
  className?: string;
  online?: boolean;
}

const sizeStyles: Record<AvatarSize, { wrapper: string; text: string; dot: string }> = {
  xs: { wrapper: 'h-5 w-5',   text: 'text-[11px]',  dot: 'h-1.5 w-1.5 border' },
  sm: { wrapper: 'h-7 w-7',   text: 'text-[13px]', dot: 'h-2 w-2 border' },
  md: { wrapper: 'h-9 w-9',   text: 'text-xs',     dot: 'h-2.5 w-2.5 border-2' },
  lg: { wrapper: 'h-12 w-12', text: 'text-sm',     dot: 'h-3 w-3 border-2' },
  xl: { wrapper: 'h-16 w-16', text: 'text-base',   dot: 'h-3.5 w-3.5 border-2' },
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name?: string): string {
  if (!name) return 'bg-surface-3';
  const colors = [
    'bg-[rgba(212,240,80,0.15)] text-accent',
    'bg-[rgba(77,159,255,0.15)] text-[var(--blue)]',
    'bg-[rgba(77,255,145,0.15)] text-[var(--green)]',
    'bg-[rgba(255,207,77,0.15)] text-[var(--amber)]',
    'bg-[rgba(255,77,77,0.15)] text-[var(--red)]',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

export function Avatar({
  src,
  alt = '',
  fallback,
  size = 'md',
  className,
  online,
}: AvatarProps) {
  const { wrapper, text, dot } = sizeStyles[size];
  const initials = getInitials(fallback ?? alt);
  const colorClass = getAvatarColor(fallback ?? alt);

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <div
        className={cn(
          'relative rounded-full overflow-hidden flex items-center justify-center flex-shrink-0',
          wrapper,
          !src && `${colorClass} font-medium`
        )}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <span className={cn('leading-none select-none', text)}>
            {initials}
          </span>
        )}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-bg',
            dot,
            online ? 'bg-[var(--green)]' : 'bg-text-3'
          )}
        />
      )}
    </div>
  );
}
