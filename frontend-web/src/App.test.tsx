import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

jest.mock('./pages/LandingPage', () => ({ __esModule: true, default: () => <div>Landing</div> }));
jest.mock('./pages/Login', () => ({ __esModule: true, default: () => <div>Login page</div> }));
jest.mock('./pages/AdminDashboard', () => ({ __esModule: true, default: () => <div>Admin dashboard</div> }));
jest.mock('./pages/FacultyDashboard', () => ({ __esModule: true, default: () => <div>Faculty dashboard</div> }));
jest.mock('./pages/StudentDashboard', () => ({ __esModule: true, default: () => <div>Student dashboard</div> }));
jest.mock('./pages/exam-portal/ExamInterface', () => ({ __esModule: true, default: () => <div>Exam interface</div> }));
jest.mock('./pages/exam-portal/ExamResults', () => ({ __esModule: true, default: () => <div>Exam results</div> }));

it('redirects direct faculty enrollment navigation to the faculty dashboard', async () => {
  localStorage.setItem('cira_token', 'faculty-token');
  localStorage.setItem('cira_user', JSON.stringify({ role: 'FACULTY', approvalStatus: 'APPROVED' }));
  window.history.pushState({}, '', '/faculty/enrollment');
  render(<App />);
  expect(await screen.findByText('Faculty dashboard')).toBeInTheDocument();
  await waitFor(() => expect(window.location.pathname).toBe('/faculty/dashboard'));
});
