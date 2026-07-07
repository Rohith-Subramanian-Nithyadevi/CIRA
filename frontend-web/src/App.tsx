import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import StudentDashboard from './pages/StudentDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import ExamDashboard from './pages/exam-portal/ExamDashboard';
import ExamInterface from './pages/exam-portal/ExamInterface';

function ExitButton() {
  if (!(window as any).secureExamAPI) return null;
  return (
    <button 
      onClick={() => (window as any).secureExamAPI.quitApp()}
      className="fixed bottom-4 right-4 z-[9999] bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold shadow-lg transition-colors flex items-center gap-2"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
      Exit App
    </button>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Toaster richColors position="top-right" />
      <ExitButton />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        
        {/* Exam Portal Routes (Locked down UI for Desktop Client) */}
        <Route path="/exam-portal" element={<ExamDashboard />} />
        <Route path="/exam-portal/take/:quizId" element={<ExamInterface />} />
        
        {/* Protected Admin Routes */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        {/* Protected Faculty Routes */}
        <Route path="/faculty/dashboard" element={
          <ProtectedRoute allowedRoles={['FACULTY']}>
            <FacultyDashboard />
          </ProtectedRoute>
        } />

        {/* Protected Student Routes */}
        <Route path="/student/dashboard" element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <StudentDashboard />
          </ProtectedRoute>
        } />
        
        {/* Fallback routing is handled inside ProtectedRoute if someone tries to navigate to root dashboard */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={[]}><div /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
