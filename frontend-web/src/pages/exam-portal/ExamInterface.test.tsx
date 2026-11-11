import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ExamInterface from './ExamInterface';
import { apiClient } from '../../lib/apiClient';

jest.mock('../../lib/apiClient', () => ({
  apiClient: {
    fetch: jest.fn(),
  },
}));

const mockQuizData = {
  status: 'success',
  data: {
    attempt: {
      id: 'attempt-123',
      startTime: new Date().toISOString(),
      responses: [],
    },
    quiz: {
      id: 'quiz-1',
      title: 'Advanced Mathematics Exam',
      subject: 'Mathematics',
      durationMinutes: 60,
      questions: [
        {
          id: 'q1',
          type: 'MCQ',
          text: 'What is 2 + 2?',
          marks: 2,
          options: ['3', '4', '5'],
        },
        {
          id: 'q2',
          type: 'NUMERICAL',
          text: 'Value of pi to 2 decimals?',
          marks: 3,
        },
      ],
    },
  },
};

describe('ExamInterface - Screen Blackout Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockQuizData,
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={['/exam-portal/take/quiz-1']}>
        <Routes>
          <Route path="/exam-portal/take/:quizId" element={<ExamInterface />} />
          <Route path="/exam-portal" element={<div>Portal Home</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders instructions screen before starting secure exam', async () => {
    renderComponent();

    expect(await screen.findByText('Secure Exam Environment')).toBeInTheDocument();
    expect(screen.getByText('Start Secure Exam')).toBeInTheDocument();
    expect(screen.getByText(/Zero tolerance/i)).toBeInTheDocument();
  });

  it('mounts blackout overlay and content wrapper once secure exam begins', async () => {
    renderComponent();

    const startBtn = await screen.findByText('Start Secure Exam');
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText('Advanced Mathematics Exam')).toBeInTheDocument();
      expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    });

    const blackoutLayer = document.getElementById('quiz-secure-blackout');
    const contentLayer = document.getElementById('quiz-secure-content');

    expect(blackoutLayer).toBeInTheDocument();
    expect(contentLayer).toBeInTheDocument();
  });

  it('preserves answer selection and navigates questions normally', async () => {
    renderComponent();

    const startBtn = await screen.findByText('Start Secure Exam');
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    });

    // Select option "4"
    const option = screen.getByLabelText('4');
    fireEvent.click(option);
    expect(option).toBeChecked();

    // Click "Save & Next"
    const nextBtn = screen.getByText('Save & Next');
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText('Value of pi to 2 decimals?')).toBeInTheDocument();
    });
  });
});

