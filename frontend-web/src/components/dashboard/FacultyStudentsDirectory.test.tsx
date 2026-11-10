import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FacultyStudentsDirectory from './FacultyStudentsDirectory';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';

jest.mock('@/lib/apiClient', () => ({
  apiClient: { fetch: jest.fn() },
  getApiErrorMessage: (error: Error) => error.message,
}));
jest.mock('@/context/FacultyDemoContext', () => ({ useFacultyDemo: () => false }));
jest.mock('./StudentProfileView', () => ({ __esModule: true, default: ({ studentId, onBack }: any) => <div><span>Profile {studentId}</span><button onClick={onBack}>Back</button></div> }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const filterOptions = {
  years: [2024],
  departments: [{ id: 'dept-1', name: 'Engineering', batchId: 'batch-1' }],
  sections: [{ id: 'section-1', name: 'A', departmentId: 'dept-1' }],
};
const studentPage = {
  students: [{ id: 'student-1', name: 'Ava Patel', rollNumber: 'CS24001', department: 'Engineering', departmentId: 'dept-1', year: 2024, section: 'A', sectionId: 'section-1' }],
  pagination: { page: 1, limit: 20, total: 1, pages: 1 },
};

describe('FacultyStudentsDirectory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
    (apiClient.fetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/filter-options')) return Promise.resolve({ json: async () => ({ data: filterOptions }) });
      if (path.includes('/reset-password')) return Promise.resolve({ json: async () => ({ message: 'Instructions sent' }) });
      return Promise.resolve({ json: async () => ({ data: studentPage }) });
    });
  });

  it('loads assigned students, cascades filters, supports search, and opens profiles', async () => {
    render(<FacultyStudentsDirectory />);
    expect(await screen.findByText('Ava Patel')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2024' } });
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'dept-1' } });
    fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'section-1' } });
    fireEvent.change(screen.getByLabelText('Search students'), { target: { value: 'Ava' } });

    await waitFor(() => expect(apiClient.fetch).toHaveBeenCalledWith(expect.stringContaining('year=2024'), expect.anything()));
    expect(apiClient.fetch).toHaveBeenCalledWith(expect.stringContaining('departmentId=dept-1'), expect.anything());
    expect(apiClient.fetch).toHaveBeenCalledWith(expect.stringContaining('sectionId=section-1'), expect.anything());
    expect(apiClient.fetch).toHaveBeenCalledWith(expect.stringContaining('search=Ava'), expect.anything());

    expect(await screen.findByText('Ava Patel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(await screen.findByText('Profile student-1')).toBeInTheDocument();
  });

  it('confirms and prevents duplicate password reset requests while sending', async () => {
    let finishReset!: (response: any) => void;
    (apiClient.fetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/filter-options')) return Promise.resolve({ json: async () => ({ data: filterOptions }) });
      if (path.includes('/reset-password')) return new Promise((resolve) => { finishReset = resolve; });
      return Promise.resolve({ json: async () => ({ data: studentPage }) });
    });
    render(<FacultyStudentsDirectory />);
    const resetButton = await screen.findByRole('button', { name: 'Reset password' });
    fireEvent.click(resetButton);
    expect(window.confirm).toHaveBeenCalledWith('Send password reset instructions to Ava Patel?');
    expect(await screen.findByRole('button', { name: /Sending/ })).toBeDisabled();
    fireEvent.click(resetButton);
    expect(apiClient.fetch).toHaveBeenCalledTimes(3);
    finishReset({ json: async () => ({ message: 'Instructions sent' }) });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Instructions sent'));
  });

  it('shows an API error separately from an empty result and can retry', async () => {
    let fail = true;
    (apiClient.fetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/filter-options')) return Promise.resolve({ json: async () => ({ data: filterOptions }) });
      if (path.includes('/students?') && fail) return Promise.reject(new Error('Student service unavailable'));
      return Promise.resolve({ json: async () => ({ data: studentPage }) });
    });
    render(<FacultyStudentsDirectory />);
    expect(await screen.findByText('Student service unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No students found')).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Ava Patel')).toBeInTheDocument();
  });
});
