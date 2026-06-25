import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Department {
  id: string;
  name: string;
  sections: Section[];
}

interface Section {
  id: string;
  name: string;
  departmentId: string;
}

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'STUDENT' | 'FACULTY'>('STUDENT');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  
  // Student specific
  const [rollNumber, setRollNumber] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [sectionId, setSectionId] = useState('');
  
  // Faculty specific
  const [employeeId, setEmployeeId] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch departments for dropdowns
    const fetchDepartments = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/v1/departments`);
        const data = await res.json();
        if (data?.data?.departments) {
          setDepartments(data.data.departments);
        }
      } catch (err) {
        console.error("Failed to fetch departments", err);
      }
    };
    fetchDepartments();
  }, []);

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return "Password must be at least 8 characters long.";
    if (!/[A-Z]/.test(pass)) return "Password must contain an uppercase letter.";
    if (!/[0-9]/.test(pass)) return "Password must contain a number.";
    return null;
  };

  const selectedDepartment = departments.find(d => d.id === departmentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!isLogin) {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
      const passError = validatePassword(password);
      if (passError) {
        setError(passError);
        setLoading(false);
        return;
      }
      if (!departmentId) {
        setError("Please select a department.");
        setLoading(false);
        return;
      }
    }

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
      
      const payload: any = isLogin ? { email, password } : { 
        email, password, name, phone, role, departmentId 
      };

      if (!isLogin && role === 'STUDENT') {
        payload.rollNumber = rollNumber;
        payload.sectionId = sectionId;
      } else if (!isLogin && role === 'FACULTY') {
        payload.employeeId = employeeId;
      }

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed.');
      }

      if (!isLogin && role === 'FACULTY') {
        // Faculty requires approval
        setSuccess('Registration successful! Your account is pending admin approval.');
        setIsLogin(true);
      } else {
        localStorage.setItem('cira_token', data.data.token);
        localStorage.setItem('cira_user', JSON.stringify(data.data.user));
        
        const loggedInUserRole = data.data.user.role;
        if (loggedInUserRole === 'ADMIN') navigate('/admin/dashboard');
        else if (loggedInUserRole === 'FACULTY') navigate('/faculty/dashboard');
        else navigate('/student/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white py-12 px-4">
      <div className="glass-card p-8 md:p-12 text-center w-full max-w-lg border border-slate-800 bg-slate-900/50 rounded-2xl shadow-2xl backdrop-blur-md">
        <h1 className="text-2xl font-bold mb-2">Centralized Access Portal</h1>
        
        <div className="flex bg-slate-800/50 rounded-lg p-1 mb-6 mt-4 border border-slate-700">
          <button 
            onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isLogin ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Sign In
          </button>
          <button 
            onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isLogin ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Sign Up
          </button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded mb-4 text-sm text-left">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-3 rounded mb-4 text-sm text-left">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {!isLogin && (
            <div className="flex justify-center gap-4 mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" checked={role === 'STUDENT'} onChange={() => setRole('STUDENT')} className="text-blue-600" />
                <span className="text-sm font-medium text-slate-300">Student</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" checked={role === 'FACULTY'} onChange={() => setRole('FACULTY')} className="text-blue-600" />
                <span className="text-sm font-medium text-slate-300">Faculty</span>
              </label>
            </div>
          )}

          {!isLogin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:border-blue-500 transition-colors" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Phone Number</label>
                <input type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:border-blue-500 transition-colors" placeholder="+1234567890" />
              </div>
              
              {role === 'STUDENT' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Roll Number</label>
                  <input type="text" required value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:border-blue-500 transition-colors" placeholder="CB.EN.U4..." />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Employee ID</label>
                  <input type="text" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:border-blue-500 transition-colors" placeholder="FAC123" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Department</label>
                <select required value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setSectionId(''); }} className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:border-blue-500 transition-colors text-white appearance-none">
                  <option value="" disabled>Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {role === 'STUDENT' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Section</label>
                  <select required value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!departmentId} className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:border-blue-500 transition-colors text-white appearance-none disabled:opacity-50">
                    <option value="" disabled>Select Section</option>
                    {selectedDepartment?.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">College Email Address</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:border-blue-500 transition-colors" placeholder="user@university.edu" />
          </div>

          <div className={!isLogin ? "grid grid-cols-1 md:grid-cols-2 gap-4" : ""}>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:border-blue-500 transition-colors" placeholder="••••••••" />
              {!isLogin && <p className="text-xs text-slate-500 mt-1">8+ chars, 1 uppercase, 1 number.</p>}
            </div>
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Confirm Password</label>
                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:border-blue-500 transition-colors" placeholder="••••••••" />
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="w-full mt-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors disabled:opacity-50">
            {loading ? 'Processing...' : (isLogin ? 'Secure Login' : 'Create Account')}
          </button>
        </form>

        <a href="/" className="mt-8 inline-block text-blue-400 hover:text-blue-300 text-sm">Return to Gateway</a>
      </div>
    </div>
  );
}
