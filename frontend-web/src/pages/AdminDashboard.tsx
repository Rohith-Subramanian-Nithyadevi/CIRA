import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';

interface PendingFaculty {
  id: string;
  name: string;
  email: string;
  employeeId: string;
}

export default function AdminDashboard() {
  const [pendingFaculty, setPendingFaculty] = useState<PendingFaculty[]>([]);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const token = localStorage.getItem('cira_token');
        const res = await fetch(`${baseUrl}/api/v1/admin/faculty/pending`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.data?.pendingFaculty) {
          setPendingFaculty(data.data.pendingFaculty);
        }
      } catch (err) {
        console.error("Failed to fetch pending faculty", err);
      }
    };
    fetchPending();
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
      setPendingFaculty(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error("Failed to approve/reject", err);
    }
  };

  return (
    <DashboardLayout title="Admin Control Center">
      <div className="space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h3 className="text-slate-400 text-sm font-medium">Pending Approvals</h3>
            <p className="text-3xl font-bold mt-2 text-yellow-500">{pendingFaculty.length}</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h3 className="text-slate-400 text-sm font-medium">System Health</h3>
            <p className="text-3xl font-bold mt-2 text-green-500">100%</p>
          </div>
        </section>

        <section className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h2 className="text-xl font-bold mb-4">Pending Faculty Approvals</h2>
          
          {pendingFaculty.length === 0 ? (
            <p className="text-slate-400 text-sm italic">No pending faculty registrations.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs uppercase bg-slate-800 border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Employee ID</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingFaculty.map(faculty => (
                    <tr key={faculty.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="px-6 py-4 font-medium text-white">{faculty.name}</td>
                      <td className="px-6 py-4">{faculty.employeeId}</td>
                      <td className="px-6 py-4">{faculty.email}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleApproval(faculty.id, 'APPROVED')} className="text-green-400 hover:text-green-300 mr-4 font-medium">Approve</button>
                        <button onClick={() => handleApproval(faculty.id, 'REJECTED')} className="text-red-400 hover:text-red-300 font-medium">Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
