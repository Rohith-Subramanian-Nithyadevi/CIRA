import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import QuestionPaperManagement from './QuestionPaperManagement';
import { apiClient } from '@/lib/apiClient';

jest.mock('@/lib/apiClient', () => ({ apiClient: { fetch: jest.fn() }, getApiErrorMessage: (error: Error) => error.message }));

describe('QuestionPaperManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks(); window.confirm = jest.fn(() => true); window.print = jest.fn();
    (apiClient.fetch as jest.Mock).mockImplementation((path: string, init?: RequestInit) => {
      if (path.endsWith('/question-papers/classes')) return Promise.resolve({ ok: true, json: async () => ({ data: { classes: [{ id: 'sec-1', type: 'SECTION', name: 'CSE · Section A' }] } }) });
      if (path.includes('/question-bank')) return Promise.resolve({ ok: true, json: async () => ({ data: { items: [{ id: 'q1', text: 'Solve 2 + 2', type: 'MCQ', marks: 1, options: ['3', '4'], image: null }] } }) });
      if (path.endsWith('/question-papers') && init?.method === 'POST') return Promise.resolve({ ok: true, json: async () => ({ data: { id: 'p1', title: 'Algebra test', category: 'TEST_QUIZ', paperStatus: 'DRAFT', questions: [], totalMarks: 0 } }) });
      if (path.endsWith('/p1') && init?.method === 'PUT') return Promise.resolve({ ok: true, json: async () => ({ data: { id: 'p1', title: 'Algebra test', category: 'TEST_QUIZ', paperStatus: 'READY', questions: [{ id: 'q1', text: 'Solve 2 + 2', marks: 1 }], totalMarks: 1 } }) });
      if (path.endsWith('/question-papers')) return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({ data: { id: 'p1', title: 'Test', category: 'TEST_QUIZ', paperStatus: 'READY', questions: [], totalMarks: 0 } }) });
    });
  });
  it('loads, creates and saves a paper with class and marks, then offers a student-safe preview', async () => {
    render(<QuestionPaperManagement onSubmissions={jest.fn()} />);
    expect(await screen.findByText('Question Papers')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create Test / Quiz' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Algebra test' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Math' } });
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'sec-1' } });
    expect(await screen.findByText('Solve 2 + 2')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith('/api/v1/faculty/quiz/question-papers', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith('/api/v1/faculty/quiz/question-papers/p1', expect.objectContaining({ method: 'PUT' })));
    expect(await screen.findByText('1 questions · 1 marks total')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByText('Total: 1 marks')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Print \/ Save PDF/i }));
    expect(window.print).toHaveBeenCalled();
  });
});
