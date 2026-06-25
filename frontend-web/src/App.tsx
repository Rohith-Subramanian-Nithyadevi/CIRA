import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import StudentDashboard from './pages/StudentDashboard';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        
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
