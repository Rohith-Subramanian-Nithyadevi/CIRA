import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding analytics data (Aptitude, Soft Skills, Verbal)...");
  
  // 1. Create Departments and Sections
  const csDept = await prisma.department.upsert({
    where: { name: 'Computer Science' },
    update: {},
    create: {
      name: 'Computer Science',
      sections: { create: [{ name: 'A' }, { name: 'B' }] }
    },
    include: { sections: true }
  });

  const ecDept = await prisma.department.upsert({
    where: { name: 'Electronics' },
    update: {},
    create: {
      name: 'Electronics',
      sections: { create: [{ name: 'A' }, { name: 'B' }] }
    },
    include: { sections: true }
  });

  const depts = [csDept, ecDept];
  const salt = await bcrypt.genSalt(10);
  const defaultPassword = await bcrypt.hash('password123', salt);

  // 2. Create Students
  const students = [];
  let rollCounter = 1;
  for (const dept of depts) {
    for (const section of dept.sections) {
      for (let i = 0; i < 10; i++) {
        const rollNum = `CB.EN.U4${dept.name.substring(0, 3).toUpperCase()}230${rollCounter.toString().padStart(2, '0')}`;
        const student = await prisma.user.upsert({
          where: { email: `student${rollCounter}@amrita.edu` },
          update: {},
          create: {
            name: `Student ${rollCounter}`,
            email: `student${rollCounter}@amrita.edu`,
            password: defaultPassword,
            role: 'STUDENT',
            rollNumber: rollNum,
            departmentId: dept.id,
            sectionId: section.id,
            approvalStatus: 'APPROVED'
          }
        });
        students.push(student);
        rollCounter++;
      }
    }
  }
  console.log(`Seeded ${students.length} students.`);

  // 3. Create Admin / Faculty if needed
  const faculty = await prisma.user.upsert({
    where: { email: 'faculty@amrita.edu' },
    update: {},
    create: {
      name: 'Dr. Jane Smith',
      email: 'faculty@amrita.edu',
      password: defaultPassword,
      role: 'FACULTY',
      approvalStatus: 'APPROVED',
      employeeId: 'EMP12345'
    }
  });

  // 4. Create Quizzes
  const quizzesData = [
    { title: 'Aptitude Assessment', subject: 'Aptitude', totalMarks: 100, topics: ['Quantitative', 'Logical Reasoning', 'Data Interpretation'] },
    { title: 'Soft Skills Evaluation', subject: 'Soft Skills', totalMarks: 100, topics: ['Communication', 'Teamwork', 'Problem Solving'] },
    { title: 'Verbal Reasoning', subject: 'Verbal', totalMarks: 100, topics: ['Grammar', 'Vocabulary', 'Reading Comprehension'] }
  ];

  const quizzes = [];
  for (const qData of quizzesData) {
    const quiz = await prisma.quiz.create({
      data: {
        title: qData.title,
        subject: qData.subject,
        description: `Standardized test for ${qData.subject}`,
        totalMarks: qData.totalMarks,
        passingMarks: 40,
        createdBy: faculty.id,
        autoSubmit: true,
      }
    });
    quizzes.push({ ...quiz, topics: qData.topics });
  }
  console.log(`Seeded ${quizzes.length} quizzes.`);

  // 5. Generate fake QuizAttempts for each student and quiz
  let attemptsCount = 0;
  for (const student of students) {
    for (const quiz of quizzes) {
      // Random score between 30 and 100
      const totalScore = Math.floor(Math.random() * 71) + 30;
      let performanceCategory: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' = 'POOR';
      if (totalScore >= 85) performanceCategory = 'EXCELLENT';
      else if (totalScore >= 70) performanceCategory = 'GOOD';
      else if (totalScore >= 50) performanceCategory = 'AVERAGE';

      // Generate random scores for topics ensuring they average out roughly
      const topicScores: Record<string, number> = {};
      quiz.topics.forEach((t: string) => {
        topicScores[t] = Math.floor(Math.random() * 41) + 60; // 60-100 random per topic
      });

      await prisma.quizAttempt.create({
        data: {
          userId: student.id,
          quizId: quiz.id,
          status: 'EVALUATED',
          score: totalScore,
          objectiveScore: totalScore,
          totalScore: totalScore,
          performanceCategory: performanceCategory,
          metrics: { topics: topicScores },
          startTime: new Date(Date.now() - 86400000 * Math.random()),
          endTime: new Date(),
        }
      });
      attemptsCount++;
    }
  }
  console.log(`Seeded ${attemptsCount} quiz attempts.`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
