import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import StudentSpace from '../components/dashboard/StudentSpace';
import UserProfile from '../components/dashboard/UserProfile';

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('progress');

  return (
    <DashboardLayout title="Academic Profile" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'profile' && <UserProfile />}
      {activeTab === 'progress' && <StudentSpace />}
      {activeTab === 'assignments' && (
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <h2 className="text-xl font-bold mb-4">My Assignments</h2>
          <p className="text-slate-500">You currently have no assigned tasks.</p>
        </div>
      )}
      {activeTab === 'quizzes' && (
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <h2 className="text-xl font-bold mb-4">Available Quizzes</h2>
          <p className="text-slate-500">No quizzes are currently scheduled for your department.</p>
        </div>
      )}
    </DashboardLayout>
  );
}
