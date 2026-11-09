export const facultyDemoBatches = [
  { id: 'demo-batch-2024', name: '2024-2028', startYear: 2024, endYear: 2028 },
  { id: 'demo-batch-2025', name: '2025-2029', startYear: 2025, endYear: 2029 },
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

const demoStudentNames = [
  'Aarav Menon', 'Diya Nair', 'Kabir Shah', 'Ananya Iyer', 'Arjun Rao', 'Meera Pillai',
  'Rohan Das', 'Ishita Kapoor', 'Aditya Kulkarni', 'Saanvi Gupta', 'Vihaan Reddy', 'Anika Bose',
  'Reyansh Kumar', 'Kavya Shetty', 'Dev Malhotra', 'Aadhya Krishnan', 'Neil Fernandes', 'Tara Joshi',
  'Ishan Verma', 'Myra Chatterjee', 'Dhruv Bhat', 'Sara Thomas', 'Kian Mehta', 'Nisha Menon',
  'Atharv Sinha', 'Riya Desai', 'Yash Patil', 'Avni Rao', 'Manav Bansal', 'Kiara Dutta',
  'Pranav Naidu', 'Zoya Mirza', 'Samar Khanna', 'Tanvi Ramesh', 'Kartik Ghosh', 'Aanya Shah',
  'Ayan Mukherjee', 'Pihu Nair', 'Shaurya Jain', 'Ira Krishnan', 'Ritvik Anand', 'Mira Sethi',
  'Kushagra Roy', 'Navya Pillai', 'Parth Iyer', 'Aisha Khan', 'Omkar Joshi', 'Samaira Bose',
  'Harsh Vardhan', 'Veda Srinivasan', "Aryan D'Souza", 'Ishani Bhat',
];

const sectionAScores = [
  92, 68, 45, 76, 84, 58, 72, 88, 64, 81, 50, 70, 79, 62, 86, 55,
  74, 90, 48, 66, 83, 78, 52, 94, 60, 87, 73, 85, 65, 89, 61, 80,
];

const demoTopics = ['Data Structures', 'Algorithms', 'Problem Solving', 'Programming Fundamentals'];
const bandForScore = (score: number) => score >= 80 ? 'Excellent' : score >= 60 ? 'Average' : 'Poor';
const topicScoresFor = (score: number, studentIndex: number) => demoTopics.map((topic, topicIndex) => ({
  topic,
  score: Math.max(0, Math.min(100, score + (((studentIndex * 7 + topicIndex * 11) % 17) - 8))),
  maxScore: 100,
}));

export const facultyDemoStudents = demoStudentNames.map((name, index) => {
  const sectionName = index < 32 ? 'A' : 'B';
  const sectionId = sectionName === 'A' ? 'demo-section-a' : 'demo-section-b';
  const rollNumber = `CS24${String(index + 1).padStart(3, '0')}`;
  const [firstName, ...lastName] = name.split(' ');
  return {
    id: `demo-student-${String(index + 1).padStart(3, '0')}`,
    name,
    firstName,
    lastName: lastName.join(' '),
    email: `${firstName.toLowerCase().replace(/[^a-z]/g, '')}.${lastName.join('').toLowerCase().replace(/[^a-z]/g, '')}@demo.cira.example`,
    rollNumber,
    roll: rollNumber,
    role: 'STUDENT',
    status: 'ACTIVE',
    academicStatus: 'Enrolled',
    departmentId: 'demo-dept-cse',
    departmentName: 'Computer Science and Engineering',
    department: { id: 'demo-dept-cse', name: 'Computer Science and Engineering' },
    sectionId,
    sectionName,
    section: { id: sectionId, name: sectionName },
    batchId: 'demo-batch-2024',
    batchName: '2024-2028',
    yearOfStudy: 3,
    semester: 5,
    profileImage: null,
    phone: `+91 90000 ${String(10000 + index).slice(-5)}`,
  };
});

const quiz1Date = (studentIndex: number) => new Date(Date.UTC(2026, 9, 20 + (studentIndex % 10), 9 + (studentIndex % 8), 0)).toISOString();
const quiz2ScoreFor = (studentIndex: number) => 52 + ((studentIndex * 17 + 23) % 49);

const quizTarget = (sectionIds: string[]) => ({
  targetBatches: [{ batchId: 'demo-batch-2024', batch: { id: 'demo-batch-2024', name: '2024-2028' } }],
  targetDepartments: [{ departmentId: 'demo-dept-cse', department: { id: 'demo-dept-cse', name: 'Computer Science and Engineering' } }],
  targetSections: sectionIds.map(sectionId => ({
    sectionId,
    section: { id: sectionId, name: sectionId === 'demo-section-a' ? 'A' : 'B' },
  })),
});

const makeDemoQuestions = (idPrefix: string, count: number) => Array.from({ length: count }, (_, index) => {
  const topic = demoTopics[index % demoTopics.length];
  return {
    id: `${idPrefix}-${index + 1}`,
    type: 'MCQ',
    text: `${topic} application question ${index + 1}`,
    marks: count === 20 ? 5 : index < 10 ? 4 : 2,
    topic,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    answerKey: idPrefix.includes('python') ? 'Option B' : 'Option A',
  };
});

const quiz1Target = quizTarget(['demo-section-a']);
const quiz2Target = quizTarget(['demo-section-a', 'demo-section-b']);

export const facultyDemoQuizzes = [
  {
    id: 'demo-quiz-1',
    title: 'Data Structures Midterm',
    subject: 'Computer Science',
    description: 'Midterm assessment covering data structures, algorithm analysis, problem solving, and programming fundamentals.',
    totalMarks: 100,
    passingMarks: 40,
    durationMinutes: 60,
    startDate: '2026-10-20T09:00:00.000Z',
    endDate: '2026-10-30T17:00:00.000Z',
    createdAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-12T10:00:00.000Z',
    status: 'COMPLETED',
    isPosted: true,
    answersPublished: false,
    allowRetake: false,
    shuffleQuestions: false,
    ...quiz1Target,
    targetStudents: [],
    _count: { questions: 20, attempts: 32 },
    questions: makeDemoQuestions('demo-question', 20),
  },
  {
    id: 'demo-quiz-2',
    title: 'Python Fundamentals',
    subject: 'Programming',
    description: 'Comprehensive practice assessment on Python syntax, control flow, functions, and data structures.',
    totalMarks: 50,
    passingMarks: 20,
    durationMinutes: 45,
    startDate: '2026-11-02T09:00:00.000Z',
    endDate: '2026-11-12T17:00:00.000Z',
    createdAt: '2026-10-28T10:00:00.000Z',
    updatedAt: '2026-10-28T10:00:00.000Z',
    status: 'COMPLETED',
    isPosted: true,
    answersPublished: true,
    allowRetake: true,
    shuffleQuestions: true,
    ...quiz2Target,
    targetStudents: [],
    _count: { questions: 15, attempts: 48 },
    questions: makeDemoQuestions('demo-python-question', 15),
  },
];

export const facultyDemoQuizAttempts = facultyDemoQuizzes.flatMap(quiz => facultyDemoStudents.flatMap((student, studentIndex) => {
  if (quiz.id === 'demo-quiz-1' && student.sectionId !== 'demo-section-a') return [];
  if (quiz.id === 'demo-quiz-2' && studentIndex >= 48) return [];
  const score = quiz.id === 'demo-quiz-1' ? sectionAScores[studentIndex] : quiz2ScoreFor(studentIndex);
  const date = quiz.id === 'demo-quiz-1' ? quiz1Date(studentIndex) : new Date(Date.UTC(2026, 10, 3 + (studentIndex % 5), 10 + (studentIndex % 6), 0)).toISOString();
  return [{
    id: `demo-attempt-${quiz.id}-${student.id}`,
    attemptId: `demo-attempt-${quiz.id}-${student.id}`,
    quizId: quiz.id,
    quizTitle: quiz.title,
    studentId: student.id,
    studentName: student.name,
    rollNumber: student.rollNumber,
    score,
    totalScore: Math.round(score * quiz.totalMarks / 100),
    totalMarks: quiz.totalMarks,
    band: bandForScore(score),
    status: 'EVALUATED',
    date,
    createdAt: date,
    evaluatedAt: date,
    topicScores: topicScoresFor(score, studentIndex),
  }];
}));

export const facultyDemoAssignments = [
  {
    id: 'demo-assignment-1',
    title: 'Graph Algorithms Worksheet',
    description: '<p>Complete the graph traversal exercises. Submit your explanations and complexity analysis as a single PDF.</p>',
    subject: 'Computer Science',
    maxMarks: 100,
    createdAt: '2026-10-22T09:00:00.000Z',
    updatedAt: '2026-10-22T09:00:00.000Z',
    dueDate: '2026-11-12T23:59:00.000Z',
    status: 'PUBLISHED',
    ...quiz1Target,
    _count: { submissions: 24 },
  },
  {
    id: 'demo-assignment-2',
    title: 'Python Practice Set',
    description: '<p>Complete the programming practice set, include your source files, and add a short note describing your approach.</p>',
    subject: 'Programming',
    maxMarks: 50,
    createdAt: '2026-10-30T09:00:00.000Z',
    updatedAt: '2026-10-30T09:00:00.000Z',
    dueDate: '2026-11-18T23:59:00.000Z',
    status: 'PUBLISHED',
    ...quiz2Target,
    _count: { submissions: 41 },
  },
];

const assignmentStatusFor = (assignmentId: string, rosterIndex: number) => {
  if (assignmentId === 'demo-assignment-1') {
    if (rosterIndex < 18) return 'GRADED';
    if (rosterIndex < 24) return 'SUBMITTED';
    return 'NOT_SUBMITTED';
  }
  if (rosterIndex < 26) return 'GRADED';
  if (rosterIndex < 41) return 'SUBMITTED';
  return 'NOT_SUBMITTED';
};

const studentsAssignedTo = (assignmentId: string) => assignmentId === 'demo-assignment-1'
  ? facultyDemoStudents.filter(student => student.sectionId === 'demo-section-a')
  : facultyDemoStudents;

export const facultyDemoTasks = [
  { id: 'demo-task-1', task: 'Review Data Structures Midterm submissions', description: 'Finish rubric checks for the evaluated midterm attempts.', completed: false, date: '2026-11-08', priority: 'HIGH', category: 'Grading' },
  { id: 'demo-task-2', task: 'Publish assignment feedback', description: 'Return feedback for graded Graph Algorithms Worksheet submissions.', completed: false, date: '2026-11-09', priority: 'MEDIUM', category: 'Assignments' },
];

export const facultyDemoCalendar = [
  { id: 'demo-event-1', title: 'Faculty coordination meeting', description: 'Weekly CSE faculty meeting.', date: '2026-11-08', startTime: '10:00', endTime: '11:00', location: 'Faculty Meeting Room' },
  { id: 'demo-event-2', title: 'Assessment review', description: 'Review quiz performance and follow-up actions.', date: '2026-11-11', startTime: '14:00', endTime: '15:00', location: 'CSE Department' },
];

export const facultyDemoAnnouncements = [
  { id: 'demo-announcement-1', title: 'Midterm review window', content: '<p>Review and evaluate the midterm submissions this week. Contact the department office if you need support.</p>', date: '2026-11-07', createdAt: '2026-11-07T08:30:00.000Z', author: 'Faculty Demo', authorName: 'Faculty Demo', isSurvey: false, audience: 'Section A', status: 'PUBLISHED', responseCount: 0 },
  { id: 'demo-announcement-2', title: 'Feedback survey', content: '<p>Please share feedback about the assessment by Friday. Your responses help improve upcoming assessments.</p>', date: '2026-11-06', createdAt: '2026-11-06T08:30:00.000Z', author: 'Faculty Demo', authorName: 'Faculty Demo', isSurvey: true, audience: 'Computer Science and Engineering', status: 'PUBLISHED', responseCount: 28 },
];

export const facultyDemoNotifications = [
  { id: 'demo-notification-1', type: 'assignment', message: 'Six submissions are waiting for grading.', createdAt: '2026-11-08T08:30:00.000Z', read: false, entityId: 'demo-assignment-1' },
  { id: 'demo-notification-2', type: 'quiz', message: 'Python Fundamentals evaluation is complete.', createdAt: '2026-11-07T13:15:00.000Z', read: true, entityId: 'demo-quiz-2' },
];

const reportScoreFor = (student: typeof facultyDemoStudents[number]) => {
  const attempt = facultyDemoQuizAttempts.find(item =>
    item.studentId === student.id && item.quizId === (student.sectionId === 'demo-section-a' ? 'demo-quiz-1' : 'demo-quiz-2')
  );
  return attempt?.score ?? null;
};

const getRosterForScope = (batchId?: string | null, departmentId?: string | null, sectionId?: string | null) =>
  facultyDemoStudents.filter(student =>
    (!batchId || student.batchId === batchId) &&
    (!departmentId || student.departmentId === departmentId) &&
    (!sectionId || student.sectionId === sectionId)
  );

const summarizeScores = (students: typeof facultyDemoStudents) => {
  const scores = students.map(reportScoreFor).filter((score): score is number => score !== null);
  const excellent = scores.filter(score => score >= 80).length;
  const average = scores.filter(score => score >= 60 && score < 80).length;
  const poor = scores.filter(score => score < 60).length;
  const totalAttempts = scores.length;
  const averageScore = totalAttempts ? Math.round(scores.reduce((sum, score) => sum + score, 0) / totalAttempts) : 0;
  return {
    poor,
    average,
    excellent,
    totalStudents: students.length,
    evaluatedStudents: totalAttempts,
    totalAttempts,
    averageScore,
    percentages: {
      poor: totalAttempts ? Math.round((poor / totalAttempts) * 10000) / 100 : 0,
      average: totalAttempts ? Math.round((average / totalAttempts) * 10000) / 100 : 0,
      excellent: totalAttempts ? Math.round((excellent / totalAttempts) * 10000) / 100 : 0,
    },
  };
};

const getReportForScope = (batchId?: string | null, departmentId?: string | null, sectionId?: string | null) => {
  const students = getRosterForScope(batchId, departmentId, sectionId);
  const scores = students.map(student => ({ student, score: reportScoreFor(student) })).filter(item => item.score !== null) as Array<{ student: typeof facultyDemoStudents[number]; score: number }>;
  const sectionRows = ['demo-section-a', 'demo-section-b']
    .map(id => {
      const sectionStudents = students.filter(student => student.sectionId === id);
      const sectionScores = sectionStudents.map(reportScoreFor).filter((score): score is number => score !== null);
      if (!sectionStudents.length) return null;
      const counts = {
        Excellent: sectionScores.filter(score => score >= 80).length,
        Average: sectionScores.filter(score => score >= 60 && score < 80).length,
        Poor: sectionScores.filter(score => score < 60).length,
      };
      return {
        name: `Section ${id.endsWith('a') ? 'A' : 'B'}`,
        sectionId: id,
        ...counts,
        averageScore: sectionScores.length ? Math.round(sectionScores.reduce((sum, score) => sum + score, 0) / sectionScores.length) : 0,
        passRate: sectionScores.length ? Math.round((sectionScores.filter(score => score >= 40).length / sectionScores.length) * 100) : 0,
        totalAttempts: sectionScores.length,
        totalStudents: sectionStudents.length,
      };
    }).filter(Boolean);
  const subjects = ['Computer Science', 'Programming'];
  const yearData = ['Poor', 'Average', 'Excellent'].map(band => ({
    band,
    'Computer Science': scores.filter(item => item.student.sectionId === 'demo-section-a' && bandForScore(item.score) === band).length,
    Programming: scores.filter(item => item.student.sectionId === 'demo-section-b' && bandForScore(item.score) === band).length,
  }));
  return {
    summary: summarizeScores(students),
    subjects,
    yearData,
    deptData: sectionRows,
  };
};

export const facultyDemoReport = getReportForScope();
export const facultyDemoReportForScope = getReportForScope;

const getQuizAttempts = (quizId: string, sectionId?: string | null) => facultyDemoQuizAttempts.filter(attempt =>
  attempt.quizId === quizId && (!sectionId || facultyDemoStudents.find(student => student.id === attempt.studentId)?.sectionId === sectionId)
);

export const getFacultyDemoQuizAnalytics = (quizId: string, sectionId?: string | null) => {
  const attempts = getQuizAttempts(quizId, sectionId);
  const distribution = {
    poor: attempts.filter(attempt => attempt.score < 60).length,
    average: attempts.filter(attempt => attempt.score >= 60 && attempt.score < 80).length,
    excellent: attempts.filter(attempt => attempt.score >= 80).length,
  };
  const averageScore = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length) : 0;
  const topicAverages = demoTopics.map(topic => {
    const scores = attempts.map(attempt => attempt.topicScores.find(item => item.topic === topic)?.score).filter((score): score is number => score !== undefined);
    return { topic, avg: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0, responses: scores.length };
  });
  const sectionComparison = ['demo-section-a', 'demo-section-b'].map(id => {
    const sectionAttempts = attempts.filter(attempt => facultyDemoStudents.find(student => student.id === attempt.studentId)?.sectionId === id);
    const sectionDistribution = {
      excellent: sectionAttempts.filter(attempt => attempt.score >= 80).length,
      average: sectionAttempts.filter(attempt => attempt.score >= 60 && attempt.score < 80).length,
      poor: sectionAttempts.filter(attempt => attempt.score < 60).length,
    };
    return {
      name: `Section ${id.endsWith('a') ? 'A' : 'B'}`,
      sectionId: id,
      averageScore: sectionAttempts.length ? Math.round(sectionAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / sectionAttempts.length) : 0,
      totalStudents: sectionAttempts.length,
      ...sectionDistribution,
    };
  }).filter(section => section.totalStudents > 0);
  return {
    quiz: { id: quizId, title: facultyDemoQuizzes.find(quiz => quiz.id === quizId)?.title || 'Assessment' },
    summary: {
      attended: attempts.length,
      evaluated: attempts.filter(attempt => attempt.status === 'EVALUATED').length,
      submitted: attempts.length,
      averageScore,
    },
    distribution,
    leaderboard: [...attempts].sort((a, b) => b.score - a.score).map((attempt, index) => {
      const student = facultyDemoStudents.find(item => item.id === attempt.studentId)!;
      return {
        id: student.id,
        studentId: student.id,
        roll: student.rollNumber,
        rollNumber: student.rollNumber,
        name: student.name,
        sectionName: student.sectionName,
        departmentName: student.departmentName,
        batchName: student.batchName,
        score: attempt.score,
        band: attempt.band,
        status: attempt.status,
        rank: index + 1,
        quizId: attempt.quizId,
        attemptId: attempt.attemptId,
      };
    }),
    sectionComparison,
    topicAverages,
  };
};

