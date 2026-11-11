import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { apiClient } from '../lib/apiClient';
import { getFacultyEmailError, normalizeFacultyEmail } from '../lib/facultyEmail';
import DotField from '../components/ui/DotField';

interface Batch {
  id: string;
  name: string;
  startYear: number;
}

interface Department {
  id: string;
  name: string;
  batchId: string;
  sections: Section[];
}

interface Section {
  id: string;
  name: string;
  departmentId: string;
}

export default function Login() {
  const navigate = useNavigate();

  const STUDENT_EMAIL_REGEX = /^ch\.(sc|en)\.u4[a-zA-Z]{2,6}\d{5}@ch\.students\.amrita\.edu$/i;
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'STUDENT' | 'FACULTY'>('STUDENT');
  const [rememberMe, setRememberMe] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const facultyEmailError = !isLogin && role === 'FACULTY' && email.trim()
    ? getFacultyEmailError(email)
    : null;
  const [personalEmail, setPersonalEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('+91 ');

  // Onboarding & Verification states
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Student specific
  const [rollNumber, setRollNumber] = useState('');
  const [batchId, setBatchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [sectionId, setSectionId] = useState('');

  // Faculty specific
  const [employeeId, setEmployeeId] = useState('');
  const [subject, setSubject] = useState('');

  const [batches, setBatches] = useState<Batch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  // Forgot password states
  const [isForgotFlow, setIsForgotFlow] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [newForgotPassword, setNewForgotPassword] = useState('');
  const [confirmForgotPassword, setConfirmForgotPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    const fetchBatches = async () => {
      try {
        const res = await apiClient.fetch('/api/v1/batches');
        const data = await res.json();
        if (data?.data?.batches) {
          setBatches(data.data.batches);
        }
      } catch (err) {
        console.error("Failed to fetch batches", err);
      }
    };
    fetchBatches();
  }, []);

  useEffect(() => {
    if (!batchId) {
      setDepartments([]);
      return;
    }
    const fetchDepartments = async () => {
      try {
        const res = await apiClient.fetch(`/api/v1/departments?batchId=${batchId}`);
        const data = await res.json();
        if (data?.data?.departments) {
          setDepartments(data.data.departments);
        }
      } catch (err) {
        console.error("Failed to fetch departments", err);
      }
    };
    fetchDepartments();
  }, [batchId]);

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return "Password must be at least 8 characters long.";
    if (!/[A-Z]/.test(pass)) return "Password must contain an uppercase letter.";
    if (!/[0-9]/.test(pass)) return "Password must contain a number.";
    return null;
  };

  const selectedDepartment = departments.find(d => d.id === departmentId);

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error("Please enter your college email address.");
      return;
    }
    setLoading(true);

    try {
      const response = await apiClient.fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.toLowerCase() }),
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
      const response = await apiClient.fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.toLowerCase(),
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

