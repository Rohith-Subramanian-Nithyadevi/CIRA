import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import FacultyHome from '../components/dashboard/FacultyHome';
import UserProfile from '../components/dashboard/UserProfile';
import QuizManagement from '../components/dashboard/QuizManagement';
import { StudentReports } from '../components/dashboard/StudentReports';

export default function FacultyDashboard() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <DashboardLayout title="Institutional Surveillance" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'profile' && <UserProfile />}
      {activeTab === 'home' && <FacultyHome />}
      {activeTab === 'reports' && <StudentReports />}
      {activeTab === 'quizzes' && <QuizManagement />}
      {activeTab === 'assignments' && (
        <div className="p-6 bg-white rounded-xl border border-border-soft shadow-sm">
          <h2 className="text-xl font-serif font-bold mb-4 text-ink">Assignment Management</h2>
          <p className="text-gray-body text-sm">Create, assign, and grade assignments here.</p>
        </div>
      )}
    </DashboardLayout>
  );
}
