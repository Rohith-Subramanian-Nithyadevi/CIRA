import { fireEvent, render, screen, within } from '@testing-library/react';
import QuizManagement from './QuizManagement';
import { apiClient } from '@/lib/apiClient';

jest.mock('@/lib/apiClient', () => ({
  apiClient: { fetch: jest.fn() },
}));

const mockBatches = [
  { id: 'batch-2024', name: '2024-2028', startYear: 2024 }
];

const mockDepartments = [
  {
    id: 'dept-cse',
    name: 'Computer Science',
    batchId: 'batch-2024',
    sections: [
      { id: 'sec-a', name: 'Section A' },
      { id: 'sec-b', name: 'Section B' }
    ]
  }
];

describe('QuizManagement hierarchical target audience & question types', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('cira_user', JSON.stringify({
      id: 'faculty-1',
      name: 'Dr. Jane Smith',
      subject: 'Data Structures & Algorithms'
    }));

    (apiClient.fetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          json: async () => ({
            data: { user: { id: 'faculty-1', subject: 'Data Structures & Algorithms' } }
          })
        });
      }
      if (path.includes('/api/v1/batches')) {
        return Promise.resolve({
          json: async () => ({
            data: { batches: mockBatches }
          })
        });
      }
      if (path.includes('/api/v1/departments')) {
        return Promise.resolve({
          json: async () => ({
            data: { departments: mockDepartments }
          })
        });
      }
      if (path.includes('/api/v1/faculty/quiz?')) {
        return Promise.resolve({
          json: async () => ({
            data: { items: [], total: 0, page: 1, hasMore: false }
          })
        });
      }
      return Promise.resolve({ json: async () => ({ status: 'success', data: {} }) });
    });
  });

  it('cascades Batch -> Department -> Section and lists combined "Batch - Dept - Section" with removal', async () => {
    render(<QuizManagement />);

    const createBtn = await screen.findByRole('button', { name: /create new quiz/i });
    fireEvent.click(createBtn);

    const subjectInput = await screen.findByDisplayValue('Data Structures & Algorithms');
    expect(subjectInput).toHaveAttribute('readonly');

    fireEvent.change(screen.getByLabelText(/Quiz Title \*/i), { target: { value: 'Algorithms Quiz 1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i })); // Step 1 -> 2
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i })); // Step 2 -> 3
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i })); // Step 3 -> 4

    const batchDropdown = await screen.findByLabelText(/1\. Batch/i) as HTMLSelectElement;
    const deptDropdown = screen.getByLabelText(/2\. Department/i) as HTMLSelectElement;
    const secDropdown = screen.getByLabelText(/3\. Section/i) as HTMLSelectElement;
    expect(deptDropdown).toBeDisabled();
    expect(secDropdown).toBeDisabled();

    fireEvent.change(batchDropdown, { target: { value: 'batch-2024' } });
    expect(deptDropdown).not.toBeDisabled();

    fireEvent.change(deptDropdown, { target: { value: 'dept-cse' } });
    expect(secDropdown).not.toBeDisabled();

    fireEvent.change(secDropdown, { target: { value: 'sec-a' } });
    expect(screen.getByText('2024-2028 - Computer Science - Section A')).toBeInTheDocument();

    const removeBtn = screen.getByTitle('Remove target class');
    fireEvent.click(removeBtn);
    expect(screen.queryByText('2024-2028 - Computer Science - Section A')).not.toBeInTheDocument();
  });

  it('supports Match the Following and Fill in the Blanks in Manual Builder, Paste Textbox, and DOCX Template modal', async () => {
    render(<QuizManagement />);
    const createBtn = await screen.findByRole('button', { name: /create new quiz/i });
    fireEvent.click(createBtn);

    fireEvent.change(await screen.findByLabelText(/Quiz Title \*/i), { target: { value: 'Question Types Quiz' } });
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i })); // Step 1 -> 2
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i })); // Step 2 -> 3
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i })); // Step 3 -> 4
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i })); // Step 4 -> 5

    const templateBtn = await screen.findByRole('button', { name: /Download DOCX Template/i });
    fireEvent.click(templateBtn);
    const mixedCheckbox = await screen.findByLabelText(/Mixed Question Types/i);
    fireEvent.click(mixedCheckbox);
    expect(screen.getByText('Match the Following')).toBeInTheDocument();
    expect(screen.getByText('Fill in the Blanks')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Cancel/i }).pop()!);

    const matchCheckbox = screen.getByLabelText(/Match Following/i);
    const fillCheckbox = screen.getByLabelText(/Fill in Blanks/i);
    fireEvent.click(matchCheckbox);
    fireEvent.click(fillCheckbox);

    const matchArea = screen.getByPlaceholderText(/Match the data structures/i);
    const fillArea = screen.getByPlaceholderText(/The time complexity of binary search is \[blank\]/i);

    fireEvent.change(matchArea, {
      target: {
        value: '1. Match countries:\nFrance -> Paris\nJapan -> Tokyo'
      }
    });
    fireEvent.change(fillArea, {
      target: {
        value: '1. Water boils at [blank] degrees Celsius.\nAnswer: 100'
      }
    });

    const convertBtn = screen.getByRole('button', { name: /Convert into Questions & Review/i });
    fireEvent.click(convertBtn);

    expect(await screen.findByText(/Define Matching Pairs/i)).toBeInTheDocument();
    expect(screen.getByText(/Fill in the Blanks Configuration/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('France')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Paris')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });
});

