import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 bg-slate-900/50 p-4 flex justify-between items-center">
        <h1 className="font-bold text-xl">Admin Control Center</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">{user.name} (Admin)</span>
          <button onClick={handleLogout} className="text-sm bg-red-600/20 text-red-400 px-3 py-1 rounded hover:bg-red-600/40">Logout</button>
        </div>
      </nav>

      <main className="p-8 max-w-7xl mx-auto space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h3 className="text-slate-400 text-sm font-medium">Pending Approvals</h3>
            <p className="text-3xl font-bold mt-2 text-yellow-500">0</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h3 className="text-slate-400 text-sm font-medium">Total Students</h3>
            <p className="text-3xl font-bold mt-2 text-blue-500">0</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h3 className="text-slate-400 text-sm font-medium">Total Faculty</h3>
            <p className="text-3xl font-bold mt-2 text-green-500">0</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h3 className="text-slate-400 text-sm font-medium">Placement Readiness</h3>
            <p className="text-3xl font-bold mt-2 text-purple-500">N/A</p>
          </div>
        </section>

        <section className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h2 className="text-xl font-bold mb-4">Faculty Approvals</h2>
          <div className="text-slate-400 text-sm italic">Approval logic will be dynamically populated here.</div>
        </section>
      </main>
    </div>
  );
}
