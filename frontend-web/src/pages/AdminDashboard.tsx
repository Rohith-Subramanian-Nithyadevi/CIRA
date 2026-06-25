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

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('hub');
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);

  useEffect(() => {
    const fetchFaculty = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const token = localStorage.getItem('cira_token');
        const res = await fetch(`${baseUrl}/api/v1/admin/faculty/all`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.data?.faculty) {
          setFacultyList(data.data.faculty);
        }
      } catch (err) {
        console.error("Failed to fetch faculty", err);
      }
    };
    fetchFaculty();
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
    } catch (err) {
      console.error("Failed to approve/reject", err);
    }
  };

  return (
    <DashboardLayout title="Admin Control Center" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'profile' && <UserProfile />}
      
      {activeTab === 'hub' && (
        <div className="space-y-8">
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h3 className="text-slate-400 text-sm font-medium">Total Faculty</h3>
            <p className="text-3xl font-bold mt-2 text-yellow-500">{facultyList.length}</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h3 className="text-slate-400 text-sm font-medium">Pending Approvals</h3>
            <p className="text-3xl font-bold mt-2 text-yellow-500">{facultyList.filter(f => f.approvalStatus === 'PENDING').length}</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h3 className="text-slate-400 text-sm font-medium">System Health</h3>
            <p className="text-3xl font-bold mt-2 text-green-500">100%</p>
          </div>
        </section>

        <section className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h2 className="text-xl font-bold mb-4">Faculty Management</h2>
          
          {facultyList.length === 0 ? (
            <p className="text-slate-400 text-sm italic">No faculty registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs uppercase bg-slate-800 border-b border-slate-700">
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
                    <tr key={faculty.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="px-6 py-4 font-medium text-white">{faculty.name}</td>
                      <td className="px-6 py-4">{faculty.employeeId}</td>
                      <td className="px-6 py-4">{faculty.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${faculty.approvalStatus === 'APPROVED' ? 'bg-green-500/20 text-green-400' : faculty.approvalStatus === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                          {faculty.approvalStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {faculty.approvalStatus !== 'APPROVED' && (
                          <button onClick={() => handleApproval(faculty.id, 'APPROVED')} className="text-green-400 hover:text-green-300 mr-4 font-medium">Approve</button>
                        )}
                        {faculty.approvalStatus !== 'REJECTED' && (
                          <button onClick={() => handleApproval(faculty.id, 'REJECTED')} className="text-red-400 hover:text-red-300 font-medium">
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
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <h2 className="text-xl font-bold mb-4">Faculty Approvals</h2>
          <p className="text-slate-500">You can manage Faculty Approvals from the Admin Hub.</p>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <h2 className="text-xl font-bold mb-4">User Management</h2>
          <p className="text-slate-500">Search and manage all platform users.</p>
        </div>
      )}

      {activeTab === 'departments' && (
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <h2 className="text-xl font-bold mb-4">Department Management</h2>
          <p className="text-slate-500">Create and manage departments and sections.</p>
        </div>
      )}
    </DashboardLayout>
  );
}