describe('QuizManagement simplified actions and answer publication workflow', () => {
  const sampleQuiz = {
    id: 'quiz-1',
    title: 'Midterm OS Quiz',
    subject: 'Operating Systems',
    totalMarks: 20,
    answersPublished: false,
    startDate: null,
    endDate: null,
    _count: { questions: 5, attempts: 1 },
    targetDepartments: [],
    targetSections: []
  };

  const sampleSubmission = {
    id: 'attempt-1',
    quizId: 'quiz-1',
    status: 'EVALUATED',
    objectiveScore: 10,
    writtenScore: 6,
    totalScore: 16,
    startTime: '2026-11-11T10:00:00.000Z',
    endTime: '2026-11-11T10:30:00.000Z',
    violationReason: null,
    user: { name: 'Aarav Patel', rollNumber: '24CS001', email: 'aarav@cira.edu' },
    responses: [
      {
        id: 'resp-1',
        answerData: 'Round Robin',
        marksAwarded: 2,
        question: { id: 'q-1', type: 'MCQ', text: 'Which scheduler is preemptive?', marks: 2, answerKey: 'Round Robin' }
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('cira_user', JSON.stringify({
      id: 'faculty-1',
      name: 'Dr. Jane Smith',
      subject: 'Operating Systems'
    }));
  });

  it('shows only Edit, View Submissions, and Delete in the Action column and handles Delete confirmation', async () => {
    let quizzesList = [{ ...sampleQuiz }];

    (apiClient.fetch as jest.Mock).mockImplementation((path: string, opts?: any) => {
      if (path.includes('/api/v1/auth/me')) {
        return Promise.resolve({ json: async () => ({ data: { user: { id: 'faculty-1', subject: 'Operating Systems' } } }) });
      }
      if (path.includes('/api/v1/batches')) {
        return Promise.resolve({ json: async () => ({ data: { batches: mockBatches } }) });
      }
      if (path.includes('/api/v1/departments')) {
        return Promise.resolve({ json: async () => ({ data: { departments: mockDepartments } }) });
      }
      if (path.includes('/api/v1/faculty/quiz?')) {
        return Promise.resolve({ json: async () => ({ status: 'success', data: { items: quizzesList, total: quizzesList.length, page: 1, hasMore: false } }) });
      }
      if (path === '/api/v1/faculty/quiz/quiz-1' && opts?.method === 'DELETE') {
        quizzesList = [];
        return Promise.resolve({ json: async () => ({ status: 'success', message: 'Quiz deleted successfully' }) });
      }
      return Promise.resolve({ json: async () => ({ status: 'success', data: {} }) });
    });

    render(<QuizManagement />);

    expect(await screen.findByText('Midterm OS Quiz')).toBeInTheDocument();

    // Only Edit, View Submissions, Print, Delete must exist in a 2x2 Action grid
    const actionsGrid = screen.getByTestId('quiz-actions-grid');
    expect(actionsGrid).toHaveClass('grid', 'grid-cols-[auto_auto]');
    expect(within(actionsGrid).getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /^Edit$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^View Submissions$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Print$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Delete$/i })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Edit Details/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit Questions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Grade Submissions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish Answers/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hide Answers/i })).not.toBeInTheDocument();

    // Delete triggers double-confirmation dialog (type CONFIRM) and deletes quiz on final Delete click
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));
    const deleteDialog = await screen.findByRole('dialog');
    expect(within(deleteDialog).getByText(/Confirm Deletion/i)).toBeInTheDocument();
    const confirmDeleteBtn = within(deleteDialog).getByRole('button', { name: /^Delete$/i });
    expect(confirmDeleteBtn).toBeDisabled();
    const confirmInput = within(deleteDialog).getByPlaceholderText('Type CONFIRM to proceed');
    fireEvent.change(confirmInput, { target: { value: 'confirm' } });
    expect(confirmDeleteBtn).toBeDisabled();
    fireEvent.change(confirmInput, { target: { value: 'CONFIRM' } });
    expect(confirmDeleteBtn).not.toBeDisabled();
    fireEvent.click(confirmDeleteBtn);

    expect(await screen.findByText('No quizzes found')).toBeInTheDocument();
  });

  it('allows unified Edit of quiz details and questions when quiz has zero attempts', async () => {
    const editableQuiz = { ...sampleQuiz, totalMarks: 5, _count: { questions: 1, attempts: 0 } };
    let putBody: any = null;

    (apiClient.fetch as jest.Mock).mockImplementation((path: string, opts?: any) => {
      if (path.includes('/api/v1/auth/me')) {
        return Promise.resolve({ json: async () => ({ data: { user: { id: 'faculty-1', subject: 'Operating Systems' } } }) });
      }
      if (path.includes('/api/v1/batches')) {
        return Promise.resolve({ json: async () => ({ data: { batches: mockBatches } }) });
      }
      if (path.includes('/api/v1/departments')) {
        return Promise.resolve({ json: async () => ({ data: { departments: mockDepartments } }) });
      }
      if (path.includes('/api/v1/faculty/quiz?')) {
        return Promise.resolve({ json: async () => ({ status: 'success', data: { items: [editableQuiz], total: 1, page: 1, hasMore: false } }) });
      }
      if (path === '/api/v1/faculty/quiz/quiz-1' && (!opts || !opts.method)) {
        return Promise.resolve({
          json: async () => ({
            status: 'success',
            data: {
              ...editableQuiz,
              questions: [
                { id: 'q-1', type: 'MCQ', text: 'Old question?', marks: 5, options: ['A', 'B', 'C', 'D'], answerKey: 'A', topic: 'CPU' }
              ]
            }
          })
        });
      }
      if (path === '/api/v1/faculty/quiz/quiz-1' && opts?.method === 'PUT') {
        putBody = JSON.parse(opts.body);
        return Promise.resolve({ json: async () => ({ status: 'success', data: editableQuiz }) });
      }
      return Promise.resolve({ json: async () => ({ status: 'success', data: {} }) });
    });

    render(<QuizManagement />);
    const editBtn = await screen.findByRole('button', { name: /^Edit$/i });
    fireEvent.click(editBtn);

    expect(await screen.findByText('Edit Quiz')).toBeInTheDocument();
    const titleInput = screen.getByDisplayValue('Midterm OS Quiz');
    fireEvent.change(titleInput, { target: { value: 'Updated OS Quiz' } });

    // Jump to Step 5 via completed stepper in Edit mode
    fireEvent.click(screen.getByRole('button', { name: /5\. Add Questions/i }));

    const reviewQuestionsBtn = await screen.findByRole('button', { name: /Review & Edit Questions/i });
    fireEvent.click(reviewQuestionsBtn);

    expect(await screen.findByDisplayValue('Old question?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save Quiz Changes/i }));

    expect(await screen.findByText('Quiz Management')).toBeInTheDocument();
    expect(putBody?.title).toBe('Updated OS Quiz');
    expect(Array.isArray(putBody?.questions)).toBe(true);
    expect(putBody.questions).toHaveLength(1);
  });

  it('opens View Submissions, hides student scores before publication, allows grading review, and updates UI on Publish Answers', async () => {
    let published = false;

    (apiClient.fetch as jest.Mock).mockImplementation((path: string, opts?: any) => {
      if (path.includes('/api/v1/auth/me')) {
        return Promise.resolve({ json: async () => ({ data: { user: { id: 'faculty-1', subject: 'Operating Systems' } } }) });
      }
      if (path.includes('/api/v1/batches')) {
        return Promise.resolve({ json: async () => ({ data: { batches: mockBatches } }) });
      }
      if (path.includes('/api/v1/departments')) {
        return Promise.resolve({ json: async () => ({ data: { departments: mockDepartments } }) });
      }
      if (path.includes('/api/v1/faculty/quiz?')) {
        return Promise.resolve({
          json: async () => ({
            status: 'success',
            data: { items: [{ ...sampleQuiz, answersPublished: published }], total: 1, page: 1, hasMore: false }
          })
        });
      }
      if (path === '/api/v1/faculty/quiz/quiz-1/submissions') {
        return Promise.resolve({
          json: async () => ({
            status: 'success',
            quiz: { id: 'quiz-1', title: 'Midterm OS Quiz', subject: 'Operating Systems', totalMarks: 20, answersPublished: published },
            data: [sampleSubmission]
          })
        });
      }
      if (path === '/api/v1/faculty/quiz/quiz-1/publish' && opts?.method === 'POST') {
        published = true;
        return Promise.resolve({
          json: async () => ({
            status: 'success',
            data: { id: 'quiz-1', title: 'Midterm OS Quiz', answersPublished: true }
          })
        });
      }
      return Promise.resolve({ json: async () => ({ status: 'success', data: {} }) });
    });

    render(<QuizManagement />);

    const viewSubBtn = await screen.findByRole('button', { name: /^View Submissions$/i });
    fireEvent.click(viewSubBtn);

    expect(await screen.findByText('Aarav Patel')).toBeInTheDocument();
    expect(screen.getByText('24CS001')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Print$/i })).not.toBeInTheDocument();
    expect(screen.getByText('Answers Not Published')).toBeInTheDocument();
    expect(screen.getByText('Hidden until published')).toBeInTheDocument();
    expect(screen.queryByText('Auto: 10 | Written: 6')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Review & Grade/i }));
    expect(await screen.findByText(/Review Attempt: Aarav Patel/i)).toBeInTheDocument();
    expect(screen.getAllByText(/"Round Robin"/).length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole('button', { name: /Back to Submissions/i }));

    const publishBtn = await screen.findByRole('button', { name: /^Publish Answers$/i });
    fireEvent.click(publishBtn);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Publishing answers will make quiz results/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Publish/i }));

    expect(await screen.findByText('Auto: 10 | Written: 6')).toBeInTheDocument();
    expect(screen.getAllByText('Answers Published').length).toBeGreaterThanOrEqual(1);
    const disabledPublishedBtn = screen.getByRole('button', { name: /Answers Published/i });
    expect(disabledPublishedBtn).toBeDisabled();
  });

  it('prints question paper PDF without answers marked when clicking Print in Quizzes action column', async () => {
    const printSpy = jest.spyOn(window, 'print').mockImplementation(() => {});

    (apiClient.fetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/api/v1/auth/me')) {
        return Promise.resolve({ json: async () => ({ data: { user: { id: 'faculty-1', subject: 'Operating Systems' } } }) });
      }
      if (path.includes('/api/v1/batches')) {
        return Promise.resolve({ json: async () => ({ data: { batches: mockBatches } }) });
      }
      if (path.includes('/api/v1/departments')) {
        return Promise.resolve({ json: async () => ({ data: { departments: mockDepartments } }) });
      }
      if (path.includes('/api/v1/faculty/quiz?')) {
        return Promise.resolve({ json: async () => ({ status: 'success', data: { items: [sampleQuiz], total: 1, page: 1, hasMore: false } }) });
      }
      if (path === '/api/v1/faculty/quiz/quiz-1') {
        return Promise.resolve({
          json: async () => ({
            status: 'success',
            data: {
              ...sampleQuiz,
              durationMinutes: 45,
              questions: [
                {
                  id: 'q-1',
                  type: 'MCQ',
                  text: 'Which scheduling algorithm is non-preemptive?',
                  marks: 2,
                  options: ['Round Robin', 'FCFS', 'SRTF', 'MLFQ'],
                  answerKey: 'SECRET_MCQ_KEY_B'
                },
                {
                  id: 'q-2',
                  type: 'FILL_BLANK',
                  text: 'A semaphore has [blank] operations.',
                  marks: 2,
                  options: null,
                  answerKey: 'SECRET_FILL_ANSWER'
                },
                {
                  id: 'q-3',
                  type: 'NUMERICAL',
                  text: 'How many bits in a byte?',
                  marks: 1,
                  options: null,
                  answerKey: '999888777'
                }
              ]
            }
          })
        });
      }
      return Promise.resolve({ json: async () => ({ status: 'success', data: {} }) });
    });

    try {
      render(<QuizManagement />);
      const printBtn = await screen.findByRole('button', { name: /^Print$/i });
      fireEvent.click(printBtn);

      expect(await screen.findByText('Which scheduling algorithm is non-preemptive?')).toBeInTheDocument();
      expect(screen.getByText('A semaphore has ____________ operations.')).toBeInTheDocument();
      expect(screen.getByText('How many bits in a byte?')).toBeInTheDocument();
      expect(screen.getByText('FCFS')).toBeInTheDocument();

      // Ensure answer keys are NOT rendered anywhere in the printable question paper
      expect(screen.queryByText(/SECRET_MCQ_KEY_B/)).not.toBeInTheDocument();
      expect(screen.queryByText(/SECRET_FILL_ANSWER/)).not.toBeInTheDocument();
      expect(screen.queryByText(/999888777/)).not.toBeInTheDocument();

      await new Promise((r) => setTimeout(r, 80));
      expect(printSpy).toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /Back to Quizzes/i }));
      expect(await screen.findByText('Quiz Management')).toBeInTheDocument();
    } finally {
      printSpy.mockRestore();
    }
  });
});

