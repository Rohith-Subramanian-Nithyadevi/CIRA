import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import FacultyHome from '../components/dashboard/FacultyHome';
import UserProfile from '../components/dashboard/UserProfile';
import QuizManagement from '../components/dashboard/QuizManagement';
import { StudentReports } from '../components/dashboard/StudentReports';
import AssignmentManagement from '../components/dashboard/AssignmentManagement';

export default function FacultyDashboard() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <DashboardLayout title="Institutional Surveillance" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'profile' && <UserProfile />}
      {activeTab === 'home' && <FacultyHome />}
      {activeTab === 'reports' && <StudentReports />}
      {activeTab === 'quizzes' && <QuizManagement />}
      {activeTab === 'assignments' && <AssignmentManagement />}
    </DashboardLayout>
  );
}
