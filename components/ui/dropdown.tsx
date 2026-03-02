'use client';

import {
  useState,
  useRef,
  useEffect,
  createContext,
  useContext,
  useCallback,
} from 'react';
import { cn } from '@/lib/cn';

interface DropdownContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

export function Dropdown({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [close]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={ref} className={cn('relative', className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownTrigger({ children }: { children: React.ReactNode }) {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('DropdownTrigger must be inside Dropdown');

  return (
    <div onClick={() => ctx.setOpen(!ctx.open)} className="cursor-pointer">
      {children}
    </div>
  );
}

export function DropdownMenu({
  children,
  align = 'left',
  className,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('DropdownMenu must be inside Dropdown');
  if (!ctx.open) return null;

  return (
    <div
      className={cn(
        'absolute top-full mt-1.5 z-50',
        'min-w-[160px] w-max max-w-xs',
        'bg-surface border border-border rounded-[var(--radius)]',
        'shadow-xl py-1 animate-fade-in',
        align === 'right' ? 'right-0' : 'left-0',
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  disabled,
  danger,
  icon,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  const ctx = useContext(DropdownContext);

  return (
    <button
      disabled={disabled}
      onClick={() => {
        onClick?.();
        ctx?.setOpen(false);
      }}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2',
        'text-xs text-left cursor-pointer',
        'transition-colors duration-100',
        danger
          ? 'text-[var(--red)] hover:bg-[var(--red-muted)]'
          : 'text-text-2 hover:bg-surface-2 hover:text-text',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        className
      )}
    >
      {icon && <span className="flex-shrink-0 text-text-3">{icon}</span>}
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="h-px bg-border my-1" />;
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1.5 label">{children}</div>
  );
}