describe('QuizManagement async loading, empty, error & retry lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('cira_user', JSON.stringify({
      id: 'faculty-1',
      name: 'Dr. Jane Smith',
      subject: 'Operating Systems'
    }));
  });

  const setupCommonMocks = (quizHandler: () => Promise<any>, submissionsHandler?: () => Promise<any>) => {
    (apiClient.fetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/api/v1/auth/me')) {
        return Promise.resolve({ json: async () => ({ data: { user: { id: 'faculty-1', subject: 'Operating Systems' } } }) });
      }
      if (path.includes('/api/v1/batches')) {
        return Promise.resolve({ json: async () => ({ data: { batches: mockBatches } }) });
      }
      if (path.includes('/api/v1/departments')) {
        return Promise.resolve({ json: async () => ({ data: { departments: mockDepartments } }) });
      }
      if (path.includes('/api/v1/faculty/quiz?')) {
        return quizHandler();
      }
      if (path.includes('/submissions') && submissionsHandler) {
        return submissionsHandler();
      }
      return Promise.resolve({ json: async () => ({ status: 'success', data: {} }) });
    });
  };

  it('shows "Loading quizzes..." immediately without flashing "No quizzes found", then renders returned quizzes', async () => {
    let resolveQuizzes!: (value: any) => void;
    setupCommonMocks(
      () => new Promise((resolve) => {
        resolveQuizzes = resolve;
      })
    );

    render(<QuizManagement />);

    expect(screen.getByText('Loading quizzes...')).toBeInTheDocument();
    expect(screen.queryByText('No quizzes found')).not.toBeInTheDocument();

    resolveQuizzes({
      ok: true,
      json: async () => ({
        status: 'success',
        data: {
          items: [
            { id: 'q1', title: 'Quiz Alpha', subject: 'Operating Systems', _count: { questions: 5, attempts: 0 } },
            { id: 'q2', title: 'Quiz Beta', subject: 'Operating Systems', _count: { questions: 8, attempts: 1 } }
          ],
          total: 2,
          page: 1,
          hasMore: false
        }
      })
    });

    expect(await screen.findByText('Quiz Alpha')).toBeInTheDocument();
    expect(screen.getByText('Quiz Beta')).toBeInTheDocument();
    expect(screen.queryByText('Loading quizzes...')).not.toBeInTheDocument();
    expect(screen.queryByText('No quizzes found')).not.toBeInTheDocument();
  });

  it('shows "Loading quizzes..." while pending and displays "No quizzes found" only after empty response resolves', async () => {
    let resolveEmpty!: (value: any) => void;
    setupCommonMocks(
      () => new Promise((resolve) => {
        resolveEmpty = resolve;
      })
    );

    render(<QuizManagement />);

    expect(screen.getByText('Loading quizzes...')).toBeInTheDocument();
    expect(screen.queryByText('No quizzes found')).not.toBeInTheDocument();

    resolveEmpty({
      ok: true,
      json: async () => ({
        status: 'success',
        data: { items: [], total: 0, page: 1, hasMore: false }
      })
    });

    expect(await screen.findByText('No quizzes found')).toBeInTheDocument();
    expect(screen.getByText("You haven't created any quizzes yet.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create new quiz/i })).toBeInTheDocument();
    expect(screen.queryByText('Loading quizzes...')).not.toBeInTheDocument();
  });

  it('shows error state and Retry button on API failure without showing "No quizzes found", then recovers on Retry', async () => {
    let attempt = 0;
    setupCommonMocks(async () => {
      attempt += 1;
      if (attempt === 1) {
        return { ok: false, status: 500, json: async () => ({ status: 'error', message: 'Server error' }) };
      }
      return {
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            items: [{ id: 'q1', title: 'Recovered Quiz', subject: 'Operating Systems', _count: { questions: 4, attempts: 0 } }],
            total: 1,
            page: 1,
            hasMore: false
          }
        })
      };
    });

    render(<QuizManagement />);

    expect(await screen.findByText('Unable to load quizzes. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('No quizzes found')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

    expect(await screen.findByText('Recovered Quiz')).toBeInTheDocument();
    expect(screen.queryByText('Unable to load quizzes. Please try again.')).not.toBeInTheDocument();
  });

  it('handles unmount while loading and refetches properly when remounted', async () => {
    let resolveFirst!: (value: any) => void;
    let callCount = 0;
    setupCommonMocks(() => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            items: [{ id: 'q-fresh', title: 'Fresh Quiz After Return', subject: 'Operating Systems', _count: { questions: 3, attempts: 0 } }],
            total: 1,
            page: 1,
            hasMore: false
          }
        })
      });
    });

    const { unmount } = render(<QuizManagement />);
    expect(screen.getByText('Loading quizzes...')).toBeInTheDocument();
    unmount();

    // Resolve stale request after unmount (should not throw or warn)
    resolveFirst({
      ok: true,
      json: async () => ({
        status: 'success',
        data: { items: [{ id: 'q-stale', title: 'Stale Quiz', subject: 'Operating Systems' }], total: 1, page: 1, hasMore: false }
      })
    });

    render(<QuizManagement />);
    expect(screen.getByText('Loading quizzes...')).toBeInTheDocument();
    expect(await screen.findByText('Fresh Quiz After Return')).toBeInTheDocument();
  });

  it('shows "Loading submissions..." when opening View Submissions before submissions resolve', async () => {
    let resolveSubs!: (value: any) => void;
    setupCommonMocks(
      async () => ({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            items: [{ id: 'quiz-1', title: 'Quiz Sub Test', subject: 'Operating Systems', totalMarks: 10, _count: { questions: 2, attempts: 1 } }],
            total: 1,
            page: 1,
            hasMore: false
          }
        })
      }),
      () => new Promise((resolve) => {
        resolveSubs = resolve;
      })
    );

    render(<QuizManagement />);
    const viewBtn = await screen.findByRole('button', { name: /^View Submissions$/i });
    fireEvent.click(viewBtn);

    expect(screen.getByText('Loading submissions...')).toBeInTheDocument();
    expect(screen.queryByText('No Submissions')).not.toBeInTheDocument();

    resolveSubs({
      ok: true,
      json: async () => ({
        status: 'success',
        quiz: { id: 'quiz-1', title: 'Quiz Sub Test', subject: 'Operating Systems', totalMarks: 10, answersPublished: false },
        data: []
      })
    });

    expect(await screen.findByText('No Submissions')).toBeInTheDocument();
    expect(screen.queryByText('Loading submissions...')).not.toBeInTheDocument();
  });
});

