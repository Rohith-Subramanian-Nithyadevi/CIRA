import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return "Password must be at least 8 characters long.";
    if (!/[A-Z]/.test(pass)) return "Password must contain an uppercase letter.";
    if (!/[0-9]/.test(pass)) return "Password must contain a number.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Password validation only on signup
    if (!isLogin) {
      const passError = validatePassword(password);
      if (passError) {
        setError(passError);
        setLoading(false);
        return;
      }
    }

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
      
      const payload = isLogin 
        ? { email, password } 
        : { email, password, name, role: 'STUDENT' }; // Default to STUDENT role on signup

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed. Please check your credentials or database connection.');
      }

      // Store token and user data
      localStorage.setItem('cira_token', data.data.token);
      localStorage.setItem('cira_user', JSON.stringify(data.data.user));

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Is your database connected?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="glass-card p-12 text-center w-full max-w-md border border-slate-800 bg-slate-900/50 rounded-2xl shadow-2xl backdrop-blur-md">
        <h1 className="text-2xl font-bold mb-2">Centralized Access Portal</h1>
        
        {/* Toggle between Login and Signup */}
        <div className="flex bg-slate-800/50 rounded-lg p-1 mb-6 mt-4 border border-slate-700">
          <button 
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isLogin ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Sign In
          </button>
          <button 
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isLogin ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded mb-4 text-sm text-left">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="text-left">
              <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="John Doe"
              />
            </div>
          )}

          <div className="text-left">
            <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="user@university.edu"
            />
          </div>
          <div className="text-left">
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="••••••••"
            />
            {!isLogin && (
              <p className="text-xs text-slate-500 mt-2">
                Must be at least 8 characters, with 1 uppercase letter and 1 number.
              </p>
            )}
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isLogin ? 'Secure Login' : 'Create Account')}
          </button>
        </form>

        <a href="/" className="mt-8 inline-block text-blue-400 hover:text-blue-300 text-sm">Return to Gateway</a>
      </div>
    </div>
  );
}
