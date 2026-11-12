import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ExamResults from './ExamResults';
import StudentDashboard from '../StudentDashboard';
import { apiClient } from '@/lib/apiClient';

jest.mock('@/lib/apiClient', () => ({
  apiClient: { fetch: jest.fn() },
}));

jest.mock('@/components/DashboardLayout', () => ({
  __esModule: true,
  default: ({ children, onTabChange }: { children: React.ReactNode; onTabChange?: (tab: string) => void }) => (
    <div>
      <button type="button" onClick={() => onTabChange?.('quizzes')}>
        Quizzes Tab
      </button>
      {children}
    </div>
  ),
}));

jest.mock('@/components/dashboard/UserProfile', () => ({
  __esModule: true,
  default: () => <div>User Profile</div>,
}));

jest.mock('@/components/dashboard/StudentSpace', () => ({
  __esModule: true,
  default: () => <div>Student Space</div>,
}));

jest.mock('@/components/student/StudentAnnouncements', () => ({
  __esModule: true,
  default: () => <div>Student Announcements</div>,
}));

jest.mock('@/components/student/ResourceHub', () => ({
  __esModule: true,
  default: () => <div>Resource Hub</div>,
}));

jest.mock('@/components/student/StudentAnalytics', () => ({
  __esModule: true,
  default: () => <div>Student Analytics</div>,
}));

jest.mock('@/components/student/TopicPerformance', () => ({
  __esModule: true,
  default: () => <div>Topic Performance</div>,
}));

jest.mock('@/components/student/GoalTracker', () => ({
  __esModule: true,
  default: () => <div>Goal Tracker</div>,
}));

describe('Student Answer Publication Visibility (ExamResults & StudentDashboard)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(
      'cira_user',
      JSON.stringify({
        id: 'student-1',
        name: 'Asha Student',
        role: 'STUDENT',
        rollNumber: '24CS001',
      })
    );
  });

  it('shows blocked message when ExamResults API rejects unpublished results', async () => {
    let resolveBlocked!: (value: any) => void;
    (apiClient.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveBlocked = resolve;
        })
    );

    render(
      <MemoryRouter initialEntries={['/exam-portal/results/quiz-1']}>
        <Routes>
          <Route path="/exam-portal/results/:quizId" element={<ExamResults />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Loading quiz results\.\.\./i)).toBeInTheDocument();

    resolveBlocked({
      ok: false,
      status: 403,
      json: async () => ({
        status: 'error',
        message: 'Results and answers are not published yet.',
      }),
    });

    await waitFor(() => {
      expect(screen.getByText(/Results and answers are not published yet\./i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Marks/i)).not.toBeInTheDocument();
  });

  it('renders MCQ, Match the Following, Fill in the Blanks, image, and marks awarded once answers are published', async () => {
    (apiClient.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        data: {
          id: 'att-1',
          status: 'SUBMITTED',
          totalScore: 10,
          objectiveScore: 10,
          writtenScore: 0,
          quiz: {
            id: 'quiz-1',
            title: 'DBMS Final Review',
            subject: 'Database Systems',
            totalMarks: 10,
            questions: [
              {
                id: 'q-mcq',
                type: 'MCQ',
                text: 'Which normal form removes transitive dependency?',
                marks: 2,
                answerKey: '3NF',
                image: 'https://example.com/er-diagram.png',
              },
              {
                id: 'q-match',
                type: 'MATCHING',
                text: 'Match SQL commands to categories',
                marks: 4,
                answerKey: [
                  { left: 'SELECT', right: 'DQL' },
                  { left: 'CREATE', right: 'DDL' },
                ],
              },
              {
                id: 'q-blank',
                type: 'FILL_BLANK',
                text: 'A ____ uniquely identifies a row, and ____ enforces referential integrity.',
                marks: 4,
                answerKey: ['Primary Key', 'Foreign Key'],
              },
            ],
          },
          responses: [
            {
              id: 'r-1',
              questionId: 'q-mcq',
              answerData: '3NF',
              marksAwarded: 2,
            },
            {
              id: 'r-2',
              questionId: 'q-match',
              answerData: [
                { left: 'SELECT', right: 'DQL' },
                { left: 'CREATE', right: 'DDL' },
              ],
              marksAwarded: 4,
            },
            {
              id: 'r-3',
              questionId: 'q-blank',
              answerData: ['primary key', 'foreign key'],
              marksAwarded: 4,
            },
          ],
        },
      }),
    });

    render(
      <MemoryRouter initialEntries={['/exam-portal/results/quiz-1']}>
        <Routes>
          <Route path="/exam-portal/results/:quizId" element={<ExamResults />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/DBMS Final Review/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Which normal form removes transitive dependency\?/i)).toBeInTheDocument();
    expect(screen.getByAltText(/Question 1/i)).toHaveAttribute('src', 'https://example.com/er-diagram.png');
    expect(screen.getAllByText(/SELECT -> DQL/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Blank 1: primary key/)).toBeInTheDocument();
    expect(screen.getByText(/Blank 1: Primary Key/)).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 2 Marks/i)).toBeInTheDocument();
    expect(screen.getAllByText(/4 \/ 4 Marks/i).length).toBe(2);
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(2);
  });

  it('StudentDashboard hides unpublished scores and reveals published scores', async () => {
    (apiClient.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/v1/student/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              performanceTrajectory: [],
              knowledgeDeficits: [],
              assignments: [],
              pastQuizzes: [
                {
                  quizId: 'quiz-hidden',
                  title: 'Hidden Score Quiz',
                  subject: 'Networks',
                  status: 'Submitted Successfully',
                  answersPublished: false,
                  totalMarks: 20,
                  totalScore: null,
                  objectiveScore: null,
                  writtenScore: null,
                  grade: null,
                  facultyFeedback: null,
                  endTime: '2026-11-11T10:00:00.000Z',
                },
                {
                  quizId: 'quiz-shown',
                  title: 'Published Score Quiz',
                  subject: 'DBMS',
                  status: 'EVALUATED',
                  answersPublished: true,
                  totalMarks: 20,
                  totalScore: 18,
                  objectiveScore: 14,
                  writtenScore: 4,
                  grade: 'A',
                  facultyFeedback: 'Solid conceptual clarity',
                  endTime: '2026-11-10T10:00:00.000Z',
                },
              ],
            },
          }),
        });
      }
      if (url.includes('/api/v1/student/exam/eligible')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'quiz-hidden',
                title: 'Hidden Score Quiz',
                subject: 'Networks',
                durationMinutes: 30,
                totalMarks: 20,
                answersPublished: false,
                startTime: '2026-11-11T09:00:00.000Z',
                endTime: '2026-11-11T12:00:00.000Z',
                attempts: [{ id: 'a1', status: 'SUBMITTED' }],
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });

    render(
      <MemoryRouter initialEntries={['/student/dashboard']}>
        <StudentDashboard />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Quizzes Tab/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Hidden Score Quiz/i).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/Submitted Successfully/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Published Score Quiz/i)).toBeInTheDocument();
    expect(screen.getByText(/18 \/ 20/i)).toBeInTheDocument();
    expect(screen.getByText(/Solid conceptual clarity/i)).toBeInTheDocument();
  });
});
