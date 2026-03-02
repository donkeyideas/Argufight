'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
  className?: string;
}

interface ButtonAsButton extends ButtonBaseProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> {
  href?: undefined;
}

interface ButtonAsLink extends ButtonBaseProps {
  href: string;
  target?: string;
  rel?: string;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-surface-2 text-text border border-border',
    'hover:bg-surface-3 hover:border-border-2',
    'active:scale-[0.98]',
  ].join(' '),
  secondary: [
    'bg-transparent text-text-2 border border-border',
    'hover:bg-surface-2 hover:text-text hover:border-border-2',
    'active:scale-[0.98]',
  ].join(' '),
  ghost: [
    'bg-transparent text-text-2 border border-transparent',
    'hover:bg-surface-2 hover:text-text',
    'active:scale-[0.98]',
  ].join(' '),
  danger: [
    'bg-[var(--red-muted)] text-[var(--red)] border border-transparent',
    'hover:border-[var(--red)]',
    'active:scale-[0.98]',
  ].join(' '),
  accent: [
    'bg-accent text-accent-fg border border-transparent font-medium',
    'hover:bg-accent-2',
    'active:scale-[0.98]',
  ].join(' '),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-xs rounded-[var(--radius-sm)] gap-1.5',
  md: 'h-9 px-4 text-sm rounded-[var(--radius)] gap-2',
  lg: 'h-11 px-6 text-sm rounded-[var(--radius)] gap-2',
};

const baseClass = (variant: ButtonVariant, size: ButtonSize, fullWidth: boolean, loading: boolean, className?: string) =>
  cn(
    'inline-flex items-center justify-center',
    'font-[450] leading-none whitespace-nowrap',
    'transition-all duration-150 cursor-pointer',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
    variantStyles[variant],
    sizeStyles[size],
    fullWidth && 'w-full',
    loading && 'opacity-60 cursor-not-allowed',
    className
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    const {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      className,
      children,
    } = props;

    const innerContent = loading ? (
      <>
        <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        <span>{children}</span>
      </>
    ) : children;

    if ('href' in props && props.href !== undefined) {
      const { href, target, rel } = props as ButtonAsLink;
      return (
        <Link
          href={href}
          target={target}
          rel={rel}
          className={baseClass(variant, size, fullWidth, loading, className)}
        >
          {innerContent}
        </Link>
      );
    }

    const { disabled, onClick, type, ...rest } = props as ButtonAsButton;
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        disabled={disabled || loading}
        onClick={onClick}
        className={baseClass(variant, size, fullWidth, loading, className)}
        {...(Object.fromEntries(
          Object.entries(rest).filter(
            ([k]) =>
              !['variant', 'size', 'loading', 'fullWidth', 'children', 'className'].includes(k)
          )
        ) as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {innerContent}
      </button>
    );
  }
);

Button.displayName = 'Button';
