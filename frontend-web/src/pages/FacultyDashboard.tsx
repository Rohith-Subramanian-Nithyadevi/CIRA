import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ControlTower from '../components/dashboard/ControlTower';
import UserProfile from '../components/dashboard/UserProfile';

export default function FacultyDashboard() {
  const [activeTab, setActiveTab] = useState('tower');

  return (
    <DashboardLayout title="Institutional Surveillance" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'profile' && <UserProfile />}
      {activeTab === 'tower' && <ControlTower />}
      {activeTab === 'reports' && (
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <h2 className="text-xl font-bold mb-4">Department & Student Reports</h2>
          <p className="text-slate-500">You must enroll in a department via your Profile to view reports.</p>
        </div>
      )}
      {activeTab === 'quizzes' && (
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <h2 className="text-xl font-bold mb-4">Quiz Management</h2>
          <p className="text-slate-500">Create, edit, and schedule quizzes here.</p>
        </div>
      )}
      {activeTab === 'assignments' && (
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <h2 className="text-xl font-bold mb-4">Assignment Management</h2>
          <p className="text-slate-500">Create, assign, and grade assignments here.</p>
        </div>
      )}
    </DashboardLayout>
  );
}
