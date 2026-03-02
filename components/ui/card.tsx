import { cn } from '@/lib/cn';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  children: React.ReactNode;
  padding?: CardPadding;
  border?: boolean;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  onClick?: () => void;
  hover?: boolean;
}

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-6',
};

export function Card({
  children,
  padding = 'md',
  border = true,
  className,
  as: Tag = 'div',
  onClick,
  hover = false,
}: CardProps) {
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'bg-surface rounded-[var(--radius)]',
        border && 'border border-border',
        hover && 'transition-colors duration-150 hover:bg-surface-2 hover:border-border-2 cursor-pointer',
        onClick && 'cursor-pointer',
        paddingStyles[padding],
        className
      )}
    >
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={cn('text-sm font-medium text-text', className)}>
      {children}
    </h3>
  );
}

interface CardSectionProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export function CardSection({ label, children, className }: CardSectionProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && <p className="label">{label}</p>}
      {children}
    </div>
  );
}
