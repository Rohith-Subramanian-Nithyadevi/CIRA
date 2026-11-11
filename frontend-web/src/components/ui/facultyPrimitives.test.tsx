import { fireEvent, render, screen } from '@testing-library/react';
import { AccessibleDialog, ErrorState, ProgressIndicator } from './facultyPrimitives';

describe('faculty UI primitives', () => {
  it('renders progress with bounded accessible value', () => {
    render(<ProgressIndicator value={140} label="Completion" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders retryable errors', () => {
    const onRetry = jest.fn();
    render(<ErrorState message="Unable to load" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('closes a dialog with Escape', () => {
    const onClose = jest.fn();
    render(<AccessibleDialog open title="Details" onClose={onClose}>Content</AccessibleDialog>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
