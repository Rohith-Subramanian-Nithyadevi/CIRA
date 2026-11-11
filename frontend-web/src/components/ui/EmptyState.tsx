import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[#1E1E22] border border-border-soft dark:border-neutral-800 rounded-lg w-full min-h-[200px] ${className}`}>
      {icon && (
        <div className="mb-4 text-maroon/60 dark:text-rose-400/80 bg-cream/50 dark:bg-neutral-800 p-4 rounded-full">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-ink dark:text-neutral-100 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-body dark:text-neutral-400 mb-6 max-w-md">
          {description}
        </p>
      )}
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  );
}
