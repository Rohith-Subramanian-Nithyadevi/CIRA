import { useState } from 'react';
import { LayoutDashboard, Users, BookOpen, LogOut, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StudentSpace from '../components/dashboard/StudentSpace';
import ControlTower from '../components/dashboard/ControlTower';

export default function Dashboard() {
  const navigate = useNavigate();
  // Simulated authentication claim reading
  const [role, setRole] = useState<'Student' | 'Faculty'>('Student');

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <span className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 mr-3 flex items-center justify-center text-sm font-bold">C</span>
          <span className="font-bold tracking-tight">Workspace</span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          {role === 'Faculty' ? (
            <>
              <button className="flex items-center w-full px-3 py-2 bg-blue-500/10 text-blue-400 rounded-lg">
                <LayoutDashboard className="w-5 h-5 mr-3" /> Control Tower
              </button>
              <button className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <Users className="w-5 h-5 mr-3" /> Student Directory
              </button>
              <button className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <BookOpen className="w-5 h-5 mr-3" /> Question Bank
              </button>
            </>
          ) : (
            <>
              <button className="flex items-center w-full px-3 py-2 bg-blue-500/10 text-blue-400 rounded-lg">
                <LayoutDashboard className="w-5 h-5 mr-3" /> My Progress
              </button>
              <button className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <FileText className="w-5 h-5 mr-3" /> Assignments
              </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between px-3 mb-4">
            <span className="text-xs text-slate-500 font-medium uppercase">Debug Panel</span>
            <button 
              onClick={() => setRole(role === 'Student' ? 'Faculty' : 'Student')}
              className="text-xs text-blue-400 hover:underline"
            >
              Switch Role
            </button>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="h-16 flex items-center justify-between px-8 border-b border-slate-800 bg-slate-900/20 backdrop-blur-md sticky top-0 z-10">
          <h2 className="text-xl font-bold">
            {role === 'Faculty' ? 'Institutional Surveillance' : 'Academic Profile'}
          </h2>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <span className="text-xs font-bold text-slate-400">{role === 'Student' ? 'ST' : 'FA'}</span>
            </div>
            <div className="text-sm">
              <p className="font-medium">{role === 'Student' ? 'Alex Mercer' : 'Dr. Sarah Chen'}</p>
              <p className="text-slate-500 text-xs">{role}</p>
            </div>
          </div>
        </div>
        
        <div className="p-8">
          {role === 'Faculty' ? <ControlTower /> : <StudentSpace />}
        </div>
      </main>
    </div>
  );
}
