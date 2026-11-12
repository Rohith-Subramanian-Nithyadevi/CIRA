import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import UserProfile from '../components/dashboard/UserProfile';
import { DeleteConfirmationDialog } from '@/components/ui/DeleteConfirmationDialog';
import { apiClient } from '@/lib/apiClient';
import { FileSpreadsheet, Upload } from 'lucide-react';

interface Faculty {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  approvalStatus: string;
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
  batchId: string;
  sections: { id: string, name: string }[];
}

interface Batch {
  id: string;
  name: string;
  startYear: number;
}

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'hub';
  const setActiveTab = (tab: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (!tab || tab === 'hub') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tab);
    }
    setSearchParams(nextParams);
  };
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  
  const [newDeptName, setNewDeptName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');

  const [importingStudents, setImportingStudents] = useState(false);
  const [importSummary, setImportSummary] = useState<{ imported: number; rejected: number; message?: string; rejectedRows?: { row: number, reason: string }[] } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ type: 'user' | 'department'; id: string; name: string } | null>(null);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
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
          const sortedUsers = [...userData.data.users].sort((a, b) => {
            if (a.role !== b.role) return a.role.localeCompare(b.role);
            const rollA = a.rollNumber || '';
            const rollB = b.rollNumber || '';
            return rollA.localeCompare(rollB);
          });
          setUserList(sortedUsers);
        }
        if (batchData.data?.batches) setBatches(batchData.data.batches);
      } catch (err) {
        console.error("Failed to fetch admin data", err);
      }
    };
    fetchAdminData();
  }, []);

  useEffect(() => {
    if (!selectedBatchId) {
      setDepartments([]);
      return;
    }
    const fetchDepartments = async () => {
      try {
        const res = await apiClient.fetch(`/api/v1/departments?batchId=${selectedBatchId}`);
        const data = await res.json();
        if (data.data?.departments) setDepartments(data.data.departments);
      } catch (err) {
        console.error("Failed to fetch departments", err);
      }
    };
    fetchDepartments();
  }, [selectedBatchId]);

  const handleApproval = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await apiClient.fetch(`/api/v1/admin/faculty/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      setFacultyList(prev => prev.map(f => f.id === id ? { ...f, approvalStatus: status } : f));
      setUserList(prev => prev.map(u => u.id === id ? { ...u, approvalStatus: status } : u));
    } catch (err) {
      console.error("Failed to approve/reject", err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const { type, id } = pendingDelete;
    const endpoint = type === 'user' ? `/api/v1/admin/users/${id}` : `/api/v1/departments/${id}`;
    const res = await apiClient.fetch(endpoint, { method: 'DELETE' });
    const data = await res.json?.().catch(() => null);
    if (res?.ok === false || data?.status === 'error') {
      const msg = data?.error?.message || data?.message || `Failed to delete ${type}.`;
      toast.error(msg);
      throw new Error(msg);
    }
    if (type === 'user') {
      setUserList(prev => prev.filter(u => u.id !== id));
      setFacultyList(prev => prev.filter(f => f.id !== id));
      toast.success('User deleted successfully.');
    } else {
      setDepartments(prev => prev.filter(d => d.id !== id));
      if (selectedDeptId === id) setSelectedDeptId('');
      toast.success('Department deleted successfully.');
    }
    setPendingDelete(null);
  };

  const handleCreateDepartment = async () => {
    if (!newDeptName || !selectedBatchId) return;
    try {
      const res = await apiClient.fetch('/api/v1/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeptName, batchId: selectedBatchId })
      });
      const data = await res.json();
      if (data.data?.department) {
        setDepartments(prev => [...prev, { ...data.data.department, sections: [] }]);
        setNewDeptName('');
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateSection = async () => {
    if (!newSectionName || !selectedDeptId) return;
    try {
      const res = await apiClient.fetch('/api/v1/departments/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSectionName, departmentId: selectedDeptId })
      });
      const data = await res.json();
      if (data.data?.section) {
        setDepartments(prev => prev.map(d => 
          d.id === selectedDeptId ? { ...d, sections: [...d.sections, data.data.section] } : d
        ));
        setNewSectionName('');
      }
    } catch (err) { console.error(err); }
  };

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
    } catch (error: any) {
      setImportSummary({ imported: 0, rejected: 0, message: error.message || 'Student import failed.', rejectedRows: [] });
    } finally {
      setImportingStudents(false);
    }
  };

  return (
    <DashboardLayout title="Admin Control Center" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'profile' && <UserProfile />}
      
      {activeTab === 'hub' && (
        <div className="space-y-8">
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#1E1E22] p-6 rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm">
              <h3 className="text-gray-body dark:text-neutral-400 text-sm font-medium">Total Faculty</h3>
              <p className="text-3xl font-bold mt-2 text-maroon dark:text-rose-400">{facultyList.length}</p>
            </div>
            <div className="bg-white dark:bg-[#1E1E22] p-6 rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm">
              <h3 className="text-gray-body dark:text-neutral-400 text-sm font-medium">Pending Approvals</h3>
              <p className="text-3xl font-bold mt-2 text-maroon dark:text-rose-400">{facultyList.filter(f => f.approvalStatus === 'PENDING').length}</p>
            </div>
            <div className="bg-white dark:bg-[#1E1E22] p-6 rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm">
              <h3 className="text-gray-body dark:text-neutral-400 text-sm font-medium">System Health</h3>
              <p className="text-3xl font-bold mt-2 text-green-600 dark:text-emerald-400">100%</p>
            </div>
          </section>

          <section className="bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 p-6 shadow-sm">
            <h2 className="text-xl font-serif font-bold mb-4 text-ink dark:text-neutral-100">Faculty Management</h2>
            
            {facultyList.length === 0 ? (
              <p className="text-gray-body dark:text-neutral-400 text-sm italic">No faculty registered yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-ink dark:text-neutral-200">
                  <thead className="text-xs uppercase bg-cream-edge/40 dark:bg-neutral-800/70 border-b border-border-soft dark:border-neutral-700 text-gray-body dark:text-neutral-400">
                    <tr>
                      <th className="px-6 py-3">Name</th>
                      <th className="px-6 py-3">Employee ID</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facultyList.map(faculty => (
                      <tr key={faculty.id} className="border-b border-border-soft dark:border-neutral-800 hover:bg-cream/40 dark:hover:bg-neutral-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-ink dark:text-neutral-100">{faculty.name}</td>
                        <td className="px-6 py-4 font-mono text-xs">{faculty.employeeId}</td>
                        <td className="px-6 py-4 text-gray-body dark:text-neutral-400">{faculty.email}</td>
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
                          {faculty.approvalStatus !== 'APPROVED' && (
                            <button onClick={() => handleApproval(faculty.id, 'APPROVED')} className="text-green-600 dark:text-emerald-400 hover:text-green-700 mr-4 font-semibold cursor-pointer">Approve</button>
                          )}
                          {faculty.approvalStatus !== 'REJECTED' && (
                            <button onClick={() => handleApproval(faculty.id, 'REJECTED')} className="text-red-600 dark:text-red-400 hover:text-red-700 font-semibold cursor-pointer">
                              {faculty.approvalStatus === 'APPROVED' ? 'Kick (Reject)' : 'Reject'}
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

      {activeTab === 'faculty' && (
        <div className="p-6 bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm">
          <h2 className="text-xl font-serif font-bold mb-4 text-ink dark:text-neutral-100">Faculty Approvals</h2>
          <p className="text-gray-body dark:text-neutral-400 text-sm">You can manage Faculty Approvals from the Admin Hub.</p>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-maroon/20 dark:border-rose-500/30 bg-cream/30 dark:bg-neutral-900/40 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-maroon/10 dark:bg-rose-500/15 text-maroon dark:text-rose-400"><FileSpreadsheet className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-serif font-bold text-ink dark:text-neutral-100">Bulk import students</h2>
                <p className="mt-1 text-xs leading-5 text-gray-body dark:text-neutral-400">Import a CSV or XLSX file. Students will be automatically grouped by Campus, Batch, Branch, and Section based on their Roll Number (e.g. <code>CH.SC.U4CSE24142</code>). Please ensure the <code>Date of Birth</code> column is formatted as DD/MM/YYYY for correct password generation.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-maroon px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-maroon-deep hover:shadow-md">
                <Upload className="h-4 w-4" />
                {importingStudents ? 'Importing...' : 'Upload Student File'}
                <input type="file" accept=".csv,.xlsx,.xls" className="sr-only" disabled={importingStudents} onChange={handleImportStudents} />
              </label>
              
              <a href="/Student_Bulk_Import_Template.csv" download className="inline-flex items-center justify-center gap-2 rounded-lg bg-white dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 px-6 py-2.5 text-sm font-bold text-ink dark:text-neutral-100 shadow-sm transition-all hover:-translate-y-0.5 hover:border-maroon hover:text-maroon">
                <FileSpreadsheet className="h-4 w-4" />
                Download Template
              </a>
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

          <div className="p-6 bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm">
            <h2 className="text-xl font-serif font-bold mb-4 text-ink dark:text-neutral-100">User Management</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-ink dark:text-neutral-200">
                <thead className="text-xs uppercase bg-cream-edge/40 dark:bg-neutral-800/70 border-b border-border-soft dark:border-neutral-700 text-gray-body dark:text-neutral-400">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map(u => (
                    <tr key={u.id} className="border-b border-border-soft dark:border-neutral-800 hover:bg-cream/40 dark:hover:bg-neutral-800/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-ink dark:text-neutral-100">{u.name}</td>
                      <td className="px-6 py-4 text-gray-body dark:text-neutral-400">{u.email}</td>
                      <td className="px-6 py-4 text-xs font-mono">{u.role}</td>
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
                        <button onClick={() => setPendingDelete({ type: 'user', id: u.id, name: u.name || u.email })} className="text-red-600 dark:text-red-400 hover:text-red-700 font-semibold cursor-pointer">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'departments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm overflow-y-auto max-h-[600px] col-span-1">
              <h2 className="text-xl font-serif font-bold mb-4 text-ink dark:text-neutral-100">Batches</h2>
              {batches.map(b => (
                <div key={b.id} className={`p-4 border rounded-xl mb-3 cursor-pointer transition-colors ${selectedBatchId === b.id ? 'border-maroon dark:border-rose-400 bg-maroon/5 dark:bg-rose-500/15' : 'border-border-soft dark:border-neutral-800 hover:border-maroon/30 hover:bg-cream/40 dark:hover:bg-neutral-800/50'}`} onClick={() => { setSelectedBatchId(b.id); setSelectedDeptId(''); }}>
                  <h3 className="font-bold text-ink dark:text-neutral-100 text-lg">{b.name}</h3>
                </div>
              ))}
            </div>

            <div className="col-span-2 space-y-6">
              {!selectedBatchId ? (
                <div className="p-6 bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm flex items-center justify-center h-full">
                  <p className="text-gray-body dark:text-neutral-400 italic">Select a batch to manage departments.</p>
                </div>
              ) : (
                <>
                  <div className="p-6 bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm">
                    <h2 className="text-xl font-serif font-bold mb-4 text-ink dark:text-neutral-100">Create Department for {batches.find(b => b.id === selectedBatchId)?.name}</h2>
                    <div className="flex gap-4">
                      <input type="text" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="Department Name (e.g. Mechanical Engineering)" className="flex-1 px-4 py-2.5 bg-white dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 rounded-lg focus:border-maroon focus:ring-1 focus:ring-maroon text-ink dark:text-neutral-100 outline-none" />
                      <button onClick={handleCreateDepartment} className="px-6 py-2.5 bg-maroon hover:bg-maroon-deep text-white rounded-full font-bold transition-all hover:scale-105 active:scale-95 text-sm shadow-sm cursor-pointer">Create</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm overflow-y-auto max-h-[400px]">
                      <h2 className="text-lg font-serif font-bold mb-4 text-ink dark:text-neutral-100">Departments List</h2>
                      {departments.length === 0 ? <p className="text-sm text-gray-body dark:text-neutral-400 italic">No departments created.</p> : null}
                      {departments.map(d => (
                        <div key={d.id} className={`p-4 border rounded-xl mb-3 cursor-pointer transition-colors flex justify-between items-center ${selectedDeptId === d.id ? 'border-maroon dark:border-rose-400 bg-maroon/5 dark:bg-rose-500/15' : 'border-border-soft dark:border-neutral-800 hover:border-maroon/30 hover:bg-cream/40 dark:hover:bg-neutral-800/50'}`} onClick={() => setSelectedDeptId(d.id)}>
                          <div>
                            <h3 className="font-bold text-ink dark:text-neutral-100">{d.name}</h3>
                            <p className="text-xs text-gray-body dark:text-neutral-400">{d.sections.length} sections</p>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setPendingDelete({ type: 'department', id: d.id, name: d.name }); }} className="text-red-600 dark:text-red-400 text-xs font-semibold hover:underline cursor-pointer">Delete</button>
                        </div>
                      ))}
                    </div>

                    <div className="p-6 bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm">
                      <h2 className="text-lg font-serif font-bold mb-4 text-ink dark:text-neutral-100">Manage Sections</h2>
                      {!selectedDeptId ? (
                        <p className="text-gray-body dark:text-neutral-400 italic text-sm">Select a department to manage sections.</p>
                      ) : (
                        <div className="space-y-4">
                          <h3 className="font-bold text-maroon dark:text-rose-400">{departments.find(d => d.id === selectedDeptId)?.name}</h3>
                          <div className="flex gap-2">
                            <input type="text" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} placeholder="Section (e.g. A, B)" className="w-full px-4 py-2 bg-white dark:bg-[#25252A] border border-border-soft dark:border-neutral-700 rounded-lg focus:border-maroon focus:ring-1 focus:ring-maroon text-ink dark:text-neutral-100 outline-none text-sm" />
                            <button onClick={handleCreateSection} className="px-6 py-2 bg-maroon hover:bg-maroon-deep text-white rounded-full font-bold transition-all text-sm shadow-sm cursor-pointer">Add</button>
                          </div>
                          <div className="mt-4 space-y-2">
                            {departments.find(d => d.id === selectedDeptId)?.sections.map(s => (
                              <div key={s.id} className="p-3 bg-cream/40 dark:bg-neutral-800/50 border border-border-soft dark:border-neutral-700 rounded-lg flex justify-between items-center text-sm text-ink dark:text-neutral-100">
                                <span>Section {s.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bulk Import removed from here */}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
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
    </DashboardLayout>
  );
}
