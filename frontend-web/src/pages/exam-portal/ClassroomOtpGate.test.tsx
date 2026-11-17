import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ExamInterface from './ExamInterface';
import { apiClient } from '@/lib/apiClient';

const mockSecureExamState = {
  isFullscreen: true,
  isBlackScreen: false,
  isLocked: false,
  enterFullscreen: jest.fn(async () => ({ ok: true })),
};

jest.mock('../../hooks/useSecureExam', () => ({
  useSecureExam: () => mockSecureExamState,
  isMultiDisplayDetected: jest.fn(() => false),
  isFullscreenSupported: jest.fn(() => true),
}));

jest.mock('../../hooks/useBehavioralTelemetry', () => ({
  useBehavioralTelemetry: () => ({
    notifyQuestionRendered: jest.fn(),
    recordOptionSelect: jest.fn(),
    recordTextChange: jest.fn(),
    recordNavigation: jest.fn(),
    getIntegrityReport: jest.fn(() => ({})),
  }),
}));

jest.mock('../../components/exam/CanvasQuestion', () => ({
  CanvasQuestion: ({ text }: { text: string }) => <div data-testid="canvas-question">{text}</div>,
}));

jest.mock('@/lib/apiClient', () => ({
  apiClient: {
    fetch: jest.fn(),
  },
}));

describe('Classroom OTP Gate & Single-Session Proctoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockSecureExamState.isFullscreen = true;
    mockSecureExamState.isBlackScreen = false;
    mockSecureExamState.isLocked = false;
    mockSecureExamState.enterFullscreen = jest.fn(async () => ({ ok: true }));
  });

  it('arms proctoring immediately on Begin Quiz and gates student behind Classroom OTP before questions appear', async () => {
    const quizId = 'quiz-otp-1';

    (apiClient.fetch as jest.Mock).mockImplementation(async (path: string, opts?: any) => {
      if (path === `/api/v1/student/exam/instructions/${quizId}`) {
        return {
          ok: true,
          json: async () => ({
            status: 'success',
            data: {
              quiz: {
                id: quizId,
                title: 'Data Structures Exam',
                subject: 'Computer Science',
                durationMinutes: 30,
                totalMarks: 50,
                description: 'Enter classroom OTP to begin.',
              },
            },
          }),
        };
      }

      if (path === `/api/v1/student/exam/start/${quizId}` && opts?.method === 'POST') {
        // Backend returns otpRequired: true, questions: []
        return {
          ok: true,
          json: async () => ({
            status: 'success',
            data: {
              attempt: { id: 'attempt-otp-1', startTime: new Date().toISOString() },
              otpRequired: true,
              quiz: {
                id: quizId,
                title: 'Data Structures Exam',
                subject: 'Computer Science',
                questions: [],
              },
            },
          }),
        };
      }

      if (path === `/api/v1/student/exam/verify-otp/${quizId}` && opts?.method === 'POST') {
        const body = JSON.parse(opts.body);
        if (body.otp === '739204') {
          return {
            ok: true,
            json: async () => ({
              status: 'success',
              data: {
                otpVerified: true,
                attemptSessionToken: 'session-token-xyz-123',
                attempt: { id: 'attempt-otp-1', startTime: new Date().toISOString() },
                quiz: {
                  id: quizId,
                  title: 'Data Structures Exam',
                  durationMinutes: 30,
                  questions: [
                    { id: 'q-otp-1', type: 'MCQ', text: 'What is a binary search tree?', marks: 5, options: ['A tree', 'A graph'] },
                  ],
                },
              },
            }),
          };
        } else {
          return {
            ok: false,
            status: 400,
            json: async () => ({
              status: 'error',
              message: 'Invalid or expired OTP. Please check the screen.',
            }),
          };
        }
      }

      return { ok: true, json: async () => ({ status: 'success', data: {} }) };
    });

    render(
      <MemoryRouter initialEntries={[`/exam-portal/take/${quizId}`]}>
        <Routes>
          <Route path="/exam-portal/take/:quizId" element={<ExamInterface />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for instructions screen
    expect(await screen.findByText('Data Structures Exam')).toBeInTheDocument();

    // Confirm background apps checkbox
    const confirmCheckbox = screen.getByLabelText(/I confirm that I have closed all background applications/i);
    fireEvent.click(confirmCheckbox);

    // Click Begin Quiz
    const beginBtn = screen.getByRole('button', { name: /Begin Quiz/i });
    fireEvent.click(beginBtn);

    // Fullscreen and proctoring must be armed, and OTP Gate must appear
    expect(mockSecureExamState.enterFullscreen).toHaveBeenCalled();
    expect(await screen.findByTestId('classroom-otp-gate')).toBeInTheDocument();
    expect(screen.getByText('Live Presence Verification')).toBeInTheDocument();
    expect(screen.getByText('Classroom Access Code')).toBeInTheDocument();
    expect(screen.queryByText('What is a binary search tree?')).not.toBeInTheDocument();

    // 1. Enter invalid OTP
    const otpInput = screen.getByTestId('classroom-otp-input');
    fireEvent.change(otpInput, { target: { value: '111222' } });

    const verifyBtn = screen.getByTestId('verify-otp-btn');
    fireEvent.click(verifyBtn);

    // Inline error appears without leaving fullscreen
    expect(await screen.findByTestId('classroom-otp-error')).toBeInTheDocument();
    expect(screen.getByText('Invalid or expired OTP. Please check the screen.')).toBeInTheDocument();
    expect(screen.getByTestId('classroom-otp-gate')).toBeInTheDocument();

    // 2. Enter valid OTP (allowing spaces like 739 204)
    fireEvent.change(otpInput, { target: { value: '739204' } });
    fireEvent.click(verifyBtn);

    // Question content is unlocked, OTP gate dismissed, and session token stored
    expect(await screen.findByText('What is a binary search tree?')).toBeInTheDocument();
    expect(screen.queryByTestId('classroom-otp-gate')).not.toBeInTheDocument();
    expect(sessionStorage.getItem(`cira_session_${quizId}`)).toBe('session-token-xyz-123');
  });
});
