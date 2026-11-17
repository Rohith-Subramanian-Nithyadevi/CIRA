import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { AccessibleDialog } from './facultyPrimitives';

export interface DeleteConfirmationDialogProps {
  open: boolean;
  itemName: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

const REQUIRED_CONFIRMATION_WORD = 'CONFIRM';

export function DeleteConfirmationDialog({
  open,
  itemName,
  title = 'Confirm Deletion',
  description = 'This action is permanent and cannot be undone.',
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const inputId = useId();

  useEffect(() => {
    if (!open) {
      setTypedConfirmation('');
      setIsDeleting(false);
      setError(null);
      inFlightRef.current = false;
    } else {
      setTypedConfirmation('');
      setError(null);
    }
  }, [open, itemName]);

  const isExactMatch = typedConfirmation === REQUIRED_CONFIRMATION_WORD;
  const showMismatchHint = typedConfirmation.length > 0 && !isExactMatch;

  const handleSafeCancel = () => {
    if (isDeleting || inFlightRef.current) return;
    onCancel();
  };

  const handleConfirm = async () => {
    if (!isExactMatch || isDeleting || inFlightRef.current) return;

    inFlightRef.current = true;
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
      inFlightRef.current = false;
      setIsDeleting(false);
    } catch (err: any) {
      inFlightRef.current = false;
      setIsDeleting(false);
      setError(err?.message || 'Failed to delete item. Please try again.');
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <AccessibleDialog open={open} title={title} onClose={handleSafeCancel} className="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger/5 p-3.5 text-sm text-ink dark:border-red-500/30 dark:bg-red-950/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger dark:text-red-400" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium text-ink dark:text-zinc-100">
              You are about to delete{' '}
              <span className="font-semibold text-maroon dark:text-rose-300">
                &ldquo;{itemName || 'this item'}&rdquo;
              </span>
              .
            </p>
            <p className="text-xs leading-relaxed text-gray-body dark:text-zinc-400">
              {description}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wide text-gray-body dark:text-zinc-300"
          >
            Type <span className="rounded bg-cream px-1.5 py-0.5 font-mono text-maroon dark:bg-zinc-800 dark:text-rose-300">{REQUIRED_CONFIRMATION_WORD}</span> to proceed
          </label>
          <input
            id={inputId}
            data-autofocus="true"
            type="text"
            value={typedConfirmation}
            onChange={(e) => {
              setTypedConfirmation(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleInputKeyDown}
            disabled={isDeleting}
            placeholder="Type CONFIRM to proceed"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-border-soft bg-cream/30 px-3.5 py-2.5 text-sm font-medium text-ink placeholder:text-gray-body/60 focus:border-maroon focus:bg-white focus:outline-none focus:ring-2 focus:ring-maroon/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:bg-zinc-900"
          />
          {showMismatchHint && (
            <p className="text-xs text-amber-700 dark:text-amber-400" role="note">
              Enter <span className="font-mono font-semibold">{REQUIRED_CONFIRMATION_WORD}</span> exactly (case-sensitive, no leading or trailing spaces).
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs font-medium text-danger dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleSafeCancel}
            disabled={isDeleting}
            className="rounded-xl border border-border-soft px-4 py-2 text-sm font-semibold text-ink transition hover:bg-cream/60 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isExactMatch || isDeleting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isDeleting ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </AccessibleDialog>
  );
}

