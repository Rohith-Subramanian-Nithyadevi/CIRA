import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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
  const [personalEmail, setPersonalEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('+91 ');
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Student specific
  const [rollNumber, setRollNumber] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [sectionId, setSectionId] = useState('');
  
  // Faculty specific
  const [employeeId, setEmployeeId] = useState('');
  const [subject, setSubject] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);
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

    if (!isLogin) {
      if (password !== confirmPassword) {
        toast.error("Passwords do not match.");
        setLoading(false);
        return;
      }
      const passError = validatePassword(password);
      if (passError) {
        toast.error(passError);
        setLoading(false);
        return;
      }

      const phoneRegex = /^\+91\s?\d{10}$/;
      if (!phoneRegex.test(phone.trim())) {
        toast.error("Please enter a valid 10-digit phone number with +91 code.");
        setLoading(false);
        return;
      }

      if (/[A-Z]/.test(email) || /[A-Z]/.test(personalEmail)) {
        toast.error("Email addresses must not contain uppercase letters.");
        setLoading(false);
        return;
      }

      if (role === 'STUDENT' && !departmentId) {
        toast.error("Please select a department.");
        setLoading(false);
        return;
      }
      
      if (role === 'FACULTY' && !subject) {
        toast.error("Please select a subject.");
        setLoading(false);
        return;
      }
    }

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
      
      const payload: any = isLogin ? { email, password } : { 
        email, personalEmail, password, name, phone, role
      };

      if (!isLogin && role === 'STUDENT') {
        payload.departmentId = departmentId;
        payload.rollNumber = rollNumber;
        payload.sectionId = sectionId;
      } else if (!isLogin && role === 'FACULTY') {
        payload.employeeId = employeeId;
        payload.subject = subject;
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

      if (!isLogin && data.message?.includes('verify')) {
        toast.success(data.message);
        setIsVerifying(true);
        return;
      }

      if (!isLogin && role === 'FACULTY') {
        // Faculty requires approval
        toast.success('Registration successful! Your account is pending admin approval.');
        setIsLogin(true);
      } else {
        localStorage.setItem('cira_token', data.data.token);
        localStorage.setItem('cira_user', JSON.stringify(data.data.user));
        
        const loggedInUserRole = data.data.user.role;
        const urlParams = new URLSearchParams(window.location.search);
        const isDesktopClient = urlParams.get('client') === 'desktop' || navigator.userAgent.toLowerCase().includes('electron');

        if (isDesktopClient && loggedInUserRole === 'STUDENT') {
          navigate('/exam-portal');
        } else if (loggedInUserRole === 'ADMIN') {
          navigate('/admin/dashboard');
        } else if (loggedInUserRole === 'FACULTY') {
          navigate('/faculty/dashboard');
        } else {
          navigate('/student/dashboard');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Verification failed.');
      }

      if (data.message?.includes('pending')) {
        toast.success(data.message);
        setIsVerifying(false);
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
      toast.error(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-xl border-slate-700/50 bg-slate-900/60 backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(37,99,235,0.25)] text-slate-100 rounded-3xl overflow-hidden">
        <CardHeader className="text-center pb-6 pt-8">
          <CardTitle className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">Centralized Access Portal</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-8 sm:px-10">
          <div className="flex bg-slate-950/50 rounded-xl p-1 mb-5 border border-slate-800/80 shadow-inner">
            <Button 
              variant="ghost"
              onClick={() => { setIsLogin(true); }}
              className={`flex-1 rounded-lg py-3 text-base transition-all duration-300 ${isLogin ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'}`}
            >
              Sign In
            </Button>
            <Button 
              variant="ghost"
              onClick={() => { setIsLogin(false); }}
              className={`flex-1 rounded-lg py-3 text-base transition-all duration-300 ${!isLogin ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'}`}
            >
              Sign Up
            </Button>
          </div>

          {isVerifying ? (
            <form onSubmit={handleVerifySubmit} className="space-y-5 text-left">
              <div className="space-y-2">
                <Label htmlFor="verificationCode" className="text-slate-300 text-sm font-medium ml-1">Verification Code</Label>
                <Input id="verificationCode" type="text" required value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="h-11 rounded-xl bg-slate-950/40 border-slate-700/50 focus-visible:ring-blue-500 focus-visible:border-blue-500 text-base px-4" placeholder="123456" />
                <p className="text-sm text-slate-500 ml-1">Sent to your Personal Email ({personalEmail}). <span className="text-slate-400 italic">Check spam if not found.</span></p>
              </div>
              <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold rounded-xl mt-6 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all hover:-translate-y-0.5">
                {loading ? 'Verifying...' : 'Verify Email'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setIsVerifying(false)} className="w-full h-12 rounded-xl mt-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
                Cancel
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {!isLogin && (
              <div className="flex justify-center mb-5 bg-slate-950/30 p-1.5 rounded-2xl border border-slate-800/50 inline-flex mx-auto">
                <RadioGroup value={role} onValueChange={(val: any) => setRole(val)} className="flex space-x-6 px-4 py-1">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="STUDENT" id="r1" className="w-5 h-5 border-slate-500 text-blue-500" />
                    <Label htmlFor="r1" className="text-slate-200 font-medium text-base cursor-pointer">Student</Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="FACULTY" id="r2" className="w-5 h-5 border-slate-500 text-blue-500" />
                    <Label htmlFor="r2" className="text-slate-200 font-medium text-base cursor-pointer">Faculty</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {!isLogin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300 text-sm font-medium ml-1">Full Name</Label>
                  <Input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl bg-slate-950/40 border-slate-700/50 focus-visible:ring-blue-500 focus-visible:border-blue-500 text-base px-4" placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-300 text-sm font-medium ml-1">Phone Number</Label>
                  <Input id="phone" type="tel" required value={phone} onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('+91')) {
                      setPhone(val);
                    } else {
                      setPhone('+91 ' + val.replace(/^\+?9?1?\s*/, ''));
                    }
                  }} className="h-11 rounded-xl bg-slate-950/40 border-slate-700/50 focus-visible:ring-blue-500 focus-visible:border-blue-500 text-base px-4" placeholder="+91 9876543210" />
                </div>
                
                {role === 'STUDENT' ? (
                  <div className="space-y-2">
                    <Label htmlFor="rollNumber" className="text-slate-300 text-sm font-medium ml-1">Roll Number</Label>
                    <Input id="rollNumber" type="text" required value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className="h-11 rounded-xl bg-slate-950/40 border-slate-700/50 focus-visible:ring-blue-500 focus-visible:border-blue-500 text-base px-4" placeholder="CH.EN.U4..." />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="employeeId" className="text-slate-300 text-sm font-medium ml-1">Employee ID</Label>
                    <Input id="employeeId" type="text" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-11 rounded-xl bg-slate-950/40 border-slate-700/50 focus-visible:ring-blue-500 focus-visible:border-blue-500 text-base px-4" placeholder="FAC123" />
                  </div>
                )}

                {role === 'STUDENT' ? (
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium ml-1">Department</Label>
                    <Select value={departmentId} onValueChange={(val) => { setDepartmentId(val || ''); setSectionId(''); }} required>
                      <SelectTrigger className="h-11 rounded-xl bg-slate-950/40 border-slate-700/50 focus:ring-blue-500 text-slate-100 px-4">
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 rounded-xl shadow-xl">
                        {departments.map(d => <SelectItem key={d.id} value={d.id} className="py-2.5 focus:bg-blue-600 focus:text-white cursor-pointer">{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium ml-1">Subject</Label>
                    <Select value={subject} onValueChange={(val) => setSubject(val || '')} required>
                      <SelectTrigger className="h-11 rounded-xl bg-slate-950/40 border-slate-700/50 focus:ring-blue-500 text-slate-100 px-4">
                        <SelectValue placeholder="Select Subject" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 rounded-xl shadow-xl">
                        <SelectItem value="softskills" className="py-2.5 focus:bg-blue-600 focus:text-white cursor-pointer">Softskills</SelectItem>
                        <SelectItem value="verbal" className="py-2.5 focus:bg-blue-600 focus:text-white cursor-pointer">Verbal</SelectItem>
                        <SelectItem value="aptitude" className="py-2.5 focus:bg-blue-600 focus:text-white cursor-pointer">Aptitude</SelectItem>
                        <SelectItem value="trainee" className="py-2.5 focus:bg-blue-600 focus:text-white cursor-pointer">Trainee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {role === 'STUDENT' && (
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium ml-1">Section</Label>
                    <Select value={sectionId} onValueChange={(val) => setSectionId(val || '')} disabled={!departmentId} required>
                      <SelectTrigger className="h-11 rounded-xl bg-slate-950/40 border-slate-700/50 focus:ring-blue-500 text-slate-100 px-4 disabled:opacity-50">
                        <SelectValue placeholder="Select Section" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 rounded-xl shadow-xl">
                        {selectedDepartment?.sections.map(s => <SelectItem key={s.id} value={s.id} className="py-2.5 focus:bg-blue-600 focus:text-white cursor-pointer">{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300 text-sm font-medium ml-1">College Email Address</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value.toLowerCase())} className="h-11 rounded-xl bg-slate-950/40 border-slate-700/50 focus-visible:ring-blue-500 focus-visible:border-blue-500 text-base px-4" placeholder="user@university.edu" />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="personalEmail" className="text-slate-300 text-sm font-medium ml-1">Personal Email (Gmail)</Label>
                <Input id="personalEmail" type="email" required value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value.toLowerCase())} className="h-11 rounded-xl bg-slate-950/40 border-slate-700/50 focus-visible:ring-blue-500 focus-visible:border-blue-500 text-base px-4" placeholder="you@gmail.com" />
              </div>
            )}

            <div className={!isLogin ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-2"}>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300 text-sm font-medium ml-1">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl bg-slate-950/40 border-slate-700/50 focus-visible:ring-blue-500 focus-visible:border-blue-500 text-base px-4 pr-10 font-mono tracking-wider" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 focus:outline-none">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {!isLogin && <p className="text-xs text-slate-500 ml-1">8+ chars, 1 uppercase, 1 number.</p>}
              </div>
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-300 text-sm font-medium ml-1">Confirm Password</Label>
                  <div className="relative">
                    <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11 rounded-xl bg-slate-950/40 border-slate-700/50 focus-visible:ring-blue-500 focus-visible:border-blue-500 text-base px-4 pr-10 font-mono tracking-wider" placeholder="••••••••" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 focus:outline-none">
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold rounded-2xl mt-6 bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_-5px_rgba(37,99,235,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_30px_-5px_rgba(37,99,235,0.6)]">
              {loading ? 'Processing...' : (isLogin ? 'Secure Login' : 'Create Account')}
            </Button>
          </form>
          )}

          <div className="mt-6 text-center">
            <a href="/" className="inline-block text-slate-400 hover:text-white text-sm font-medium transition-colors hover:underline underline-offset-4">Return to Gateway</a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
