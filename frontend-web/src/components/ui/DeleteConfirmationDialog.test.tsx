import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';

describe('DeleteConfirmationDialog', () => {
  it('keeps Delete disabled until CONFIRM matches exactly and blocks Enter bypass', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    const onCancel = jest.fn();

    render(
      <DeleteConfirmationDialog
        open
        itemName="Operating Systems Midterm"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    const input = screen.getByPlaceholderText('Type CONFIRM to proceed');

    expect(deleteButton).toBeDisabled();
    expect(screen.getByText(/Operating Systems Midterm/)).toBeInTheDocument();

    // Case-sensitive & whitespace checks
    for (const badInput of ['confirm', 'Confirm', ' CONFIRM', 'CONFIRM ', ' CONFIRM ']) {
      fireEvent.change(input, { target: { value: badInput } });
      expect(deleteButton).toBeDisabled();
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onConfirm).not.toHaveBeenCalled();
    }

    // Typing character-by-character must keep focus inside the input (not jump to Close X button)
    input.focus();
    let typed = '';
    for (const ch of ['C', 'O', 'N', 'F', 'I', 'R', 'M']) {
      typed += ch;
      fireEvent.change(input, { target: { value: typed } });
      expect(document.activeElement).toBe(input);
    }
    expect(deleteButton).not.toBeDisabled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();

    // Explicit click triggers onConfirm
    await act(async () => {
      fireEvent.click(deleteButton);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows loading state while deleting, prevents duplicate clicks, and displays errors on failure', async () => {
    let rejectDelete: (err: Error) => void;
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectDelete = reject;
        })
    );
    const onCancel = jest.fn();

    render(
      <DeleteConfirmationDialog
        open
        itemName="Announcement A"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    const input = screen.getByPlaceholderText('Type CONFIRM to proceed');
    fireEvent.change(input, { target: { value: 'CONFIRM' } });

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Deleting\.\.\./i })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(input).toBeDisabled();
    });

    // Attempting Cancel or Escape during deletion does not invoke onCancel
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => {
      rejectDelete!(new Error('Server refused delete'));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server refused delete');
      expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

