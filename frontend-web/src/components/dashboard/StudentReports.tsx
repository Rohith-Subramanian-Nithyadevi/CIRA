import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { Search, ChevronRight, User, BookOpen, AlertTriangle, TrendingUp, ArrowLeft } from 'lucide-react';

// --- FAKE DATA SET ---
const mockData = {
  years: ['2023-2024', '2024-2025'],
  departments: [
    { id: 'CS', name: 'Computer Science' },
    { id: 'EC', name: 'Electronics' },
    { id: 'ME', name: 'Mechanical' }
  ],
  sections: ['A', 'B', 'C'],
  quizzes: [
    { id: 'q1', title: 'Aptitude Assessment', date: '2024-02-15' },
    { id: 'q2', title: 'Soft Skills Evaluation', date: '2024-03-10' },
    { id: 'q3', title: 'Verbal Reasoning', date: '2024-04-05' }
  ],
  topics: {
    q1: ['Quantitative', 'Logical Reasoning', 'Data Interpretation'],
    q2: ['Communication', 'Teamwork', 'Problem Solving'],
    q3: ['Grammar', 'Vocabulary', 'Reading Comprehension']
  }
};

// Generate comprehensive student data
const generateStudents = () => {
  const students: any[] = [];
  mockData.departments.forEach(dept => {
    mockData.sections.forEach(sec => {
      for (let i = 1; i <= 15; i++) {
        const roll = `CB.EN.U4${dept.id}230${i.toString().padStart(2, '0')}`;
        students.push({
          id: roll,
          rollNumber: roll,
          name: `Student ${i} (${dept.id}-${sec})`,
          departmentId: dept.id,
          sectionId: sec,
          quizzes: mockData.quizzes.map(q => {
            const isGood = Math.random() > 0.4;
            const score = isGood ? Math.floor(Math.random() * 30 + 70) : Math.floor(Math.random() * 30 + 40);
            
            const topicScores = mockData.topics[q.id as keyof typeof mockData.topics].map((t: string) => ({
              topic: t,
              score: isGood ? Math.floor(Math.random() * 40 + 60) : Math.floor(Math.random() * 50 + 30)
            }));

            return {
              quizId: q.id,
              score,
              band: score >= 80 ? 'Excellent' : score >= 60 ? 'Average' : 'Poor',
              topicScores
            };
          })
        });
      }
    });
  });
  return students;
};

const studentsData = generateStudents();

