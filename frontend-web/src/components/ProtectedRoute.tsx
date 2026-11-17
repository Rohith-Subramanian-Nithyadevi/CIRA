import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ('ADMIN' | 'FACULTY' | 'STUDENT')[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const location = useLocation();
  const token = localStorage.getItem('cira_token');
  const userStr = localStorage.getItem('cira_user');
  const redirectTo = `${location.pathname}${location.search}${location.hash}`;
  const loginPath = redirectTo && redirectTo !== '/login'
    ? `/login?redirect=${encodeURIComponent(redirectTo)}`
    : '/login';

  if (!token || !userStr) {
    return <Navigate to={loginPath} replace state={{ from: redirectTo }} />;
  }

  try {
    const user = JSON.parse(userStr);

    if (user.approvalStatus === 'PENDING') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Account Pending Approval</h1>
            <p className="text-slate-400">An administrator must approve your faculty account before you can access the platform.</p>
            <button onClick={() => { localStorage.clear(); window.location.href='/login'; }} className="mt-4 text-blue-400 hover:underline">Sign Out</button>
          </div>
        </div>
      );
    }

    if (!allowedRoles.includes(user.role)) {
      // Redirect to their proper dashboard if they try to access another role's route
      if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
      if (user.role === 'FACULTY') return <Navigate to="/faculty/dashboard" replace />;
      return <Navigate to="/student/dashboard" replace />;
    }

    return <>{children}</>;
  } catch (error) {
    localStorage.clear();
    return <Navigate to={loginPath} replace state={{ from: redirectTo }} />;
  }
}
