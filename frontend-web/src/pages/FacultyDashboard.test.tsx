import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FacultyDashboard from './FacultyDashboard';

jest.mock('../components/DashboardLayout', () => ({ __esModule: true, default: ({ children, facultyNavigation, onTabChange }: any) => <div>
  {facultyNavigation.flatMap((group: any) => group.items).map((item: any) => <button key={item.id} onClick={() => onTabChange(item.id)}>{item.label}</button>)}
  <button onClick={() => onTabChange('department-enrollment')}>Try stale enrollment link</button>{children}
</div> }));
jest.mock('../context/FacultyDemoContext', () => ({ FacultyDemoProvider: ({ children }: any) => children }));
jest.mock('../components/dashboard/FacultyHome', () => ({ __esModule: true, default: () => <div>Overview page</div> }));
jest.mock('../components/dashboard/UserProfile', () => ({ __esModule: true, default: () => <div>Profile page</div> }));
jest.mock('../components/dashboard/QuizManagement', () => ({ __esModule: true, default: () => <div>Quizzes page</div> }));
jest.mock('../components/dashboard/StudentReports', () => ({ StudentReports: () => <div>Reports page</div> }));
jest.mock('../components/dashboard/AssignmentManagement', () => ({ __esModule: true, default: () => <div>Assignments page</div> }));
jest.mock('../components/dashboard/FacultyStudentsDirectory', () => ({ __esModule: true, default: () => <div>Students directory page</div> }));
jest.mock('../components/dashboard/FacultyCommandPalette', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/dashboard/QuestionBank', () => ({ __esModule: true, default: () => <div>Question Bank page</div> }));
jest.mock('../components/dashboard/QuestionPaperManagement', () => ({ __esModule: true, default: () => <div>Question Papers page</div> }));
jest.mock('../components/dashboard/FacultyManagement', () => ({ __esModule: true, default: () => <div>Faculty Management page</div> }));
jest.mock('../components/dashboard/FacultyNotifications', () => ({
  FacultyNotificationsProvider: ({ children }: any) => children,
  FacultyNotificationsPage: () => <div>Notifications page</div>,
}));

describe('faculty dashboard navigation', () => {
  beforeEach(() => localStorage.setItem('cira_user', JSON.stringify({ role: 'FACULTY' })));

  it.each([
    ['Question Bank', 'Question Bank page'],
    ['Student Directory', 'Students directory page'],
    ['Notifications', 'Notifications page'],
  ])('%s opens its real dashboard page', (label, page) => {
    render(
      <MemoryRouter>
        <FacultyDashboard />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(screen.getByText(page)).toBeInTheDocument();
  });

  it('redirects stale enrollment tab navigation to Overview', () => {
    render(
      <MemoryRouter>
        <FacultyDashboard />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try stale enrollment link' }));
    expect(screen.getByText('Overview page')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Department Enrollment/i })).not.toBeInTheDocument();
  });

  it('preserves the active tab from the URL on refresh (e.g. ?tab=quizzes)', () => {
    render(
      <MemoryRouter initialEntries={['/faculty/dashboard?tab=quizzes']}>
        <FacultyDashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('Quizzes page')).toBeInTheDocument();
    expect(screen.queryByText('Overview page')).not.toBeInTheDocument();
  });

  it('falls back to Overview when an invalid tab query param is in the URL', () => {
    render(
      <MemoryRouter initialEntries={['/faculty/dashboard?tab=nonexistent-tab']}>
        <FacultyDashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('Overview page')).toBeInTheDocument();
  });

  it('completely removes Administration dock items from navigation for FACULTY users', () => {
    localStorage.setItem('cira_user', JSON.stringify({ role: 'FACULTY' }));
    render(
      <MemoryRouter initialEntries={['/faculty/dashboard']}>
        <FacultyDashboard />
      </MemoryRouter>
    );

    // Admin controls must NOT exist for faculty
    expect(screen.queryByRole('button', { name: 'Faculty Approvals' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'User Management' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Departments' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Faculty Management' })).not.toBeInTheDocument();

    // Faculty assessment items must be present
    expect(screen.getByRole('button', { name: 'Quizzes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assignments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Question Bank' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Question Papers' })).toBeInTheDocument();
  });

  it('redirects FACULTY users away from admin tabs to Overview', () => {
    localStorage.setItem('cira_user', JSON.stringify({ role: 'FACULTY' }));
    render(
      <MemoryRouter initialEntries={['/faculty/dashboard?tab=approvals']}>
        <FacultyDashboard />
      </MemoryRouter>
    );

    expect(screen.queryByText('Faculty Management page')).not.toBeInTheDocument();
    expect(screen.getByText('Overview page')).toBeInTheDocument();
  });

  it('completely removes the Assessments dock from navigation for ADMIN users', () => {
    localStorage.setItem('cira_user', JSON.stringify({ role: 'ADMIN' }));
    render(
      <MemoryRouter initialEntries={['/faculty/dashboard']}>
        <FacultyDashboard />
      </MemoryRouter>
    );

    // Assessments dock items must not exist in admin navigation
    expect(screen.queryByRole('button', { name: 'Quizzes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assignments' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Question Bank' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Question Papers' })).not.toBeInTheDocument();

    // Administration items and Workspace must be present
    expect(screen.getByRole('button', { name: 'Faculty Approvals' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'User Management' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Departments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('Faculty Management page')).toBeInTheDocument();
  });

  it('redirects ADMIN users away from assessment tabs to Faculty Management', () => {
    localStorage.setItem('cira_user', JSON.stringify({ role: 'ADMIN' }));
    render(
      <MemoryRouter initialEntries={['/faculty/dashboard?tab=quizzes']}>
        <FacultyDashboard />
      </MemoryRouter>
    );

    expect(screen.queryByText('Quizzes page')).not.toBeInTheDocument();
    expect(screen.getByText('Faculty Management page')).toBeInTheDocument();
  });
});
