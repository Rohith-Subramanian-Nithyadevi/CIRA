import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AssignmentManagement from '../dashboard/AssignmentManagement';
import StudyPlanner from '../student/StudyPlanner';
import { apiClient } from '@/lib/apiClient';

jest.mock('@/hooks/useReferenceData', () => ({
  useBatches: () => ({ batches: [] }),
  useDepartments: () => ({ departments: [] }),
}));

jest.mock('@/lib/apiClient', () => ({
  apiClient: { fetch: jest.fn() },
}));

describe('Standardized double-confirmation across modules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('requires CONFIRM before deleting an assignment and keeps it in UI on backend failure', async () => {
    (apiClient.fetch as jest.Mock).mockImplementation(async (path: string, opts?: any) => {
      if (path.startsWith('/api/v1/assignments/faculty?') || path === '/api/v1/assignments/faculty') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: 'a1', title: 'Lab Assignment 1', description: '<p>Submit PDF</p>', dueDate: new Date().toISOString(), _count: { submissions: 0 } }],
          }),
        };
      }
      if (path === '/api/v1/assignments/faculty/a1' && opts?.method === 'DELETE') {
        return {
          ok: false,
          json: async () => ({ success: false, message: 'Assignment cannot be deleted right now' }),
        };
      }
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    });

    render(
      <MemoryRouter>
        <AssignmentManagement />
      </MemoryRouter>
    );
    expect(await screen.findByText('Lab Assignment 1')).toBeInTheDocument();

    // Clicking Delete opens confirmation dialog instead of deleting immediately
    fireEvent.click(screen.getByRole('button', { name: 'Delete Lab Assignment 1' }));
    const dialog = await screen.findByRole('dialog');
    const confirmDeleteBtn = within(dialog).getByRole('button', { name: 'Delete' });
    expect(confirmDeleteBtn).toBeDisabled();

    // Enter uppercase CONFIRM and submit; backend rejects so item remains in UI and error appears
    fireEvent.change(within(dialog).getByPlaceholderText('Type CONFIRM to proceed'), { target: { value: 'CONFIRM' } });
    expect(confirmDeleteBtn).not.toBeDisabled();
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Assignment cannot be deleted right now');
    });
    expect(screen.getByText('Lab Assignment 1')).toBeInTheDocument();
  });

  it('requires CONFIRM before deleting student study tasks and habits', async () => {
    let tasks = [{ id: 't1', title: 'Revise OS Notes', completed: false, date: new Date().toISOString() }];
    let habits = [{ id: 'h1', title: 'Daily Practice', completedDates: [] }];

    (apiClient.fetch as jest.Mock).mockImplementation(async (path: string, opts?: any) => {
      if (path === '/api/v1/student/tasks' && (!opts || !opts.method)) {
        return { ok: true, json: async () => ({ tasks, streak: 0 }) };
      }
      if (path === '/api/v1/student/habits' && (!opts || !opts.method)) {
        return { ok: true, json: async () => habits };
      }
      if (path === '/api/v1/student/calendar') {
        return { ok: true, json: async () => ({ success: true, data: [] }) };
      }
      if (path === '/api/v1/student/tasks/t1' && opts?.method === 'DELETE') {
        tasks = [];
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (path === '/api/v1/student/habits/h1' && opts?.method === 'DELETE') {
        habits = [];
        return { ok: true, json: async () => ({ success: true }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    });

    render(<StudyPlanner />);
    expect(await screen.findByText('Revise OS Notes')).toBeInTheDocument();
    expect(screen.getByText('Daily Practice')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete task Revise OS Notes' }));
    const taskDialog = await screen.findByRole('dialog');
    const delBtn = within(taskDialog).getByRole('button', { name: 'Delete' });
    expect(delBtn).toBeDisabled();

    fireEvent.change(within(taskDialog).getByPlaceholderText('Type CONFIRM to proceed'), { target: { value: 'CONFIRM' } });
    fireEvent.click(delBtn);

    await waitFor(() => {
      expect(screen.queryByText('Revise OS Notes')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete habit Daily Practice' }));
    const habitDialog = await screen.findByRole('dialog');
    fireEvent.change(within(habitDialog).getByPlaceholderText('Type CONFIRM to proceed'), { target: { value: 'CONFIRM' } });
    fireEvent.click(within(habitDialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText('Daily Practice')).not.toBeInTheDocument();
    });
  });
});

