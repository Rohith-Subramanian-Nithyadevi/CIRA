import { LayoutDashboard, Users, BookOpen, LogOut, FileText, CheckSquare, Settings, User, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import React from 'react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function DashboardLayout({ children, title, activeTab, onTabChange }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');
  const role = user.role || 'STUDENT';

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const getNavClass = (tab: string) => {
    return `flex items-center w-full px-3 py-2 rounded-lg transition-colors font-medium text-sm ${
      activeTab === tab 
        ? 'bg-maroon/10 text-maroon font-semibold' 
        : 'text-gray-body hover:text-ink hover:bg-cream-edge/30'
    }`;
  };

  return (
    <div className="min-h-screen bg-cream flex text-ink font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border-soft bg-white flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-border-soft">
          <img src="/img/favicon.ico" alt="CIRA Logo" className="w-8 h-8 mr-3 object-contain" />
          <span className="font-bold tracking-tight text-ink">CIRA Workspace</span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {role === 'ADMIN' && (
            <>
              <button onClick={() => onTabChange('hub')} className={getNavClass('hub')}>
                <LayoutDashboard className="w-5 h-5 mr-3" /> Admin Hub
              </button>
              <button onClick={() => onTabChange('faculty')} className={getNavClass('faculty')}>
                <CheckSquare className="w-5 h-5 mr-3" /> Faculty Approvals
              </button>
              <button onClick={() => onTabChange('users')} className={getNavClass('users')}>
                <Users className="w-5 h-5 mr-3" /> User Management
              </button>
              <button onClick={() => onTabChange('departments')} className={getNavClass('departments')}>
                <Settings className="w-5 h-5 mr-3" /> Departments
              </button>
              <button onClick={() => onTabChange('profile')} className={getNavClass('profile')}>
                <User className="w-5 h-5 mr-3" /> My Profile
              </button>
            </>
          )}

          {role === 'FACULTY' && (
            <>
              <button onClick={() => onTabChange('home')} className={getNavClass('home')}>
                <Home className="w-5 h-5 mr-3" /> Home
              </button>
              <button onClick={() => onTabChange('reports')} className={getNavClass('reports')}>
                <Users className="w-5 h-5 mr-3" /> Student Reports
              </button>
              <button onClick={() => onTabChange('quizzes')} className={getNavClass('quizzes')}>
                <BookOpen className="w-5 h-5 mr-3" /> Quizzes
              </button>
              <button onClick={() => onTabChange('assignments')} className={getNavClass('assignments')}>
                <FileText className="w-5 h-5 mr-3" /> Assignments
              </button>
              <button onClick={() => onTabChange('profile')} className={getNavClass('profile')}>
                <User className="w-5 h-5 mr-3" /> My Profile
              </button>
            </>
          )}

          {role === 'STUDENT' && (
            <>
              <button onClick={() => onTabChange('progress')} className={getNavClass('progress')}>
                <LayoutDashboard className="w-5 h-5 mr-3" /> My Progress
              </button>
              <button onClick={() => onTabChange('assignments')} className={getNavClass('assignments')}>
                <FileText className="w-5 h-5 mr-3" /> Assignments
              </button>
              <button onClick={() => onTabChange('quizzes')} className={getNavClass('quizzes')}>
                <BookOpen className="w-5 h-5 mr-3" /> Quizzes
              </button>
              <button onClick={() => onTabChange('profile')} className={getNavClass('profile')}>
                <User className="w-5 h-5 mr-3" /> My Profile
              </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-border-soft">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-gray-body hover:text-ink hover:bg-cream-edge/30 rounded-lg transition-colors font-medium text-sm"
          >
            <LogOut className="w-5 h-5 mr-3" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="h-16 shrink-0 flex items-center justify-between px-8 border-b border-border-soft bg-white/80 backdrop-blur-md">
          <h2 className="text-xl font-serif font-bold text-ink">{title}</h2>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-cream border border-border-soft flex items-center justify-center">
              <span className="text-xs font-bold text-maroon">
                {role === 'ADMIN' ? 'AD' : role === 'FACULTY' ? 'FA' : 'ST'}
              </span>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-ink leading-none">{user.name || 'User'}</p>
              <p className="text-gray-body text-xs mt-1 leading-none">{role}</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