describe('QuizManagement 5-step creation wizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('cira_user', JSON.stringify({
      id: 'faculty-1',
      name: 'Dr. Jane Smith',
      subject: 'Operating Systems'
    }));

    (apiClient.fetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/api/v1/auth/me')) {
        return Promise.resolve({ json: async () => ({ data: { user: { id: 'faculty-1', subject: 'Operating Systems' } } }) });
      }
      if (path.includes('/api/v1/batches')) {
        return Promise.resolve({ json: async () => ({ data: { batches: mockBatches } }) });
      }
      if (path.includes('/api/v1/departments')) {
        return Promise.resolve({ json: async () => ({ data: { departments: mockDepartments } }) });
      }
      if (path.includes('/api/v1/faculty/quiz?')) {
        return Promise.resolve({ json: async () => ({ status: 'success', data: { items: [], total: 0, page: 1, hasMore: false } }) });
      }
      return Promise.resolve({ json: async () => ({ status: 'success', data: {} }) });
    });
  });

  it('validates each step before advancing, preserves data across back/next, and guards unsaved cancel', async () => {
    render(<QuizManagement />);
    fireEvent.click(await screen.findByRole('button', { name: /create new quiz/i }));

    // Step 1: Cannot jump to uncompleted step 5 or advance with empty title
    expect(screen.getAllByText('Step 1 of 5').length).toBeGreaterThanOrEqual(1);
    const step5NavBtn = screen.getByRole('button', { name: /5\. Add Questions/i });
    expect(step5NavBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    expect(await screen.findByText('Quiz title is required.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Quiz Title \*/i), { target: { value: 'Wizard OS Exam' } });
    fireEvent.change(screen.getByLabelText(/Duration \(mins\) \*/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    expect(await screen.findByText(/Enter a valid duration in minutes/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Duration \(mins\) \*/i), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));

    // Step 2: Schedule validation (End Time must be after Start Time)
    expect(await screen.findByText('Quiz Schedule')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Start Time/i), { target: { value: '2026-12-01T10:00' } });
    fireEvent.change(screen.getByLabelText(/End Time/i), { target: { value: '2026-12-01T09:00' } });
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    expect(await screen.findByText('End time must be later than start time.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/End Time/i), { target: { value: '2026-12-01T11:30' } });
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));

    // Step 3: Marks validation (Passing marks <= Total marks)
    expect(await screen.findByText('Marks Configuration')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Total Marks \(Optional\)/i), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText(/Passing Marks/i), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    expect(await screen.findByText('Passing marks cannot exceed total marks.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Passing Marks/i), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));

    // Step 4: Assign Classes
    expect(await screen.findByLabelText(/1\. Batch/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/1\. Batch/i), { target: { value: 'batch-2024' } });
    fireEvent.change(screen.getByLabelText(/2\. Department/i), { target: { value: 'dept-cse' } });
    fireEvent.change(screen.getByLabelText(/3\. Section/i), { target: { value: 'sec-a' } });
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));

    // Step 5: Summary strip + question methods
    expect(await screen.findByText('Wizard OS Exam')).toBeInTheDocument();
    expect(screen.getByText('45 mins')).toBeInTheDocument();
    expect(screen.getByText('50 total · Pass 20')).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    // Navigate Back to Step 1 and verify entered data is preserved
    fireEvent.click(screen.getByRole('button', { name: /1\. Basic Details/i }));
    expect(await screen.findByDisplayValue('Wizard OS Exam')).toBeInTheDocument();
    expect(screen.getByDisplayValue('45')).toBeInTheDocument();

    // Cancel prompts unsaved-changes confirmation before leaving
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    expect(await screen.findByText('Discard unsaved quiz?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Discard Changes/i }));
    expect(await screen.findByText('Quiz Management')).toBeInTheDocument();
  });
});

describe('QuizManagement View Submissions class-wise roster & filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('cira_user', JSON.stringify({
      id: 'faculty-1',
      name: 'Dr. Jane Smith',
      subject: 'Operating Systems'
    }));
  });

  it('displays class-wise roster (submitted with 0 marks + NOT SUBMITTED), updates summary metrics on class tabs, and filters by status', async () => {
    const multiClassRoster = [
      {
        id: 'att-1',
        userId: 'stu-1',
        hasSubmitted: true,
        status: 'EVALUATED',
        objectiveScore: 0,
        writtenScore: 0,
        totalScore: 0,
        startTime: '2026-11-11T09:00:00.000Z',
        endTime: '2026-11-11T09:20:00.000Z',
        violationReason: null,
        classKey: 'section:sec-a',
        classLabel: '2024-2028 · CSE – Section A',
        classShortLabel: 'CSE – Section A',
        user: { id: 'stu-1', name: 'Aarav Zero', rollNumber: '24CS001' },
        responses: []
      },
      {
        id: null,
        userId: 'stu-2',
        hasSubmitted: false,
        status: 'NOT_SUBMITTED',
        objectiveScore: null,
        writtenScore: null,
        totalScore: null,
        startTime: null,
        endTime: null,
        violationReason: null,
        classKey: 'section:sec-a',
        classLabel: '2024-2028 · CSE – Section A',
        classShortLabel: 'CSE – Section A',
        user: { id: 'stu-2', name: 'Ananya Pending', rollNumber: '24CS002' },
        responses: []
      },
      {
        id: 'att-3',
        userId: 'stu-3',
        hasSubmitted: true,
        status: 'SUBMITTED',
        objectiveScore: 12,
        writtenScore: 0,
        totalScore: 12,
        startTime: '2026-11-11T09:00:00.000Z',
        endTime: '2026-11-11T09:15:00.000Z',
        violationReason: 'Tab switch detected',
        classKey: 'section:sec-b',
        classLabel: '2024-2028 · CSE – Section B',
        classShortLabel: 'CSE – Section B',
        user: { id: 'stu-3', name: 'Bhavya Violated', rollNumber: '24CS101' },
        responses: []
      }
    ];

    (apiClient.fetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/api/v1/auth/me')) {
        return Promise.resolve({ json: async () => ({ data: { user: { id: 'faculty-1', subject: 'Operating Systems' } } }) });
      }
      if (path.includes('/api/v1/batches')) {
        return Promise.resolve({ json: async () => ({ data: { batches: mockBatches } }) });
      }
      if (path.includes('/api/v1/departments')) {
        return Promise.resolve({ json: async () => ({ data: { departments: mockDepartments } }) });
      }
      if (path.includes('/api/v1/faculty/quiz?')) {
        return Promise.resolve({
          json: async () => ({
            status: 'success',
            data: {
              items: [{ id: 'quiz-multi', title: 'OS Roster Quiz', subject: 'Operating Systems', totalMarks: 20, answersPublished: true, _count: { questions: 4, attempts: 2 } }],
              total: 1,
              page: 1,
              hasMore: false
            }
          })
        });
      }
      if (path === '/api/v1/faculty/quiz/quiz-multi/submissions') {
        return Promise.resolve({
          json: async () => ({
            status: 'success',
            quiz: { id: 'quiz-multi', title: 'OS Roster Quiz', subject: 'Operating Systems', totalMarks: 20, answersPublished: true },
            data: multiClassRoster.filter(r => r.id),
            roster: multiClassRoster,
            assignedClasses: [
              { id: 'section:sec-a', label: '2024-2028 · CSE – Section A', shortLabel: 'CSE – Section A' },
              { id: 'section:sec-b', label: '2024-2028 · CSE – Section B', shortLabel: 'CSE – Section B' }
            ]
          })
        });
      }
      return Promise.resolve({ json: async () => ({ status: 'success', data: {} }) });
    });

    render(<QuizManagement />);
    fireEvent.click(await screen.findByRole('button', { name: /^View Submissions$/i }));

    // Initial All Classes view shows all 3 students (including NOT SUBMITTED)
    expect(await screen.findByText('Aarav Zero')).toBeInTheDocument();
    expect(screen.getByText('Ananya Pending')).toBeInTheDocument();
    expect(screen.getByText('Bhavya Violated')).toBeInTheDocument();
    expect(screen.getByText('NOT SUBMITTED')).toBeInTheDocument();
    expect(screen.getByText('Auto: 0 | Written: 0')).toBeInTheDocument();
    expect(screen.getByText('Not submitted')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Review & Grade/i })).toHaveLength(2);

    // Summary metrics for All Classes
    const summaryRegion = screen.getByLabelText('Submission summary');
    expect(within(summaryRegion).getByText('3')).toBeInTheDocument();
    expect(within(summaryRegion).getByText('2')).toBeInTheDocument();

    // Switch to CSE – Section A tab
    fireEvent.click(screen.getByRole('tab', { name: /CSE – Section A \(2\)/i }));
    expect(screen.getByText('Aarav Zero')).toBeInTheDocument();
    expect(screen.getByText('Ananya Pending')).toBeInTheDocument();
    expect(screen.queryByText('Bhavya Violated')).not.toBeInTheDocument();

    // Filter to Not Submitted within CSE – Section A
    fireEvent.click(screen.getByRole('button', { name: /Not Submitted \(1\)/i }));
    expect(screen.getByText('Ananya Pending')).toBeInTheDocument();
    expect(screen.queryByText('Aarav Zero')).not.toBeInTheDocument();

    // Reset filters -> back to All Classes & All Students
    fireEvent.click(screen.getByRole('button', { name: /Reset filters/i }));
    expect(screen.getByText('Bhavya Violated')).toBeInTheDocument();

    // Filter by Violated
    fireEvent.click(screen.getByRole('button', { name: /Violated \(1\)/i }));
    expect(screen.getByText('Bhavya Violated')).toBeInTheDocument();
    expect(screen.queryByText('Aarav Zero')).not.toBeInTheDocument();
    expect(screen.queryByText('Ananya Pending')).not.toBeInTheDocument();
  });
});

