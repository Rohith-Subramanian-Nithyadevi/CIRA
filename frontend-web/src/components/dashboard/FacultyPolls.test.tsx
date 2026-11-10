import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FacultyPolls from './FacultyPolls';
import { apiClient } from '@/lib/apiClient';

jest.mock('@/lib/apiClient', () => ({ apiClient: { fetch: jest.fn() }, getApiErrorMessage: (error: Error) => error.message }));

describe('FacultyPolls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.fetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/targets')) return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { batches: [], departments: [{ id: 'dept-1', name: 'CSE', batch: '2026' }], sections: [] } }) });
      if (path.includes('/results')) return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { poll: { id: 'p1', title: 'Choose time' }, total: 0, options: [{ option: 'Morning', count: 0, percentage: null }, { option: 'Evening', count: 0, percentage: null }] } }) });
      if (path.includes('/polls') && path.includes('status=')) return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [{ id: 'p1', title: 'Choose time', audience: '2026 | CSE', date: '2026-11-10T09:00:00Z', pollStartsAt: '2026-11-10T09:00:00Z', pollExpiresAt: null, _count: { responses: 0 } }] }) });
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { id: 'p2' } }) });
    });
  });

  it('creates a targeted poll with editable options, preview, schedule, and publish action', async () => {
    render(<FacultyPolls />);
    expect(await screen.findByText('Choose time')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create Poll' }));
    fireEvent.change(await screen.findByLabelText('Poll question'), { target: { value: 'When should we meet?' } });
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: 'Morning' } });
    fireEvent.change(screen.getByLabelText('Option 2'), { target: { value: 'Evening' } });
    fireEvent.change(screen.getByLabelText('Audience'), { target: { value: 'dept-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByText('When should we meet?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Poll' }));
    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith('/api/v1/faculty/dashboard/announcements/polls', expect.objectContaining({ method: 'POST' })));
    const call = (apiClient.fetch as jest.Mock).mock.calls.find(([url, init]) => url.endsWith('/polls') && init?.method === 'POST');
    expect(JSON.parse(call[1].body)).toMatchObject({ question: 'When should we meet?', options: ['Morning', 'Evening'], targetType: 'DEPARTMENT', targetId: 'dept-1' });
  });

  it('shows aggregate results without percentages when there are no votes', async () => {
    render(<FacultyPolls />);
    await screen.findByText('Choose time');
    fireEvent.click(screen.getByRole('button', { name: 'View Results' }));
    expect(await screen.findByText('0 total responses')).toBeInTheDocument();
    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
