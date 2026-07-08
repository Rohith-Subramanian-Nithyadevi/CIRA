import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import UserProfile from '../components/dashboard/UserProfile';

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
  sections: { id: string, name: string }[];
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('hub');
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  const [newDeptName, setNewDeptName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const token = localStorage.getItem('cira_token');
        const headers = { 'Authorization': `Bearer ${token}` };

        const [facRes, userRes, deptRes] = await Promise.all([
          fetch(`${baseUrl}/api/v1/admin/faculty/all`, { headers }),
          fetch(`${baseUrl}/api/v1/admin/users`, { headers }),
          fetch(`${baseUrl}/api/v1/departments`, { headers })
        ]);

        const facData = await facRes.json();
        const userData = await userRes.json();
        const deptData = await deptRes.json();

        if (facData.data?.faculty) setFacultyList(facData.data.faculty);
        if (userData.data?.users) setUserList(userData.data.users);
        if (deptData.data?.departments) setDepartments(deptData.data.departments);
      } catch (err) {
        console.error("Failed to fetch admin data", err);
      }
    };
    fetchAdminData();
  }, []);

  const handleApproval = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const token = localStorage.getItem('cira_token');
      await fetch(`${baseUrl}/api/v1/admin/faculty/${id}/approve`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      setFacultyList(prev => prev.map(f => f.id === id ? { ...f, approvalStatus: status } : f));
      setUserList(prev => prev.map(u => u.id === id ? { ...u, approvalStatus: status } : u));
    } catch (err) {
      console.error("Failed to approve/reject", err);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const token = localStorage.getItem('cira_token');
      await fetch(`${baseUrl}/api/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUserList(prev => prev.filter(u => u.id !== id));
      setFacultyList(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error("Failed to delete user", err);
    }
  };

  const handleCreateDepartment = async () => {
    if (!newDeptName) return;
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const token = localStorage.getItem('cira_token');
      const res = await fetch(`${baseUrl}/api/v1/departments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeptName })
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
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const token = localStorage.getItem('cira_token');
      const res = await fetch(`${baseUrl}/api/v1/departments/sections`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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

  const handleDeleteDepartment = async (id: string) => {
    if (!window.confirm('Delete department? All sections inside will be lost.')) return;
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const token = localStorage.getItem('cira_token');
      await fetch(`${baseUrl}/api/v1/departments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setDepartments(prev => prev.filter(d => d.id !== id));
      if (selectedDeptId === id) setSelectedDeptId('');
    } catch (err) { console.error(err); }
  };

  return (
    <DashboardLayout title="Admin Control Center" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'profile' && <UserProfile />}
      
      {activeTab === 'hub' && (
        <div className="space-y-8">
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-xl border border-border-soft shadow-sm">
              <h3 className="text-gray-body text-sm font-medium">Total Faculty</h3>
              <p className="text-3xl font-bold mt-2 text-maroon">{facultyList.length}</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-border-soft shadow-sm">
              <h3 className="text-gray-body text-sm font-medium">Pending Approvals</h3>
              <p className="text-3xl font-bold mt-2 text-maroon">{facultyList.filter(f => f.approvalStatus === 'PENDING').length}</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-border-soft shadow-sm">
              <h3 className="text-gray-body text-sm font-medium">System Health</h3>
              <p className="text-3xl font-bold mt-2 text-green-600">100%</p>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-border-soft p-6 shadow-sm">
            <h2 className="text-xl font-serif font-bold mb-4 text-ink">Faculty Management</h2>
            
            {facultyList.length === 0 ? (
              <p className="text-gray-body text-sm italic">No faculty registered yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-ink">
                  <thead className="text-xs uppercase bg-cream-edge/40 border-b border-border-soft text-gray-body">
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
                      <tr key={faculty.id} className="border-b border-border-soft hover:bg-cream/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-ink">{faculty.name}</td>
                        <td className="px-6 py-4 font-mono text-xs">{faculty.employeeId}</td>
                        <td className="px-6 py-4 text-gray-body">{faculty.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            faculty.approvalStatus === 'APPROVED' ? 'bg-green-500/10 text-green-700 border-green-200' : 
                            faculty.approvalStatus === 'PENDING' ? 'bg-yellow-500/10 text-yellow-700 border-yellow-200' : 
                            'bg-red-500/10 text-red-700 border-red-200'
                          }`}>
                            {faculty.approvalStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {faculty.approvalStatus !== 'APPROVED' && (
                            <button onClick={() => handleApproval(faculty.id, 'APPROVED')} className="text-green-600 hover:text-green-700 mr-4 font-semibold">Approve</button>
                          )}
                          {faculty.approvalStatus !== 'REJECTED' && (
                            <button onClick={() => handleApproval(faculty.id, 'REJECTED')} className="text-red-600 hover:text-red-700 font-semibold">
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
        <div className="p-6 bg-white rounded-xl border border-border-soft shadow-sm">
          <h2 className="text-xl font-serif font-bold mb-4 text-ink">Faculty Approvals</h2>
          <p className="text-gray-body text-sm">You can manage Faculty Approvals from the Admin Hub.</p>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-xl border border-border-soft shadow-sm">
            <h2 className="text-xl font-serif font-bold mb-4 text-ink">User Management</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-ink">
                <thead className="text-xs uppercase bg-cream-edge/40 border-b border-border-soft text-gray-body">
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
                    <tr key={u.id} className="border-b border-border-soft hover:bg-cream/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-ink">{u.name}</td>
                      <td className="px-6 py-4 text-gray-body">{u.email}</td>
                      <td className="px-6 py-4 text-xs font-mono">{u.role}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          u.approvalStatus === 'APPROVED' ? 'bg-green-500/10 text-green-700 border-green-200' : 
                          u.approvalStatus === 'PENDING' ? 'bg-yellow-500/10 text-yellow-700 border-yellow-200' : 
                          'bg-red-500/10 text-red-700 border-red-200'
                        }`}>
                          {u.approvalStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDeleteUser(u.id)} className="text-red-600 hover:text-red-700 font-semibold">Delete</button>
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
          <div className="p-6 bg-white rounded-xl border border-border-soft shadow-sm">
            <h2 className="text-xl font-serif font-bold mb-4 text-ink">Create Department</h2>
            <div className="flex gap-4">
              <input type="text" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="Department Name (e.g. Mechanical Engineering)" className="flex-1 px-4 py-2.5 bg-white border border-border-soft rounded-lg focus:border-maroon focus:ring-1 focus:ring-maroon text-ink outline-none" />
              <button onClick={handleCreateDepartment} className="px-6 py-2.5 bg-maroon hover:bg-maroon-deep text-white rounded-full font-bold transition-all hover:scale-105 active:scale-95 text-sm shadow-sm">Create</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white rounded-xl border border-border-soft shadow-sm overflow-y-auto max-h-[500px]">
              <h2 className="text-xl font-serif font-bold mb-4 text-ink">Departments List</h2>
              {departments.map(d => (
                <div key={d.id} className={`p-4 border rounded-xl mb-3 cursor-pointer transition-colors flex justify-between items-center ${selectedDeptId === d.id ? 'border-maroon bg-maroon/5' : 'border-border-soft hover:border-maroon/30 hover:bg-cream/40'}`} onClick={() => setSelectedDeptId(d.id)}>
                  <div>
                    <h3 className="font-bold text-ink">{d.name}</h3>
                    <p className="text-xs text-gray-body">{d.sections.length} sections</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteDepartment(d.id); }} className="text-red-600 text-xs font-semibold hover:underline">Delete</button>
                </div>
              ))}
            </div>

            <div className="p-6 bg-white rounded-xl border border-border-soft shadow-sm">
              <h2 className="text-xl font-serif font-bold mb-4 text-ink">Manage Sections</h2>
              {!selectedDeptId ? (
                <p className="text-gray-body italic text-sm">Select a department from the left to manage sections.</p>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-bold text-maroon">{departments.find(d => d.id === selectedDeptId)?.name}</h3>
                  <div className="flex gap-2">
                    <input type="text" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} placeholder="Section Name (e.g. A, B, C)" className="w-48 px-4 py-2 bg-white border border-border-soft rounded-lg focus:border-maroon focus:ring-1 focus:ring-maroon text-ink outline-none text-sm" />
                    <button onClick={handleCreateSection} className="px-6 py-2 bg-maroon hover:bg-maroon-deep text-white rounded-full font-bold transition-all text-sm shadow-sm">Add</button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {departments.find(d => d.id === selectedDeptId)?.sections.map(s => (
                      <div key={s.id} className="p-3 bg-cream/40 border border-border-soft rounded-lg flex justify-between items-center text-sm text-ink">
                        <span>Section {s.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
