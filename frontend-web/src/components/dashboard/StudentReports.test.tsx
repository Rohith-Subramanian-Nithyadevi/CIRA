import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudentReports } from './StudentReports';
import { apiClient } from '@/lib/apiClient';

jest.mock('@/lib/apiClient', () => ({ apiClient: { fetch: jest.fn() } }));
jest.mock('@/context/FacultyDemoContext', () => ({ useFacultyDemo: () => false }));
jest.mock('./StudentProfileView', () => ({ __esModule: true, default: () => <div>Student profile</div> }));
jest.mock('recharts', () => {
  const Stub = ({ children }: any) => <div>{children}</div>;
  return { BarChart: Stub, Bar: Stub, XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, Tooltip: Stub, Legend: Stub, ResponsiveContainer: Stub, PieChart: Stub, Pie: Stub, Cell: Stub };
});

const options = {
  years: [2024],
  departments: [{ id: 'dept-assigned', name: 'Assigned Department', batchId: 'batch-1', startYear: 2024 }],
  sections: [{ id: 'section-assigned', name: 'A', departmentId: 'dept-assigned' }],
};

describe('StudentReports authorized filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.fetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/filter-options')) return Promise.resolve({ json: async () => ({ data: options }) });
      if (path.includes('/faculty/quiz')) return Promise.resolve({ json: async () => ({ data: [{ id: 'quiz-1', title: 'Quiz One', createdAt: '2026-01-01' }] }) });
      if (path.includes('/reports/quiz/')) return Promise.resolve({ ok: true, json: async () => ({ data: { quiz: { id: 'quiz-1', title: 'Quiz One' }, leaderboard: [], topicAverages: [], sectionComparison: [], distribution: {}, summary: {} } }) });
      return Promise.resolve({ ok: true, json: async () => ({ data: { summary: { totalAttempts: 0, totalStudents: 0, evaluatedStudents: 0, percentages: {} }, yearData: [], deptData: [], subjects: [] } }) });
    });
  });

  it('shows only server-returned assigned filters and sends cascading selections to scoped reports', async () => {
    render(<StudentReports />);
    expect(await screen.findByRole('option', { name: '2024' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Assigned Department' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Outside Department' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2024' } });
    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith(expect.stringContaining('/filter-options?year=2024'), expect.anything()));
    await waitFor(() => expect(screen.getByLabelText('Department')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'dept-assigned' } });
    await waitFor(() => expect(screen.getByLabelText('Section')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'section-assigned' } });

    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith(expect.stringContaining('/performance-bands?year=2024&departmentId=dept-assigned&sectionId=section-assigned')));
    expect(screen.getAllByText('Assigned Department').length).toBeGreaterThan(0);
  });
});
