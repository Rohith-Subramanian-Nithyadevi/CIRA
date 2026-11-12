import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import QuestionBank from './QuestionBank';
import { apiClient } from '@/lib/apiClient';

jest.mock('@/lib/apiClient', () => ({
  apiClient: { fetch: jest.fn() },
  getApiErrorMessage: (error: Error) => error.message,
}));

const item = {
  id: 'q1', ownerId: 'faculty-1', ownership: 'owned', category: 'ASSIGNMENT', subject: 'Math', type: 'MCQ',
  text: 'What is 2 + 2?', topic: 'Arithmetic', subtopic: null, difficulty: 'Easy', tags: ['basics'], marks: 1,
  negativeMarks: 0, options: ['3', '4'], answerKey: '4', explanation: null, image: null,
  usages: [{ category: 'TEST_QUIZ', assessmentTitle: 'Quiz One' }],
  reuse: { eligible: false, usedInOppositeCategory: true, warning: 'This question has been used in the opposite assessment category.' },
};
const page = { items: [item], pagination: { page: 1, limit: 12, total: 13, pages: 2 } };

describe('QuestionBank', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
    (apiClient.fetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/upload-image')) return Promise.resolve({ json: async () => ({ data: { url: 'https://res.cloudinary.com/cira/image/upload/test.png' } }) });
      if (path.includes('/question-bank') && !path.includes('?')) return Promise.resolve({ json: async () => ({ data: item }) });
      return Promise.resolve({ json: async () => ({ data: page }) });
    });
  });

  it('shows separate Assignment and Test/Quiz divisions and warns on opposite-category reuse', async () => {
    render(<QuestionBank />);
    expect(await screen.findByText('What is 2 + 2?')).toBeInTheDocument();
    expect(screen.getByText(/used in the opposite assessment category/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Tests / Quizzes' }));
    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith(expect.stringContaining('category=TEST_QUIZ'), expect.anything()));
    fireEvent.click(screen.getByLabelText('Include questions used in the opposite category'));
    expect(await screen.findByText(/Included questions used in the opposite assessment category/i)).toBeInTheDocument();
    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith(expect.stringContaining('includeReused=true'), expect.anything()));
  });

  it('provides editor controls for every existing question type', async () => {
    render(<QuestionBank />);
    await screen.findByText('What is 2 + 2?');
    fireEvent.click(screen.getByRole('button', { name: 'New question' }));
    const typeSelect = screen.getByLabelText('Question type');
    const cases = [
      ['MCQ', 'Correct option 1'], ['MULTI_SELECT', 'Correct option 1'], ['TRUE_FALSE', 'Correct answer'],
      ['FILL_BLANK', 'Expected answer'], ['NUMERICAL', 'Expected numerical answer'], ['SHORT_WRITTEN', 'manually graded'],
      ['LONG_WRITTEN', 'manually graded'], ['MATCHING', 'Left item 1'], ['CODING', 'Reference solution'],
    ];
    for (const [type, expected] of cases) {
      fireEvent.change(typeSelect, { target: { value: type } });
      expect(screen.getByLabelText('Question type')).toHaveValue(type);
      if (type === 'SHORT_WRITTEN' || type === 'LONG_WRITTEN') expect(screen.getByText(expected, { exact: false })).toBeInTheDocument();
      else expect(screen.getByLabelText(expected)).toBeInTheDocument();
    }
  });

  it('sends search and metadata filters to the paginated endpoint', async () => {
    render(<QuestionBank />);
    await screen.findByText('What is 2 + 2?');
    fireEvent.change(screen.getByLabelText('Search questions'), { target: { value: 'integral' } });
    fireEvent.change(screen.getByLabelText('Filter subject'), { target: { value: 'Math' } });
    fireEvent.change(screen.getByLabelText('Filter topic'), { target: { value: 'Calculus' } });
    fireEvent.change(screen.getByLabelText('Filter difficulty'), { target: { value: 'Hard' } });
    fireEvent.change(screen.getByLabelText('Filter type'), { target: { value: 'MATCHING' } });
    fireEvent.change(screen.getByLabelText('Filter tag'), { target: { value: 'exam' } });
    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith(expect.stringContaining('tag=exam'), expect.anything()));
    const filteredPath = (apiClient.fetch as jest.Mock).mock.calls.map(([requestPath]) => requestPath).find((requestPath) => requestPath.includes('tag=exam'));
    expect(filteredPath).toContain('subject=Math');
    expect(filteredPath).toContain('topic=Calculus');
    expect(filteredPath).toContain('difficulty=Hard');
    expect(filteredPath).toContain('type=MATCHING');
    expect(filteredPath).toContain('tag=exam');
    await waitFor(() => expect(screen.queryByText('Loading question bank…')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith(expect.stringContaining('page=2'), expect.anything()));
  });

  it('creates a persisted question with tags and category and exposes preview', async () => {
    render(<QuestionBank />);
    await screen.findByText('What is 2 + 2?');
    fireEvent.click(screen.getByRole('button', { name: 'New question' }));
    fireEvent.change(screen.getByLabelText('Question content'), { target: { value: 'Select the correct sum' } });
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Option 2'), { target: { value: '4' } });
    fireEvent.click(screen.getByLabelText('Correct option 2'));
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'addition, basics' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByText('Select the correct sum', { selector: 'p' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save question' }));
    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith('/api/v1/faculty/quiz/question-bank', expect.objectContaining({ method: 'POST' })));
    const createCall = (apiClient.fetch as jest.Mock).mock.calls.find(([path, init]) => path === '/api/v1/faculty/quiz/question-bank' && init?.method === 'POST');
    expect(JSON.parse(createCall[1].body)).toMatchObject({ category: 'ASSIGNMENT', type: 'MCQ', tags: ['addition', 'basics'], answerKey: '4' });
  });

  it('uploads, previews and removes an image reference', async () => {
    render(<QuestionBank />);
    await screen.findByText('What is 2 + 2?');
    fireEvent.click(screen.getByRole('button', { name: 'New question' }));
    const file = new File(['image'], 'question.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload image'), { target: { files: [file] } });
    expect(await screen.findByAltText('Question attachment preview')).toHaveAttribute('src', 'https://res.cloudinary.com/cira/image/upload/test.png');
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(screen.queryByAltText('Question attachment preview')).not.toBeInTheDocument();
  });

  it('edits owned questions and removes them without physically deleting the record', async () => {
    render(<QuestionBank />);
    await screen.findByText('What is 2 + 2?');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Question content'), { target: { value: 'Updated sum question' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save question' }));
    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith('/api/v1/faculty/quiz/question-bank/q1', expect.objectContaining({ method: 'PUT' })));
    expect(await screen.findByText('What is 2 + 2?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove question q1' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /^Delete$/i });
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Type CONFIRM to proceed'), { target: { value: 'CONFIRM' } });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith('/api/v1/faculty/quiz/question-bank/q1', expect.objectContaining({ method: 'DELETE' })));
  });

  it('separates loading errors from empty results and retries failed loads', async () => {
    let fail = true;
    (apiClient.fetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/question-bank') && fail) return Promise.reject(new Error('Question service unavailable'));
      return Promise.resolve({ json: async () => ({ data: { items: [], pagination: { page: 1, pages: 1, total: 0 } } }) });
    });
    render(<QuestionBank />);
    expect(await screen.findByText('Question service unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No questions found')).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No questions found')).toBeInTheDocument();
  });
});
