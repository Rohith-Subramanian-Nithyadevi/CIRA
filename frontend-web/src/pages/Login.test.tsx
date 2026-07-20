import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from './Login';

const renderLogin = () => {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/student/dashboard" element={<h1>Student Dashboard</h1>} />
        <Route path="/faculty/dashboard" element={<h1>Faculty Dashboard</h1>} />
        <Route path="/admin/dashboard" element={<h1>Admin Dashboard</h1>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Login', () => {
  it('stores the logged-in user and sends them to the correct dashboard', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { departments: [] } }),
    } as Response);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          token: 'student-token',
          user: {
            id: 'student-1',
            name: 'Student One',
            role: 'STUDENT',
            approvalStatus: 'APPROVED',
          },
        },
      }),
    } as Response);

    renderLogin();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await userEvent.type(screen.getByLabelText(/your username or email/i), 'student@amrita.edu');
    await userEvent.type(screen.getByLabelText(/^your password$/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByRole('heading', { name: /student dashboard/i })).toBeInTheDocument();
    expect(localStorage.getItem('cira_token')).toBe('student-token');
    expect(JSON.parse(localStorage.getItem('cira_user') || '{}')).toMatchObject({
      id: 'student-1',
      role: 'STUDENT',
    });
  });

  it('shows the backend error message when login fails', async () => {
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { departments: [] } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' }),
      } as Response);

    renderLogin();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    await userEvent.type(screen.getByLabelText(/your username or email/i), 'wrong@amrita.edu');
    await userEvent.type(screen.getByLabelText(/^your password$/i), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /^log in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
