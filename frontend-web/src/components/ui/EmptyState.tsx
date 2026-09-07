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
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-white border border-border-soft rounded-lg w-full min-h-[200px] ${className}`}>
      {icon && (
        <div className="mb-4 text-maroon/60 bg-cream/50 p-4 rounded-full">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-ink mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-ink-light mb-6 max-w-md">
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