export const StudentReports = () => {
  const [selectedYear] = useState(mockData.years[1]);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchedStudent, setSearchedStudent] = useState<any | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const student = studentsData.find(s => s.rollNumber.toLowerCase() === searchTerm.toLowerCase());
    if (student) {
      setSearchedStudent(student);
    } else {
      alert("Student not found!");
    }
  };

  // 1. Year Level Data (Aggregated by Subject across all students)
  const yearData = useMemo(() => {
    const poorObj: any = { band: 'Poor' };
    const avgObj: any = { band: 'Average' };
    const excObj: any = { band: 'Excellent' };

    mockData.quizzes.forEach(quiz => {
      let excellent = 0, average = 0, poor = 0;
      studentsData.forEach(s => {
        const qAttempt = s.quizzes.find((sq: any) => sq.quizId === quiz.id);
        if (qAttempt) {
          if (qAttempt.band === 'Excellent') excellent++;
          else if (qAttempt.band === 'Average') average++;
          else poor++;
        }
      });
      poorObj[quiz.title] = poor;
      avgObj[quiz.title] = average;
      excObj[quiz.title] = excellent;
    });

    return [poorObj, avgObj, excObj];
  }, []);

  // 2. Department Level Data (Aggregated across sections)
  const deptData = useMemo(() => {
    if (!selectedDept) return [];
    return mockData.sections.map(sec => {
      const secStudents = studentsData.filter(s => s.departmentId === selectedDept && s.sectionId === sec);
      let excellent = 0, average = 0, poor = 0;
      secStudents.forEach(s => {
        const avgScore = s.quizzes.reduce((acc: number, q: any) => acc + q.score, 0) / s.quizzes.length;
        if (avgScore >= 80) excellent++;
        else if (avgScore >= 60) average++;
        else poor++;
      });
      return { name: `Section ${sec}`, Excellent: excellent, Average: average, Poor: poor };
    });
  }, [selectedDept]);

  // 3. Quiz Level Data
  const quizDetails = useMemo(() => {
    if (!selectedDept || !selectedSection || !selectedQuiz) return null;
    
    const relevantStudents = studentsData.filter(s => s.departmentId === selectedDept && s.sectionId === selectedSection);
    const quizMetadata = mockData.quizzes.find(q => q.id === selectedQuiz);
    
    let excellent = 0, average = 0, poor = 0;
    const leaderboard: any[] = [];
    
    // Calculate Topic Averages
    const topicSums: Record<string, number> = {};
    const topicCounts: Record<string, number> = {};

    relevantStudents.forEach(s => {
      const qAttempt = s.quizzes.find((q: any) => q.quizId === selectedQuiz);
      if (qAttempt) {
        if (qAttempt.band === 'Excellent') excellent++;
        else if (qAttempt.band === 'Average') average++;
        else poor++;

        leaderboard.push({ name: s.name, roll: s.rollNumber, score: qAttempt.score, band: qAttempt.band });

        qAttempt.topicScores.forEach((ts: any) => {
          topicSums[ts.topic] = (topicSums[ts.topic] || 0) + ts.score;
          topicCounts[ts.topic] = (topicCounts[ts.topic] || 0) + 1;
        });
      }
    });

    leaderboard.sort((a, b) => b.score - a.score);

    const pieData = [
      { name: 'Excellent (>80)', value: excellent },
      { name: 'Average (60-80)', value: average },
      { name: 'Poor (<60)', value: poor },
    ];

    const topicAverages = Object.keys(topicSums).map(topic => ({
      topic,
      avg: Math.round(topicSums[topic] / topicCounts[topic])
    }));

    return { pieData, leaderboard, topicAverages, title: quizMetadata?.title };
  }, [selectedDept, selectedSection, selectedQuiz]);


  // RENDER STUDENT PROFILE
  if (searchedStudent) {
    const studentQuizzes = searchedStudent.quizzes.map((q: any) => {
      const qMeta = mockData.quizzes.find(mq => mq.id === q.quizId);
      return { name: qMeta?.title, score: q.score };
    });

    return (
      <div className="text-ink">
        <button 
          onClick={() => { setSearchedStudent(null); setSearchTerm(''); }}
          className="flex items-center text-maroon hover:text-maroon-deep mb-6 transition-colors font-bold text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Analytics
        </button>
        
        <div className="bg-white rounded-xl p-6 border border-border-soft shadow-sm mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-serif font-bold text-ink mb-2">{searchedStudent.name}</h2>
            <p className="text-gray-body text-base">Roll Number: <span className="text-ink font-mono font-bold">{searchedStudent.rollNumber}</span></p>
            <p className="text-gray-body mt-1">Department: {mockData.departments.find(d => d.id === searchedStudent.departmentId)?.name} | Section: {searchedStudent.sectionId}</p>
          </div>
          <div className="h-20 w-20 bg-maroon/10 border border-maroon/20 rounded-full flex items-center justify-center shadow-sm">
            <User className="w-10 h-10 text-maroon" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 border border-border-soft shadow-sm">
            <h3 className="text-lg font-serif font-bold mb-6 flex items-center text-ink"><TrendingUp className="mr-2 text-maroon w-5 h-5"/> Performance Trend</h3>
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={studentQuizzes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9B2242" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#9B2242" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} opacity={0.6} />
                  <XAxis dataKey="name" stroke="var(--gray-body)" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--gray-body)' }} />
                  <YAxis stroke="var(--gray-body)" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--gray-body)' }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid var(--border-soft)', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} itemStyle={{ color: 'var(--ink)', fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="score" stroke="#9B2242" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" activeDot={{r: 6, fill: '#9B2242', stroke: '#fff', strokeWidth: 2}} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-border-soft shadow-sm">
             <h3 className="text-lg font-serif font-bold mb-6 flex items-center text-ink"><BookOpen className="mr-2 text-maroon w-5 h-5"/> Topic Strengths & Weaknesses</h3>
             <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {searchedStudent.quizzes.map((q: any) => (
                  <div key={q.quizId} className="border-b border-border-soft pb-4 last:border-b-0 last:pb-0">
                    <h4 className="font-semibold text-ink mb-2">{mockData.quizzes.find(mq => mq.id === q.quizId)?.title}</h4>
                    {q.topicScores.map((ts: any) => (
                      <div key={ts.topic} className="flex justify-between items-center mb-1 text-sm">
                        <span className="text-gray-body">{ts.topic}</span>
                        <span className={`font-bold ${ts.score >= 80 ? 'text-green-700' : ts.score >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                          {ts.score}%
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    );
  }

  // RENDER HIERARCHICAL DASHBOARD
  return (
    <div className="text-ink">
      {/* Top Bar: Search and Breadcrumbs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-gray-body">
          <span className="cursor-pointer hover:text-maroon transition-colors" onClick={() => { setSelectedDept(null); setSelectedSection(null); setSelectedQuiz(null); }}>
            Year: {selectedYear}
          </span>
          
          {selectedDept && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-gray-body/60" />
              <span className="cursor-pointer hover:text-maroon transition-colors" onClick={() => { setSelectedSection(null); setSelectedQuiz(null); }}>
                {mockData.departments.find(d => d.id === selectedDept)?.name}
              </span>
            </>
          )}

          {selectedSection && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-gray-body/60" />
              <span className="cursor-pointer hover:text-maroon transition-colors" onClick={() => { setSelectedQuiz(null); }}>
                Section {selectedSection}
              </span>
            </>
          )}

          {selectedQuiz && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-gray-body/60" />
              <span className="text-maroon">
                {mockData.quizzes.find(q => q.id === selectedQuiz)?.title}
              </span>
            </>
          )}
        </div>

        <form onSubmit={handleSearch} className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Search Roll No (e.g. CB.EN...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-border-soft rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors text-sm text-ink placeholder:text-gray-body/50"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-body/50" />
        </form>
      </div>

      {/* Level 1: Year Analysis (Choose Dept) */}
      {!selectedDept && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <h2 className="text-xl font-serif font-bold text-ink">Department Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {mockData.departments.map(dept => (
              <div 
                key={dept.id} 
                onClick={() => setSelectedDept(dept.id)}
                className="bg-white border border-border-soft rounded-xl p-6 hover:border-maroon/40 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-sm"
              >
                <h3 className="text-lg font-bold text-ink mb-1">{dept.name}</h3>
                <p className="text-xs text-gray-body mb-4">Click to view section details</p>
                <div className="w-full bg-cream rounded-full h-2 mb-2">
                  <div className="bg-maroon h-2 rounded-full" style={{width: '75%'}}></div>
                </div>
                <p className="text-xs text-right text-maroon font-semibold">75% Avg Readiness</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-border-soft rounded-xl p-6 mt-8 shadow-sm">
            <h3 className="text-lg font-serif font-bold mb-6 text-ink">Subject Performance by Band</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barSize={30}>
                  <defs>
                    <linearGradient id="gradAptitude" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9B2242" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#8A1E3A" stopOpacity={0.85}/>
                    </linearGradient>
                    <linearGradient id="gradSoftSkills" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E8D6B8" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#C8B698" stopOpacity={0.85}/>
                    </linearGradient>
                    <linearGradient id="gradVerbal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F5E3D2" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#E3D1C0" stopOpacity={0.85}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} opacity={0.6} />
                  <XAxis dataKey="band" stroke="var(--gray-body)" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--gray-body)' }} />
                  <YAxis stroke="var(--gray-body)" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--gray-body)' }} />
                  <RechartsTooltip cursor={{ fill: 'var(--cream)', opacity: 0.3 }} contentStyle={{ backgroundColor: '#ffffff', border: '1px solid var(--border-soft)', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} itemStyle={{ fontWeight: 'bold', color: 'var(--ink)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: 12, fill: 'var(--ink)' }} />
                  <Bar dataKey="Aptitude Assessment" fill="url(#gradAptitude)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Soft Skills Evaluation" fill="url(#gradSoftSkills)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Verbal Reasoning" fill="url(#gradVerbal)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Level 2: Dept Analysis (Choose Section) */}
      {selectedDept && !selectedSection && (
        <div className="space-y-6 animate-in fade-in duration-500">
           <h2 className="text-xl font-serif font-bold text-ink">Section Overview</h2>
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
             {mockData.sections.map(sec => (
                <div 
                  key={sec} 
                  onClick={() => setSelectedSection(sec)}
                  className="bg-white border border-border-soft rounded-xl p-5 hover:border-maroon/40 cursor-pointer transition-all flex items-center justify-between shadow-sm"
                >
                  <span className="text-base font-semibold text-ink">Section {sec}</span>
                  <ChevronRight className="w-5 h-5 text-gray-body" />
                </div>
             ))}
           </div>
           
           <div className="bg-white border border-border-soft rounded-xl p-6 mt-8 shadow-sm">
            <h3 className="text-lg font-serif font-bold mb-6 text-ink">Performance by Section</h3>
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barSize={40}>
                  <defs>
                    <linearGradient id="secExcellent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.85}/>
                    </linearGradient>
                    <linearGradient id="secAverage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#D97706" stopOpacity={0.85}/>
                    </linearGradient>
                    <linearGradient id="secPoor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#DC2626" stopOpacity={0.85}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} opacity={0.6} />
                  <XAxis dataKey="name" stroke="var(--gray-body)" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--gray-body)' }} />
                  <YAxis stroke="var(--gray-body)" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--gray-body)' }} />
                  <RechartsTooltip cursor={{ fill: 'var(--cream)', opacity: 0.3 }} contentStyle={{ backgroundColor: '#ffffff', border: '1px solid var(--border-soft)', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} itemStyle={{ fontWeight: 'bold', color: 'var(--ink)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: 12 }} />
                  <Bar dataKey="Excellent" stackId="a" fill="url(#secExcellent)" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="Average" stackId="a" fill="url(#secAverage)" />
                  <Bar dataKey="Poor" stackId="a" fill="url(#secPoor)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Level 3: Section Analysis (Choose Quiz) */}
      {selectedSection && !selectedQuiz && (
        <div className="space-y-6 animate-in fade-in duration-500">
           <h2 className="text-xl font-serif font-bold text-ink mb-6">Recent Assessments (Section {selectedSection})</h2>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {mockData.quizzes.map(quiz => (
                <div 
                  key={quiz.id} 
                  onClick={() => setSelectedQuiz(quiz.id)}
                  className="bg-white border border-border-soft rounded-xl p-6 hover:border-maroon/40 cursor-pointer transition-all shadow-sm group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-maroon/5 rounded-full blur-3xl group-hover:bg-maroon/10 transition-all"></div>
                  <h3 className="text-lg font-bold text-ink mb-1 relative z-10">{quiz.title}</h3>
                  <p className="text-xs text-gray-body mb-4 relative z-10">Conducted on {quiz.date}</p>
                  <div className="flex items-center text-maroon text-xs font-bold relative z-10">
                    View detailed analytics <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
             ))}
           </div>
        </div>
      )}

      {/* Level 4: Quiz Analysis (Detailed view) */}
      {selectedQuiz && quizDetails && (
        <div className="space-y-6 animate-in fade-in duration-500">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score Distribution */}
            <div className="bg-white border border-border-soft rounded-xl p-6 lg:col-span-1 shadow-sm">
              <h3 className="text-base font-bold text-ink mb-4 text-center font-serif">Score Distribution</h3>
              <div className="h-64 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="pieGrad0" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#059669" stopOpacity={1}/>
                      </linearGradient>
                      <linearGradient id="pieGrad1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#D97706" stopOpacity={1}/>
                      </linearGradient>
                      <linearGradient id="pieGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#DC2626" stopOpacity={1}/>
                      </linearGradient>
                    </defs>
                    <Pie
                      data={quizDetails.pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={8}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={6}
                    >
                      {quizDetails.pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#pieGrad${index % 3})`} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid var(--border-soft)', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} itemStyle={{ color: 'var(--ink)', fontWeight: 'bold' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Topic Wise Breakdown */}
            <div className="bg-white border border-border-soft rounded-xl p-6 lg:col-span-2 shadow-sm">
               <h3 className="text-base font-bold text-ink mb-6 font-serif">Topic-wise Class Average</h3>
               <div className="h-64 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quizDetails.topicAverages} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }} barSize={24}>
                    <defs>
                      <linearGradient id="barGood" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#059669" stopOpacity={0.85}/>
                        <stop offset="100%" stopColor="#10B981" stopOpacity={1}/>
                      </linearGradient>
                      <linearGradient id="barAvg" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#D97706" stopOpacity={0.85}/>
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity={1}/>
                      </linearGradient>
                      <linearGradient id="barPoor" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#DC2626" stopOpacity={0.85}/>
                        <stop offset="100%" stopColor="#EF4444" stopOpacity={1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" horizontal={false} opacity={0.6} />
                    <XAxis type="number" domain={[0, 100]} stroke="var(--gray-body)" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--gray-body)' }} />
                    <YAxis dataKey="topic" type="category" stroke="var(--gray-body)" axisLine={false} tickLine={false} tick={{ fill: 'var(--ink)', fontSize: 11 }} />
                    <RechartsTooltip cursor={{fill: 'var(--cream)', opacity: 0.3}} contentStyle={{ backgroundColor: '#ffffff', border: '1px solid var(--border-soft)', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} itemStyle={{ fontWeight: 'bold', color: 'var(--ink)' }} />
                    <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                      {quizDetails.topicAverages.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.avg < 60 ? 'url(#barPoor)' : entry.avg < 75 ? 'url(#barAvg)' : 'url(#barGood)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             {/* Class Leaderboard */}
            <div className="bg-white border border-border-soft rounded-xl p-6 lg:col-span-2 shadow-sm">
              <h3 className="text-base font-bold text-ink mb-4 font-serif">Class Leaderboard</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-ink">
                  <thead className="text-xs text-gray-body uppercase bg-cream-edge/40 border-b border-border-soft">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg font-semibold">Rank</th>
                      <th className="px-4 py-3 font-semibold">Roll Number</th>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-4 py-3 rounded-tr-lg font-semibold">Band</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizDetails.leaderboard.map((student, idx) => (
                      <tr 
                        key={student.roll} 
                        onClick={() => { setSearchTerm(student.roll); setSearchedStudent(studentsData.find(s => s.rollNumber === student.roll)); }}
                        className="border-b border-border-soft hover:bg-cream/40 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-maroon text-xs font-semibold">{student.roll}</td>
                        <td className="px-4 py-3 text-gray-body">{student.name}</td>
                        <td className="px-4 py-3 text-ink font-semibold">{student.score}%</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            student.band === 'Excellent' ? 'bg-green-50/10 text-green-700 border-green-200' :
                            student.band === 'Average' ? 'bg-yellow-50/10 text-yellow-700 border-yellow-200' :
                            'bg-red-50/10 text-red-700 border-red-200'
                          }`}>
                            {student.band}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actionable Insights */}
            <div className="bg-white border border-border-soft rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-ink mb-4 flex items-center font-serif"><AlertTriangle className="w-5 h-5 text-yellow-600 mr-2"/> Actionable Insights</h3>
              <div className="space-y-4">
                {quizDetails.topicAverages.filter(t => t.avg < 65).length > 0 ? (
                  quizDetails.topicAverages.filter(t => t.avg < 65).map(weakTopic => (
                    <div key={weakTopic.topic} className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <h4 className="text-red-700 font-bold text-sm mb-1">Low Performance in {weakTopic.topic}</h4>
                      <p className="text-gray-body text-xs leading-relaxed">Class average is {weakTopic.avg}%. Consider scheduling a remedial session for this topic.</p>
                    </div>
                  ))
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <h4 className="text-green-700 font-bold text-sm mb-1">Excellent Overall Performance</h4>
                    <p className="text-gray-body text-xs leading-relaxed">No critical weak topics identified for this assessment.</p>
                  </div>
                )}
                <button className="w-full mt-4 py-2.5 bg-maroon hover:bg-maroon-deep text-white rounded-full transition-all font-bold text-xs shadow-sm hover:scale-105 active:scale-95">
                  Generate Remedial Assignments
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
