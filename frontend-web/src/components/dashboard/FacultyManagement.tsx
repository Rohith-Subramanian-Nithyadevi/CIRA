import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';
import { DeleteConfirmationDialog } from '@/components/ui/DeleteConfirmationDialog';
import StudentProfileView from './StudentProfileView';
import { downloadCsv } from '@/lib/csv';
import { 
  FileSpreadsheet, 
  Upload, 
  Search, 
  Trash2, 
  RefreshCw, 
  KeyRound,
  Eye,
  Filter,
  X,
  BookOpen,
  GraduationCap
} from 'lucide-react';

interface Faculty {
  id: string;
  name: string;
  email: string;
  employeeId?: string;
  department?: { id: string; name: string; batchId?: string; batch?: { id: string; name: string; startYear: number } } | null;
  section?: { id: string; name: string } | null;
  mappedDepartments?: Array<{
    department: {
      id: string;
      name: string;
      batchId?: string;
      batch?: { id: string; name: string; startYear: number };
    };
  }>;
  mappedSections?: Array<{
    section: {
      id: string;
      name: string;
      department?: {
        id: string;
        name: string;
        batch?: { id: string; name: string; startYear: number };
      };
    };
  }>;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  rollNumber?: string | null;
  employeeId?: string | null;
  department?: { id: string; name: string; batchId?: string; batch?: { id: string; name: string; startYear: number } } | null;
  section?: { id: string; name: string } | null;
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

export type ManagementSection = 'approvals' | 'users' | 'departments';

interface FacultyManagementProps {
  initialTab?: ManagementSection;
  onNavigateTab?: (tab: string) => void;
}

export default function FacultyManagement({ initialTab }: FacultyManagementProps) {
  const [searchParams] = useSearchParams();
  
  // Resolve active section from props or current query parameter
  const activeSection = useMemo<ManagementSection>(() => {
    if (initialTab) return initialTab;
    const tabParam = searchParams.get('tab');
    if (tabParam === 'users' || tabParam === 'user-directory') return 'users';
    if (tabParam === 'departments' || tabParam === 'academic-structure') return 'departments';
    return 'approvals';
  }, [initialTab, searchParams]);

  const [loading, setLoading] = useState(true);

  // Core data states
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);

  // Faculty Approvals filters
  const [facultySearch, setFacultySearch] = useState('');
  const [facultyStatusFilter, setFacultyStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  // User Management filters & profile view
  const [userSearch, setUserSearch] = useState('');
  const [userBatchFilter, setUserBatchFilter] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('');
  const [userSectionFilter, setUserSectionFilter] = useState('');
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);
  const [resettingStudentId, setResettingStudentId] = useState<string | null>(null);

