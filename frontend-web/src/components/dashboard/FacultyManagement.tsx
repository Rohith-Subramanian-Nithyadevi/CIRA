import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';
import { DeleteConfirmationDialog } from '@/components/ui/DeleteConfirmationDialog';
import StudentProfileView from './StudentProfileView';
import { downloadCsv } from '@/lib/csv';
import { 
  Users, 
  CheckSquare, 
  Building2, 
  FileSpreadsheet, 
  Upload, 
  Search, 
  Trash2, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  GraduationCap,
  ShieldCheck,
  UserCheck,
  KeyRound,
  Eye,
  Filter,
  X,
  Layers,
  ChevronRight,
  Loader2,
  Calendar
} from 'lucide-react';

interface Faculty {
  id: string;
  name: string;
  email: string;
  employeeId?: string;
  department?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
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

export default function FacultyManagement({ initialTab, onNavigateTab }: FacultyManagementProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Resolve active section from URL query or prop
  const activeSectionFromQuery = (searchParams.get('section') || searchParams.get('subtab')) as ManagementSection | null;
  const currentTabParam = searchParams.get('tab');
  
  const initialActive = useMemo<ManagementSection>(() => {
    if (initialTab) return initialTab;
    if (currentTabParam === 'approvals' || currentTabParam === 'faculty-approvals') return 'approvals';
    if (currentTabParam === 'users' || currentTabParam === 'user-directory') return 'users';
    if (currentTabParam === 'departments' || currentTabParam === 'academic-structure') return 'departments';
    if (activeSectionFromQuery === 'users' || activeSectionFromQuery === 'departments' || activeSectionFromQuery === 'approvals') {
      return activeSectionFromQuery;
    }
    return 'approvals';
  }, [initialTab, currentTabParam, activeSectionFromQuery]);

  const [activeSection, setActiveSection] = useState<ManagementSection>(initialActive);

  // Sync state when URL params change
  useEffect(() => {
    if (currentTabParam === 'approvals' || currentTabParam === 'faculty-approvals') {
      setActiveSection('approvals');
    } else if (currentTabParam === 'users' || currentTabParam === 'user-directory') {
      setActiveSection('users');
    } else if (currentTabParam === 'departments' || currentTabParam === 'academic-structure') {
      setActiveSection('departments');
    } else if (activeSectionFromQuery) {
      setActiveSection(activeSectionFromQuery);
    }
  }, [currentTabParam, activeSectionFromQuery]);

  const handleSwitchSection = (section: ManagementSection) => {
    setActiveSection(section);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('section', section);
    setSearchParams(nextParams);
    if (onNavigateTab) {
      if (section === 'approvals') onNavigateTab('approvals');
      else if (section === 'users') onNavigateTab('users');
      else if (section === 'departments') onNavigateTab('departments');
    }
  };

  const [loading, setLoading] = useState(true);

  // Core data states
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Section 1: Faculty Approvals filters
  const [facultySearch, setFacultySearch] = useState('');
  const [facultyStatusFilter, setFacultyStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  // Section 2: Student & User Directory filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userBatchFilter, setUserBatchFilter] = useState<string>('');
  const [userDeptFilter, setUserDeptFilter] = useState<string>('');
  const [userSectionFilter, setUserSectionFilter] = useState<string>('');
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);
  const [resettingStudentId, setResettingStudentId] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Section 3: Batches & Departments structure
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

  // Fetch all primary admin data
  const fetchAdminData = async () => {
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

      if (facData.status === 'success' && facData.data?.faculty) {
        setFacultyList(facData.data.faculty);
      }
      if (userData.status === 'success' && userData.data?.users) {
        setUserList(userData.data.users);
      }
      if (batchData.status === 'success' && batchData.data?.batches) {
        setBatches(batchData.data.batches);
        if (batchData.data.batches.length > 0 && !selectedBatchId) {
          setSelectedBatchId(batchData.data.batches[0].id);
        }
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

  // Fetch departments when selected batch changes
  useEffect(() => {
    if (!selectedBatchId) {
      setDepartments([]);
      return;
    }
    const fetchDepartments = async () => {
      try {
        const res = await apiClient.fetch(`/api/v1/departments?batchId=${selectedBatchId}`);
        const data = await res.json();
        if (data.status === 'success' && data.data?.departments) {
          setDepartments(data.data.departments);
          if (data.data.departments.length > 0 && !selectedDeptId) {
            setSelectedDeptId(data.data.departments[0].id);
          } else if (data.data.departments.length === 0) {
            setSelectedDeptId('');
          }
        }
      } catch (err) {
        console.error('Failed to fetch departments', err);
      }
    };
    void fetchDepartments();
  }, [selectedBatchId]);

  // Section 1: Faculty Approval action
  const handleApproval = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      setActionLoadingId(id);
      const res = await apiClient.fetch(`/api/v1/admin/faculty/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        toast.success(`Faculty member status updated to ${status}.`);
        setFacultyList(prev => prev.map(f => f.id === id ? { ...f, approvalStatus: status } : f));
        setUserList(prev => prev.map(u => u.id === id ? { ...u, approvalStatus: status } : u));
      } else {
        toast.error(data.message || 'Failed to update faculty status.');
      }
    } catch (err) {
      toast.error('Network error while updating approval status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Section 2: Student Password Reset
  const handleResetStudentPassword = async (studentId: string, studentName: string) => {
    try {
      setResettingStudentId(studentId);
      const res = await apiClient.fetch(`/api/v1/faculty/students/${studentId}/reset-password`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        toast.success(`Password reset instructions sent for ${studentName}.`);
      } else {
        toast.error(data.message || 'Failed to initiate password reset.');
      }
    } catch (err) {
      toast.error('Error initiating password reset.');
    } finally {
      setResettingStudentId(null);
    }
  };

  // Section 2: Bulk Student Import
  const handleStudentBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setImportingStudents(true);
    setImportSummary(null);

    try {
      const res = await apiClient.fetch('/api/v1/admin/students/bulk-import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        toast.success(`Successfully enrolled ${data.data.imported} student(s)!`);
        setImportSummary(data.data);
        void fetchAdminData();
      } else {
        toast.error(data.message || 'Bulk student import failed.');
        if (data.data?.rejectedRows) {
          setImportSummary(data.data);
        }
      }
    } catch (err: any) {
      toast.error('Network error during bulk student upload: ' + (err.message || 'Unknown error'));
    } finally {
      setImportingStudents(false);
      e.target.value = '';
    }
  };

  // Download Student Import CSV Template
  const handleDownloadTemplate = () => {
    const headers = ['name', 'email', 'rollNumber', 'batch', 'department', 'section', 'personalEmail', 'phone'];
    const sampleRows = [
      {
        name: 'Arun Kumar',
        email: 'arun@college.edu',
        rollNumber: '21CS001',
        batch: '2024',
        department: 'Computer Science & Engineering',
        section: 'A',
        personalEmail: 'arunkumar@gmail.com',
        phone: '9876543210'
      },
      {
        name: 'Bhavna Sharma',
        email: 'bhavna@college.edu',
        rollNumber: '21CS002',
        batch: '2024',
        department: 'Computer Science & Engineering',
        section: 'B',
        personalEmail: 'bhavna.sharma@gmail.com',
        phone: '9876543211'
      }
    ];
    downloadCsv(sampleRows, headers, 'student_bulk_enrollment_template');
    toast.success('Sample student enrollment template downloaded.');
  };

  // Section 3: Create Department
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
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.data?.department) {
        toast.success(`Department "${cleanName}" created successfully!`);
        setDepartments(prev => [...prev, data.data.department]);
        setSelectedDeptId(data.data.department.id);
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

  // Section 3: Create Section
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
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.data?.section) {
        toast.success(`Section "${cleanName}" added!`);
        setDepartments(prev =>
          prev.map(dept => {
            if (dept.id !== selectedDeptId) return dept;
            return {
              ...dept,
              sections: [...dept.sections, data.data.section]
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

  // Confirm delete handler (User or Department)
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
          setDepartments(prev => prev.filter(d => d.id !== id));
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

  // -------------------------------------------------------------
  // Filtered Data Lists
  // -------------------------------------------------------------

  // Section 1: Filtered Faculty
  const filteredFaculty = useMemo(() => {
    return facultyList.filter(f => {
      const matchSearch =
        !facultySearch.trim() ||
        f.name.toLowerCase().includes(facultySearch.toLowerCase()) ||
        f.email.toLowerCase().includes(facultySearch.toLowerCase()) ||
        (f.employeeId && f.employeeId.toLowerCase().includes(facultySearch.toLowerCase()));

      const matchStatus = facultyStatusFilter === 'ALL' || f.approvalStatus === facultyStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [facultyList, facultySearch, facultyStatusFilter]);

  // Section 2: Department options for User Directory filter
  const availableDeptsForUserFilter = useMemo(() => {
    if (!userBatchFilter) {
      const allDeptsMap = new Map<string, { id: string; name: string }>();
      userList.forEach(u => {
        if (u.department) allDeptsMap.set(u.department.id, { id: u.department.id, name: u.department.name });
      });
      return Array.from(allDeptsMap.values());
    }
    const deptsInBatch = new Map<string, { id: string; name: string }>();
    userList.forEach(u => {
      if (u.department && (u.department.batchId === userBatchFilter || String(u.department.batch?.startYear) === userBatchFilter)) {
        deptsInBatch.set(u.department.id, { id: u.department.id, name: u.department.name });
      }
    });
    return Array.from(deptsInBatch.values());
  }, [userList, userBatchFilter]);

  // Section 2: Section options for User Directory filter
  const availableSectionsForUserFilter = useMemo(() => {
    if (!userDeptFilter) return [];
    const secMap = new Map<string, string>();
    userList.forEach(u => {
      if (u.department?.id === userDeptFilter && u.section) {
        secMap.set(u.section.id, u.section.name);
      }
    });
    return Array.from(secMap.entries()).map(([id, name]) => ({ id, name }));
  }, [userList, userDeptFilter]);

  // Section 2: Filtered Users
  const filteredUsers = useMemo(() => {
    return userList.filter(u => {
      // Role filter
      if (userRoleFilter !== 'ALL' && u.role !== userRoleFilter) return false;

      // Batch filter
      if (userBatchFilter) {
        const uBatchId = u.department?.batchId;
        const uBatchYear = u.department?.batch?.startYear ? String(u.department.batch.startYear) : '';
        if (uBatchId !== userBatchFilter && uBatchYear !== userBatchFilter) return false;
      }

      // Department filter
      if (userDeptFilter && u.department?.id !== userDeptFilter) return false;

      // Section filter
      if (userSectionFilter && u.section?.id !== userSectionFilter) return false;

      // Search filter
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        const matchName = u.name.toLowerCase().includes(q);
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchRoll = u.rollNumber ? u.rollNumber.toLowerCase().includes(q) : false;
        const matchEmp = u.employeeId ? u.employeeId.toLowerCase().includes(q) : false;
        if (!matchName && !matchEmail && !matchRoll && !matchEmp) return false;
      }

      return true;
    });
  }, [userList, userRoleFilter, userBatchFilter, userDeptFilter, userSectionFilter, userSearch]);

  // Pending faculty count for badge
  const pendingFacultyCount = facultyList.filter(f => f.approvalStatus === 'PENDING').length;
  const approvedFacultyCount = facultyList.filter(f => f.approvalStatus === 'APPROVED').length;
  const rejectedFacultyCount = facultyList.filter(f => f.approvalStatus === 'REJECTED').length;

  const totalStudentsCount = userList.filter(u => u.role === 'STUDENT').length;
  const totalFacultyRoleCount = userList.filter(u => u.role === 'FACULTY').length;
  const totalAdminsCount = userList.filter(u => u.role === 'ADMIN').length;

  // If a student's profile is opened from the User Directory, render the full StudentProfileView
  if (profileStudentId) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setProfileStudentId(null)}
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-body hover:text-maroon px-3 py-1.5 rounded-lg border border-border-soft hover:bg-cream transition-colors cursor-pointer"
        >
          &larr; Back to Student & User Directory
        </button>
        <StudentProfileView studentId={profileStudentId} onBack={() => setProfileStudentId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* Clean Top Administration Sub-Dashboard Navigation Tabs       */}
      {/* ============================================================ */}
      <div className="bg-white dark:bg-[#1E1E22] rounded-2xl border border-border-soft dark:border-neutral-800 p-2 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => handleSwitchSection('approvals')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'approvals'
                ? 'bg-maroon text-white shadow-xs'
                : 'text-gray-body dark:text-neutral-400 hover:text-ink dark:hover:text-neutral-200 hover:bg-cream/40 dark:hover:bg-neutral-800/60'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>1. Faculty Approval</span>
            {pendingFacultyCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeSection === 'approvals'
                  ? 'bg-white text-maroon'
                  : 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300'
              }`}>
                {pendingFacultyCount} pending
              </span>
            )}
          </button>

          <button
            onClick={() => handleSwitchSection('users')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'users'
                ? 'bg-maroon text-white shadow-xs'
                : 'text-gray-body dark:text-neutral-400 hover:text-ink dark:hover:text-neutral-200 hover:bg-cream/40 dark:hover:bg-neutral-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Student / User Directory</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              activeSection === 'users' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-neutral-800 text-gray-body'
            }`}>
              {userList.length}
            </span>
          </button>

          <button
            onClick={() => handleSwitchSection('departments')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'departments'
                ? 'bg-maroon text-white shadow-xs'
                : 'text-gray-body dark:text-neutral-400 hover:text-ink dark:hover:text-neutral-200 hover:bg-cream/40 dark:hover:bg-neutral-800/60'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>3. Batches, Departments & Sections</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              activeSection === 'departments' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-neutral-800 text-gray-body'
            }`}>
              {batches.length} batches
            </span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* DASHBOARD VIEW 1: FACULTY APPROVAL & ACCESS CONTROL          */}
      {/* ============================================================ */}
      {activeSection === 'approvals' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-maroon/10 text-maroon flex items-center justify-center font-bold text-lg shrink-0">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-ink dark:text-neutral-100">
                  Faculty Approval & Verification
                </h1>
                <p className="text-xs text-gray-body dark:text-neutral-400">
                  Review pending instructor registration requests and manage active teaching privileges.
                </p>
              </div>
            </div>
            <button
              onClick={fetchAdminData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-body hover:text-maroon border border-border-soft rounded-xl hover:bg-cream/50 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-maroon' : ''}`} />
              <span>Refresh Records</span>
            </button>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-body uppercase tracking-wider">Total Faculty</span>
                <Users className="w-4 h-4 text-maroon" />
              </div>
              <div className="text-2xl font-bold font-serif text-ink dark:text-neutral-100 mt-2">
                {facultyList.length}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-amber-200 dark:border-amber-900/40 shadow-xs bg-amber-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Pending Approvals</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold font-serif text-amber-900 dark:text-amber-300 mt-2">
                {pendingFacultyCount}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-emerald-200 dark:border-emerald-900/40 shadow-xs bg-emerald-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Approved Faculty</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold font-serif text-emerald-900 dark:text-emerald-300 mt-2">
                {approvedFacultyCount}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-rose-200 dark:border-rose-900/40 shadow-xs bg-rose-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wider">Revoked / Rejected</span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-bold font-serif text-rose-900 dark:text-rose-300 mt-2">
                {rejectedFacultyCount}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white dark:bg-[#1E1E22] p-4 rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-body absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search faculty by name, email, employee ID..."
                value={facultySearch}
                onChange={e => setFacultySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-maroon text-ink dark:text-neutral-100"
              />
              {facultySearch && (
                <button
                  onClick={() => setFacultySearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-body hover:text-ink"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto self-start sm:self-auto">
              <span className="text-xs text-gray-body font-semibold mr-1">Status:</span>
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFacultyStatusFilter(status)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    facultyStatusFilter === status
                      ? 'bg-maroon text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-neutral-800 text-gray-body dark:text-neutral-400 hover:text-ink'
                  }`}
                >
                  {status === 'ALL' ? 'All' : status === 'PENDING' ? 'Pending' : status === 'APPROVED' ? 'Approved' : 'Rejected'}
                </button>
              ))}
            </div>
          </div>

          {/* Faculty Approvals Table */}
          <div className="bg-white dark:bg-[#1E1E22] rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-neutral-900 text-xs uppercase font-bold text-gray-body border-b border-border-soft dark:border-neutral-800">
                  <tr>
                    <th className="py-3 px-4">Faculty Member</th>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft dark:divide-neutral-800">
                  {filteredFaculty.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-body">
                        <Users className="w-8 h-8 text-maroon/40 mx-auto mb-2" />
                        <p className="font-semibold text-sm">No faculty members found</p>
                        <p className="text-xs text-gray-body mt-0.5">
                          {facultySearch || facultyStatusFilter !== 'ALL'
                            ? 'Try clearing the search query or status filter.'
                            : 'No faculty registration requests have been recorded yet.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredFaculty.map(faculty => {
                      const isPending = faculty.approvalStatus === 'PENDING';
                      const isApproved = faculty.approvalStatus === 'APPROVED';
                      const isActionLoading = actionLoadingId === faculty.id;

                      return (
                        <tr key={faculty.id} className="hover:bg-cream/20 dark:hover:bg-neutral-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-maroon/10 text-maroon flex items-center justify-center font-bold text-xs shrink-0">
                                {faculty.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-ink dark:text-neutral-100 block">
                                  {faculty.name}
                                </span>
                                {faculty.createdAt && (
                                  <span className="text-[11px] text-gray-body">
                                    Joined {new Date(faculty.createdAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-gray-body">
                            {faculty.employeeId || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-gray-body font-medium">
                            {faculty.email}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold text-ink dark:text-neutral-200">
                            {faculty.department?.name || <span className="text-gray-body italic">Unassigned</span>}
                          </td>
                          <td className="py-3.5 px-4">
                            {isApproved ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </span>
                            ) : isPending ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                <Clock className="w-3 h-3" /> Pending Review
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                <XCircle className="w-3 h-3" /> Revoked
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isPending ? (
                                <>
                                  <button
                                    onClick={() => handleApproval(faculty.id, 'APPROVED')}
                                    disabled={isActionLoading}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                  >
                                    {isActionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Approve Access
                                  </button>
                                  <button
                                    onClick={() => handleApproval(faculty.id, 'REJECTED')}
                                    disabled={isActionLoading}
                                    className="px-2.5 py-1 text-rose-600 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : isApproved ? (
                                <button
                                  onClick={() => handleApproval(faculty.id, 'REJECTED')}
                                  disabled={isActionLoading}
                                  className="px-2.5 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1 ml-auto"
                                >
                                  {isActionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                                  Revoke Access
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleApproval(faculty.id, 'APPROVED')}
                                  disabled={isActionLoading}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1 ml-auto"
                                >
                                  {isActionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                                  Reinstate Access
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

      {/* ============================================================ */}
      {/* DASHBOARD VIEW 2: STUDENT & USER DIRECTORY                   */}
      {/* ============================================================ */}
      {activeSection === 'users' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-maroon/10 text-maroon flex items-center justify-center font-bold text-lg shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-ink dark:text-neutral-100">
                  Student & User Directory
                </h1>
                <p className="text-xs text-gray-body dark:text-neutral-400">
                  Filter students by batch, department, and section, inspect individual profiles, and bulk-enroll students.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                onClick={() => setShowBulkImport(!showBulkImport)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                  showBulkImport
                    ? 'bg-maroon text-white border-maroon'
                    : 'bg-white dark:bg-[#1E1E22] text-gray-body hover:text-maroon border-border-soft hover:bg-cream/50'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{showBulkImport ? 'Hide Bulk Import' : 'Bulk Import Students'}</span>
              </button>

              <button
                onClick={fetchAdminData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-body hover:text-maroon border border-border-soft rounded-xl hover:bg-cream/50 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-maroon' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-body uppercase tracking-wider">Total Students</span>
                <GraduationCap className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold font-serif text-ink dark:text-neutral-100 mt-2">
                {totalStudentsCount}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-body uppercase tracking-wider">Faculty Members</span>
                <Users className="w-4 h-4 text-maroon" />
              </div>
              <div className="text-2xl font-bold font-serif text-ink dark:text-neutral-100 mt-2">
                {totalFacultyRoleCount}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-body uppercase tracking-wider">Administrators</span>
                <ShieldCheck className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold font-serif text-ink dark:text-neutral-100 mt-2">
                {totalAdminsCount}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-body uppercase tracking-wider">Total Accounts</span>
                <UserCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold font-serif text-ink dark:text-neutral-100 mt-2">
                {userList.length}
              </div>
            </div>
          </div>

          {/* Bulk Student Enrollment Card (Collapsible) */}
          {showBulkImport && (
            <div className="p-5 sm:p-6 bg-cream/30 dark:bg-neutral-900/40 rounded-2xl border border-maroon/20 dark:border-rose-500/30 shadow-xs space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-maroon/10 text-maroon flex items-center justify-center font-bold text-base shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-sm text-ink dark:text-neutral-100">
                      Bulk Student Enrollment
                    </h3>
                    <p className="text-xs text-gray-body dark:text-neutral-400">
                      Upload CSV or XLSX file containing student roster details with automatic class assignment.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#25252A] border border-border-soft text-ink dark:text-neutral-200 text-xs font-bold rounded-lg hover:bg-cream transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-maroon" />
                  <span>Download Sample Template</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-border-soft dark:border-neutral-700 hover:border-maroon/50 rounded-xl p-5 text-center bg-white dark:bg-[#1E1E22] transition-colors relative">
                <input
                  type="file"
                  accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv"
                  onChange={handleStudentBulkImport}
                  disabled={importingStudents}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-maroon/10 flex items-center justify-center text-maroon">
                    {importingStudents ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-maroon hover:underline">
                      {importingStudents ? 'Processing spreadsheet...' : 'Click to upload or drag and drop'}
                    </span>
                    <p className="text-[11px] text-gray-body dark:text-neutral-400 mt-0.5">
                      Accepts .CSV or .XLSX files with columns: name, email, rollNumber, batch, department, section
                    </p>
                  </div>
                </div>
              </div>

              {/* Import Results Feedback */}
              {importSummary && (
                <div className="p-4 rounded-xl border border-border-soft bg-white dark:bg-[#1E1E22] space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> {importSummary.imported} Enrolled
                    </span>
                    {importSummary.rejected > 0 && (
                      <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> {importSummary.rejected} Rejected
                      </span>
                    )}
                  </div>
                  {importSummary.rejectedRows && importSummary.rejectedRows.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto text-xs space-y-1 p-2 bg-slate-50 dark:bg-neutral-900 rounded-lg">
                      <p className="font-bold text-gray-body uppercase text-[10px]">Rejection Diagnostics:</p>
                      {importSummary.rejectedRows.map((r, i) => (
                        <div key={i} className="text-rose-600 font-mono text-[11px]">
                          Row {r.row}: {r.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* User / Student Filters Bar */}
          <div className="bg-white dark:bg-[#1E1E22] p-4 rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink dark:text-neutral-200 flex items-center gap-1.5 uppercase tracking-wider">
                <Filter className="w-3.5 h-3.5 text-maroon" /> Directory Class & Role Filters
              </span>
              {(userBatchFilter || userDeptFilter || userSectionFilter || userRoleFilter !== 'ALL' || userSearch) && (
                <button
                  onClick={() => {
                    setUserBatchFilter('');
                    setUserDeptFilter('');
                    setUserSectionFilter('');
                    setUserRoleFilter('ALL');
                    setUserSearch('');
                  }}
                  className="text-xs text-maroon font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" /> Clear All Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Batch / Year Dropdown */}
              <div>
                <label className="text-[11px] font-semibold text-gray-body block mb-1">Academic Batch / Year</label>
                <select
                  value={userBatchFilter}
                  onChange={e => {
                    setUserBatchFilter(e.target.value);
                    setUserDeptFilter('');
                    setUserSectionFilter('');
                  }}
                  className="w-full h-9 px-2.5 rounded-xl border border-border-soft dark:border-neutral-700 bg-slate-50 dark:bg-[#25252A] text-xs font-medium text-ink dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-maroon"
                >
                  <option value="">All Years / Batches</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.name}>
                      Batch {b.name} ({b.startYear})
                    </option>
                  ))}
                </select>
              </div>

              {/* Department Dropdown */}
              <div>
                <label className="text-[11px] font-semibold text-gray-body block mb-1">Department</label>
                <select
                  value={userDeptFilter}
                  onChange={e => {
                    setUserDeptFilter(e.target.value);
                    setUserSectionFilter('');
                  }}
                  className="w-full h-9 px-2.5 rounded-xl border border-border-soft dark:border-neutral-700 bg-slate-50 dark:bg-[#25252A] text-xs font-medium text-ink dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-maroon"
                >
                  <option value="">All Departments</option>
                  {availableDeptsForUserFilter.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Dropdown */}
              <div>
                <label className="text-[11px] font-semibold text-gray-body block mb-1">Section</label>
                <select
                  value={userSectionFilter}
                  onChange={e => setUserSectionFilter(e.target.value)}
                  disabled={!userDeptFilter}
                  className="w-full h-9 px-2.5 rounded-xl border border-border-soft dark:border-neutral-700 bg-slate-50 dark:bg-[#25252A] text-xs font-medium text-ink dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-maroon disabled:opacity-50"
                >
                  <option value="">All Sections</option>
                  {availableSectionsForUserFilter.map(s => (
                    <option key={s.id} value={s.id}>
                      Section {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Dropdown */}
              <div>
                <label className="text-[11px] font-semibold text-gray-body block mb-1">Account Role</label>
                <select
                  value={userRoleFilter}
                  onChange={e => setUserRoleFilter(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl border border-border-soft dark:border-neutral-700 bg-slate-50 dark:bg-[#25252A] text-xs font-medium text-ink dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-maroon"
                >
                  <option value="ALL">All Roles</option>
                  <option value="STUDENT">Students</option>
                  <option value="FACULTY">Faculty</option>
                  <option value="ADMIN">Administrators</option>
                </select>
              </div>

              {/* Search Bar */}
              <div>
                <label className="text-[11px] font-semibold text-gray-body block mb-1">Search User</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-body absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search name, roll..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-maroon text-ink dark:text-neutral-100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* User Directory Table */}
          <div className="bg-white dark:bg-[#1E1E22] rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-neutral-900 text-xs uppercase font-bold text-gray-body border-b border-border-soft dark:border-neutral-800">
                  <tr>
                    <th className="py-3 px-4">User / Student</th>
                    <th className="py-3 px-4">Roll / ID</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Department & Batch</th>
                    <th className="py-3 px-4">Section</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft dark:divide-neutral-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-body">
                        <Users className="w-8 h-8 text-maroon/40 mx-auto mb-2" />
                        <p className="font-semibold text-sm">No user records match these filters</p>
                        <p className="text-xs text-gray-body mt-0.5">
                          Try modifying your class filter or clearing the search box.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => {
                      const isStudent = user.role === 'STUDENT';
                      const isResetting = resettingStudentId === user.id;

                      return (
                        <tr key={user.id} className="hover:bg-cream/20 dark:hover:bg-neutral-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                isStudent
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  : user.role === 'FACULTY'
                                  ? 'bg-maroon/10 text-maroon'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {user.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-ink dark:text-neutral-100 block">
                                  {user.name}
                                </span>
                                <span className="text-[11px] text-gray-body block">
                                  {user.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 font-mono text-xs text-gray-body">
                            {user.rollNumber || user.employeeId || '—'}
                          </td>

                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              isStudent
                                ? 'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                                : user.role === 'FACULTY'
                                ? 'bg-maroon/10 text-maroon border border-maroon/20'
                                : 'bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                            }`}>
                              {user.role}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-xs">
                            <span className="font-semibold text-ink dark:text-neutral-200 block">
                              {user.department?.name || <span className="text-gray-body italic">Unassigned</span>}
                            </span>
                            {user.department?.batch && (
                              <span className="text-[11px] text-gray-body">
                                Batch {user.department.batch.name} ({user.department.batch.startYear})
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-xs font-semibold text-ink dark:text-neutral-200">
                            {user.section ? `Sec ${user.section.name}` : <span className="text-gray-body">—</span>}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Clickable Student Profile Button */}
                              {isStudent && (
                                <button
                                  onClick={() => setProfileStudentId(user.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[#25252A] border border-border-soft hover:border-maroon/40 text-ink dark:text-neutral-200 hover:text-maroon rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                  title="Inspect full student performance profile"
                                >
                                  <Eye className="w-3.5 h-3.5 text-maroon" />
                                  <span>Profile</span>
                                </button>
                              )}

                              {/* Student Password Reset Button */}
                              {isStudent && (
                                <button
                                  onClick={() => handleResetStudentPassword(user.id, user.name)}
                                  disabled={isResetting}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[#25252A] border border-border-soft text-gray-body hover:text-ink rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                                  title="Send password reset link to student email"
                                >
                                  {isResetting ? <Loader2 className="w-3 h-3 animate-spin text-maroon" /> : <KeyRound className="w-3 h-3" />}
                                  <span>Reset</span>
                                </button>
                              )}

                              {/* Delete Account Confirmation */}
                              <button
                                onClick={() => setPendingDelete({ type: 'user', id: user.id, name: `${user.name} (${user.email})` })}
                                className="p-1 text-gray-body hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Delete user account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Count */}
            <div className="py-3 px-4 bg-slate-50/60 dark:bg-neutral-900/60 border-t border-border-soft dark:border-neutral-800 text-xs text-gray-body flex items-center justify-between">
              <span>Showing {filteredUsers.length} of {userList.length} user accounts</span>
              <span className="text-[11px]">Server-authenticated institutional records</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* DASHBOARD VIEW 3: BATCHES, DEPARTMENTS & SECTIONS            */}
      {/* ============================================================ */}
      {activeSection === 'departments' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-maroon/10 text-maroon flex items-center justify-center font-bold text-lg shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-ink dark:text-neutral-100">
                  Batches, Departments & Sections
                </h1>
                <p className="text-xs text-gray-body dark:text-neutral-400">
                  Configure institutional academic structure, batches, engineering departments, and class sections.
                </p>
              </div>
            </div>

            <button
              onClick={fetchAdminData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-body hover:text-maroon border border-border-soft rounded-xl hover:bg-cream/50 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-maroon' : ''}`} />
              <span>Refresh Structure</span>
            </button>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-body uppercase tracking-wider">Academic Batches</span>
                <Calendar className="w-4 h-4 text-maroon" />
              </div>
              <div className="text-2xl font-bold font-serif text-ink dark:text-neutral-100 mt-2">
                {batches.length}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-body uppercase tracking-wider">Departments in Batch</span>
                <Building2 className="w-4 h-4 text-maroon" />
              </div>
              <div className="text-2xl font-bold font-serif text-ink dark:text-neutral-100 mt-2">
                {departments.length}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-[#1E1E22] rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-body uppercase tracking-wider">Sections in Department</span>
                <Layers className="w-4 h-4 text-maroon" />
              </div>
              <div className="text-2xl font-bold font-serif text-ink dark:text-neutral-100 mt-2">
                {departments.find(d => d.id === selectedDeptId)?.sections.length || 0}
              </div>
            </div>
          </div>

          {/* 3-Column Original Clean Structure Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Step 1: Batches Column (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white dark:bg-[#1E1E22] p-5 rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-serif font-bold text-ink dark:text-neutral-100 uppercase tracking-wider text-xs">
                    1. Select Academic Batch
                  </h3>
                  <span className="text-[11px] text-gray-body font-semibold">
                    {batches.length} available
                  </span>
                </div>

                <div className="space-y-2">
                  {batches.length === 0 ? (
                    <p className="text-xs text-gray-body py-4 text-center italic">No academic batches configured.</p>
                  ) : (
                    batches.map(batch => {
                      const isSelected = selectedBatchId === batch.id;
                      return (
                        <button
                          key={batch.id}
                          onClick={() => {
                            setSelectedBatchId(batch.id);
                            setSelectedDeptId('');
                          }}
                          className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'border-maroon bg-maroon/5 dark:bg-rose-950/20 ring-1 ring-maroon'
                              : 'border-border-soft dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600 bg-white dark:bg-[#222227]'
                          }`}
                        >
                          <div>
                            <span className="font-bold text-sm text-ink dark:text-neutral-100 block">
                              Batch {batch.name}
                            </span>
                            <span className="text-[11px] text-gray-body">
                              Starting year: {batch.startYear}
                            </span>
                          </div>
                          <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-maroon' : 'text-gray-body/40'}`} />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Step 2: Departments Column (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white dark:bg-[#1E1E22] p-5 rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-serif font-bold text-ink dark:text-neutral-100 uppercase tracking-wider text-xs">
                    2. Departments in Batch
                  </h3>
                  <span className="text-[11px] text-gray-body font-semibold">
                    {departments.length} depts
                  </span>
                </div>

                {/* Create Department Form */}
                <div className="p-3 bg-slate-50 dark:bg-neutral-900/60 rounded-xl border border-border-soft dark:border-neutral-700/60 space-y-2">
                  <span className="text-[11px] font-bold text-gray-body block">Create New Department</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Mechanical Engineering"
                      value={newDeptName}
                      onChange={e => setNewDeptName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateDepartment()}
                      className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 rounded-lg text-ink dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-maroon"
                    />
                    <button
                      onClick={handleCreateDepartment}
                      disabled={creatingDept || !newDeptName.trim()}
                      className="px-3 py-1.5 bg-maroon text-white text-xs font-bold rounded-lg hover:bg-maroon-deep transition-colors disabled:opacity-50 shrink-0 cursor-pointer flex items-center gap-1"
                    >
                      {creatingDept && <Loader2 className="w-3 h-3 animate-spin" />}
                      Add
                    </button>
                  </div>
                </div>

                {/* Departments List */}
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {departments.length === 0 ? (
                    <div className="py-8 text-center text-gray-body">
                      <Building2 className="w-6 h-6 text-maroon/30 mx-auto mb-1.5" />
                      <p className="text-xs font-semibold">No departments in this batch</p>
                      <p className="text-[11px] text-gray-body mt-0.5">Use the form above to add a department.</p>
                    </div>
                  ) : (
                    departments.map(dept => {
                      const isSelected = selectedDeptId === dept.id;
                      return (
                        <div
                          key={dept.id}
                          onClick={() => setSelectedDeptId(dept.id)}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'border-maroon bg-maroon/5 dark:bg-rose-950/20 ring-1 ring-maroon'
                              : 'border-border-soft dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600 bg-white dark:bg-[#222227]'
                          }`}
                        >
                          <div>
                            <span className="font-bold text-xs text-ink dark:text-neutral-100 block">
                              {dept.name}
                            </span>
                            <span className="text-[10px] text-gray-body">
                              {dept.sections.length} section(s)
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete({ type: 'department', id: dept.id, name: dept.name });
                              }}
                              className="p-1 text-gray-body hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Delete department"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-maroon' : 'text-gray-body/30'}`} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Sections Column (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white dark:bg-[#1E1E22] p-5 rounded-2xl border border-border-soft dark:border-neutral-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-serif font-bold text-ink dark:text-neutral-100 uppercase tracking-wider text-xs">
                    3. Manage Sections
                  </h3>
                  {selectedDeptId && (
                    <span className="text-[11px] font-bold text-maroon">
                      {departments.find(d => d.id === selectedDeptId)?.name}
                    </span>
                  )}
                </div>

                {!selectedDeptId ? (
                  <div className="py-12 text-center text-gray-body">
                    <Layers className="w-8 h-8 text-maroon/30 mx-auto mb-2" />
                    <p className="text-xs font-semibold">Select a Department</p>
                    <p className="text-[11px] text-gray-body mt-0.5 max-w-xs mx-auto">
                      Choose a department in Step 2 to configure and view its class sections.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Add Section Form */}
                    <div className="p-3 bg-slate-50 dark:bg-neutral-900/60 rounded-xl border border-border-soft dark:border-neutral-700/60 space-y-2">
                      <span className="text-[11px] font-bold text-gray-body block">Add Section to Department</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. A, B, C, CSE-1"
                          value={newSectionName}
                          onChange={e => setNewSectionName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleCreateSection()}
                          className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 rounded-lg text-ink dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-maroon"
                        />
                        <button
                          onClick={handleCreateSection}
                          disabled={creatingSection || !newSectionName.trim()}
                          className="px-3 py-1.5 bg-maroon text-white text-xs font-bold rounded-lg hover:bg-maroon-deep transition-colors disabled:opacity-50 shrink-0 cursor-pointer flex items-center gap-1"
                        >
                          {creatingSection && <Loader2 className="w-3 h-3 animate-spin" />}
                          Add Section
                        </button>
                      </div>
                    </div>

                    {/* Sections List */}
                    <div className="space-y-2 max-h-[420px] overflow-y-auto">
                      {departments.find(d => d.id === selectedDeptId)?.sections.length === 0 ? (
                        <div className="py-8 text-center text-gray-body">
                          <Layers className="w-6 h-6 text-maroon/30 mx-auto mb-1.5" />
                          <p className="text-xs font-semibold">No sections created yet</p>
                          <p className="text-[11px] text-gray-body mt-0.5">Add sections like "A" or "B" using the form above.</p>
                        </div>
                      ) : (
                        departments.find(d => d.id === selectedDeptId)?.sections.map(section => (
                          <div
                            key={section.id}
                            className="p-3 bg-white dark:bg-[#222227] border border-border-soft dark:border-neutral-700 rounded-xl flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-lg bg-cream dark:bg-neutral-800 text-maroon font-bold text-xs flex items-center justify-center">
                                {section.name}
                              </span>
                              <span className="text-xs font-bold text-ink dark:text-neutral-100">
                                Section {section.name}
                              </span>
                            </div>
                            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
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
            ? 'Deleting this department will permanently remove it and all associated sections. This action cannot be undone.'
            : 'Deleting this user account will permanently remove their profile, permissions, and session records. This action cannot be undone.'
        }
        confirmLabel="Permanently Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
