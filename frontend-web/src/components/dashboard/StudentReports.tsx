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

const COLORS = ['#10B981', '#F59E0B', '#EF4444']; // Green, Yellow, Red

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

  // 1. Year Level Data (Aggregated across all departments)
  const yearData = useMemo(() => {
    return mockData.departments.map(d => {
      const deptStudents = studentsData.filter(s => s.departmentId === d.id);
      let excellent = 0, average = 0, poor = 0;
      deptStudents.forEach(s => {
        const avgScore = s.quizzes.reduce((acc: number, q: any) => acc + q.score, 0) / s.quizzes.length;
        if (avgScore >= 80) excellent++;
        else if (avgScore >= 60) average++;
        else poor++;
      });
      return { name: d.name, Excellent: excellent, Average: average, Poor: poor };
    });
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
      <div className="p-6 text-gray-100">
        <button 
          onClick={() => { setSearchedStudent(null); setSearchTerm(''); }}
          className="flex items-center text-blue-400 hover:text-blue-300 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Analytics
        </button>
        
        <div className="bg-gray-800/50 backdrop-blur-md rounded-xl p-6 border border-gray-700 shadow-xl mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">{searchedStudent.name}</h2>
            <p className="text-gray-400 text-lg">Roll Number: <span className="text-gray-200 font-mono">{searchedStudent.rollNumber}</span></p>
            <p className="text-gray-400">Department: {mockData.departments.find(d => d.id === searchedStudent.departmentId)?.name} | Section: {searchedStudent.sectionId}</p>
          </div>
          <div className="h-24 w-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center border-4 border-gray-800 shadow-lg">
            <User className="w-12 h-12 text-white" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 backdrop-blur-md rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-semibold mb-6 flex items-center"><TrendingUp className="mr-2 text-indigo-400"/> Performance Trend</h3>
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={studentQuizzes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818CF8" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#818CF8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.4} />
                  <XAxis dataKey="name" stroke="#9CA3AF" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                  <YAxis stroke="#9CA3AF" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.95)', border: '1px solid #374151', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }} itemStyle={{ color: '#E5E7EB', fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="score" stroke="#818CF8" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" activeDot={{r: 6, fill: '#818CF8', stroke: '#fff', strokeWidth: 2, filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))'}} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-md rounded-xl p-6 border border-gray-700">
             <h3 className="text-xl font-semibold mb-6 flex items-center"><BookOpen className="mr-2 text-green-400"/> Topic Strengths & Weaknesses</h3>
             <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {searchedStudent.quizzes.map((q: any) => (
                  <div key={q.quizId} className="border-b border-gray-700 pb-4">
                    <h4 className="font-medium text-gray-300 mb-2">{mockData.quizzes.find(mq => mq.id === q.quizId)?.title}</h4>
                    {q.topicScores.map((ts: any) => (
                      <div key={ts.topic} className="flex justify-between items-center mb-1 text-sm">
                        <span className="text-gray-400">{ts.topic}</span>
                        <span className={`font-semibold ${ts.score >= 80 ? 'text-green-400' : ts.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
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
    <div className="p-6 text-gray-100 min-h-screen">
      {/* Top Bar: Search and Breadcrumbs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center space-x-2 text-sm font-medium">
          <span className="text-gray-400 cursor-pointer hover:text-white transition-colors" onClick={() => { setSelectedDept(null); setSelectedSection(null); setSelectedQuiz(null); }}>
            Year: {selectedYear}
          </span>
          
          {selectedDept && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <span className="text-gray-400 cursor-pointer hover:text-white transition-colors" onClick={() => { setSelectedSection(null); setSelectedQuiz(null); }}>
                {mockData.departments.find(d => d.id === selectedDept)?.name}
              </span>
            </>
          )}

          {selectedSection && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <span className="text-gray-400 cursor-pointer hover:text-white transition-colors" onClick={() => { setSelectedQuiz(null); }}>
                Section {selectedSection}
              </span>
            </>
          )}

          {selectedQuiz && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <span className="text-indigo-400">
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
            className="w-full bg-gray-800/80 border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
        </form>
      </div>

      {/* Level 1: Year Analysis (Choose Dept) */}
      {!selectedDept && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-bold text-white">Department Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {mockData.departments.map(dept => (
              <div 
                key={dept.id} 
                onClick={() => setSelectedDept(dept.id)}
                className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 hover:bg-gray-750 hover:border-indigo-500/50 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10"
              >
                <h3 className="text-xl font-semibold mb-2">{dept.name}</h3>
                <p className="text-sm text-gray-400 mb-4">Click to view section details</p>
                <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                  <div className="bg-indigo-500 h-2 rounded-full" style={{width: '75%'}}></div>
                </div>
                <p className="text-xs text-right text-indigo-400 font-medium">75% Avg Readiness</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 mt-8">
            <h3 className="text-lg font-semibold mb-6">Readiness Distribution by Department</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barSize={40}>
                  <defs>
                    <linearGradient id="colorExcellent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34D399" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.8}/>
                    </linearGradient>
                    <linearGradient id="colorAverage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FBBF24" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#D97706" stopOpacity={0.8}/>
                    </linearGradient>
                    <linearGradient id="colorPoor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F87171" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#DC2626" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.4} />
                  <XAxis dataKey="name" stroke="#9CA3AF" axisLine={false} tickLine={false} tick={{ fontSize: 13 }} />
                  <YAxis stroke="#9CA3AF" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip cursor={{ fill: '#374151', opacity: 0.2 }} contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.95)', border: '1px solid #4B5563', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }} itemStyle={{ fontWeight: 'bold', color: '#E5E7EB' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="Excellent" stackId="a" fill="url(#colorExcellent)" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="Average" stackId="a" fill="url(#colorAverage)" />
                  <Bar dataKey="Poor" stackId="a" fill="url(#colorPoor)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Level 2: Dept Analysis (Choose Section) */}
      {selectedDept && !selectedSection && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <h2 className="text-2xl font-bold text-white">Section Overview</h2>
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
             {mockData.sections.map(sec => (
                <div 
                  key={sec} 
                  onClick={() => setSelectedSection(sec)}
                  className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5 hover:border-blue-500/50 cursor-pointer transition-all hover:bg-gray-750 flex items-center justify-between"
                >
                  <span className="text-lg font-medium text-gray-200">Section {sec}</span>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
             ))}
           </div>
           
           <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 mt-8">
            <h3 className="text-lg font-semibold mb-6">Performance by Section</h3>
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barSize={40}>
                  <defs>
                    <linearGradient id="secExcellent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34D399" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.8}/>
                    </linearGradient>
                    <linearGradient id="secAverage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FBBF24" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#D97706" stopOpacity={0.8}/>
                    </linearGradient>
                    <linearGradient id="secPoor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F87171" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#DC2626" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.4} />
                  <XAxis dataKey="name" stroke="#9CA3AF" axisLine={false} tickLine={false} tick={{ fontSize: 13 }} />
                  <YAxis stroke="#9CA3AF" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip cursor={{ fill: '#374151', opacity: 0.2 }} contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.95)', border: '1px solid #4B5563', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }} itemStyle={{ fontWeight: 'bold', color: '#E5E7EB' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <h2 className="text-2xl font-bold text-white mb-6">Recent Assessments (Section {selectedSection})</h2>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {mockData.quizzes.map(quiz => (
                <div 
                  key={quiz.id} 
                  onClick={() => setSelectedQuiz(quiz.id)}
                  className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700 rounded-xl p-6 hover:border-indigo-500/50 cursor-pointer transition-all shadow-lg hover:shadow-indigo-500/20 group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
                  <h3 className="text-xl font-bold text-gray-100 mb-2 relative z-10">{quiz.title}</h3>
                  <p className="text-sm text-gray-400 mb-4 relative z-10">Conducted on {quiz.date}</p>
                  <div className="flex items-center text-indigo-400 text-sm font-medium relative z-10">
                    View detailed analytics <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
             ))}
           </div>
        </div>
      )}

      {/* Level 4: Quiz Analysis (Detailed view) */}
      {selectedQuiz && quizDetails && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score Distribution */}
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-6 lg:col-span-1">
              <h3 className="text-lg font-semibold mb-4 text-center">Score Distribution</h3>
              <div className="h-64 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="pieGrad0" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34D399" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#059669" stopOpacity={1}/>
                      </linearGradient>
                      <linearGradient id="pieGrad1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FBBF24" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#D97706" stopOpacity={1}/>
                      </linearGradient>
                      <linearGradient id="pieGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F87171" stopOpacity={1}/>
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
                        <Cell key={`cell-${index}`} fill={`url(#pieGrad${index % 3})`} style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.3))' }} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.95)', border: '1px solid #4B5563', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }} itemStyle={{ color: '#E5E7EB', fontWeight: 'bold' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Topic Wise Breakdown */}
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-6 lg:col-span-2">
               <h3 className="text-lg font-semibold mb-6">Topic-wise Class Average</h3>
               <div className="h-64 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quizDetails.topicAverages} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }} barSize={24}>
                    <defs>
                      <linearGradient id="barGood" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#059669" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#34D399" stopOpacity={1}/>
                      </linearGradient>
                      <linearGradient id="barAvg" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#D97706" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#FBBF24" stopOpacity={1}/>
                      </linearGradient>
                      <linearGradient id="barPoor" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#DC2626" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#F87171" stopOpacity={1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} opacity={0.4} />
                    <XAxis type="number" domain={[0, 100]} stroke="#9CA3AF" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <YAxis dataKey="topic" type="category" stroke="#9CA3AF" axisLine={false} tickLine={false} tick={{ fill: '#D1D5DB', fontSize: 12 }} />
                    <RechartsTooltip cursor={{fill: '#374151', opacity: 0.2}} contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.95)', border: '1px solid #4B5563', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }} itemStyle={{ fontWeight: 'bold', color: '#E5E7EB' }} />
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
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold mb-4">Class Leaderboard</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="text-xs text-gray-400 uppercase bg-gray-700/50 border-b border-gray-700">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">Rank</th>
                      <th className="px-4 py-3">Roll Number</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3 rounded-tr-lg">Band</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizDetails.leaderboard.map((student, idx) => (
                      <tr 
                        key={student.roll} 
                        onClick={() => { setSearchTerm(student.roll); setSearchedStudent(studentsData.find(s => s.rollNumber === student.roll)); }}
                        className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-indigo-300">{student.roll}</td>
                        <td className="px-4 py-3">{student.name}</td>
                        <td className="px-4 py-3">{student.score}%</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            student.band === 'Excellent' ? 'bg-green-500/20 text-green-400' :
                            student.band === 'Average' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
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
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center"><AlertTriangle className="w-5 h-5 text-yellow-500 mr-2"/> Actionable Insights</h3>
              <div className="space-y-4">
                {quizDetails.topicAverages.filter(t => t.avg < 65).length > 0 ? (
                  quizDetails.topicAverages.filter(t => t.avg < 65).map(weakTopic => (
                    <div key={weakTopic.topic} className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                      <h4 className="text-red-400 font-medium text-sm mb-1">Low Performance in {weakTopic.topic}</h4>
                      <p className="text-gray-400 text-xs">Class average is {weakTopic.avg}%. Consider scheduling a remedial session for this topic.</p>
                    </div>
                  ))
                ) : (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <h4 className="text-green-400 font-medium text-sm mb-1">Excellent Overall Performance</h4>
                    <p className="text-gray-400 text-xs">No critical weak topics identified for this assessment.</p>
                  </div>
                )}
                <button className="w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium text-sm shadow-lg shadow-indigo-500/20">
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
