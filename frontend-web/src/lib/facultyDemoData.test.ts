import {
  facultyDemoAssignments,
  facultyDemoQuizzes,
  facultyDemoStudents,
  facultyDemoSubmissions,
  getFacultyDemoQuizAnalytics,
  getFacultyDemoStudentByRoll,
  getFacultyDemoStudentProfile,
  facultyDemoReportForScope,
} from './facultyDemoData';

describe('faculty demo data', () => {
  it('provides a complete roster with 32 students in Section A', () => {
    const sectionA = facultyDemoStudents.filter(student => student.sectionId === 'demo-section-a');

    expect(sectionA).toHaveLength(32);
    expect(facultyDemoStudents).toHaveLength(52);
    expect(sectionA.every(student => student.name && student.email && student.rollNumber && student.batchName)).toBe(true);
    expect(new Set(facultyDemoStudents.map(student => student.rollNumber)).size).toBe(facultyDemoStudents.length);
  });

  it('keeps report totals and score bands consistent with Section A attempts', () => {
    const report = facultyDemoReportForScope('demo-batch-2024', 'demo-dept-cse', 'demo-section-a');
    const analytics = getFacultyDemoQuizAnalytics('demo-quiz-1', 'demo-section-a');

    expect(report.summary).toMatchObject({
      totalStudents: 32,
      evaluatedStudents: 32,
      totalAttempts: 32,
      averageScore: 72,
      poor: 6,
      average: 14,
      excellent: 12,
    });
    expect(analytics.leaderboard).toHaveLength(32);
    expect(analytics.summary.attended).toBe(analytics.leaderboard.length);
    expect(analytics.distribution.poor + analytics.distribution.average + analytics.distribution.excellent).toBe(analytics.summary.evaluated);
    expect(analytics.leaderboard.every(student => student.studentId && student.rollNumber && student.name && student.status)).toBe(true);
  });

  it('returns a full demo profile for a student found by roll number', () => {
    const student = getFacultyDemoStudentByRoll('cs24001');
    expect(student).not.toBeNull();
    const profile = getFacultyDemoStudentProfile(student!.id);

    expect(profile?.student).toMatchObject({ name: student!.name, rollNumber: student!.rollNumber, sectionName: 'A' });
    expect(profile?.quizHistory.length).toBeGreaterThan(0);
    expect(profile?.assignmentCompletion.total).toBe(2);
    expect(profile?.assignmentCompletion.items.every(item => item.title && item.assignedDate && item.status)).toBe(true);
  });

  it('provides a complete assignment roster and matching submission counts', () => {
    facultyDemoAssignments.forEach(assignment => {
      const data = facultyDemoSubmissions(assignment.id);
      expect(data.submissions).toHaveLength(data.summary.totalAssigned);
      expect(data.summary.submitted).toBe(data.submissions.filter(submission => submission.status !== 'NOT_SUBMITTED').length);
      expect(data.summary.graded).toBe(data.submissions.filter(submission => submission.status === 'GRADED').length);
      expect(data.summary.pending).toBe(data.submissions.filter(submission => submission.status === 'NOT_SUBMITTED').length);
      expect(data.submissions.every(submission => submission.studentId && submission.studentName && submission.rollNumber && submission.maxMarks)).toBe(true);
    });
  });

  it('provides fully populated quiz metadata and question fields', () => {
    expect(facultyDemoQuizzes).toHaveLength(2);
    facultyDemoQuizzes.forEach(quiz => {
      expect(quiz.title && quiz.subject && quiz.description && quiz.startDate && quiz.endDate).toBeTruthy();
      expect(quiz.totalMarks).toBeGreaterThan(0);
      expect(quiz.passingMarks).toBeGreaterThan(0);
      expect(quiz.durationMinutes).toBeGreaterThan(0);
      expect(quiz.questions.length).toBe(quiz._count.questions);
      expect(quiz.questions.every(question => question.text && question.topic && question.options.length === 4 && question.answerKey)).toBe(true);
    });
  });
});
