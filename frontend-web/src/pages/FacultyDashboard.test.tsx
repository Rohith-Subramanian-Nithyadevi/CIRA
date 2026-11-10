import { fireEvent, render, screen } from '@testing-library/react';
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
    render(<FacultyDashboard />);
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(screen.getByText(page)).toBeInTheDocument();
  });

  it('redirects stale enrollment tab navigation to Overview', () => {
    render(<FacultyDashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'Try stale enrollment link' }));
    expect(screen.getByText('Overview page')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Department Enrollment/i })).not.toBeInTheDocument();
  });
});
