import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ControlTower from '../components/dashboard/ControlTower';
import UserProfile from '../components/dashboard/UserProfile';

export default function FacultyDashboard() {
  const [activeTab, setActiveTab] = useState('tower');

  return (
    <DashboardLayout title="Institutional Surveillance" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'profile' ? (
        <UserProfile />
      ) : (
        <ControlTower />
      )}
    </DashboardLayout>
  );
}
