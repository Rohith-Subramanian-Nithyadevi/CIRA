import React, { useEffect, useId, useRef } from 'react';
import { AlertCircle, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-body">{eyebrow}</p>}
        <h2 className="font-serif text-2xl font-bold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-body">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  description,
  icon,
  action,
  className,
}: {
  label: string;
  value: React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-border-soft bg-white p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-body">{label}</p>
        {icon && <span className="text-maroon" aria-hidden="true">{icon}</span>}
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-ink">{value}</p>
      {description && <p className="mt-1 text-xs text-gray-body">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-border-soft bg-white p-5 shadow-sm', className)}>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-serif text-xl font-bold text-ink">{title}</h3>
          {description && <p className="mt-1 text-sm text-gray-body">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  label = 'Search',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-body" aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-border-soft bg-white pl-9 pr-3 text-sm text-ink outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20"
      />
    </label>
  );
}

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-3 rounded-xl border border-border-soft bg-cream/30 p-3 md:flex-row md:flex-wrap md:items-center', className)}>{children}</div>;
}

export function StatusBadge({
  status,
  children,
}: {
  status: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children: React.ReactNode;
}) {
  const styles = {
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    danger: 'border-danger/30 bg-danger/10 text-danger',
    info: 'border-info/30 bg-info/10 text-info',
    neutral: 'border-border-soft bg-cream text-gray-body',
  };
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold', styles[status])}>{children}</span>;
}

export function ProgressIndicator({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const boundedValue = Math.min(100, Math.max(0, value));
  return (
    <div className={className}>
      {label && <div className="mb-1 flex justify-between text-xs text-gray-body"><span>{label}</span><span>{Math.round(boundedValue)}%</span></div>}
      <div className="h-2 overflow-hidden rounded-full bg-cream-edge" role="progressbar" aria-valuenow={Math.round(boundedValue)} aria-valuemin={0} aria-valuemax={100} aria-label={label || 'Progress'}>
        <div className="h-full rounded-full bg-maroon transition-[width] duration-200" style={{ width: `${boundedValue}%` }} />
      </div>
    </div>
  );
}

export function LoadingState({ label = 'Loading', className }: { label?: string; className?: string }) {
  return <div className={cn('flex min-h-32 items-center justify-center rounded-xl border border-border-soft bg-white p-6 text-sm text-gray-body', className)} role="status" aria-live="polite"><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-maroon border-t-transparent" aria-hidden="true" />{label}</div>;
}

export function ErrorState({
  message = 'Something went wrong while loading this section.',
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-32 flex-col items-center justify-center rounded-xl border border-danger/30 bg-danger/5 p-6 text-center', className)} role="alert">
      <AlertCircle className="mb-2 h-5 w-5 text-danger" aria-hidden="true" />
      <p className="text-sm text-ink">{message}</p>
      {onRetry && <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-danger/40 px-3 py-1.5 text-sm font-semibold text-danger transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30">Retry</button>}
    </div>
  );
}

function useDialogFocus(dialogRef: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute('disabled'));
    (focusable()[0] || dialog).focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previous?.focus();
    };
  }, [dialogRef, onClose]);
}

export function AccessibleDialog({
  open,
  title,
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(dialogRef, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cn('max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-border-soft bg-white p-6 shadow-xl', className)}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-serif text-xl font-bold text-ink">{title}</h2>
          <button type="button" aria-label="Close dialog" onClick={onClose} className="rounded-lg p-1.5 text-gray-body transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AccessibleDialog open={open} title={title} onClose={onCancel}>
      <p className="text-sm text-gray-body">{description}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-lg border border-border-soft px-4 py-2 text-sm font-semibold text-ink hover:bg-cream/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30">Cancel</button>
        <button type="button" onClick={onConfirm} className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30">{confirmLabel}</button>
      </div>
    </AccessibleDialog>
  );
}

export function ResponsiveTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('w-full overflow-x-auto rounded-xl border border-border-soft bg-white', className)}><table className="w-full min-w-[640px] text-left text-sm">{children}</table></div>;
}