  // Batches & Departments structure state
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [creatingDept, setCreatingDept] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);

  // Bulk student import
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

  // Assign classes modal state
  const [assignModalFaculty, setAssignModalFaculty] = useState<Faculty | null>(null);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');

  const handleOpenAssignModal = (faculty: Faculty) => {
    setAssignModalFaculty(faculty);
    const currDeptIds = (faculty.mappedDepartments || []).map(m => m.department.id);
    const currSectionIds = (faculty.mappedSections || []).map(m => m.section.id);
    setSelectedDeptIds(currDeptIds);
    setSelectedSectionIds(currSectionIds);
    setAssignSearch('');
  };

  const handleToggleDeptAssignment = (deptId: string) => {
    setSelectedDeptIds(prev => 
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  const handleToggleSectionAssignment = (sectionId: string) => {
    setSelectedSectionIds(prev =>
      prev.includes(sectionId) ? prev.filter(id => id !== sectionId) : [...prev, sectionId]
    );
  };

  const handleSaveAssignments = async () => {
    if (!assignModalFaculty) return;
    setSavingAssignments(true);
    try {
      const res = await apiClient.fetch(`/api/v1/admin/faculty/${assignModalFaculty.id}/assign-classes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentIds: selectedDeptIds,
          sectionIds: selectedSectionIds,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.status === 'success') {
        toast.success(`Classes assigned to ${assignModalFaculty.name} successfully.`);
        if (data.data?.faculty) {
          setFacultyList(prev =>
            prev.map(f => (f.id === assignModalFaculty.id ? { ...f, ...data.data.faculty } : f))
          );
        } else {
          fetchAdminData();
        }
        setAssignModalFaculty(null);
      } else {
        toast.error(data?.message || 'Failed to assign classes.');
      }
    } catch (err) {
      toast.error('Network error while assigning classes.');
    } finally {
      setSavingAssignments(false);
    }
  };

  // Fetch all primary admin data (faculty, users, batches, and all departments)
  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [facRes, userRes, batchRes, deptRes] = await Promise.all([
        apiClient.fetch('/api/v1/admin/faculty/all'),
        apiClient.fetch('/api/v1/admin/users'),
        apiClient.fetch('/api/v1/batches'),
        apiClient.fetch('/api/v1/departments')
      ]);

      const facData = await facRes.json().catch(() => ({}));
      const userData = await userRes.json().catch(() => ({}));
      const batchData = await batchRes.json().catch(() => ({}));
      const deptData = await deptRes.json().catch(() => ({}));

      if (facData.data?.faculty) {
        setFacultyList(facData.data.faculty);
      } else if (Array.isArray(facData.data)) {
        setFacultyList(facData.data);
      }

      if (userData.data?.users) {
        const sortedUsers = [...userData.data.users].sort((a: User, b: User) => {
          if (a.role !== b.role) return a.role.localeCompare(b.role);
          const rollA = a.rollNumber || '';
          const rollB = b.rollNumber || '';
          return rollA.localeCompare(rollB);
        });
        setUserList(sortedUsers);
      } else if (Array.isArray(userData.data)) {
        setUserList(userData.data);
      }

      const fetchedDepts: Department[] = deptData.data?.departments || (Array.isArray(deptData.data) ? deptData.data : []);
      setAllDepartments(fetchedDepts);

      let loadedBatches: Batch[] = [];
      if (batchData.data?.batches) {
        loadedBatches = batchData.data.batches;
        setBatches(loadedBatches);
      } else if (Array.isArray(batchData.data)) {
        loadedBatches = batchData.data;
        setBatches(loadedBatches);
      }

      // Auto-select a batch that has existing departments, or fallback to the first batch
      if (loadedBatches.length > 0) {
        setSelectedBatchId(prev => {
          if (prev && loadedBatches.some(b => b.id === prev)) return prev;
          const batchWithDepts = loadedBatches.find(b => fetchedDepts.some(d => d.batchId === b.id));
          return batchWithDepts ? batchWithDepts.id : loadedBatches[0].id;
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch administration data', err);
      toast.error('Failed to load administrative records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAdminData();
  }, []);

  // Departments for the currently selected batch in Batches & Departments view
  const departmentsForSelectedBatch = useMemo(() => {
    if (!selectedBatchId) return allDepartments;
    return allDepartments.filter(d => d.batchId === selectedBatchId);
  }, [allDepartments, selectedBatchId]);

  // Auto-select the first department in the selected batch
  useEffect(() => {
    if (departmentsForSelectedBatch.length > 0) {
      if (!selectedDeptId || !departmentsForSelectedBatch.some(d => d.id === selectedDeptId)) {
        setSelectedDeptId(departmentsForSelectedBatch[0].id);
      }
    } else {
      setSelectedDeptId('');
    }
  }, [departmentsForSelectedBatch, selectedDeptId]);

  // Handle Faculty Approval / Rejection
  const handleApproval = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      setActionLoadingId(id);
      const res = await apiClient.fetch(`/api/v1/admin/faculty/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (!data.status || data.status === 'success')) {
        toast.success(status === 'APPROVED' ? 'Faculty approved successfully' : 'Faculty access revoked');
        setFacultyList(prev => prev.map(f => f.id === id ? { ...f, approvalStatus: status } : f));
        setUserList(prev => prev.map(u => u.id === id ? { ...u, approvalStatus: status } : u));
      } else {
        toast.error(data.message || 'Failed to update faculty status');
      }
    } catch (err) {
      toast.error('Network error updating faculty status');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Bulk Student File Import
  const handleImportStudents = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setImportingStudents(true);
      setImportSummary(null);

      const res = await apiClient.fetch('/api/v1/admin/users/bulk-import-students', {
        method: 'POST',
        body: formData
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.status === 'success' || data.imported !== undefined)) {
        toast.success(`Successfully imported ${data.data?.imported ?? data.imported ?? 0} students!`);
        setImportSummary(data.data || data);
        void fetchAdminData();
      } else {
        toast.error(data.message || 'Bulk student import failed.');
        if (data.data?.rejectedRows || data.rejectedRows) {
          setImportSummary(data.data || data);
        }
      }
    } catch (err: any) {
      toast.error('Network error during bulk student upload: ' + (err.message || 'Unknown error'));
    } finally {
      setImportingStudents(false);
      e.target.value = '';
    }
  };

  // Download Student Import Template
  const handleDownloadTemplate = () => {
    const headers = ['name', 'email', 'rollNumber', 'batch', 'department', 'section', 'personalEmail', 'phone'];
    const sampleRows = [
      {
        name: 'Arun Kumar',
        email: 'arun@college.edu',
        rollNumber: 'CH.SC.U4CSE24001',
        batch: '2024',
        department: 'Computer Science & Engineering',
        section: 'A',
        personalEmail: 'arunkumar@gmail.com',
        phone: '9876543210'
      },
      {
        name: 'Bhavna Sharma',
        email: 'bhavna@college.edu',
        rollNumber: 'CH.SC.U4CSE24002',
        batch: '2024',
        department: 'Computer Science & Engineering',
        section: 'B',
        personalEmail: 'bhavna.sharma@gmail.com',
        phone: '9876543211'
      }
    ];
    downloadCsv(sampleRows, headers, 'Student_Bulk_Import_Template');
    toast.success('Student enrollment template downloaded.');
  };

  // Password reset for individual student
  const handleResetPassword = async (user: User) => {
    try {
      setResettingStudentId(user.id);
      const res = await apiClient.fetch(`/api/v1/admin/users/${user.id}/reset-password`, {
        method: 'POST'
      });
      const data = await res.json().catch(() => null);
      if (res.ok && (!data || data.status === 'success')) {
        toast.success(`Password reset successfully for ${user.name}`);
      } else {
        toast.error(data?.message || 'Failed to reset password');
      }
    } catch {
      toast.error('Network error resetting student password');
    } finally {
      setResettingStudentId(null);
    }
  };

  // Create Department
  const handleCreateDepartment = async () => {
    if (!selectedBatchId) {
      toast.error('Please select an academic batch first.');
      return;
    }
    const cleanName = newDeptName.trim();
    if (!cleanName) {
      toast.error('Please enter a department name.');
      return;
    }

    try {
      setCreatingDept(true);
      const res = await apiClient.fetch('/api/v1/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, batchId: selectedBatchId })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.data?.department) {
        toast.success(`Department "${cleanName}" created successfully!`);
        const createdDept: Department = {
          ...data.data.department,
          sections: data.data.department.sections || []
        };
        setAllDepartments(prev => [...prev, createdDept]);
        setSelectedDeptId(createdDept.id);
        setNewDeptName('');
      } else {
        toast.error(data.message || 'Failed to create department.');
      }
    } catch (err) {
      toast.error('Network error while creating department.');
    } finally {
      setCreatingDept(false);
    }
  };

  // Create Section
  const handleCreateSection = async () => {
    if (!selectedDeptId) {
      toast.error('Please select a department first.');
      return;
    }
    const cleanName = newSectionName.trim();
    if (!cleanName) {
      toast.error('Please enter a section name (e.g. A, B, C).');
      return;
    }

    try {
      setCreatingSection(true);
      const res = await apiClient.fetch('/api/v1/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, departmentId: selectedDeptId })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.data?.section) {
        toast.success(`Section "${cleanName}" added!`);
        setAllDepartments(prev =>
          prev.map(dept => {
            if (dept.id !== selectedDeptId) return dept;
            return {
              ...dept,
              sections: [...(dept.sections || []), data.data.section]
            };
          })
        );
        setNewSectionName('');
      } else {
        toast.error(data.message || 'Failed to create section.');
      }
    } catch (err) {
      toast.error('Network error while adding section.');
    } finally {
      setCreatingSection(false);
    }
  };

  // Confirm delete (User or Department)
  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const { type, id, name } = pendingDelete;
    const endpoint = type === 'user' ? `/api/v1/admin/users/${id}` : `/api/v1/departments/${id}`;

    try {
      const res = await apiClient.fetch(endpoint, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (res.ok && (!data || data.status === 'success')) {
        toast.success(`${type === 'user' ? 'User' : 'Department'} "${name}" deleted.`);
        if (type === 'user') {
          setUserList(prev => prev.filter(u => u.id !== id));
          setFacultyList(prev => prev.filter(f => f.id !== id));
        } else {
          setAllDepartments(prev => prev.filter(d => d.id !== id));
          if (selectedDeptId === id) setSelectedDeptId('');
        }
      } else {
        toast.error(data?.message || `Failed to delete ${name}.`);
      }
    } catch (err) {
      toast.error(`Error deleting ${name}.`);
    } finally {
      setPendingDelete(null);
    }
  };

  // Filtered Faculty List
  const filteredFaculty = useMemo(() => {
    return facultyList.filter(f => {
      if (facultyStatusFilter !== 'ALL' && f.approvalStatus !== facultyStatusFilter) {
        return false;
      }
      if (facultySearch.trim()) {
        const q = facultySearch.toLowerCase();
        const matchName = f.name?.toLowerCase().includes(q);
        const matchEmail = f.email?.toLowerCase().includes(q);
        const matchEmp = f.employeeId ? f.employeeId.toLowerCase().includes(q) : false;
        if (!matchName && !matchEmail && !matchEmp) return false;
      }
      return true;
    });
  }, [facultyList, facultyStatusFilter, facultySearch]);

  // Students Only in User Management (exclude Faculty / Admin)
  const studentUsers = useMemo(() => {
    return userList.filter(u => u.role === 'STUDENT');
  }, [userList]);

  // Department options for User Management filter
  const userFilterDeptOptions = useMemo(() => {
    if (!userBatchFilter) return allDepartments;
    return allDepartments.filter(d => d.batchId === userBatchFilter);
  }, [allDepartments, userBatchFilter]);

  // Section options for User Management filter
  const userFilterSectionOptions = useMemo(() => {
    if (!userDeptFilter) {
      return Array.from(new Set(userFilterDeptOptions.flatMap(d => (d.sections || []).map(s => s.name))))
        .sort()
        .map(name => ({ id: name, name }));
    }
    const dept = userFilterDeptOptions.find(d => d.id === userDeptFilter || d.name === userDeptFilter);
    return dept ? (dept.sections || []) : [];
  }, [userDeptFilter, userFilterDeptOptions]);

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    return studentUsers.filter(u => {
      // Batch filter
      if (userBatchFilter) {
        const uBatchId = u.department?.batchId;
        const uBatchYear = u.department?.batch?.startYear ? String(u.department.batch.startYear) : '';
        if (uBatchId !== userBatchFilter && uBatchYear !== userBatchFilter) return false;
      }

      // Department filter
      if (userDeptFilter && u.department?.id !== userDeptFilter && u.department?.name !== userDeptFilter) {
        return false;
      }

      // Section filter
      if (userSectionFilter && u.section?.id !== userSectionFilter && u.section?.name !== userSectionFilter) {
        return false;
      }

      // Search filter
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        const matchName = u.name?.toLowerCase().includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        const matchRoll = u.rollNumber ? u.rollNumber.toLowerCase().includes(q) : false;
        if (!matchName && !matchEmail && !matchRoll) return false;
      }

      return true;
    });
  }, [studentUsers, userBatchFilter, userDeptFilter, userSectionFilter, userSearch]);

  // If a student's profile is opened from User Management, render StudentProfileView
  if (profileStudentId) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setProfileStudentId(null)}
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-body hover:text-maroon px-3 py-1.5 rounded-lg border border-border-soft hover:bg-cream transition-colors cursor-pointer"
        >
          &larr; Back to User Management
        </button>
        <StudentProfileView studentId={profileStudentId} onBack={() => setProfileStudentId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* 1. FACULTY APPROVALS VIEW (Standalone)                       */}
      {/* ============================================================ */}
      {activeSection === 'approvals' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-serif font-bold text-ink dark:text-neutral-100">Faculty Approvals</h1>
              <p className="text-sm text-gray-body dark:text-neutral-400">Review pending instructor registrations and manage teaching privileges.</p>
            </div>
            <button
              onClick={fetchAdminData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-body hover:text-maroon border border-border-soft rounded-lg hover:bg-cream/50 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-maroon' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Metric Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-[#1E1E22] p-6 rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm">
              <h3 className="text-gray-body dark:text-neutral-400 text-sm font-medium">Total Faculty</h3>
              <p className="text-3xl font-bold mt-2 text-maroon dark:text-rose-400">{facultyList.length}</p>
            </div>
            <div className="bg-white dark:bg-[#1E1E22] p-6 rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm">
              <h3 className="text-gray-body dark:text-neutral-400 text-sm font-medium">Pending Approvals</h3>
              <p className="text-3xl font-bold mt-2 text-maroon dark:text-rose-400">
                {facultyList.filter(f => f.approvalStatus === 'PENDING').length}
              </p>
            </div>
          </section>

          {/* Faculty Table Section */}
          <section className="bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-serif font-bold text-ink dark:text-neutral-100">Faculty Management</h2>
              
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-muted" />
                  <input
                    type="text"
                    value={facultySearch}
                    onChange={e => setFacultySearch(e.target.value)}
                    placeholder="Search faculty..."
                    className="pl-9 pr-3 py-1.5 text-xs bg-cream/40 dark:bg-neutral-800 border border-border-soft dark:border-neutral-700 rounded-lg focus:border-maroon focus:ring-1 focus:ring-maroon text-ink dark:text-neutral-100 outline-none w-48 sm:w-60"
                  />
                </div>
                <div className="flex items-center gap-1 bg-cream/40 dark:bg-neutral-800 p-1 rounded-lg border border-border-soft dark:border-neutral-700 text-xs font-semibold">
                  {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setFacultyStatusFilter(status)}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        facultyStatusFilter === status ? 'bg-maroon text-white shadow-xs' : 'text-gray-body dark:text-neutral-400 hover:text-ink'
                      }`}
                    >
                      {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredFaculty.length === 0 ? (
              <p className="text-gray-body dark:text-neutral-400 text-sm italic py-4">No faculty records found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-ink dark:text-neutral-200">
                  <thead className="text-xs uppercase bg-cream-edge/40 dark:bg-neutral-800/70 border-b border-border-soft dark:border-neutral-700 text-gray-body dark:text-neutral-400">
                    <tr>
                      <th className="px-6 py-3">Name</th>
                      <th className="px-6 py-3">Employee ID</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Assigned Classes</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFaculty.map(faculty => (
                      <tr key={faculty.id} className="border-b border-border-soft dark:border-neutral-800 hover:bg-cream/40 dark:hover:bg-neutral-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-ink dark:text-neutral-100">{faculty.name}</td>
                        <td className="px-6 py-4 font-mono text-xs">{faculty.employeeId || '—'}</td>
                        <td className="px-6 py-4 text-gray-body dark:text-neutral-400">{faculty.email}</td>
                        <td className="px-6 py-4">
                          {(() => {
                            const deptCount = faculty.mappedDepartments?.length || 0;
                            const secCount = faculty.mappedSections?.length || 0;
                            const totalCount = deptCount + secCount;
                            if (totalCount === 0) {
                              return (
                                <span className="text-xs text-gray-body/60 dark:text-neutral-500 italic">
                                  No classes assigned
                                </span>
                              );
                            }
                            return (
                              <div className="flex flex-wrap gap-1.5 max-w-xs">
                                {faculty.mappedDepartments?.map(md => (
                                  <span
                                    key={`dept-${md.department.id}`}
                                    title={`${md.department.batch?.name ? `${md.department.batch.name} · ` : ''}${md.department.name} (All Sections)`}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-maroon/10 text-maroon dark:bg-rose-500/20 dark:text-rose-300"
                                  >
                                    {md.department.name} (All)
                                  </span>
                                ))}
                                {faculty.mappedSections?.map(ms => (
                                  <span
                                    key={`sec-${ms.section.id}`}
                                    title={`${ms.section.department?.name || ''} - Section ${ms.section.name}`}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cream-edge/60 dark:bg-neutral-800 text-ink dark:text-neutral-300 border border-border-soft dark:border-neutral-700"
                                  >
                                    {ms.section.department?.name ? `${ms.section.department.name} - ` : ''}Sec {ms.section.name}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            faculty.approvalStatus === 'APPROVED' ? 'bg-green-500/10 text-green-700 dark:text-emerald-300 border-green-200 dark:border-emerald-800' : 
                            faculty.approvalStatus === 'PENDING' ? 'bg-yellow-500/10 text-yellow-700 dark:text-amber-300 border-yellow-200 dark:border-amber-800' : 
                            'bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                          }`}>
                            {faculty.approvalStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {faculty.approvalStatus === 'APPROVED' && (
                            <button
                              onClick={() => handleOpenAssignModal(faculty)}
                              className="text-maroon dark:text-rose-400 hover:text-maroon-deep mr-4 font-semibold inline-flex items-center gap-1 cursor-pointer"
                              title="Assign classes and sections to this faculty member"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Assign</span>
                            </button>
                          )}
                          {faculty.approvalStatus !== 'APPROVED' && (
                            <button
                              onClick={() => handleApproval(faculty.id, 'APPROVED')}
                              disabled={actionLoadingId === faculty.id}
                              className="text-green-600 dark:text-emerald-400 hover:text-green-700 mr-4 font-semibold cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {faculty.approvalStatus !== 'REJECTED' && (
                            <button
                              onClick={() => handleApproval(faculty.id, 'REJECTED')}
                              disabled={actionLoadingId === faculty.id}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 font-semibold cursor-pointer"
                            >
                              {faculty.approvalStatus === 'APPROVED' ? 'Revoke Access' : 'Reject'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. USER MANAGEMENT VIEW (Students Only, Standalone)          */}
      {/* ============================================================ */}
      {activeSection === 'users' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Bulk Import Students Card */}
          <div className="rounded-xl border border-maroon/20 dark:border-rose-500/30 bg-cream/30 dark:bg-neutral-900/40 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-maroon/10 dark:bg-rose-500/15 text-maroon dark:text-rose-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-bold text-ink dark:text-neutral-100">Bulk import students</h2>
                <p className="mt-1 text-xs leading-5 text-gray-body dark:text-neutral-400">
                  Import a CSV or XLSX file. Students will be automatically grouped by Campus, Batch, Branch, and Section based on their Roll Number (e.g. <code>CH.SC.U4CSE24142</code>). Please ensure the <code>Date of Birth</code> column is formatted as DD/MM/YYYY for correct password generation.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-maroon px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-maroon-deep hover:shadow-md">
                <Upload className="h-4 w-4" />
                {importingStudents ? 'Importing...' : 'Upload Student File'}
                <input type="file" accept=".csv,.xlsx,.xls" className="sr-only" disabled={importingStudents} onChange={handleImportStudents} />
              </label>

              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 px-6 py-2.5 text-sm font-bold text-ink dark:text-neutral-100 shadow-sm transition-all hover:-translate-y-0.5 hover:border-maroon hover:text-maroon cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Download Template
              </button>
            </div>

            {importSummary && (
              <div className={`mt-3 rounded-lg border px-4 py-3 text-sm ${importSummary.rejected ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200' : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-emerald-300'}`}>
                <p className="font-semibold">Imported: {importSummary.imported} · Rejected: {importSummary.rejected}. {importSummary.message}</p>
                {importSummary.rejectedRows && importSummary.rejectedRows.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto rounded bg-white/50 dark:bg-black/20 p-2 text-xs">
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

          {/* User Management Section */}
          <div className="bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-serif font-bold text-ink dark:text-neutral-100">User Management</h2>
                <p className="text-xs text-gray-body dark:text-neutral-400">Institutional student accounts with academic batch, department, and section filters.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchAdminData}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-body hover:text-maroon border border-border-soft rounded-lg hover:bg-cream/50 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-maroon' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Batch, Department, Section Filters and Search Bar */}
            <div className="p-4 bg-cream/40 dark:bg-neutral-800/40 rounded-xl border border-border-soft dark:border-neutral-700/60 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-body">
                <Filter className="w-3.5 h-3.5 text-maroon" />
                <span>Filters:</span>
              </div>

              {/* Batch Filter */}
              <select
                value={userBatchFilter}
                onChange={e => {
                  setUserBatchFilter(e.target.value);
                  setUserDeptFilter('');
                  setUserSectionFilter('');
                }}
                className="px-3 py-1.5 text-xs bg-white dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 rounded-lg text-ink dark:text-neutral-200 outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
              >
                <option value="">All Batches</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              {/* Department Filter */}
              <select
                value={userDeptFilter}
                onChange={e => {
                  setUserDeptFilter(e.target.value);
                  setUserSectionFilter('');
                }}
                className="px-3 py-1.5 text-xs bg-white dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 rounded-lg text-ink dark:text-neutral-200 outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
              >
                <option value="">All Departments</option>
                {userFilterDeptOptions.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              {/* Section Filter */}
              <select
                value={userSectionFilter}
                onChange={e => setUserSectionFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 rounded-lg text-ink dark:text-neutral-200 outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
              >
                <option value="">All Sections</option>
                {userFilterSectionOptions.map(s => (
                  <option key={s.id} value={s.id}>Section {s.name}</option>
                ))}
              </select>

              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-muted" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search student by name, roll no, email..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 rounded-lg text-ink dark:text-neutral-200 outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                />
              </div>

              {/* Clear Filters */}
              {(userBatchFilter || userDeptFilter || userSectionFilter || userSearch) && (
                <button
                  onClick={() => {
                    setUserBatchFilter('');
                    setUserDeptFilter('');
                    setUserSectionFilter('');
                    setUserSearch('');
                  }}
                  className="px-2.5 py-1.5 text-xs text-maroon hover:bg-maroon/10 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Students Table */}
            {filteredStudents.length === 0 ? (
              <p className="text-gray-body dark:text-neutral-400 text-sm italic py-4">No student records match the selected criteria.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-ink dark:text-neutral-200">
                  <thead className="text-xs uppercase bg-cream-edge/40 dark:bg-neutral-800/70 border-b border-border-soft dark:border-neutral-700 text-gray-body dark:text-neutral-400">
                    <tr>
                      <th className="px-6 py-3">Student Name</th>
                      <th className="px-6 py-3">Roll Number</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Academic Scope</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(student => (
                      <tr key={student.id} className="border-b border-border-soft dark:border-neutral-800 hover:bg-cream/40 dark:hover:bg-neutral-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-ink dark:text-neutral-100">
                          <button
                            onClick={() => setProfileStudentId(student.id)}
                            className="text-left font-bold text-ink dark:text-neutral-100 hover:text-maroon dark:hover:text-rose-400 cursor-pointer transition-colors"
                          >
                            {student.name}
                          </button>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-body dark:text-neutral-300">
                          {student.rollNumber || '—'}
                        </td>
                        <td className="px-6 py-4 text-gray-body dark:text-neutral-400 text-xs">
                          {student.email}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-body dark:text-neutral-300">
                          {student.department?.name || 'Department Unassigned'}
                          {student.section?.name ? ` · Sec ${student.section.name}` : ''}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            student.approvalStatus === 'APPROVED' ? 'bg-green-500/10 text-green-700 dark:text-emerald-300 border-green-200 dark:border-emerald-800' : 
                            student.approvalStatus === 'PENDING' ? 'bg-yellow-500/10 text-yellow-700 dark:text-amber-300 border-yellow-200 dark:border-amber-800' : 
                            'bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                          }`}>
                            {student.approvalStatus || 'APPROVED'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setProfileStudentId(student.id)}
                              className="px-2 py-1 text-xs font-bold text-gray-body hover:text-maroon border border-border-soft rounded-lg hover:bg-cream/50 transition-colors cursor-pointer flex items-center gap-1"
                              title="View Student Profile"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Profile</span>
                            </button>
                            <button
                              onClick={() => handleResetPassword(student)}
                              disabled={resettingStudentId === student.id}
                              className="px-2 py-1 text-xs font-bold text-gray-body hover:text-amber-600 border border-border-soft rounded-lg hover:bg-amber-50 transition-colors cursor-pointer flex items-center gap-1"
                              title="Reset Password"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Reset</span>
                            </button>
                            <button
                              onClick={() => setPendingDelete({ type: 'user', id: student.id, name: student.name || student.email })}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Student"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. DEPARTMENTS VIEW (3-Column Layout, Standalone)            */}
      {/* ============================================================ */}
      {activeSection === 'departments' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-serif font-bold text-ink dark:text-neutral-100">Batches & Departments</h1>
              <p className="text-sm text-gray-body dark:text-neutral-400">Configure academic batches, departments, and class sections.</p>
            </div>
            <button
              onClick={fetchAdminData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-body hover:text-maroon border border-border-soft rounded-lg hover:bg-cream/50 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-maroon' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Batches List with Department Count */}
            <div className="p-6 bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm overflow-y-auto max-h-[600px] col-span-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-serif font-bold text-ink dark:text-neutral-100">Batches</h2>
                <span className="text-xs text-gray-body dark:text-neutral-400 font-semibold">{batches.length} batches</span>
              </div>

              {batches.length === 0 ? (
                <p className="text-sm text-gray-body dark:text-neutral-400 italic">No batches created.</p>
              ) : (
                batches.map(b => {
                  const count = allDepartments.filter(d => d.batchId === b.id).length;
                  const isSelected = selectedBatchId === b.id;
                  return (
                    <div
                      key={b.id}
                      className={`p-4 border rounded-xl mb-3 cursor-pointer transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'border-maroon dark:border-rose-400 bg-maroon/5 dark:bg-rose-500/15 ring-1 ring-maroon dark:ring-rose-400'
                          : 'border-border-soft dark:border-neutral-800 hover:border-maroon/30 hover:bg-cream/40 dark:hover:bg-neutral-800/50'
                      }`}
                      onClick={() => {
                        setSelectedBatchId(b.id);
                        setSelectedDeptId('');
                      }}
                    >
                      <div>
                        <h3 className="font-bold text-ink dark:text-neutral-100 text-base">{b.name}</h3>
                        <p className="text-xs text-gray-body dark:text-neutral-400 mt-0.5">
                          {count} {count === 1 ? 'department' : 'departments'}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="w-2.5 h-2.5 rounded-full bg-maroon dark:bg-rose-400 shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Column 2: Departments & Sections */}
            <div className="col-span-2 space-y-6">
              {!selectedBatchId ? (
                <div className="p-6 bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm flex items-center justify-center h-full min-h-[300px]">
                  <p className="text-gray-body dark:text-neutral-400 italic">Select a batch to manage departments.</p>
                </div>
              ) : (
                <>
                  {/* Create Department Card */}
                  <div className="p-6 bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm">
                    <h2 className="text-xl font-serif font-bold mb-4 text-ink dark:text-neutral-100">
                      Create Department for {batches.find(b => b.id === selectedBatchId)?.name || 'Selected Batch'}
                    </h2>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={newDeptName}
                        onChange={e => setNewDeptName(e.target.value)}
                        placeholder="Department Name (e.g. Mechanical Engineering)"
                        className="flex-1 px-4 py-2.5 bg-white dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 rounded-lg focus:border-maroon focus:ring-1 focus:ring-maroon text-ink dark:text-neutral-100 outline-none text-sm"
                      />
                      <button
                        onClick={handleCreateDepartment}
                        disabled={creatingDept}
                        className="px-6 py-2.5 bg-maroon hover:bg-maroon-deep text-white rounded-full font-bold transition-all hover:scale-105 active:scale-95 text-sm shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {creatingDept ? 'Creating...' : 'Create'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Departments List */}
                    <div className="p-6 bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm overflow-y-auto max-h-[400px]">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-serif font-bold text-ink dark:text-neutral-100">Departments List</h2>
                        <span className="text-xs text-gray-body dark:text-neutral-400 font-semibold">
                          {departmentsForSelectedBatch.length} {departmentsForSelectedBatch.length === 1 ? 'dept' : 'depts'}
                        </span>
                      </div>

                      {departmentsForSelectedBatch.length === 0 ? (
                        <p className="text-sm text-gray-body dark:text-neutral-400 italic">No departments created in this batch.</p>
                      ) : (
                        departmentsForSelectedBatch.map(d => (
                          <div
                            key={d.id}
                            className={`p-4 border rounded-xl mb-3 cursor-pointer transition-colors flex justify-between items-center ${
                              selectedDeptId === d.id
                                ? 'border-maroon dark:border-rose-400 bg-maroon/5 dark:bg-rose-500/15 ring-1 ring-maroon dark:ring-rose-400'
                                : 'border-border-soft dark:border-neutral-800 hover:border-maroon/30 hover:bg-cream/40 dark:hover:bg-neutral-800/50'
                            }`}
                            onClick={() => setSelectedDeptId(d.id)}
                          >
                            <div>
                              <h3 className="font-bold text-ink dark:text-neutral-100">{d.name}</h3>
                              <p className="text-xs text-gray-body dark:text-neutral-400 mt-0.5">
                                {(d.sections || []).length} { (d.sections || []).length === 1 ? 'section' : 'sections'}
                              </p>
                            </div>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setPendingDelete({ type: 'department', id: d.id, name: d.name });
                              }}
                              className="text-red-600 dark:text-red-400 text-xs font-semibold hover:underline cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Manage Sections */}
                    <div className="p-6 bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm">
                      <h2 className="text-lg font-serif font-bold mb-4 text-ink dark:text-neutral-100">Manage Sections</h2>
                      {!selectedDeptId ? (
                        <p className="text-gray-body dark:text-neutral-400 italic text-sm">Select a department to manage sections.</p>
                      ) : (
                        <div className="space-y-4">
                          <h3 className="font-bold text-maroon dark:text-rose-400">
                            {departmentsForSelectedBatch.find(d => d.id === selectedDeptId)?.name}
                          </h3>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newSectionName}
                              onChange={e => setNewSectionName(e.target.value)}
                              placeholder="Section (e.g. A, B)"
                              className="w-full px-4 py-2 bg-white dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 rounded-lg focus:border-maroon focus:ring-1 focus:ring-maroon text-ink dark:text-neutral-100 outline-none text-sm"
                            />
                            <button
                              onClick={handleCreateSection}
                              disabled={creatingSection}
                              className="px-6 py-2 bg-maroon hover:bg-maroon-deep text-white rounded-full font-bold transition-all text-sm shadow-sm cursor-pointer disabled:opacity-50"
                            >
                              {creatingSection ? 'Adding...' : 'Add'}
                            </button>
                          </div>
                          <div className="mt-4 space-y-2 max-h-[250px] overflow-y-auto">
                            {(departmentsForSelectedBatch.find(d => d.id === selectedDeptId)?.sections || []).length === 0 ? (
                              <p className="text-xs text-gray-body dark:text-neutral-400 italic">No sections created yet.</p>
                            ) : (
                              (departmentsForSelectedBatch.find(d => d.id === selectedDeptId)?.sections || []).map(s => (
                                <div
                                  key={s.id}
                                  className="p-3 bg-cream/40 dark:bg-neutral-800/50 border border-border-soft dark:border-neutral-700 rounded-lg flex justify-between items-center text-sm text-ink dark:text-neutral-100"
                                >
                                  <span>Section {s.name}</span>
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
        </div>
      )}

      {/* Class Assignment Modal */}
      {assignModalFaculty && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-classes-title"
        >
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border-soft dark:border-neutral-800 bg-white dark:bg-[#1E1E22] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-border-soft dark:border-neutral-800 flex items-start justify-between gap-4 bg-cream/30 dark:bg-neutral-900/40">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-maroon/10 text-maroon dark:bg-rose-500/15 dark:text-rose-400">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="assign-classes-title" className="text-xl font-serif font-bold text-ink dark:text-neutral-100">
                    Assign Classes & Sections
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-body dark:text-neutral-400">
                    <span className="font-semibold text-ink dark:text-neutral-200">{assignModalFaculty.name}</span>
                    <span>·</span>
                    <span>{assignModalFaculty.email}</span>
                    {assignModalFaculty.employeeId && (
                      <>
                        <span>·</span>
                        <span className="font-mono bg-cream dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-border-soft dark:border-neutral-700">
                          ID: {assignModalFaculty.employeeId}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalFaculty(null)}
                aria-label="Close modal"
                className="text-gray-body hover:text-ink dark:text-neutral-400 dark:hover:text-neutral-100 p-1.5 rounded-lg hover:bg-cream dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Subheader & Search */}
            <div className="px-6 py-3 border-b border-border-soft dark:border-neutral-800 bg-cream/10 dark:bg-neutral-900/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs text-gray-body dark:text-neutral-400">
                Select authorized departments or individual sections. Enrolled classes appear in the faculty member&apos;s Student Reports and exam scoping.
              </p>
              {allDepartments.length > 3 && (
                <div className="relative shrink-0">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-muted" />
                  <input
                    type="text"
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    placeholder="Filter classes..."
                    className="pl-8 pr-2.5 py-1 text-xs bg-white dark:bg-neutral-800 border border-border-soft dark:border-neutral-700 rounded-lg text-ink dark:text-neutral-100 outline-none w-44"
                  />
                </div>
              )}
            </div>

            {/* Modal Body: Batches, Departments & Sections */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {batches.length === 0 && allDepartments.length === 0 ? (
                <div className="text-center py-8 text-gray-body dark:text-neutral-400 text-sm italic">
                  No academic batches or departments configured. Please add batches and departments in the Departments tab first.
                </div>
              ) : (
                (() => {
                  const query = assignSearch.trim().toLowerCase();
                  const batchGroups = batches.map(batch => {
                    const depts = allDepartments.filter(d => {
                      if (d.batchId !== batch.id) return false;
                      if (!query) return true;
                      const matchDept = d.name.toLowerCase().includes(query);
                      const matchBatch = batch.name.toLowerCase().includes(query);
                      const matchSec = (d.sections || []).some(s => s.name.toLowerCase().includes(query));
                      return matchDept || matchBatch || matchSec;
                    });
                    return { batch, depts };
                  }).filter(g => g.depts.length > 0);

                  if (batchGroups.length === 0) {
                    return (
                      <p className="text-center py-8 text-gray-body dark:text-neutral-400 text-sm italic">
                        No departments or sections match &ldquo;{assignSearch}&rdquo;.
                      </p>
                    );
                  }

                  return batchGroups.map(({ batch, depts }) => (
                    <div key={batch.id} className="space-y-3">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-border-soft dark:border-neutral-800">
                        <span className="text-xs font-bold uppercase tracking-wider text-maroon dark:text-rose-400">
                          {batch.name}
                        </span>
                        <span className="text-xs text-gray-body dark:text-neutral-500">
                          (Year {batch.startYear})
                        </span>
                      </div>

                      <div className="space-y-3 pl-1">
                        {depts.map(dept => {
                          const isDeptSelected = selectedDeptIds.includes(dept.id);
                          const sections = dept.sections || [];

                          return (
                            <div 
                              key={dept.id} 
                              className={`rounded-xl border p-4 transition-all ${
                                isDeptSelected 
                                  ? 'border-maroon/40 bg-maroon/[0.03] dark:border-rose-500/40 dark:bg-rose-500/[0.05]' 
                                  : 'border-border-soft dark:border-neutral-800 bg-white dark:bg-[#242429]'
                              }`}
                            >
                              {/* Department level checkbox */}
                              <div className="flex items-start justify-between gap-3">
                                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={isDeptSelected}
                                    onChange={() => handleToggleDeptAssignment(dept.id)}
                                    className="mt-1 h-4 w-4 rounded border-border-soft text-maroon focus:ring-maroon cursor-pointer"
                                  />
                                  <div>
                                    <span className="font-semibold text-sm text-ink dark:text-neutral-100">
                                      {dept.name}
                                    </span>
                                    <span className="ml-2 text-xs text-maroon dark:text-rose-400 font-medium">
                                      (All Sections)
                                    </span>
                                    <p className="text-xs text-gray-body dark:text-neutral-400 mt-0.5">
                                      Assigns instructor to all current and future sections in this department.
                                    </p>
                                  </div>
                                </label>
                              </div>

                              {/* Individual sections */}
                              {sections.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border-soft/60 dark:border-neutral-800/80 pl-6 space-y-2">
                                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-body dark:text-neutral-400">
                                    Or assign specific sections:
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {sections.map(section => {
                                      const isSecSelected = selectedSectionIds.includes(section.id);
                                      const effectivelySelected = isDeptSelected || isSecSelected;

                                      return (
                                        <label 
                                          key={section.id} 
                                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                                            isDeptSelected
                                              ? 'border-maroon/20 bg-maroon/[0.05] dark:border-rose-500/20 dark:bg-rose-500/10 opacity-75'
                                              : isSecSelected
                                                ? 'border-maroon/40 bg-maroon/10 dark:border-rose-500/40 dark:bg-rose-500/20 text-maroon dark:text-rose-300 font-semibold'
                                                : 'border-border-soft dark:border-neutral-700 bg-cream/30 dark:bg-neutral-800 text-ink dark:text-neutral-200 hover:bg-cream dark:hover:bg-neutral-700'
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={effectivelySelected}
                                            disabled={isDeptSelected}
                                            onChange={() => handleToggleSectionAssignment(section.id)}
                                            className="h-3.5 w-3.5 rounded border-border-soft text-maroon focus:ring-maroon cursor-pointer disabled:cursor-not-allowed"
                                          />
                                          <span className="truncate">Section {section.name}</span>
                                          {isDeptSelected && (
                                            <span className="text-[10px] text-maroon dark:text-rose-400 font-normal ml-auto">
                                              (via Dept)
                                            </span>
                                          )}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border-soft dark:border-neutral-800 bg-cream/30 dark:bg-neutral-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-gray-body dark:text-neutral-400 font-medium">
                {selectedDeptIds.length} whole department(s) and {selectedSectionIds.length} individual section(s) selected
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAssignModalFaculty(null)}
                  disabled={savingAssignments}
                  className="px-4 py-2 text-xs font-bold text-gray-body hover:text-ink dark:text-neutral-400 dark:hover:text-neutral-200 border border-border-soft dark:border-neutral-700 rounded-lg hover:bg-cream dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignments}
                  disabled={savingAssignments}
                  className="px-5 py-2 text-xs font-bold text-white bg-maroon hover:bg-maroon-deep dark:bg-maroon dark:hover:bg-maroon-deep rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {savingAssignments ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Assignments</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={Boolean(pendingDelete)}
        itemName={pendingDelete?.name || 'this record'}
        title="Confirm Deletion"
        description={
          pendingDelete?.type === 'department'
            ? 'Deleting this department will permanently remove it and its sections. This action cannot be undone.'
            : 'Deleting this user account will permanently remove their access and profile. This action cannot be undone.'
        }
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
