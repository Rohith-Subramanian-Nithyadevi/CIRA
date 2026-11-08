import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import FacultyHome from '../components/dashboard/FacultyHome';
import UserProfile from '../components/dashboard/UserProfile';
import QuizManagement from '../components/dashboard/QuizManagement';
import { StudentReports } from '../components/dashboard/StudentReports';
import AssignmentManagement from '../components/dashboard/AssignmentManagement';
import { FileText, Home, ListChecks, User, Users } from 'lucide-react';
import type { DashboardNavGroup } from '../components/DashboardLayout';
import FacultyCommandPalette from '../components/dashboard/FacultyCommandPalette';
import { FacultyDemoProvider } from '../context/FacultyDemoContext';

const facultyNavigation: DashboardNavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'home', label: 'Overview', icon: Home },
    ],
  },
  {
    label: 'Students',
    items: [
      { id: 'reports', label: 'Students & Reports', icon: Users, badge: 'Analytics' },
    ],
  },
  {
    label: 'Assessments',
    items: [
      { id: 'quizzes', label: 'Quizzes', icon: ListChecks },
      { id: 'assignments', label: 'Assignments', icon: FileText },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'profile', label: 'My Profile', icon: User },
    ],
  },
];

export default function FacultyDashboard() {
  const [activeTab, setActiveTab] = useState('home');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  return (
    <FacultyDemoProvider value={isDemo}>
    <>
    <DashboardLayout title="Faculty Workspace" activeTab={activeTab} onTabChange={setActiveTab} facultyNavigation={facultyNavigation} onCommandPalette={() => setCommandPaletteOpen(true)} isDemo={isDemo} onToggleDemo={setIsDemo} facultySidebarCollapsible>
      {activeTab === 'profile' && <UserProfile />}
      {activeTab === 'home' && <FacultyHome onNavigate={setActiveTab} />}
      {activeTab === 'reports' && <StudentReports />}
      {activeTab === 'quizzes' && <QuizManagement />}
      {activeTab === 'assignments' && <AssignmentManagement />}
    </DashboardLayout>
    <FacultyCommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} onNavigate={setActiveTab} />
    </>
    </FacultyDemoProvider>
  );
}
