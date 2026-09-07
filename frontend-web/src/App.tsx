import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import StudentDashboard from './pages/StudentDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import ExamDashboard from './pages/exam-portal/ExamDashboard';
import ExamInterface from './pages/exam-portal/ExamInterface';
import ExamResults from './pages/exam-portal/ExamResults';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        
        {/* Exam Portal Routes (Locked down UI for Web Client) */}
        <Route path="/exam-portal" element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <ExamDashboard />
          </ProtectedRoute>
        } />
        <Route path="/exam-portal/take/:quizId" element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <ExamInterface />
          </ProtectedRoute>
        } />
        <Route path="/exam-portal/results/:quizId" element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <ExamResults />
          </ProtectedRoute>
        } />
        <Route path="/exam-portal/review/:quizId" element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <ExamResults />
          </ProtectedRoute>
        } />
        
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
  </QueryClientProvider>
  );
}

export default App;
