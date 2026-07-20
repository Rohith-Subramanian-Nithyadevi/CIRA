import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import DotField from '../components/ui/DotField';

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
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [firebaseIdToken, setFirebaseIdToken] = useState('');

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

  // Forgot password states
  const [isForgotFlow, setIsForgotFlow] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1); // 1 = request code, 2 = reset password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [newForgotPassword, setNewForgotPassword] = useState('');
  const [confirmForgotPassword, setConfirmForgotPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error("Please enter your college email address.");
      return;
    }
    setLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to request password reset.');
      }

      toast.success("Verification code sent to your personal email.");
      setForgotStep(2);
    } catch (err: any) {
      toast.error(err.message || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotCode || !newForgotPassword || !confirmForgotPassword) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (newForgotPassword !== confirmForgotPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    const passError = validatePassword(newForgotPassword);
    if (passError) {
      toast.error(passError);
      return;
    }
    setLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          code: forgotCode,
          newPassword: newForgotPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Password reset failed.');
      }

      toast.success("Password reset successful. You can now login.");
      setIsForgotFlow(false);
      setForgotStep(1);
      setForgotEmail('');
      setForgotCode('');
      setNewForgotPassword('');
      setConfirmForgotPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const token = await user.getIdToken();
      setFirebaseIdToken(token);

      const googlePersonalEmail = (user.email || '').toLowerCase();
      setPersonalEmail(googlePersonalEmail);

      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/v1/auth/firebase-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Google Sign-In failed.');
      }

      if (data.status === 'NEEDS_ONBOARDING') {
        toast.info("Google authentication successful! Please enter your college email and profile details.");
        if (data.data.name) setName(data.data.name);
        setIsOnboarding(true);
        return;
      }

      // Existing user signed in
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
    } catch (err: any) {
      toast.error(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!email) {
      toast.error("Please enter your college email address.");
      setLoading(false);
      return;
    }

    if (role === 'STUDENT' && !email.toLowerCase().endsWith('@ch.students.amrita.edu')) {
      toast.error("Student college email must end with @ch.students.amrita.edu");
      setLoading(false);
      return;
    }

    if (role === 'FACULTY' && !email.toLowerCase().endsWith('@ch.amrita.edu') && !email.toLowerCase().endsWith('@ch.students.amrita.edu')) {
      toast.error("Faculty college email must end with @ch.amrita.edu");
      setLoading(false);
      return;
    }

    const phoneRegex = /^\+91\s?\d{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      toast.error("Please enter a valid 10-digit phone number with +91 code.");
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

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const payload: any = {
        idToken: firebaseIdToken,
        role,
        name,
        email: email.toLowerCase(), // College Email
        phone,
      };

      if (role === 'STUDENT') {
        payload.departmentId = departmentId;
        payload.rollNumber = rollNumber;
        payload.sectionId = sectionId;
      } else {
        payload.employeeId = employeeId;
        payload.subject = subject;
      }

      const response = await fetch(`${baseUrl}/api/v1/auth/firebase-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed.');
      }

      toast.success(data.message || 'Registration successful. Please verify your college email.');
      setIsOnboarding(false);
      setIsVerifying(true);
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };


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
    <div 
      className="min-h-screen flex items-center justify-center font-sans text-ink selection:bg-maroon/20 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      style={{ background: 'radial-gradient(circle, var(--bg-cream) 0%, var(--bg-cream-edge) 100%)' }}
    >
      {/* Background DotField */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <DotField
          dotRadius={1.5}
          dotSpacing={14}
          bulgeStrength={32}
          glowRadius={140}
          sparkle={false}
          waveAmplitude={0}
          cursorRadius={400}
          cursorForce={0.1}
          bulgeOnly
          gradientFrom="#9B2242"
          gradientTo="#8A1E3A"
          glowColor="rgba(245, 227, 210, 0.4)"
        />
      </div>

      <div className="relative z-10 w-full max-w-xl border border-border-soft bg-white shadow-[0_20px_40px_rgba(0,0,0,0.06)] text-ink rounded-xl p-8 sm:p-10">
        <div className="text-center pb-6 pt-2 flex flex-col items-center">
          <div className="w-36 h-20 overflow-hidden relative rounded-xl mb-8 shadow-sm">
            <img 
              src="/img/qq.jpeg" 
              alt="CIRA Logo" 
              className="absolute inset-0 w-full h-full object-contain scale-[1.4]" 
            />
          </div>
          <h2 className="text-3xl font-serif font-bold text-ink leading-tight">Centralized Access Portal</h2>
        </div>
        <div>
          {!isForgotFlow && (
            <div className="flex bg-cream-edge rounded-full p-1 mb-6 border border-border-soft">
              <button 
                type="button"
                onClick={() => { setIsLogin(true); }}
                className={`flex-1 rounded-full py-2.5 text-base transition-all duration-300 ${isLogin ? 'bg-maroon text-white shadow-sm font-bold' : 'text-gray-body hover:text-ink font-medium'}`}
              >
                Sign In
              </button>
              <button 
                type="button"
                onClick={() => { setIsLogin(false); }}
                className={`flex-1 rounded-full py-2.5 text-base transition-all duration-300 ${!isLogin ? 'bg-maroon text-white shadow-sm font-bold' : 'text-gray-body hover:text-ink font-medium'}`}
              >
                Sign Up
              </button>
            </div>
          )}

          {isForgotFlow ? (
            forgotStep === 1 ? (
              <form onSubmit={handleForgotPasswordRequest} className="space-y-5 text-left">
                <h3 className="text-lg font-bold text-ink mb-2">Forgot Password</h3>
                <p className="text-sm text-gray-body mb-4">Enter your college email address. We will send a verification code to your personal email address.</p>
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail" className="text-ink text-sm font-medium ml-1">College Email Address</Label>
                  <Input id="forgotEmail" type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value.toLowerCase())} className="h-11 rounded-xl bg-white border border-border-soft focus-visible:ring-2 focus-visible:ring-maroon text-ink text-base px-4 placeholder:text-gray-body/50" placeholder="user@university.edu" />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold rounded-full mt-6 bg-maroon hover:bg-maroon-deep text-white shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]">
                  {loading ? 'Sending Code...' : 'Send Reset Code'}
                </Button>
                <button type="button" onClick={() => setIsForgotFlow(false)} className="w-full h-12 rounded-full mt-2 text-gray-body hover:text-ink hover:bg-cream transition-colors text-base font-medium">
                  Back to Login
                </button>
              </form>
            ) : (
              <form onSubmit={handlePasswordResetSubmit} className="space-y-5 text-left">
                <h3 className="text-lg font-bold text-ink mb-2">Reset Password</h3>
                <p className="text-sm text-gray-body mb-4">A reset code has been sent to your personal email. Please enter the code and your new password.</p>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgotCode" className="text-ink text-sm font-medium ml-1">Reset Verification Code</Label>
                    <Input id="forgotCode" type="text" required value={forgotCode} onChange={(e) => setForgotCode(e.target.value)} className="h-11 rounded-xl bg-white border border-border-soft focus-visible:ring-2 focus-visible:ring-maroon text-ink text-base px-4 placeholder:text-gray-body/50" placeholder="123456" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newForgotPassword" className="text-ink text-sm font-medium ml-1">New Password</Label>
                    <div className="relative">
                      <Input id="newForgotPassword" type={showForgotNewPassword ? "text" : "password"} required value={newForgotPassword} onChange={(e) => setNewForgotPassword(e.target.value)} className="h-11 rounded-xl bg-white border border-border-soft focus-visible:ring-2 focus-visible:ring-maroon text-ink text-base px-4 pr-10 font-mono tracking-wider placeholder:text-gray-body/50" placeholder="••••••••" />
                      <button type="button" onClick={() => setShowForgotNewPassword(!showForgotNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-body hover:text-ink focus:outline-none">
                        {showForgotNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-body ml-1">8+ chars, 1 uppercase, 1 number.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmForgotPassword" className="text-ink text-sm font-medium ml-1">Confirm New Password</Label>
                    <div className="relative">
                      <Input id="confirmForgotPassword" type={showForgotConfirmPassword ? "text" : "password"} required value={confirmForgotPassword} onChange={(e) => setConfirmForgotPassword(e.target.value)} className="h-11 rounded-xl bg-white border border-border-soft focus-visible:ring-2 focus-visible:ring-maroon text-ink text-base px-4 pr-10 font-mono tracking-wider placeholder:text-gray-body/50" placeholder="••••••••" />
                      <button type="button" onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-body hover:text-ink focus:outline-none">
                        {showForgotConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold rounded-full mt-6 bg-maroon hover:bg-maroon-deep text-white shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]">
                  {loading ? 'Resetting Password...' : 'Reset Password'}
                </Button>
                <button type="button" onClick={() => setForgotStep(1)} className="w-full h-12 rounded-full mt-2 text-gray-body hover:text-ink hover:bg-cream transition-colors text-base font-medium">
                  Request New Code
                </button>
              </form>
            )
          ) : isOnboarding ? (
            <form onSubmit={handleOnboardingSubmit} className="space-y-4 text-left">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-ink">Complete Account Profile</h3>
                <p className="text-xs text-gray-body mt-1">Google Auth Personal Email: <span className="font-semibold text-maroon">{personalEmail}</span></p>
              </div>

              <div className="flex justify-center mb-4">
                <div className="flex bg-cream-edge rounded-full p-1 border border-border-soft w-full max-w-[280px]">
                  <button 
                    type="button"
                    onClick={() => setRole('STUDENT')}
                    className={`flex-1 rounded-full py-1.5 text-xs transition-all duration-300 ${role === 'STUDENT' ? 'bg-maroon text-white shadow-sm font-bold' : 'text-gray-body hover:text-ink font-medium'}`}
                  >
                    Student
                  </button>
                  <button 
                    type="button"
                    onClick={() => setRole('FACULTY')}
                    className={`flex-1 rounded-full py-1.5 text-xs transition-all duration-300 ${role === 'FACULTY' ? 'bg-maroon text-white shadow-sm font-bold' : 'text-gray-body hover:text-ink font-medium'}`}
                  >
                    Faculty
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="onboardingName" className="text-ink text-sm font-medium ml-1">Full Name</Label>
                  <Input id="onboardingName" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl bg-white border border-border-soft text-ink text-base px-4" placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onboardingPhone" className="text-ink text-sm font-medium ml-1">Phone Number</Label>
                  <Input id="onboardingPhone" type="tel" required value={phone} onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('+91')) { setPhone(val); } else { setPhone('+91 ' + val.replace(/^\+?9?1?\s*/, '')); }
                  }} className="h-11 rounded-xl bg-white border border-border-soft text-ink text-base px-4" placeholder="+91 9876543210" />
                </div>
                
                {role === 'STUDENT' ? (
                  <div className="space-y-2">
                    <Label htmlFor="onboardingRoll" className="text-ink text-sm font-medium ml-1">Roll Number</Label>
                    <Input id="onboardingRoll" type="text" required value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className="h-11 rounded-xl bg-white border border-border-soft text-ink text-base px-4" placeholder="CH.EN.U4..." />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="onboardingEmpId" className="text-ink text-sm font-medium ml-1">Employee ID</Label>
                    <Input id="onboardingEmpId" type="text" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-11 rounded-xl bg-white border border-border-soft text-ink text-base px-4" placeholder="FAC123" />
                  </div>
                )}

                {role === 'STUDENT' ? (
                  <div className="space-y-2">
                    <Label className="text-ink text-sm font-medium ml-1">Department</Label>
                    <Select value={departmentId} onValueChange={(val) => { setDepartmentId(val || ''); setSectionId(''); }} required>
                      <SelectTrigger className="h-11 rounded-xl bg-white border border-border-soft text-ink px-4">
                        <SelectValue placeholder="Select Department">
                          {departmentId ? departments.find(d => d.id === departmentId)?.name : "Select Department"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-border-soft text-ink rounded-xl shadow-xl">
                        {departments.map(d => <SelectItem key={d.id} value={d.id} className="py-2.5 focus:bg-maroon focus:text-white cursor-pointer">{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-ink text-sm font-medium ml-1">Subject</Label>
                    <Select value={subject} onValueChange={(val) => setSubject(val || '')} required>
                      <SelectTrigger className="h-11 rounded-xl bg-white border border-border-soft text-ink px-4">
                        <SelectValue placeholder="Select Subject">
                          {subject ? subject.charAt(0).toUpperCase() + subject.slice(1) : "Select Subject"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-border-soft text-ink rounded-xl shadow-xl">
                        <SelectItem value="softskills" className="py-2.5 focus:bg-maroon focus:text-white cursor-pointer">Softskills</SelectItem>
                        <SelectItem value="verbal" className="py-2.5 focus:bg-maroon focus:text-white cursor-pointer">Verbal</SelectItem>
                        <SelectItem value="aptitude" className="py-2.5 focus:bg-maroon focus:text-white cursor-pointer">Aptitude</SelectItem>
                        <SelectItem value="trainee" className="py-2.5 focus:bg-maroon focus:text-white cursor-pointer">Trainee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {role === 'STUDENT' && (
                  <div className="space-y-2">
                    <Label className="text-ink text-sm font-medium ml-1">Section</Label>
                    <Select value={sectionId} onValueChange={(val) => setSectionId(val || '')} disabled={!departmentId} required>
                      <SelectTrigger className="h-11 rounded-xl bg-white border border-border-soft text-ink px-4 disabled:opacity-50">
                        <SelectValue placeholder="Select Section">
                          {sectionId ? selectedDepartment?.sections.find((s: Section) => s.id === sectionId)?.name : "Select Section"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-border-soft text-ink rounded-xl shadow-xl">
                        {selectedDepartment?.sections.map((s: Section) => <SelectItem key={s.id} value={s.id} className="py-2.5 focus:bg-maroon focus:text-white cursor-pointer">{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="onboardingCollegeEmail" className="text-ink text-sm font-medium ml-1">College Email Address (For Verification Code)</Label>
                <Input id="onboardingCollegeEmail" type="email" required value={email} onChange={(e) => setEmail(e.target.value.toLowerCase())} className="h-11 rounded-xl bg-white border border-border-soft text-ink text-base px-4" placeholder={role === 'STUDENT' ? "user@ch.students.amrita.edu" : "user@ch.amrita.edu"} />
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold rounded-full mt-6 bg-maroon hover:bg-maroon-deep text-white shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]">
                {loading ? 'Submitting Details...' : 'Complete Registration'}
              </Button>
              <button type="button" onClick={() => setIsOnboarding(false)} className="w-full h-12 rounded-full mt-2 text-gray-body hover:text-ink hover:bg-cream transition-colors text-base font-medium">
                Cancel
              </button>
            </form>
          ) : isVerifying ? (
            <form onSubmit={handleVerifySubmit} className="space-y-5 text-left">
              <div className="space-y-2">
                <Label htmlFor="verificationCode" className="text-ink text-sm font-medium ml-1">Verification Code</Label>
                <Input id="verificationCode" type="text" required value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="h-11 rounded-xl bg-white border border-border-soft focus-visible:ring-2 focus-visible:ring-maroon text-ink text-base px-4 placeholder:text-gray-body/50" placeholder="123456" />
                <p className="text-sm text-gray-body ml-1">Sent to your College Email ({email}). <span className="text-gray-body/75 italic">Check spam if not found.</span></p>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold rounded-full mt-6 bg-maroon hover:bg-maroon-deep text-white shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]">
                {loading ? 'Verifying...' : 'Verify Email'}
              </Button>
              <button type="button" onClick={() => setIsVerifying(false)} className="w-full h-12 rounded-full mt-2 text-gray-body hover:text-ink hover:bg-cream transition-colors text-base font-medium">
                Cancel
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-left">


            {!isLogin && (

              <div className="flex justify-center mb-6">
                <div className="flex bg-cream-edge rounded-full p-1 border border-border-soft w-full max-w-[280px]">
                  <button 
                    type="button"
                    onClick={() => setRole('STUDENT')}
                    className={`flex-1 rounded-full py-2 text-sm transition-all duration-300 ${role === 'STUDENT' ? 'bg-maroon text-white shadow-sm font-bold' : 'text-gray-body hover:text-ink font-medium'}`}
                  >
                    Student
                  </button>
                  <button 
                    type="button"
                    onClick={() => setRole('FACULTY')}
                    className={`flex-1 rounded-full py-2 text-sm transition-all duration-300 ${role === 'FACULTY' ? 'bg-maroon text-white shadow-sm font-bold' : 'text-gray-body hover:text-ink font-medium'}`}
                  >
                    Faculty
                  </button>
                </div>
              </div>
            )}

            {!isLogin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-ink text-sm font-medium ml-1">Full Name</Label>
                  <Input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl bg-white border border-border-soft focus-visible:ring-2 focus-visible:ring-maroon text-ink text-base px-4 placeholder:text-gray-body/50" placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-ink text-sm font-medium ml-1">Phone Number</Label>
                  <Input id="phone" type="tel" required value={phone} onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('+91')) {
                      setPhone(val);
                    } else {
                      setPhone('+91 ' + val.replace(/^\+?9?1?\s*/, ''));
                    }
                  }} className="h-11 rounded-xl bg-white border border-border-soft focus-visible:ring-2 focus-visible:ring-maroon text-ink text-base px-4 placeholder:text-gray-body/50" placeholder="+91 9876543210" />
                </div>
                
                {role === 'STUDENT' ? (
                  <div className="space-y-2">
                    <Label htmlFor="rollNumber" className="text-ink text-sm font-medium ml-1">Roll Number</Label>
                    <Input id="rollNumber" type="text" required value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className="h-11 rounded-xl bg-white border border-border-soft focus-visible:ring-2 focus-visible:ring-maroon text-ink text-base px-4 placeholder:text-gray-body/50" placeholder="CH.EN.U4..." />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="employeeId" className="text-ink text-sm font-medium ml-1">Employee ID</Label>
                    <Input id="employeeId" type="text" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-11 rounded-xl bg-white border border-border-soft focus-visible:ring-2 focus-visible:ring-maroon text-ink text-base px-4 placeholder:text-gray-body/50" placeholder="FAC123" />
                  </div>
                )}

                {role === 'STUDENT' ? (
                  <div className="space-y-2">
                    <Label className="text-ink text-sm font-medium ml-1">Department</Label>
                    <Select value={departmentId} onValueChange={(val) => { setDepartmentId(val || ''); setSectionId(''); }} required>
                      <SelectTrigger className="h-11 rounded-xl bg-white border border-border-soft focus:ring-maroon text-ink px-4">
                        <SelectValue placeholder="Select Department">
                          {departmentId ? departments.find(d => d.id === departmentId)?.name : "Select Department"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-border-soft text-ink rounded-xl shadow-xl">
                        {departments.map(d => <SelectItem key={d.id} value={d.id} className="py-2.5 focus:bg-maroon focus:text-white cursor-pointer">{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-ink text-sm font-medium ml-1">Subject</Label>
                    <Select value={subject} onValueChange={(val) => setSubject(val || '')} required>
                      <SelectTrigger className="h-11 rounded-xl bg-white border border-border-soft focus:ring-maroon text-ink px-4">
                        <SelectValue placeholder="Select Subject">
                          {subject ? subject.charAt(0).toUpperCase() + subject.slice(1) : "Select Subject"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-border-soft text-ink rounded-xl shadow-xl">
                        <SelectItem value="softskills" className="py-2.5 focus:bg-maroon focus:text-white cursor-pointer">Softskills</SelectItem>
                        <SelectItem value="verbal" className="py-2.5 focus:bg-maroon focus:text-white cursor-pointer">Verbal</SelectItem>
                        <SelectItem value="aptitude" className="py-2.5 focus:bg-maroon focus:text-white cursor-pointer">Aptitude</SelectItem>
                        <SelectItem value="trainee" className="py-2.5 focus:bg-maroon focus:text-white cursor-pointer">Trainee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {role === 'STUDENT' && (
                  <div className="space-y-2">
                    <Label className="text-ink text-sm font-medium ml-1">Section</Label>
                    <Select value={sectionId} onValueChange={(val) => setSectionId(val || '')} disabled={!departmentId} required>
                      <SelectTrigger className="h-11 rounded-xl bg-white border border-border-soft focus:ring-maroon text-ink px-4 disabled:opacity-50">
                        <SelectValue placeholder="Select Section">
                          {sectionId ? selectedDepartment?.sections.find((s: Section) => s.id === sectionId)?.name : "Select Section"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-border-soft text-ink rounded-xl shadow-xl">
                        {selectedDepartment?.sections.map((s: Section) => <SelectItem key={s.id} value={s.id} className="py-2.5 focus:bg-maroon focus:text-white cursor-pointer">{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-ink text-sm font-medium ml-1">College Email Address</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value.toLowerCase())} className="h-11 rounded-xl bg-white border border-border-soft focus-visible:ring-2 focus-visible:ring-maroon text-ink text-base px-4 placeholder:text-gray-body/50" placeholder="user@university.edu" />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="personalEmail" className="text-ink text-sm font-medium ml-1">Personal Email (Gmail)</Label>
                <Input id="personalEmail" type="email" required value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value.toLowerCase())} className="h-11 rounded-xl bg-white border border-border-soft focus-visible:ring-2 focus-visible:ring-maroon text-ink text-base px-4 placeholder:text-gray-body/50" placeholder="you@gmail.com" />
              </div>
            )}

            <div className={!isLogin ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-2"}>
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <Label htmlFor="password" className="text-ink text-sm font-medium">Password</Label>
                  {isLogin && (
                    <button 
                      type="button" 
                      onClick={() => { setIsForgotFlow(true); setForgotStep(1); }} 
                      className="text-xs text-maroon hover:text-maroon-deep transition-colors hover:underline font-semibold"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl bg-white border border-border-soft focus-visible:ring-2 focus-visible:ring-maroon text-ink text-base px-4 pr-10 font-mono tracking-wider placeholder:text-gray-body/50" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-body hover:text-ink focus:outline-none">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {!isLogin && <p className="text-xs text-gray-body ml-1">8+ chars, 1 uppercase, 1 number.</p>}
              </div>
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-ink text-sm font-medium ml-1">Confirm Password</Label>
                  <div className="relative">
                    <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11 rounded-xl bg-white border border-border-soft focus-visible:ring-2 focus-visible:ring-maroon text-ink text-base px-4 pr-10 font-mono tracking-wider placeholder:text-gray-body/50" placeholder="••••••••" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-body hover:text-ink focus:outline-none">
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold rounded-full mt-6 bg-maroon hover:bg-maroon-deep text-white shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]">
              {loading ? 'Processing...' : (isLogin ? 'Secure Login' : 'Create Account')}
            </Button>

            <div className="pt-2">
              <div className="relative flex items-center justify-center my-4">
                <div className="border-t border-border-soft w-full"></div>
                <span className="bg-white px-3 text-xs text-gray-body font-medium uppercase tracking-wider relative">Or continue with</span>
              </div>

              <Button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                variant="outline"
                className="w-full h-12 rounded-full border border-border-soft bg-white hover:bg-cream/40 text-ink font-semibold flex items-center justify-center gap-3 transition-all hover:shadow-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Sign in with Google</span>
              </Button>
            </div>
          </form>

          )}

          <div className="mt-6 text-center">
            <a href="/" className="inline-block text-gray-body hover:text-maroon text-sm font-medium transition-colors hover:underline underline-offset-4 font-sans">Return to Gateway</a>
          </div>
        </div>
      </div>
    </div>
  );
}

