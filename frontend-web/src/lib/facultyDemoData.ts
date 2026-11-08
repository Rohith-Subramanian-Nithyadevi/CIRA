export const facultyDemoBatches = [
  { id: 'demo-batch-2024', name: '2024-2028', startYear: 2024 },
  { id: 'demo-batch-2025', name: '2025-2029', startYear: 2025 },
];

export const facultyDemoDepartments = [
  {
    id: 'demo-dept-cse',
    name: 'Computer Science and Engineering',
    batchId: 'demo-batch-2024',
    sections: [
      { id: 'demo-section-a', name: 'A', departmentId: 'demo-dept-cse' },
      { id: 'demo-section-b', name: 'B', departmentId: 'demo-dept-cse' },
    ],
  },
];

export const facultyDemoQuizzes = [
  {
    id: 'demo-quiz-1',
    title: 'Data Structures Midterm',
    subject: 'Computer Science',
    totalMarks: 100,
    passingMarks: 40,
    durationMinutes: 60,
    startDate: '2026-11-03T09:00:00.000Z',
    endDate: '2026-11-15T17:00:00.000Z',
    targetDepartments: [{ departmentId: 'demo-dept-cse', department: { name: 'Computer Science and Engineering' } }],
    targetSections: [{ sectionId: 'demo-section-a', section: { name: 'A' } }],
    _count: { questions: 20, attempts: 32 },
    answersPublished: false,
  },
  {
    id: 'demo-quiz-2',
    title: 'Python Fundamentals',
    subject: 'Programming',
    totalMarks: 50,
    passingMarks: 20,
    durationMinutes: 45,
    startDate: '2026-11-20T09:00:00.000Z',
    endDate: null,
    targetDepartments: [],
    targetSections: [],
    _count: { questions: 15, attempts: 28 },
    answersPublished: true,
  },
];

export const facultyDemoAssignments = [
  {
    id: 'demo-assignment-1',
    title: 'Graph Algorithms Worksheet',
    description: '<p>Complete the graph traversal exercises.</p>',
    dueDate: '2026-11-12T23:59:00.000Z',
    targetBatches: [{ batchId: 'demo-batch-2024' }],
    targetDepartments: [{ departmentId: 'demo-dept-cse' }],
    targetSections: [{ sectionId: 'demo-section-a' }],
    _count: { submissions: 18 },
  },
  {
    id: 'demo-assignment-2',
    title: 'Python Practice Set',
    description: '<p>Submit the programming practice set.</p>',
    dueDate: '2026-11-18T23:59:00.000Z',
    targetBatches: [],
    targetDepartments: [],
    targetSections: [],
    _count: { submissions: 24 },
  },
];

export const facultyDemoTasks = [
  { id: 'demo-task-1', task: 'Review midterm submissions', completed: false, date: '2026-11-08' },
  { id: 'demo-task-2', task: 'Publish assignment feedback', completed: false, date: '2026-11-09' },
];

export const facultyDemoCalendar = [
  { id: 'demo-event-1', title: 'Faculty coordination meeting', date: '2026-11-08' },
  { id: 'demo-event-2', title: 'Assessment review', date: '2026-11-11' },
];

export const facultyDemoAnnouncements = [
  { id: 'demo-announcement-1', title: 'Midterm review window', content: '<p>Review and evaluate the midterm submissions this week.</p>', date: '2026-11-07', author: 'You', isSurvey: false, audience: 'All Students' },
  { id: 'demo-announcement-2', title: 'Feedback survey', content: '<p>Please share feedback about the assessment.</p>', date: '2026-11-06', author: 'You', isSurvey: true, audience: 'Computer Science and Engineering' },
];

export const facultyDemoNotifications = [
  { id: 'demo-notification-1', type: 'assignment', message: 'Five submissions are waiting for review.', createdAt: '2026-11-08T08:30:00.000Z', read: false },
];

export const facultyDemoReport = {
  summary: {
    poor: 6, average: 14, excellent: 12, totalStudents: 32, evaluatedStudents: 32, totalAttempts: 32, averageScore: 72,
    percentages: { poor: 18.75, average: 43.75, excellent: 37.5 },
  },
  subjects: ['Computer Science'],
  yearData: [{ band: 'Poor', 'Computer Science': 6 }, { band: 'Average', 'Computer Science': 14 }, { band: 'Excellent', 'Computer Science': 12 }],
  deptData: [{ name: 'Section A', sectionId: 'demo-section-a', Excellent: 12, Average: 14, Poor: 6, averageScore: 72, passRate: 81, totalAttempts: 32 }],
};

export const facultyDemoQuizAnalytics = {
  quiz: { id: 'demo-quiz-1', title: 'Data Structures Midterm' },
  summary: { attended: 32, evaluated: 32, submitted: 32, averageScore: 72 },
  distribution: { poor: 6, average: 14, excellent: 12 },
  leaderboard: [
    { id: 'demo-student-1', roll: 'CS24001', name: 'Aarav Menon', sectionName: 'A', departmentName: 'CSE', score: 92, band: 'Excellent', status: 'EVALUATED' },
    { id: 'demo-student-2', roll: 'CS24002', name: 'Diya Nair', sectionName: 'A', departmentName: 'CSE', score: 68, band: 'Average', status: 'EVALUATED' },
  ],
  sectionComparison: [{ name: 'Section A', averageScore: 72, totalStudents: 32, excellent: 12, average: 14, poor: 6 }],
  topicAverages: [{ topic: 'Graphs', avg: 76 }, { topic: 'Trees', avg: 68 }],
};

export const facultyDemoSubmissions = (assignmentId: string) => ({
  assignment: { id: assignmentId, title: 'Graph Algorithms Worksheet', maxMarks: 100 },
  summary: { totalAssigned: 32, submitted: 24, graded: 18, pending: 6 },
  submissions: [
    { submissionId: 'demo-submission-1', studentName: 'Aarav Menon', rollNumber: 'CS24001', status: 'GRADED', grade: 88, feedback: 'Strong work.' },
    { submissionId: 'demo-submission-2', studentName: 'Diya Nair', rollNumber: 'CS24002', status: 'SUBMITTED', grade: null, feedback: '' },
    { submissionId: 'demo-submission-3', studentName: 'Kabir Shah', rollNumber: 'CS24003', status: 'NOT_SUBMITTED', grade: null, feedback: '' },
  ],
});
