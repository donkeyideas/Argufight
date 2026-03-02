'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (options: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={14} className="text-[var(--green)]" />,
  error:   <AlertCircle size={14} className="text-[var(--red)]" />,
  info:    <Info size={14} className="text-[var(--blue)]" />,
  warning: <AlertTriangle size={14} className="text-[var(--amber)]" />,
};

const borderColors: Record<ToastType, string> = {
  success: 'border-l-[var(--green)]',
  error:   'border-l-[var(--red)]',
  info:    'border-l-[var(--blue)]',
  warning: 'border-l-[var(--amber)]',
};

function ToastItem({ toast: t, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(t.id), t.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, onRemove]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 w-80 max-w-full',
        'bg-surface border border-border border-l-2 rounded-[var(--radius)]',
        'shadow-lg p-3.5 animate-slide-right',
        borderColors[t.type]
      )}
      role="alert"
    >
      <span className="flex-shrink-0 mt-0.5">{icons[t.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text leading-tight">{t.title}</p>
        {t.description && (
          <p className="text-xs text-text-3 mt-1">{t.description}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(t.id)}
        className="flex-shrink-0 text-text-3 hover:text-text-2 transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((options: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { ...options, id }]);
  }, []);

  const ctx: ToastContextValue = {
    toast:   add,
    success: (title, description) => add({ type: 'success', title, description }),
    error:   (title, description) => add({ type: 'error',   title, description }),
    info:    (title, description) => add({ type: 'info',    title, description }),
    warning: (title, description) => add({ type: 'warning', title, description }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
