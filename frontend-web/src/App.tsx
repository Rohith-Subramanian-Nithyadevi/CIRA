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

function App() {
  return (
    <BrowserRouter>
      <Toaster richColors position="top-right" />
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
