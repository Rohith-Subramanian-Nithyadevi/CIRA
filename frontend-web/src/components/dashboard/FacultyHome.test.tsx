import { render, screen, waitFor } from '@testing-library/react';
import FacultyHome from './FacultyHome';

jest.mock('@/hooks/useReferenceData', () => ({
  useBatches: () => ({ batches: [] }),
  useDepartments: () => ({ departments: [] }),
}));

jest.mock('@/lib/apiClient', () => ({
  apiClient: {
    fetch: jest.fn(async (path: string) => {
      if (path.endsWith('/tasks')) throw new Error('tasks unavailable');
      if (path.endsWith('/calendar')) return new Response(JSON.stringify({ success: true, data: [{ id: 'event-1', title: 'Faculty meeting', date: new Date().toISOString() }] }), { status: 200 });
      if (path.includes('/announcements')) return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
      if (path.includes('/notifications')) return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
      if (path.includes('/assignments/faculty')) throw new Error('assignments unavailable');
      return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
    }),
  },
}));

describe('FacultyHome agenda', () => {
  it('keeps calendar data visible when the task source fails', async () => {
    render(<FacultyHome />);

    await waitFor(() => {
      expect(screen.getByText('Tasks unavailable')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Today agenda' })).toBeInTheDocument();
    });
  });
});
