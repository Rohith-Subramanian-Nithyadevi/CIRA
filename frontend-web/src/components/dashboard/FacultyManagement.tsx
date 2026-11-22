import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';
import { DeleteConfirmationDialog } from '@/components/ui/DeleteConfirmationDialog';
import { 
  Users, 
  CheckSquare, 
  Building2, 
  FileSpreadsheet, 
  Upload, 
  Search, 
  Trash2, 
  Plus, 
  FolderPlus,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  GraduationCap
} from 'lucide-react';

interface Faculty {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  department?: { id: string; name: string } | null;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: { id: string; name: string } | null;
  approvalStatus: string;
  createdAt: string;
}

interface Section {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  batchId: string;
  sections: Section[];
}

interface Batch {
  id: string;
  name: string;
  startYear: number;
}

type ManagementSubTab = 'approvals' | 'users' | 'departments';

export default function FacultyManagement() {
  const [activeSubTab, setActiveSubTab] = useState<ManagementSubTab>('approvals');
  const [loading, setLoading] = useState(true);

  // Data states
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Search & Filter states
  const [facultySearch, setFacultySearch] = useState('');
  const [facultyStatusFilter, setFacultyStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');

  // Department & Section management states
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [creatingDept, setCreatingDept] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);

  // Student Bulk Import states
  const [importingStudents, setImportingStudents] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    rejected: number;
    message?: string;
    rejectedRows?: { row: number; reason: string }[];
  } | null>(null);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    type: 'user' | 'department';
    id: string;
    name: string;
  } | null>(null);

  const fetchCoreData = async () => {
    try {
      setLoading(true);
      const [facRes, userRes, batchRes] = await Promise.all([
        apiClient.fetch('/api/v1/admin/faculty/all'),
        apiClient.fetch('/api/v1/admin/users'),
        apiClient.fetch('/api/v1/batches')
      ]);

      const facData = await facRes.json();
      const userData = await userRes.json();
      const batchData = await batchRes.json();

      if (facData.data?.faculty) setFacultyList(facData.data.faculty);
      if (userData.data?.users) {
        const sortedUsers = [...userData.data.users].sort((a: User, b: User) => {
          if (a.role !== b.role) return a.role.localeCompare(b.role);
          return (a.name || '').localeCompare(b.name || '');
        });
        setUserList(sortedUsers);
      }
      if (batchData.data?.batches) {
        setBatches(batchData.data.batches);
        if (batchData.data.batches.length > 0 && !selectedBatchId) {
          setSelectedBatchId(batchData.data.batches[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch management data', err);
      toast.error('Unable to load administration data. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoreData();
  }, []);

  // Fetch departments when batch changes
  useEffect(() => {
    if (!selectedBatchId) {
      setDepartments([]);
      return;
    }
    const fetchDepartments = async () => {
      try {
        const res = await apiClient.fetch(`/api/v1/departments?batchId=${selectedBatchId}`);
        const data = await res.json();
        if (data.data?.departments) {
          setDepartments(data.data.departments);
          if (data.data.departments.length > 0 && !selectedDeptId) {
            setSelectedDeptId(data.data.departments[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch departments', err);
      }
    };
    fetchDepartments();
  }, [selectedBatchId]);

  // Faculty Approval Handler
  const handleApproval = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      setActionLoadingId(id);
      const res = await apiClient.fetch(`/api/v1/admin/faculty/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Status update failed');

      setFacultyList(prev => prev.map(f => f.id === id ? { ...f, approvalStatus: status } : f));
      setUserList(prev => prev.map(u => u.id === id ? { ...u, approvalStatus: status } : u));
      toast.success(`Faculty account ${status === 'APPROVED' ? 'approved' : 'rejected'} successfully.`);
    } catch (err: any) {
      console.error('Failed to approve/reject faculty', err);
      toast.error(err.message || 'Action failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete User or Department
  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const { type, id } = pendingDelete;
    const endpoint = type === 'user' ? `/api/v1/admin/users/${id}` : `/api/v1/departments/${id}`;

    try {
      const res = await apiClient.fetch(endpoint, { method: 'DELETE' });
      const data = await res.json?.().catch(() => null);

      if (res?.ok === false || data?.status === 'error') {
        const msg = data?.error?.message || data?.message || `Failed to delete ${type}.`;
        toast.error(msg);
        return;
      }

      if (type === 'user') {
        setUserList(prev => prev.filter(u => u.id !== id));
        setFacultyList(prev => prev.filter(f => f.id !== id));
        toast.success('User account deleted permanently.');
      } else {
        setDepartments(prev => prev.filter(d => d.id !== id));
        if (selectedDeptId === id) setSelectedDeptId('');
        toast.success('Department and associated sections deleted.');
      }
    } catch (err: any) {
      toast.error(err.message || `Failed to delete ${type}.`);
    } finally {
      setPendingDelete(null);
    }
  };

  // Create Department
  const handleCreateDepartment = async () => {
    if (!newDeptName.trim() || !selectedBatchId) return;
    try {
      setCreatingDept(true);
      const res = await apiClient.fetch('/api/v1/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeptName.trim(), batchId: selectedBatchId })
      });
      const data = await res.json();
      if (data.data?.department) {
        setDepartments(prev => [...prev, { ...data.data.department, sections: [] }]);
        setNewDeptName('');
        setSelectedDeptId(data.data.department.id);
        toast.success(`Department "${data.data.department.name}" created.`);
      } else {
        toast.error(data.message || 'Could not create department');
      }
    } catch (err: any) {
      toast.error(err.message || 'Department creation failed');
    } finally {
      setCreatingDept(false);
    }
  };

  // Create Section
  const handleCreateSection = async () => {
    if (!newSectionName.trim() || !selectedDeptId) return;
    try {
      setCreatingSection(true);
      const res = await apiClient.fetch('/api/v1/departments/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSectionName.trim().toUpperCase(), departmentId: selectedDeptId })
      });
      const data = await res.json();
      if (data.data?.section) {
        setDepartments(prev => prev.map(d => 
          d.id === selectedDeptId ? { ...d, sections: [...d.sections, data.data.section] } : d
        ));
        setNewSectionName('');
        toast.success(`Section ${data.data.section.name} added.`);
      } else {
        toast.error(data.message || 'Could not add section');
      }
    } catch (err: any) {
      toast.error(err.message || 'Section creation failed');
    } finally {
      setCreatingSection(false);
    }
  };

  // Student Bulk Import Handler
  const handleImportStudents = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setImportingStudents(true);
    setImportSummary(null);
    try {
      const response = await apiClient.fetch('/api/v1/admin/students/import', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      setImportSummary({
        imported: result.data?.imported || 0,
        rejected: result.data?.rejected || 0,
        message: result.data?.rejected ? 'Review rejected rows before retrying.' : 'All rows imported successfully.',
        rejectedRows: result.data?.rejectedRows || []
      });
      if (result.data?.imported > 0) {
        toast.success(`Successfully imported ${result.data.imported} student account(s).`);
        fetchCoreData();
      }
    } catch (error: any) {
      setImportSummary({ imported: 0, rejected: 0, message: error.message || 'Student import failed.', rejectedRows: [] });
      toast.error(error.message || 'Student import failed.');
    } finally {
      setImportingStudents(false);
    }
  };

  // Filtered Faculty
  const filteredFaculty = useMemo(() => {
    return facultyList.filter(f => {
      const matchesSearch = 
        (f.name || '').toLowerCase().includes(facultySearch.toLowerCase()) ||
        (f.email || '').toLowerCase().includes(facultySearch.toLowerCase()) ||
        (f.employeeId || '').toLowerCase().includes(facultySearch.toLowerCase());
      const matchesStatus = facultyStatusFilter === 'ALL' || f.approvalStatus === facultyStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [facultyList, facultySearch, facultyStatusFilter]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return userList.filter(u => {
      const matchesSearch = 
        (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(userSearch.toLowerCase());
      const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [userList, userSearch, userRoleFilter]);

  const pendingFacultyCount = facultyList.filter(f => f.approvalStatus === 'PENDING').length;
  const currentBatch = batches.find(b => b.id === selectedBatchId);
  const currentDept = departments.find(d => d.id === selectedDeptId);

  return (
    <div className="space-y-6">
      {/* Top Header & Stat Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink dark:text-neutral-100 flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-maroon dark:text-rose-400" />
            Faculty Management & Administration
          </h1>
          <p className="text-sm text-gray-body dark:text-neutral-400 mt-1">
            Approve faculty registrations, manage institutional user accounts, bulk-import students, and configure academic departmental structures.
          </p>
        </div>

        <button
          onClick={fetchCoreData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-border-soft dark:border-neutral-700 bg-white dark:bg-[#1E1E22] hover:bg-cream/40 dark:hover:bg-neutral-800 text-ink dark:text-neutral-200 transition-colors shadow-xs shrink-0 self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Quick Stat Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#1E1E22] p-4 rounded-xl border border-border-soft dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-body dark:text-neutral-400 uppercase tracking-wider">Total Faculty</span>
            <Users className="w-4 h-4 text-maroon dark:text-rose-400 opacity-80" />
          </div>
          <p className="text-2xl font-bold mt-1 text-ink dark:text-neutral-100">{facultyList.length}</p>
        </div>

        <div className="bg-white dark:bg-[#1E1E22] p-4 rounded-xl border border-border-soft dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-body dark:text-neutral-400 uppercase tracking-wider">Pending Approvals</span>
            <Clock className="w-4 h-4 text-amber-500 opacity-80" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingFacultyCount}</p>
            {pendingFacultyCount > 0 && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">Action needed</span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1E22] p-4 rounded-xl border border-border-soft dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-body dark:text-neutral-400 uppercase tracking-wider">Registered Users</span>
            <GraduationCap className="w-4 h-4 text-maroon dark:text-rose-400 opacity-80" />
          </div>
          <p className="text-2xl font-bold mt-1 text-ink dark:text-neutral-100">{userList.length}</p>
        </div>

        <div className="bg-white dark:bg-[#1E1E22] p-4 rounded-xl border border-border-soft dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-body dark:text-neutral-400 uppercase tracking-wider">Academic Batches</span>
            <Building2 className="w-4 h-4 text-maroon dark:text-rose-400 opacity-80" />
          </div>
          <p className="text-2xl font-bold mt-1 text-ink dark:text-neutral-100">{batches.length}</p>
        </div>
      </div>

      {/* Horizontal Sub-Tabs */}
      <div className="border-b border-border-soft dark:border-neutral-800">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Faculty Management Tabs">
          <button
            onClick={() => setActiveSubTab('approvals')}
            className={`flex items-center gap-2 py-3 px-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'approvals'
                ? 'border-maroon dark:border-rose-400 text-maroon dark:text-rose-300'
                : 'border-transparent text-gray-body dark:text-neutral-400 hover:text-ink dark:hover:text-neutral-200 hover:border-gray-300'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Faculty Approvals</span>
            {pendingFacultyCount > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white">
                {pendingFacultyCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('users')}
            className={`flex items-center gap-2 py-3 px-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'users'
                ? 'border-maroon dark:border-rose-400 text-maroon dark:text-rose-300'
                : 'border-transparent text-gray-body dark:text-neutral-400 hover:text-ink dark:hover:text-neutral-200 hover:border-gray-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Directory & Student Import</span>
          </button>

          <button
            onClick={() => setActiveSubTab('departments')}
            className={`flex items-center gap-2 py-3 px-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'departments'
                ? 'border-maroon dark:border-rose-400 text-maroon dark:text-rose-300'
                : 'border-transparent text-gray-body dark:text-neutral-400 hover:text-ink dark:hover:text-neutral-200 hover:border-gray-300'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Departments & Sections</span>
          </button>
        </nav>
      </div>

      {/* SUB-TAB 1: FACULTY APPROVALS */}
      {activeSubTab === 'approvals' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-[#1E1E22] p-4 rounded-xl border border-border-soft dark:border-neutral-800 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search faculty by name, email, employee ID..."
                value={facultySearch}
                onChange={e => setFacultySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-cream/20 dark:bg-neutral-900 border border-border-soft dark:border-neutral-700 rounded-lg text-ink dark:text-neutral-100 placeholder-gray-400 focus:outline-none focus:border-maroon"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-body dark:text-neutral-400">Status:</span>
              <div className="flex rounded-lg border border-border-soft dark:border-neutral-700 p-0.5 bg-cream/20 dark:bg-neutral-900 text-xs font-semibold">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setFacultyStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                      facultyStatusFilter === status
                        ? 'bg-maroon text-white shadow-xs'
                        : 'text-gray-body dark:text-neutral-300 hover:text-ink dark:hover:text-white'
                    }`}
                  >
                    {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Faculty Table */}
          <div className="bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-ink dark:text-neutral-200">
                <thead className="text-xs uppercase bg-cream-edge/40 dark:bg-neutral-800/70 border-b border-border-soft dark:border-neutral-700 text-gray-body dark:text-neutral-400">
                  <tr>
                    <th className="px-6 py-3.5">Faculty Member</th>
                    <th className="px-6 py-3.5">Employee ID</th>
                    <th className="px-6 py-3.5">Email</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft dark:divide-neutral-800">
                  {filteredFaculty.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-gray-body dark:text-neutral-400 text-sm italic">
                        {facultyList.length === 0 ? 'No faculty accounts registered yet.' : 'No faculty match the current search or status filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredFaculty.map(faculty => {
                      const isActing = actionLoadingId === faculty.id;
                      return (
                        <tr key={faculty.id} className="hover:bg-cream/30 dark:hover:bg-neutral-800/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-ink dark:text-neutral-100">{faculty.name}</div>
                            {faculty.department?.name && (
                              <div className="text-xs text-gray-400 mt-0.5">{faculty.department.name}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-gray-body dark:text-neutral-400">
                            {faculty.employeeId || '—'}
                          </td>
                          <td className="px-6 py-4 text-gray-body dark:text-neutral-400">
                            {faculty.email}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              faculty.approvalStatus === 'APPROVED' ? 'bg-green-500/10 text-green-700 dark:text-emerald-300 border-green-200 dark:border-emerald-800' : 
                              faculty.approvalStatus === 'PENDING' ? 'bg-yellow-500/10 text-yellow-700 dark:text-amber-300 border-yellow-200 dark:border-amber-800' : 
                              'bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                            }`}>
                              {faculty.approvalStatus === 'APPROVED' && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-emerald-400" />}
                              {faculty.approvalStatus === 'PENDING' && <Clock className="w-3.5 h-3.5 text-yellow-600 dark:text-amber-400" />}
                              {faculty.approvalStatus === 'REJECTED' && <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
                              {faculty.approvalStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center justify-end gap-2">
                              {faculty.approvalStatus !== 'APPROVED' && (
                                <button
                                  onClick={() => handleApproval(faculty.id, 'APPROVED')}
                                  disabled={isActing}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                                >
                                  {isActing ? 'Updating...' : 'Approve'}
                                </button>
                              )}
                              {faculty.approvalStatus !== 'REJECTED' && (
                                <button
                                  onClick={() => handleApproval(faculty.id, 'REJECTED')}
                                  disabled={isActing}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  {faculty.approvalStatus === 'APPROVED' ? 'Revoke Access' : 'Reject'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: USER DIRECTORY & STUDENT BULK IMPORT */}
      {activeSubTab === 'users' && (
        <div className="space-y-6">
          {/* Bulk Student Import Banner */}
          <div className="rounded-xl border border-maroon/20 dark:border-rose-500/30 bg-cream/30 dark:bg-neutral-900/40 p-5 sm:p-6 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-maroon/10 dark:bg-rose-500/15 text-maroon dark:text-rose-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-serif font-bold text-ink dark:text-neutral-100">
                  Bulk Student Enrollment
                </h2>
                <p className="mt-1 text-xs leading-5 text-gray-body dark:text-neutral-400">
                  Upload a spreadsheet (.csv, .xlsx) containing student accounts. The platform parses roll numbers (e.g. <code>CH.SC.U4CSE24142</code>) to automatically group students by Campus, Degree, Branch, Batch, and Section. Provide the <code>Date of Birth</code> column formatted as DD/MM/YYYY for initial student password generation.
                </p>
                
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-maroon px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-maroon-deep">
                    <Upload className="h-3.5 w-3.5" />
                    {importingStudents ? 'Processing...' : 'Upload Student File (.xlsx / .csv)'}
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="sr-only"
                      disabled={importingStudents}
                      onChange={handleImportStudents}
                    />
                  </label>

                  <a
                    href="/Student_Bulk_Import_Template.csv"
                    download
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-white dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 px-4 py-2 text-xs font-bold text-ink dark:text-neutral-100 shadow-xs transition-colors hover:border-maroon hover:text-maroon"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Download Sample CSV Template
                  </a>
                </div>

                {importSummary && (
                  <div className={`mt-3.5 rounded-lg border px-4 py-3 text-xs ${
                    importSummary.rejected 
                      ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200' 
                      : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-emerald-300'
                  }`}>
                    <p className="font-semibold">
                      Import completed: {importSummary.imported} created · {importSummary.rejected} rejected. {importSummary.message}
                    </p>
                    {importSummary.rejectedRows && importSummary.rejectedRows.length > 0 && (
                      <div className="mt-2 max-h-36 overflow-y-auto rounded bg-white/60 dark:bg-black/30 p-2.5 text-[11px]">
                        <ul className="list-inside list-disc space-y-1">
                          {importSummary.rejectedRows.map((r, i) => (
                            <li key={i}><strong>Row {r.row}:</strong> {r.reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User Directory Table */}
          <div className="bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-xs">
            <div className="p-4 border-b border-border-soft dark:border-neutral-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search accounts by name or email..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-cream/20 dark:bg-neutral-900 border border-border-soft dark:border-neutral-700 rounded-lg text-ink dark:text-neutral-100 placeholder-gray-400 focus:outline-none focus:border-maroon"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-body dark:text-neutral-400">Role:</span>
                <select
                  value={userRoleFilter}
                  onChange={e => setUserRoleFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold bg-cream/20 dark:bg-neutral-900 border border-border-soft dark:border-neutral-700 rounded-lg text-ink dark:text-neutral-200 focus:outline-none focus:border-maroon"
                >
                  <option value="ALL">All Roles ({userList.length})</option>
                  <option value="STUDENT">Students ({userList.filter(u => u.role === 'STUDENT').length})</option>
                  <option value="FACULTY">Faculty ({userList.filter(u => u.role === 'FACULTY').length})</option>
                  <option value="ADMIN">Admins ({userList.filter(u => u.role === 'ADMIN').length})</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-ink dark:text-neutral-200">
                <thead className="text-xs uppercase bg-cream-edge/40 dark:bg-neutral-800/70 border-b border-border-soft dark:border-neutral-700 text-gray-body dark:text-neutral-400">
                  <tr>
                    <th className="px-6 py-3.5">User</th>
                    <th className="px-6 py-3.5">Email</th>
                    <th className="px-6 py-3.5">Role</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft dark:divide-neutral-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-gray-body dark:text-neutral-400 text-sm italic">
                        No accounts match your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-cream/30 dark:hover:bg-neutral-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-ink dark:text-neutral-100">
                          {u.name || 'Unnamed'}
                        </td>
                        <td className="px-6 py-4 text-gray-body dark:text-neutral-400">
                          {u.email}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                            u.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300' :
                            u.role === 'FACULTY' ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' :
                            'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            u.approvalStatus === 'APPROVED' ? 'bg-green-500/10 text-green-700 dark:text-emerald-300 border-green-200 dark:border-emerald-800' : 
                            u.approvalStatus === 'PENDING' ? 'bg-yellow-500/10 text-yellow-700 dark:text-amber-300 border-yellow-200 dark:border-amber-800' : 
                            'bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                          }`}>
                            {u.approvalStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setPendingDelete({ type: 'user', id: u.id, name: u.name || u.email })}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                            title="Delete user permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: DEPARTMENTS & SECTIONS */}
      {activeSubTab === 'departments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1: Academic Batches (3 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-[#1E1E22] p-5 rounded-xl border border-border-soft dark:border-neutral-800 shadow-xs">
              <h2 className="text-base font-serif font-bold text-ink dark:text-neutral-100 mb-1">
                Academic Batches
              </h2>
              <p className="text-xs text-gray-body dark:text-neutral-400 mb-4">
                Select a batch to inspect and configure departments.
              </p>

              {batches.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No batches registered yet.</p>
              ) : (
                <div className="space-y-2">
                  {batches.map(b => {
                    const isSelected = selectedBatchId === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={() => {
                          setSelectedBatchId(b.id);
                          setSelectedDeptId('');
                        }}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-maroon dark:border-rose-400 bg-maroon/5 dark:bg-rose-500/15 shadow-xs'
                            : 'border-border-soft dark:border-neutral-800 hover:border-maroon/40 hover:bg-cream/20 dark:hover:bg-neutral-800/50'
                        }`}
                      >
                        <div>
                          <h3 className={`font-bold text-sm ${isSelected ? 'text-maroon dark:text-rose-300' : 'text-ink dark:text-neutral-100'}`}>
                            {b.name}
                          </h3>
                          <span className="text-[11px] text-gray-400">Start Year: {b.startYear}</span>
                        </div>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-maroon dark:bg-rose-400" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Column 2 & 3: Departments & Section Controls (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {!selectedBatchId ? (
              <div className="bg-white dark:bg-[#1E1E22] p-12 rounded-xl border border-border-soft dark:border-neutral-800 shadow-xs flex flex-col items-center justify-center text-center">
                <Building2 className="w-10 h-10 text-gray-400 mb-2 opacity-50" />
                <p className="text-sm text-gray-body dark:text-neutral-400">
                  Select a batch from the left to configure departments and sections.
                </p>
              </div>
            ) : (
              <>
                {/* Department Creation Header */}
                <div className="bg-white dark:bg-[#1E1E22] p-5 rounded-xl border border-border-soft dark:border-neutral-800 shadow-xs">
                  <h2 className="text-base font-serif font-bold text-ink dark:text-neutral-100 mb-1">
                    Create Department in Batch {currentBatch?.name}
                  </h2>
                  <p className="text-xs text-gray-body dark:text-neutral-400 mb-3">
                    Add branch codes or departments (e.g. CSE, ECE, MECH, AIE).
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newDeptName}
                      onChange={e => setNewDeptName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateDepartment()}
                      placeholder="Department code/name (e.g. CSE, Mechanical Engineering)..."
                      className="flex-1 px-3.5 py-2 text-sm bg-cream/20 dark:bg-neutral-900 border border-border-soft dark:border-neutral-700 rounded-lg text-ink dark:text-neutral-100 focus:outline-none focus:border-maroon"
                    />
                    <button
                      onClick={handleCreateDepartment}
                      disabled={creatingDept || !newDeptName.trim()}
                      className="px-4 py-2 bg-maroon hover:bg-maroon-deep text-white text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {creatingDept ? 'Creating...' : 'Add Department'}
                    </button>
                  </div>
                </div>

                {/* Departments & Sections Dual-Pane */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Department List */}
                  <div className="bg-white dark:bg-[#1E1E22] p-5 rounded-xl border border-border-soft dark:border-neutral-800 shadow-xs">
                    <h3 className="text-sm font-bold text-ink dark:text-neutral-100 mb-3 flex items-center justify-between">
                      <span>Departments ({departments.length})</span>
                    </h3>

                    {departments.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-4">No departments created yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {departments.map(d => {
                          const isSelected = selectedDeptId === d.id;
                          return (
                            <div
                              key={d.id}
                              onClick={() => setSelectedDeptId(d.id)}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'border-maroon dark:border-rose-400 bg-maroon/5 dark:bg-rose-500/15'
                                  : 'border-border-soft dark:border-neutral-800 hover:border-maroon/30 hover:bg-cream/20 dark:hover:bg-neutral-800/40'
                              }`}
                            >
                              <div>
                                <h4 className={`font-semibold text-sm ${isSelected ? 'text-maroon dark:text-rose-300' : 'text-ink dark:text-neutral-100'}`}>
                                  {d.name}
                                </h4>
                                <span className="text-[11px] text-gray-400">{d.sections.length} section(s)</span>
                              </div>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setPendingDelete({ type: 'department', id: d.id, name: d.name });
                                }}
                                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded transition-colors"
                                title="Delete department"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right: Section Controls for Selected Dept */}
                  <div className="bg-white dark:bg-[#1E1E22] p-5 rounded-xl border border-border-soft dark:border-neutral-800 shadow-xs">
                    <h3 className="text-sm font-bold text-ink dark:text-neutral-100 mb-3">
                      Sections {currentDept ? `(${currentDept.name})` : ''}
                    </h3>

                    {!selectedDeptId ? (
                      <p className="text-xs text-gray-400 italic py-4">
                        Select a department on the left to manage its class sections.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newSectionName}
                            onChange={e => setNewSectionName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateSection()}
                            placeholder="Section letter (e.g. A, B, C)..."
                            className="flex-1 px-3 py-1.5 text-xs bg-cream/20 dark:bg-neutral-900 border border-border-soft dark:border-neutral-700 rounded-lg text-ink dark:text-neutral-100 focus:outline-none focus:border-maroon"
                          />
                          <button
                            onClick={handleCreateSection}
                            disabled={creatingSection || !newSectionName.trim()}
                            className="px-3 py-1.5 bg-maroon hover:bg-maroon-deep text-white text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                          >
                            <FolderPlus className="w-3.5 h-3.5" />
                            Add
                          </button>
                        </div>

                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {currentDept?.sections.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No sections created for this department.</p>
                          ) : (
                            currentDept?.sections.map(s => (
                              <div
                                key={s.id}
                                className="p-2.5 rounded-lg border border-border-soft dark:border-neutral-700 bg-cream/20 dark:bg-neutral-800/40 flex items-center justify-between text-xs font-semibold text-ink dark:text-neutral-100"
                              >
                                <span>Section {s.name}</span>
                                <span className="text-[10px] text-gray-400 uppercase font-mono">ID: {s.id.slice(0, 8)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Deletion Dialog */}
      <DeleteConfirmationDialog
        open={Boolean(pendingDelete)}
        itemName={pendingDelete?.name || 'this record'}
        title="Confirm Deletion"
        description={
          pendingDelete?.type === 'department'
            ? 'Deleting this department will permanently remove it and its sections. This action cannot be undone.'
            : 'Deleting this user account will permanently remove their access and profile. This action cannot be undone.'
        }
        confirmLabel="Delete Permanently"
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
