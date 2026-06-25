import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import StudentSpace from '../components/dashboard/StudentSpace';
import UserProfile from '../components/dashboard/UserProfile';

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('progress');

  return (
    <DashboardLayout title="Academic Profile" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'profile' ? (
        <UserProfile />
      ) : (
        <StudentSpace />
      )}
    </DashboardLayout>
  );
}
