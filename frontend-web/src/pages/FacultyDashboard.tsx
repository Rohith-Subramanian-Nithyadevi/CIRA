import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ControlTower from '../components/dashboard/ControlTower';
import UserProfile from '../components/dashboard/UserProfile';
import QuizManagement from '../components/dashboard/QuizManagement';
import { StudentReports } from '../components/dashboard/StudentReports';

export default function FacultyDashboard() {
  const [activeTab, setActiveTab] = useState('tower');

  return (
    <DashboardLayout title="Institutional Surveillance" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'profile' && <UserProfile />}
      {activeTab === 'tower' && <ControlTower />}
      {activeTab === 'reports' && <StudentReports />}
      {activeTab === 'quizzes' && <QuizManagement />}
      {activeTab === 'assignments' && (
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <h2 className="text-xl font-bold mb-4">Assignment Management</h2>
          <p className="text-slate-500">Create, assign, and grade assignments here.</p>
        </div>
      )}
    </DashboardLayout>
  );
}
