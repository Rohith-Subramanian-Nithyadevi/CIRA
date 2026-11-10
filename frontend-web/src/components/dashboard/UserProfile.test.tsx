import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UserProfile from './UserProfile';
import { apiClient } from '@/lib/apiClient';
import { ThemeProvider } from '@/context/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/apiClient', () => ({ apiClient: { fetch: jest.fn() }, getApiErrorMessage: (error: Error) => error.message }));

describe('role-specific user profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('cira_user', JSON.stringify({ role: 'FACULTY', name: 'Asha Rao', email: 'asha@ch.amrita.edu', department: { name: 'CSE' }, designation: 'Assistant Professor', approvalStatus: 'APPROVED' }));
    (apiClient.fetch as jest.Mock).mockImplementation(async (path: string) => path === '/api/v1/auth/me'
      ? ({ json: async () => ({ data: { user: JSON.parse(localStorage.getItem('cira_user')!) } }) })
      : ({ ok: true, json: async () => ({ success: true }) }));
  });

  it('shows faculty profile values as read-only and only offers password fields', async () => {
    render(<QueryClientProvider client={new QueryClient()}><ThemeProvider><UserProfile /></ThemeProvider></QueryClientProvider>);
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('asha@ch.amrita.edu')).toBeInTheDocument();
    expect(screen.getByText('CSE')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Profile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enroll/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    expect(screen.getByLabelText('Current Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('New Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Confirm New Password')).toHaveAttribute('type', 'password');
    expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument();
  });

  it('validates strength and confirmation, then sends only current and new password', async () => {
    render(<ThemeProvider><UserProfile /></ThemeProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Change Password' }));
    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'OldPassword1' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'weakpass' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'weakpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('uppercase letter');
    expect(apiClient.fetch).not.toHaveBeenCalledWith('/api/v1/faculty/profile', expect.anything());

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPassword1' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'Mismatch1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('do not match');

    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPassword1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith('/api/v1/faculty/profile', expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ currentPassword: 'OldPassword1', newPassword: 'NewPassword1' }),
    })));
    expect(await screen.findByRole('status')).toHaveTextContent('Password changed successfully');
  });

  it('leaves student profile editing behavior on the shared component', async () => {
    localStorage.setItem('cira_user', JSON.stringify({ role: 'STUDENT', name: 'Student One', email: 'student@example.test' }));
    render(<QueryClientProvider client={new QueryClient()}><ThemeProvider><UserProfile /></ThemeProvider></QueryClientProvider>);
    expect(await screen.findByRole('button', { name: 'Edit Profile' })).toBeInTheDocument();
  });
});
