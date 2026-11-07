import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FacultyCommandPalette from './FacultyCommandPalette';

jest.mock('@/lib/apiClient', () => ({
  apiClient: {
    fetch: jest.fn(async (path: string) => {
      if (path.includes('/quiz')) return new Response(JSON.stringify({ data: [{ id: 'quiz-1', title: 'Algebra', subject: 'Maths' }] }), { status: 200 });
      if (path.includes('/assignments')) return new Response(JSON.stringify({ data: [{ id: 'assignment-1', title: 'Worksheet' }] }), { status: 200 });
      return new Response(JSON.stringify({ data: [{ id: 'announcement-1', title: 'Exam briefing' }] }), { status: 200 });
    }),
  },
}));

describe('FacultyCommandPalette', () => {
  it('navigates with arrow keys and restores focus after Escape', async () => {
    const user = userEvent.setup();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = jest.fn();
    const onNavigate = jest.fn();

    const { rerender } = render(<FacultyCommandPalette open onClose={onClose} onNavigate={onNavigate} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onNavigate).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    rerender(<FacultyCommandPalette open onClose={onClose} onNavigate={onNavigate} />);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();

    trigger.remove();
  });
});
