'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-text-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full h-9 bg-surface-2 text-text text-sm',
              'border border-border rounded-[var(--radius)]',
              'placeholder:text-text-3',
              'transition-colors duration-150',
              'focus:outline-none focus:border-border-2 focus:bg-surface-3',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              !leftIcon && 'px-3',
              error && 'border-[var(--red)] focus:border-[var(--red)]',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3">
              {rightIcon}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-[var(--red)]">{error}</p>}
        {hint && !error && <p className="text-xs text-text-3">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-text-2">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full bg-surface-2 text-text text-sm',
            'border border-border rounded-[var(--radius)]',
            'placeholder:text-text-3 p-3 resize-none',
            'transition-colors duration-150',
            'focus:outline-none focus:border-border-2 focus:bg-surface-3',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            error && 'border-[var(--red)]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[var(--red)]">{error}</p>}
        {hint && !error && <p className="text-xs text-text-3">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