export const facultyDemoQuizAnalytics = getFacultyDemoQuizAnalytics('demo-quiz-1');

export const getFacultyDemoStudentByRoll = (rollNumber: string) => {
  const normalized = rollNumber.trim().toLowerCase();
  return facultyDemoStudents.find(student => student.rollNumber.toLowerCase() === normalized) || null;
};

export const getFacultyDemoStudentProfile = (studentId: string) => {
  const student = facultyDemoStudents.find(item => item.id === studentId);
  if (!student) return null;
  const quizHistory = facultyDemoQuizAttempts
    .filter(attempt => attempt.studentId === studentId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(attempt => ({
      quizId: attempt.quizId,
      title: attempt.quizTitle,
      score: attempt.score,
      band: attempt.band,
      date: attempt.date,
      topicScores: attempt.topicScores.map(({ topic, score }) => ({ topic, score })),
    }));
  const assignments = facultyDemoAssignments.filter(assignment =>
    assignment.targetSections.some(target => target.sectionId === student.sectionId)
  );
  const assignmentItems = assignments.map(assignment => {
    const rosterIndex = facultyDemoStudents.findIndex(item => item.id === studentId);
    const status = assignmentStatusFor(assignment.id, rosterIndex);
    const grade = status === 'GRADED' ? Math.round(assignment.maxMarks * (0.65 + ((rosterIndex * 7) % 31) / 100)) : null;
    return {
      assignmentId: assignment.id,
      title: assignment.title,
      maxMarks: assignment.maxMarks,
      assignedDate: assignment.createdAt,
      status,
      grade,
      feedback: status === 'GRADED' ? 'Good work. Review the rubric notes for one suggested improvement.' : null,
      submittedAt: status === 'NOT_SUBMITTED' ? null : new Date(Date.UTC(2026, 10, 1 + (rosterIndex % 10), 12, 0)).toISOString(),
    };
  });
  const completed = assignmentItems.filter(item => item.status !== 'NOT_SUBMITTED').length;
  return {
    student: {
      id: student.id,
      name: student.name,
      rollNumber: student.rollNumber,
      departmentId: student.departmentId,
      departmentName: student.departmentName,
      sectionId: student.sectionId,
      sectionName: student.sectionName,
      batchName: student.batchName,
    },
    quizHistory,
    attendance: { available: false },
    assignmentCompletion: { completed, total: assignmentItems.length, items: assignmentItems },
  };
};

export const facultyDemoSubmissions = (assignmentId: string) => {
  const assignment = facultyDemoAssignments.find(item => item.id === assignmentId) || facultyDemoAssignments[0];
  const roster = studentsAssignedTo(assignment.id);
  const submissions = roster.map(student => {
    const rosterIndex = facultyDemoStudents.findIndex(item => item.id === student.id);
    const status = assignmentStatusFor(assignment.id, rosterIndex);
    const grade = status === 'GRADED' ? Math.round(assignment.maxMarks * (0.65 + ((rosterIndex * 7) % 31) / 100)) : null;
    const submittedAt = status === 'NOT_SUBMITTED' ? null : new Date(Date.UTC(2026, 10, 1 + (rosterIndex % 10), 12, 0)).toISOString();
    return {
      submissionId: status === 'NOT_SUBMITTED' ? `demo-assignment-record-${assignment.id}-${student.id}` : `demo-submission-${assignment.id}-${student.id}`,
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      email: student.email,
      sectionName: student.sectionName,
      departmentName: student.departmentName,
      status,
      grade,
      maxMarks: assignment.maxMarks,
      feedback: status === 'GRADED' ? 'Good work. Review the rubric notes for one suggested improvement.' : '',
      submittedAt,
      gradedAt: status === 'GRADED' ? new Date(Date.UTC(2026, 10, 4 + (rosterIndex % 5), 15, 0)).toISOString() : null,
      fileName: status === 'NOT_SUBMITTED' ? null : `${student.rollNumber}_${assignment.id}.pdf`,
      fileUrl: status === 'NOT_SUBMITTED' ? null : '#demo-submission',
      late: submittedAt ? new Date(submittedAt) > new Date(assignment.dueDate) : false,
    };
  });
  const graded = submissions.filter(submission => submission.status === 'GRADED').length;
  const submitted = submissions.filter(submission => submission.status !== 'NOT_SUBMITTED').length;
  return {
    assignment: {
      id: assignment.id,
      title: assignment.title,
      subject: assignment.subject,
      maxMarks: assignment.maxMarks,
      dueDate: assignment.dueDate,
    },
    summary: {
      totalAssigned: roster.length,
      submitted,
      graded,
      pending: roster.length - submitted,
    },
    submissions,
  };
};
