import { LayoutDashboard, Users, BookOpen, LogOut, FileText, CheckSquare, Settings, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import React from 'react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');
  const role = user.role || 'STUDENT';

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <span className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 mr-3 flex items-center justify-center text-sm font-bold">C</span>
          <span className="font-bold tracking-tight">Workspace</span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {role === 'ADMIN' && (
            <>
              <button className="flex items-center w-full px-3 py-2 bg-blue-500/10 text-blue-400 rounded-lg">
                <LayoutDashboard className="w-5 h-5 mr-3" /> Admin Hub
              </button>
              <button className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <CheckSquare className="w-5 h-5 mr-3" /> Faculty Approvals
              </button>
              <button className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <Users className="w-5 h-5 mr-3" /> User Management
              </button>
              <button className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <Settings className="w-5 h-5 mr-3" /> Departments
              </button>
            </>
          )}

          {role === 'FACULTY' && (
            <>
              <button className="flex items-center w-full px-3 py-2 bg-blue-500/10 text-blue-400 rounded-lg">
                <LayoutDashboard className="w-5 h-5 mr-3" /> Control Tower
              </button>
              <button className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <Users className="w-5 h-5 mr-3" /> Student Reports
              </button>
              <button className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <BookOpen className="w-5 h-5 mr-3" /> Quizzes
              </button>
              <button className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <FileText className="w-5 h-5 mr-3" /> Assignments
              </button>
            </>
          )}

          {role === 'STUDENT' && (
            <>
              <button className="flex items-center w-full px-3 py-2 bg-blue-500/10 text-blue-400 rounded-lg">
                <LayoutDashboard className="w-5 h-5 mr-3" /> My Progress
              </button>
              <button className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <FileText className="w-5 h-5 mr-3" /> Assignments
              </button>
              <button className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <BookOpen className="w-5 h-5 mr-3" /> Quizzes
              </button>
              <button className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <User className="w-5 h-5 mr-3" /> My Profile
              </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="h-16 shrink-0 flex items-center justify-between px-8 border-b border-slate-800 bg-slate-900/20 backdrop-blur-md">
          <h2 className="text-xl font-bold">{title}</h2>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <span className="text-xs font-bold text-slate-400">
                {role === 'ADMIN' ? 'AD' : role === 'FACULTY' ? 'FA' : 'ST'}
              </span>
            </div>
            <div className="text-sm">
              <p className="font-medium">{user.name || 'User'}</p>
              <p className="text-slate-500 text-xs">{role}</p>
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
