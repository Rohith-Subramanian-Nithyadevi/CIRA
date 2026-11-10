import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiClient } from '@/lib/apiClient';
import { FacultyNotificationBell, FacultyNotificationsPage, FacultyNotificationsProvider } from './FacultyNotifications';

jest.mock('@/lib/apiClient', () => ({ apiClient: { fetch: jest.fn() } }));

const notifications = [
  { id: 'n1', type: 'ASSIGNMENT_SUBMISSION', message: 'A student submitted an assignment.', createdAt: '2026-11-09T08:00:00.000Z', read: false },
  { id: 'n2', type: 'SURVEY_RESPONSE', message: 'A student responded to your survey.', createdAt: '2026-11-08T08:00:00.000Z', read: true },
];
let savedNotifications: typeof notifications;

describe('Faculty notification centre', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    savedNotifications = notifications.map((item) => ({ ...item }));
    (apiClient.fetch as jest.Mock).mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') { const id = path.split('/').at(-2); const item = savedNotifications.find((notification) => notification.id === id); if (item) item.read = true; return { ok: true, json: async () => ({ success: true }) }; }
      return { ok: true, json: async () => ({ success: true, data: savedNotifications }) };
    });
  });

  it('loads unread count, marks an item read through the existing API, and navigates to its workflow', async () => {
    const navigate = jest.fn();
    render(<FacultyNotificationsProvider isDemo={false} onNavigate={navigate}><FacultyNotificationBell onNavigate={navigate} /><FacultyNotificationsPage /></FacultyNotificationsProvider>);
    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
    expect((await screen.findAllByText('Assignment update')).length).toBeGreaterThan(0);
    expect(apiClient.fetch).not.toHaveBeenCalledWith(expect.stringMatching(/\/read$/), expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith('/api/v1/faculty/dashboard/notifications/n1/read', { method: 'PATCH' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh notifications' }));
    expect(await screen.findByText('0 unread')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open workflow' })[0]);
    expect(navigate).toHaveBeenCalledWith('assignments');
  });

  it('filters read and unread items', async () => {
    render(<FacultyNotificationsProvider isDemo={false} onNavigate={jest.fn()}><FacultyNotificationsPage /></FacultyNotificationsProvider>);
    expect(await screen.findByText('A student submitted an assignment.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Read' }));
    expect(screen.queryByText('A student submitted an assignment.')).not.toBeInTheDocument();
    expect(screen.getByText('A student responded to your survey.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unread' }));
    expect(screen.getByText('A student submitted an assignment.')).toBeInTheDocument();
  });

  it('shows an API error and supports retry and empty states', async () => {
    (apiClient.fetch as jest.Mock).mockImplementationOnce(async () => { throw new Error('Service unavailable'); }).mockImplementationOnce(async () => ({ ok: true, json: async () => ({ success: true, data: [] }) }));
    render(<FacultyNotificationsProvider isDemo={false} onNavigate={jest.fn()}><FacultyNotificationsPage /></FacultyNotificationsProvider>);
    expect(await screen.findByText('Service unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
  });
});
