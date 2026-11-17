import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

const LoginProbe = () => {
  const location = useLocation();
  return (
    <div>
      <h1>Login Screen</h1>
      <div data-testid="login-search">{location.search}</div>
    </div>
  );
};

const renderProtectedRoute = (initialPath = '/admin/dashboard') => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<h1>Login Screen</h1>} />
        <Route path="/admin/dashboard" element={<h1>Admin Dashboard</h1>} />
        <Route
          path="/faculty/dashboard"
          element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <h1>Faculty Dashboard</h1>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  it('redirects guests to the login page while preserving the requested URL', () => {
    render(
      <MemoryRouter initialEntries={['/faculty/dashboard?tab=quizzes&view=submissions&quizId=q1']}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route
            path="/faculty/dashboard"
            element={
              <ProtectedRoute allowedRoles={['FACULTY']}>
                <h1>Faculty Dashboard</h1>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /login screen/i })).toBeInTheDocument();
    expect(screen.getByTestId('login-search').textContent).toBe(
      `?redirect=${encodeURIComponent('/faculty/dashboard?tab=quizzes&view=submissions&quizId=q1')}`
    );
  });

  it('renders the page when the logged-in user has the right role', () => {
    localStorage.setItem('cira_token', 'valid-token');
    localStorage.setItem(
      'cira_user',
      JSON.stringify({ role: 'FACULTY', approvalStatus: 'APPROVED' })
    );

    renderProtectedRoute('/faculty/dashboard');

    expect(screen.getByRole('heading', { name: /faculty dashboard/i })).toBeInTheDocument();
  });

  it('redirects logged-in users away from pages for a different role', () => {
    localStorage.setItem('cira_token', 'valid-token');
    localStorage.setItem(
      'cira_user',
      JSON.stringify({ role: 'ADMIN', approvalStatus: 'APPROVED' })
    );

    renderProtectedRoute('/faculty/dashboard');

    expect(screen.getByRole('heading', { name: /admin dashboard/i })).toBeInTheDocument();
  });

  it('shows pending approval messaging for faculty accounts waiting on admin approval', () => {
    localStorage.setItem('cira_token', 'valid-token');
    localStorage.setItem(
      'cira_user',
      JSON.stringify({ role: 'FACULTY', approvalStatus: 'PENDING' })
    );

    renderProtectedRoute('/faculty/dashboard');

    expect(screen.getByText(/account pending approval/i)).toBeInTheDocument();
  });
});
