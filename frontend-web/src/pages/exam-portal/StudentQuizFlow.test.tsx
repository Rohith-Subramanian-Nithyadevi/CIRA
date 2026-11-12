import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';
import StudentDashboard from '../StudentDashboard';
import ExamInterface from './ExamInterface';
import { apiClient } from '@/lib/apiClient';

jest.mock('@/lib/apiClient', () => ({
  apiClient: { fetch: jest.fn() },
}));

jest.mock('../../hooks/useSecureExam', () => ({
  useSecureExam: () => ({
    isFullscreen: true,
    enterFullscreen: jest.fn(async () => {}),
  }),
}));

jest.mock('@/components/DashboardLayout', () => ({
  __esModule: true,
  default: ({ children, activeTab, onTabChange }: { children: React.ReactNode; activeTab: string; onTabChange: (tab: string) => void }) => (
    <div>
      <span data-testid="active-tab">{activeTab}</span>
      <button type="button" onClick={() => onTabChange('quizzes')}>
        Quizzes
      </button>
      {children}
    </div>
  ),
}));

jest.mock('@/components/dashboard/UserProfile', () => ({ __esModule: true, default: () => <div>Profile</div> }));
jest.mock('@/components/dashboard/StudentSpace', () => ({ __esModule: true, default: () => <div>Home Space</div> }));
jest.mock('@/components/student/StudentAnnouncements', () => ({ __esModule: true, default: () => <div>Announcements</div> }));
jest.mock('@/components/student/ResourceHub', () => ({ __esModule: true, default: () => <div>Resources</div> }));
jest.mock('@/components/student/StudentAnalytics', () => ({ __esModule: true, default: () => <div>Analytics</div> }));
jest.mock('@/components/student/TopicPerformance', () => ({ __esModule: true, default: () => <div>Topics</div> }));
jest.mock('@/components/student/GoalTracker', () => ({ __esModule: true, default: () => <div>Goals</div> }));

describe('Simplified Student Quiz Navigation Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('cira_user', JSON.stringify({ id: 'student-1', name: 'Asha', role: 'STUDENT' }));
  });

  it('navigates directly from Quizzes -> Start Quiz -> Instructions -> Begin Quiz -> Actual Quiz and supports Back', async () => {
    (apiClient.fetch as jest.Mock).mockImplementation(async (path: string, opts?: any) => {
      if (path === '/api/v1/student/exam/eligible') {
        return {
          ok: true,
          json: async () => ({
            status: 'success',
            data: [
              {
                id: 'quiz-os-1',
                title: 'OS Processes Quiz',
                subject: 'Operating Systems',
                durationMinutes: 45,
                totalMarks: 20,
                startDate: new Date(Date.now() - 60_000).toISOString(),
                endDate: new Date(Date.now() + 3_600_000).toISOString(),
                attempts: [],
              },
            ],
          }),
        };
      }
      if (path === '/api/v1/student/dashboard') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              pastQuizzes: [
                { id: 'att-0', quizId: 'quiz-prev', title: 'Previous DBMS Quiz', answersPublished: false, submittedAt: new Date().toISOString() },
              ],
            },
          }),
        };
      }
      if (path === '/api/v1/student/exam/instructions/quiz-os-1') {
        return {
          ok: true,
          json: async () => ({
            status: 'success',
            data: {
              quiz: {
                id: 'quiz-os-1',
                title: 'OS Processes Quiz',
                subject: 'Operating Systems',
                durationMinutes: 45,
                totalMarks: 20,
                passingMarks: 8,
                questionCount: 1,
                description: 'Attempt all questions carefully.',
              },
            },
          }),
        };
      }
      if (path === '/api/v1/student/exam/start/quiz-os-1' && opts?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            status: 'success',
            data: {
              attempt: { id: 'attempt-1', startTime: new Date().toISOString(), responses: [] },
              quiz: {
                id: 'quiz-os-1',
                title: 'OS Processes Quiz',
                subject: 'Operating Systems',
                durationMinutes: 45,
                questions: [
                  { id: 'q-1', type: 'MCQ', text: 'What is a process?', marks: 5, options: ['Program in execution', 'Disk file'] },
                ],
              },
            },
          }),
        };
      }
      return { ok: true, json: async () => ({ status: 'success', data: {} }) };
    });

    render(
      <MemoryRouter initialEntries={['/student/dashboard']}>
        <Routes>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/exam-portal" element={<Navigate to="/student/dashboard?tab=quizzes" replace />} />
          <Route path="/exam-portal/take/:quizId" element={<ExamInterface />} />
        </Routes>
      </MemoryRouter>
    );

    // Step 1 & 2: Enter Quizzes tab and see Active + Attended quizzes (no intermediate portal button)
    fireEvent.click(screen.getByRole('button', { name: 'Quizzes' }));
    expect(await screen.findByText('OS Processes Quiz')).toBeInTheDocument();
    expect(screen.getByText('Previous DBMS Quiz')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Go to Exam Portal/i })).not.toBeInTheDocument();

    // Step 3: Click Start Quiz -> goes directly to Instructions (not a second quiz list)
    fireEvent.click(screen.getByRole('button', { name: /Start Quiz/i }));

    expect(await screen.findByText('Attempt all questions carefully.')).toBeInTheDocument();
    expect(screen.getByText(/Important Instructions/i)).toBeInTheDocument();
    expect(screen.queryByText('Active Examinations')).not.toBeInTheDocument();

    // Ensure /start was NOT prematurely triggered before clicking Begin Quiz
    expect(apiClient.fetch).not.toHaveBeenCalledWith('/api/v1/student/exam/start/quiz-os-1', expect.anything());

    // Step 4 (Back Navigation): Clicking Back to Quizzes returns directly to Quizzes listing tab
    fireEvent.click(screen.getByRole('button', { name: /Back to Quizzes/i }));
    expect(await screen.findByTestId('active-tab')).toHaveTextContent('quizzes');
    expect(await screen.findByText('OS Processes Quiz')).toBeInTheDocument();

    // Go back to Instructions and click Begin Quiz -> Actual Quiz opens
    fireEvent.click(screen.getByRole('button', { name: /Start Quiz/i }));
    expect(await screen.findByText('Attempt all questions carefully.')).toBeInTheDocument();
    const beginBtn = screen.getByRole('button', { name: /Begin Quiz/i });
    expect(beginBtn).not.toBeDisabled();
    fireEvent.click(beginBtn);

    expect(await screen.findByText('What is a process?')).toBeInTheDocument();
    expect(screen.getByText('Question Palette')).toBeInTheDocument();
  });

  it('supports direct URL refresh on Instructions page and blocks unavailable or submitted quizzes', async () => {
    (apiClient.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        status: 'error',
        error: { code: 'ALREADY_SUBMITTED', message: 'You have already submitted this quiz.' },
      }),
    });

    render(
      <MemoryRouter initialEntries={['/exam-portal/take/quiz-submitted']}>
        <Routes>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/exam-portal/take/:quizId" element={<ExamInterface />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Quiz Unavailable')).toBeInTheDocument();
    expect(screen.getByText('You have already submitted this quiz.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Begin Quiz/i })).not.toBeInTheDocument();
  });
});