<<<<<<< HEAD
=======
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const token = await user.getIdToken();
      setFirebaseIdToken(token);

      const googlePersonalEmail = (user.email || '').toLowerCase();
      setPersonalEmail(googlePersonalEmail);

      const response = await apiClient.fetch('/api/v1/auth/firebase-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Google Sign-In failed.');
      }

      if (data.status === 'NEEDS_ONBOARDING') {
        toast.info("Google authentication successful! Please enter your details and verify your College ID.");
        if (data.data.name) setName(data.data.name);
        setIsOnboarding(true);
        return;
      }

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

    if (role === 'FACULTY' && getFacultyEmailError(email)) {
      toast.error(getFacultyEmailError(email) || 'Use a valid faculty email ending in @ch.amrita.edu.');
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
      const payload: any = {
        idToken: firebaseIdToken,
        role,
        name,
        email: role === 'FACULTY' ? normalizeFacultyEmail(email) : email.toLowerCase().trim(),
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

      const response = await apiClient.fetch('/api/v1/auth/firebase-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed.');
      }

      toast.success(data.message || 'Registration successful. A verification code was sent to your college email for College ID verification.');
      setIsOnboarding(false);
      setIsVerifying(true);
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

>>>>>>> 1337b9372f667fbde4b97e71d0076bd2c2a291b9
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!isLogin && role === 'FACULTY' && getFacultyEmailError(email)) {
      toast.error(getFacultyEmailError(email) || 'Use a valid faculty email ending in @ch.amrita.edu.');
      setLoading(false);
      return;
    }
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

      if (role === 'STUDENT' && !STUDENT_EMAIL_REGEX.test(email)) {
        toast.error("Student email must follow the format ch.(sc|en).u4<dept><5digits>@ch.students.amrita.edu (e.g. ch.sc.u4cse24118@ch.students.amrita.edu)");
        setLoading(false);
        return;
      }

      if (role === 'FACULTY' && !email.toLowerCase().endsWith('@amrita.edu')) {
        toast.error("Faculty email must end with @amrita.edu");
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
      const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
      
      const payload: any = isLogin ? { email, password } : { 
        email: !isLogin && role === 'FACULTY' ? normalizeFacultyEmail(email) : email.trim(), personalEmail, password, name, phone, role
      };

      if (!isLogin && role === 'STUDENT') {
        payload.departmentId = departmentId;
        payload.rollNumber = rollNumber;
        payload.sectionId = sectionId;
      } else if (!isLogin && role === 'FACULTY') {
        payload.employeeId = employeeId;
        payload.subject = subject;
      }

      const response = await apiClient.fetch(endpoint, {
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
      const response = await apiClient.fetch('/api/v1/auth/verify-email', {
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
    <div className="w-full min-h-screen flex flex-col lg:flex-row font-sans text-ink bg-white selection:bg-maroon/20 overflow-x-hidden">
      
      {/* LEFT COLUMN - 60% Width Panel with Original #FAF5EE Cream Color & DotField (Desktop Only) */}
      <div 
        className="login-hero hidden lg:flex relative lg:w-[55%] xl:w-[60%] h-screen sticky top-0 flex-col justify-between p-10 xl:p-14 overflow-hidden border-r border-border-soft"
        style={{ background: 'radial-gradient(circle, #FAF5EE 0%, #EFE5D8 100%)' }}
      >
        
        {/* Interactive DotField Canvas Background (Landing Page Theme) */}
        <div className="absolute inset-0 z-0 opacity-45 pointer-events-auto">
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

        {/* Top Logo / Brand (Favicon maroon C image icon & CIRA text) */}
        <div className="relative z-10 flex items-center gap-3">
          <img 
            src="/img/favicon.ico" 
            alt="CIRA Logo" 
            className="w-9 h-9 rounded-md object-contain shadow-sm" 
          />
          <span className="text-ink font-bold tracking-tight text-xl font-sans">CIRA</span>
        </div>

        {/* Bottom Text Overlay - CIRA Platform Details */}
        <div className="relative z-10 max-w-xl space-y-4 mb-4">
          <p className="text-maroon font-semibold tracking-wider uppercase text-xs">WELCOME TO</p>
          <h1 className="text-4xl xl:text-5xl font-extrabold text-ink tracking-tight leading-tight">
            CIRA Platform
          </h1>
          <p className="text-gray-body text-base leading-relaxed font-normal max-w-lg">
            Centralized Industry Readiness Accelerator. Empowering proctored assessments, skill evaluations, and academic growth across Amrita Vishwa Vidyapeetham.
          </p>
        </div>

        {/* Bottom footer credit */}
        <div className="relative z-10 text-xs text-gray-body/70 font-medium">
          © {new Date().getFullYear()} CIRA - Amrita Vishwa Vidyapeetham. All rights reserved.
        </div>
      </div>


      {/* RIGHT COLUMN - Authentication Form (Mobile & Desktop) */}
      <div className="w-full lg:w-[45%] xl:w-[40%] min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 overflow-y-auto bg-white border-l border-border-soft">
        
        {/* Mobile Header View */}
        <div className="lg:hidden flex items-center justify-between pb-4 mb-4 border-b border-border-soft/60">
          <div className="flex items-center gap-3">
            <img 
              src="/img/favicon.ico" 
              alt="CIRA Logo" 
              className="w-9 h-9 rounded-lg object-contain shadow-xs" 
            />
            <div>
              <span className="text-ink font-bold text-xl tracking-tight leading-none block">CIRA</span>
              <span className="text-[10px] text-gray-body font-semibold tracking-wider uppercase mt-0.5 block">Amrita CIRA Platform</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-maroon/10 text-maroon font-semibold text-xs px-3 py-1.5 rounded-full border border-maroon/15">
            <span className="w-1.5 h-1.5 rounded-full bg-maroon animate-pulse" />
            {isLogin ? 'Log In' : 'Sign Up'}
          </div>
        </div>

        <div className="w-full max-w-md mx-auto my-auto space-y-6 py-2">
          
          {/* Main Title & Header */}
          {!isForgotFlow && !isVerifying && (
            <div className="space-y-4">
              {/* Segmented Control Bar for instant switching */}
              <div className="grid grid-cols-2 p-1.5 bg-[#FAF5EE] rounded-xl border border-border-soft">
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all duration-200 ${
                    isLogin 
                      ? 'bg-maroon text-white shadow-sm' 
                      : 'text-gray-body hover:text-ink'
                  }`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all duration-200 ${
                    !isLogin 
                      ? 'bg-maroon text-white shadow-sm' 
                      : 'text-gray-body hover:text-ink'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <div className="space-y-1 pt-1">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
                  {isLogin ? 'Welcome back!' : 'Create your account'}
                </h2>
                <p className="text-xs sm:text-sm text-gray-body font-medium">
                  {isLogin ? 'Login to your account to continue' : 'Join CIRA Community across Amrita'}
                </p>
              </div>
            </div>
          )}

          {/* FORGOT PASSWORD FLOW */}
          {isForgotFlow ? (
            forgotStep === 1 ? (
              <form onSubmit={handleForgotPasswordRequest} className="space-y-5">
                <div className="space-y-2">
                  <h2 className="text-2xl font-extrabold text-ink">Forgot Password</h2>
                  <p className="text-xs text-gray-body leading-relaxed">
                    Enter your college email address. A reset code will be sent to your personal email address.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="forgotEmail" className="text-xs font-semibold text-ink uppercase tracking-wider">
                    College Email Address
                  </Label>
                  <Input 
                    id="forgotEmail" 
                    type="email" 
                    required 
                    value={forgotEmail} 
                    onChange={(e) => setForgotEmail(e.target.value.toLowerCase())} 
                    className="h-11 rounded-lg bg-white border border-border-soft focus:border-maroon focus:ring-1 focus:ring-maroon text-ink text-sm px-4" 
                    placeholder="user@ch.students.amrita.edu" 
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full h-11 text-sm font-semibold rounded-lg bg-maroon hover:bg-maroon-deep text-white shadow-sm transition-all"
                >
                  {loading ? 'Sending Reset Code...' : 'Send Reset Code'}
                </Button>

                <button 
                  type="button" 
                  onClick={() => setIsForgotFlow(false)} 
                  className="w-full text-center text-xs font-semibold text-gray-body hover:text-maroon transition-colors py-1"
                >
                  Back to Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-extrabold text-ink">Reset Password</h2>
                  <p className="text-xs text-gray-body">
                    Enter the 6-digit code sent to your personal email and choose a new password.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="forgotCode" className="text-xs font-semibold text-ink">Reset Code</Label>
                    <Input id="forgotCode" type="text" required value={forgotCode} onChange={(e) => setForgotCode(e.target.value)} className="h-10 rounded-lg bg-white border border-border-soft text-ink px-3" placeholder="123456" />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="newForgotPassword" className="text-xs font-semibold text-ink">New Password</Label>
                    <div className="relative">
                      <Input id="newForgotPassword" type={showForgotNewPassword ? "text" : "password"} required value={newForgotPassword} onChange={(e) => setNewForgotPassword(e.target.value)} className="h-10 rounded-lg bg-white border border-border-soft text-ink px-3 pr-9" placeholder="••••••••" />
                      <button type="button" onClick={() => setShowForgotNewPassword(!showForgotNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-body hover:text-ink">
                        {showForgotNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="confirmForgotPassword" className="text-xs font-semibold text-ink">Confirm Password</Label>
                    <div className="relative">
                      <Input id="confirmForgotPassword" type={showForgotConfirmPassword ? "text" : "password"} required value={confirmForgotPassword} onChange={(e) => setConfirmForgotPassword(e.target.value)} className="h-10 rounded-lg bg-white border border-border-soft text-ink px-3 pr-9" placeholder="••••••••" />
                      <button type="button" onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-body hover:text-ink">
                        {showForgotConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full h-11 text-sm font-semibold rounded-lg bg-maroon hover:bg-maroon-deep text-white shadow-sm transition-all mt-2">
                  {loading ? 'Resetting Password...' : 'Reset Password'}
                </Button>
              </form>
            )
<<<<<<< HEAD
=======
          ) : isOnboarding ? (
            /* GOOGLE LOGIN ONBOARDING FORM */
            <form onSubmit={handleOnboardingSubmit} className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-ink">College ID & Profile Setup</h2>
                <p className="text-xs text-gray-body">
                  Google Email: <span className="font-bold text-maroon">{personalEmail}</span>. Enter college details for College ID verification.
                </p>
              </div>

              <div className="flex bg-cream-edge p-1 rounded-lg">
                <button type="button" onClick={() => setRole('STUDENT')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${role === 'STUDENT' ? 'bg-maroon text-white shadow-sm' : 'text-gray-body'}`}>Student</button>
                <button type="button" onClick={() => setRole('FACULTY')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${role === 'FACULTY' ? 'bg-maroon text-white shadow-sm' : 'text-gray-body'}`}>Faculty</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="onboardingName" className="text-xs font-semibold text-ink">Full Name</Label>
                  <Input id="onboardingName" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3" placeholder="John Doe" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="onboardingPhone" className="text-xs font-semibold text-ink">Phone</Label>
                  <Input id="onboardingPhone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3" placeholder="+91 9876543210" />
                </div>
                {role === 'STUDENT' ? (
                  <div className="space-y-1">
                    <Label htmlFor="onboardingRoll" className="text-xs font-semibold text-ink">Roll Number (College ID)</Label>
                    <Input id="onboardingRoll" type="text" required value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3" placeholder="CH.EN.U4..." />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label htmlFor="onboardingEmp" className="text-xs font-semibold text-ink">Employee ID</Label>
                    <Input id="onboardingEmp" type="text" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3" placeholder="FAC123" />
                  </div>
                )}
                {role === 'STUDENT' ? (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-ink">Batch</Label>
                      <Select value={batchId} onValueChange={(val) => { setBatchId(val || ''); setDepartmentId(''); setSectionId(''); }} items={batches.map(b => ({ label: b.name, value: b.id }))}>
                        <SelectTrigger className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3">
                          <SelectValue placeholder="Batch">
                            {(val) => batches.find(b => b.id === val)?.name || val}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-border-soft">{batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-ink">Department</Label>
                      <Select value={departmentId} disabled={!batchId} onValueChange={(val) => { setDepartmentId(val || ''); setSectionId(''); }} items={departments.map(d => ({ label: d.name, value: d.id }))}>
                        <SelectTrigger className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3">
                          <SelectValue placeholder="Department">
                            {(val) => departments.find(d => d.id === val)?.name || val}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-border-soft">{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-ink">Subject</Label>
                    <Select value={subject} onValueChange={(val) => setSubject(val || '')} items={[
                      { label: 'Softskills', value: 'softskills' },
                      { label: 'Verbal', value: 'verbal' },
                      { label: 'Aptitude', value: 'aptitude' },
                      { label: 'Trainee', value: 'trainee' },
                    ]}>
                      <SelectTrigger className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3">
                        <SelectValue placeholder="Subject">
                          {(val) => ({ softskills: 'Softskills', verbal: 'Verbal', aptitude: 'Aptitude', trainee: 'Trainee' }[val as string] || val)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-border-soft">
                        <SelectItem value="softskills">Softskills</SelectItem>
                        <SelectItem value="verbal">Verbal</SelectItem>
                        <SelectItem value="aptitude">Aptitude</SelectItem>
                        <SelectItem value="trainee">Trainee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {role === 'STUDENT' && (
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold text-ink">Section</Label>
                    <Select value={sectionId} onValueChange={(val) => setSectionId(val || '')} disabled={!departmentId} items={selectedDepartment?.sections.map(s => ({ label: s.name, value: s.id })) || []}>
                      <SelectTrigger className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3">
                        <SelectValue placeholder="Section">
                          {(val) => selectedDepartment?.sections.find(s => s.id === val)?.name || val}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-border-soft">{selectedDepartment?.sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="onboardingCollegeEmail" className="text-xs font-semibold text-ink">College Email Address</Label>
                <Input id="onboardingCollegeEmail" type="email" required value={email} onChange={(e) => setEmail(e.target.value.toLowerCase())} aria-invalid={role === 'FACULTY' && Boolean(facultyEmailError)} aria-describedby={role === 'FACULTY' && facultyEmailError ? 'onboarding-faculty-email-error' : undefined} className="h-10 rounded-lg bg-white border border-border-soft text-xs px-3" placeholder={role === 'STUDENT' ? "username@ch.students.amrita.edu" : "username@ch.amrita.edu"} />
                {role === 'FACULTY' && facultyEmailError && <p id="onboarding-faculty-email-error" className="text-xs text-red-700" role="alert">{facultyEmailError}</p>}
              </div>

              <Button type="submit" disabled={loading} className="w-full h-11 text-xs font-semibold rounded-lg bg-maroon hover:bg-maroon-deep text-white shadow-sm transition-all mt-2">
                {loading ? 'Submitting...' : 'Submit & Send College ID Code'}
              </Button>
            </form>
>>>>>>> 1337b9372f667fbde4b97e71d0076bd2c2a291b9
          ) : isVerifying ? (
            /* COLLEGE ID CODE VERIFICATION FORM */
            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <h2 className="text-2xl font-extrabold text-ink">Verify College ID</h2>
                <p className="text-xs text-gray-body leading-relaxed">
                  Enter the 6-digit verification code sent to your college email (<span className="font-semibold text-maroon">{email}</span>).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="verificationCode" className="text-xs font-semibold text-ink uppercase tracking-wider">Verification Code</Label>
                <Input id="verificationCode" type="text" required value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="h-11 rounded-lg bg-white border border-border-soft text-ink text-base tracking-widest text-center" placeholder="123456" />
              </div>

              <Button type="submit" disabled={loading} className="w-full h-11 text-sm font-semibold rounded-lg bg-maroon hover:bg-maroon-deep text-white shadow-sm transition-all">
                {loading ? 'Verifying...' : 'Verify Code & Continue'}
              </Button>
            </form>
          ) : (
            /* MAIN SIGN IN / SIGN UP FORM */
            <form onSubmit={handleSubmit} className="space-y-3.5">
              
              {!isLogin && (
                <div className="flex bg-[#FAF5EE] p-1.5 rounded-xl mb-3 border border-border-soft">
                  <button type="button" onClick={() => setRole('STUDENT')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${role === 'STUDENT' ? 'bg-maroon text-white shadow-sm' : 'text-gray-body hover:text-ink'}`}>Student</button>
                  <button type="button" onClick={() => setRole('FACULTY')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${role === 'FACULTY' ? 'bg-maroon text-white shadow-sm' : 'text-gray-body hover:text-ink'}`}>Faculty</button>
                </div>
              )}

              {!isLogin && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="name" className="text-xs font-medium text-ink">Full Name</Label>
                    <Input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3" placeholder="John Doe" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="phone" className="text-xs font-medium text-ink">Phone</Label>
                    <Input id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3" placeholder="+91 9876543210" />
                  </div>
                  {role === 'STUDENT' ? (
                    <div className="space-y-1">
                      <Label htmlFor="rollNumber" className="text-xs font-medium text-ink">Roll Number (College ID)</Label>
                      <Input id="rollNumber" type="text" required value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3" placeholder="CH.EN.U4..." />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label htmlFor="employeeId" className="text-xs font-medium text-ink">Employee ID</Label>
                      <Input id="employeeId" type="text" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3" placeholder="FAC123" />
                    </div>
                  )}
                  {role === 'STUDENT' ? (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-ink">Batch</Label>
                        <Select value={batchId} onValueChange={(val) => { setBatchId(val || ''); setDepartmentId(''); setSectionId(''); }} items={batches.map(b => ({ label: b.name, value: b.id }))}>
                          <SelectTrigger className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3">
                            <SelectValue placeholder="Batch">
                              {(val) => batches.find(b => b.id === val)?.name || val}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-border-soft">{batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-ink">Department</Label>
                        <Select value={departmentId} disabled={!batchId} onValueChange={(val) => { setDepartmentId(val || ''); setSectionId(''); }} items={departments.map(d => ({ label: d.name, value: d.id }))}>
                          <SelectTrigger className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3">
                            <SelectValue placeholder="Department">
                              {(val) => departments.find(d => d.id === val)?.name || val}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-border-soft">{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-ink">Subject</Label>
                      <Select value={subject} onValueChange={(val) => setSubject(val || '')} items={[
                        { label: 'Softskills', value: 'softskills' },
                        { label: 'Verbal', value: 'verbal' },
                        { label: 'Aptitude', value: 'aptitude' },
                        { label: 'Trainee', value: 'trainee' },
                      ]}>
                        <SelectTrigger className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3">
                          <SelectValue placeholder="Subject">
                            {(val) => ({ softskills: 'Softskills', verbal: 'Verbal', aptitude: 'Aptitude', trainee: 'Trainee' }[val as string] || val)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-border-soft">
                          <SelectItem value="softskills">Softskills</SelectItem>
                          <SelectItem value="verbal">Verbal</SelectItem>
                          <SelectItem value="aptitude">Aptitude</SelectItem>
                          <SelectItem value="trainee">Trainee</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {role === 'STUDENT' && (
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-medium text-ink">Section</Label>
                      <Select value={sectionId} onValueChange={(val) => setSectionId(val || '')} disabled={!departmentId} items={selectedDepartment?.sections.map(s => ({ label: s.name, value: s.id })) || []}>
                        <SelectTrigger className="h-9 rounded-lg bg-white border border-border-soft text-xs px-3">
                          <SelectValue placeholder="Section">
                            {(val) => selectedDepartment?.sections.find(s => s.id === val)?.name || val}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-border-soft">{selectedDepartment?.sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Email Input */}
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-medium text-gray-body">
                  {isLogin ? 'Your username or email' : 'College Email Address'}
                </Label>
                <Input 
                  id="email" 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value.toLowerCase())} 
                  aria-invalid={Boolean(facultyEmailError)}
                  aria-describedby={facultyEmailError ? 'faculty-email-error' : undefined}
                  className="h-11 rounded-lg bg-white border border-border-soft focus:border-maroon focus:ring-1 focus:ring-maroon text-ink text-sm px-3.5 placeholder:text-gray-body/50" 
<<<<<<< HEAD
                  placeholder={isLogin ? "Your username or email" : (role === 'STUDENT' ? "ch.sc.u4cse24118@ch.students.amrita.edu" : "username@amrita.edu")} 
=======
                  placeholder={isLogin ? "Your username or email" : (role === 'STUDENT' ? "username@ch.students.amrita.edu" : "username@ch.amrita.edu")} 
>>>>>>> 1337b9372f667fbde4b97e71d0076bd2c2a291b9
                />
                {facultyEmailError && <p id="faculty-email-error" className="text-xs text-red-700" role="alert">{facultyEmailError}</p>}
              </div>

              {!isLogin && (
                <div className="space-y-1">
                  <Label htmlFor="personalEmail" className="text-xs font-medium text-gray-body">Personal Email (Gmail)</Label>
                  <Input id="personalEmail" type="email" required value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value.toLowerCase())} className="h-10 rounded-lg bg-white border border-border-soft text-ink text-xs px-3.5 placeholder:text-gray-body/50" placeholder="you@gmail.com" />
                </div>
              )}

              {/* Password Input */}
              <div className="space-y-1">
                <Label htmlFor="password" className="text-xs font-medium text-gray-body">
                  {isLogin ? 'Your password' : 'Password'}
                </Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="h-11 rounded-lg bg-white border border-border-soft focus:border-maroon focus:ring-1 focus:ring-maroon text-ink text-sm px-3.5 pr-10 placeholder:text-gray-body/50" 
                    placeholder="Your password" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-body hover:text-ink"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-1">
                  <Label htmlFor="confirmPassword" className="text-xs font-medium text-gray-body">Confirm Password</Label>
                  <div className="relative">
                    <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-10 rounded-lg bg-white border border-border-soft text-ink text-xs px-3.5 pr-10 placeholder:text-gray-body/50" placeholder="Confirm password" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-body hover:text-ink">
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Action Row: Remember me + Forgot password */}
              {isLogin && (
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div 
                      onClick={() => setRememberMe(!rememberMe)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${rememberMe ? 'bg-maroon border-maroon text-white' : 'border-border-soft group-hover:border-gray-body bg-white'}`}
                    >
                      {rememberMe && <Check size={12} strokeWidth={3} />}
                    </div>
                    <span className="text-xs font-medium text-gray-body">Remember me</span>
                  </label>

                  <button 
                    type="button" 
                    onClick={() => { setIsForgotFlow(true); setForgotStep(1); }} 
                    className="text-xs font-semibold text-maroon hover:text-maroon-deep transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Log In Button (Primary CIRA Maroon) */}
              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full h-11 text-sm font-semibold rounded-lg bg-maroon hover:bg-maroon-deep text-white shadow-md transition-all mt-2"
              >
                {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Create Account')}
              </Button>
            </form>
          )}

          {/* Toggle between Sign In and Sign Up */}
          {!isForgotFlow && !isVerifying && (
            <div className="pt-1 text-center">
              <p className="text-xs text-gray-body font-medium">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-maroon hover:text-maroon-deep font-bold hover:underline ml-1"
                >
                  {isLogin ? 'Sign up' : 'Log in'}
                </button>
              </p>
            </div>
          )}

        </div>

        {/* Footer info */}
        <div className="pt-6 border-t border-border-soft/60 text-center space-y-1.5">
          <p className="text-xs text-gray-body/80 font-medium">
            Need help accessing your account? Contact{' '}
            <a href="mailto:support@cira.edu" className="text-maroon font-semibold hover:underline">
              CIRA Support
            </a>
          </p>
          <p className="lg:hidden text-[11px] text-gray-body/60 font-medium">
            © {new Date().getFullYear()} CIRA - Amrita Vishwa Vidyapeetham
          </p>
        </div>

      </div>

    </div>
  );
}
