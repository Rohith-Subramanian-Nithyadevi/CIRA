import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function seedData() {
  console.log('Seeding data...');

  // 1. Create a Faculty User if none exists to assign to department
  let faculty = await prisma.user.findFirst({ where: { role: 'FACULTY' } });
  if (!faculty) {
    faculty = await prisma.user.create({
      data: {
        email: 'mockfaculty@example.com',
        name: 'Prof. John Doe',
        password: 'hashedpassword',
        role: 'FACULTY',
        isEmailVerified: true
      }
    });
    console.log('Created mock faculty user');
  }

  // 2. Create Batch
  const batch = await prisma.batch.upsert({
    where: { name: '2024 Batch' },
    update: {},
    create: {
      name: '2024 Batch',
      startYear: 2024
    }
  });

  // 3. Create Department
  const department = await prisma.department.upsert({
    where: { name_batchId: { name: 'Computer Science', batchId: batch.id } },
    update: {},
    create: {
      name: 'Computer Science',
      batchId: batch.id
    }
  });

  // 4. Map Faculty to Department
  await prisma.facultyDepartment.upsert({
    where: { userId_departmentId: { userId: faculty.id, departmentId: department.id } },
    update: {},
    create: { userId: faculty.id, departmentId: department.id }
  });

  // 5. Create Sections
  const sectionA = await prisma.section.upsert({
    where: { name_departmentId: { name: 'A', departmentId: department.id } },
    update: {},
    create: { name: 'A', departmentId: department.id }
  });

  const sectionB = await prisma.section.upsert({
    where: { name_departmentId: { name: 'B', departmentId: department.id } },
    update: {},
    create: { name: 'B', departmentId: department.id }
  });

  // 6. Create Students
  const students = [];
  for (let i = 1; i <= 20; i++) {
    const isSectionA = i <= 10;
    const student = await prisma.user.upsert({
      where: { email: `student${i}@example.com` },
      update: {},
      create: {
        email: `student${i}@example.com`,
        name: `Student ${i}`,
        password: 'hashedpassword',
        role: 'STUDENT',
        rollNumber: `CB.EN.U4CSE24${i.toString().padStart(3, '0')}`,
        isEmailVerified: true,
        departmentId: department.id,
        sectionId: isSectionA ? sectionA.id : sectionB.id
      }
    });
    students.push(student);
  }

  // 7. Create a Quiz
  const quiz1 = await prisma.quiz.create({
    data: {
      title: 'Midterm Data Structures',
      subject: 'Data Structures',
      createdBy: faculty.id,
      totalMarks: 100,
      targetDepartments: {
        create: [{ departmentId: department.id }]
      }
    }
  });

  const quiz2 = await prisma.quiz.create({
    data: {
      title: 'Midterm Algorithms',
      subject: 'Algorithms',
      createdBy: faculty.id,
      totalMarks: 100,
      targetDepartments: {
        create: [{ departmentId: department.id }]
      }
    }
  });

  // Create Dummy Questions for topic-wise analysis
  const q1 = await prisma.question.create({ data: { quizId: quiz1.id, text: 'Q1', type: 'MCQ', marks: 50, topic: 'Arrays' }});
  const q2 = await prisma.question.create({ data: { quizId: quiz1.id, text: 'Q2', type: 'MCQ', marks: 50, topic: 'Linked Lists' }});

  const q3 = await prisma.question.create({ data: { quizId: quiz2.id, text: 'Q1', type: 'MCQ', marks: 50, topic: 'Sorting' }});
  const q4 = await prisma.question.create({ data: { quizId: quiz2.id, text: 'Q2', type: 'MCQ', marks: 50, topic: 'Graphs' }});

  // 8. Create Quiz Attempts and Responses
  console.log('Seeding quiz attempts...');
  for (const student of students) {
    // Random score for quiz 1 between 40 and 100
    const score1 = Math.floor(Math.random() * (100 - 40 + 1)) + 40;
    const attempt1 = await prisma.quizAttempt.create({
      data: {
        userId: student.id,
        quizId: quiz1.id,
        status: 'EVALUATED',
        totalScore: score1,
        score: score1
      }
    });

    await prisma.quizResponse.create({
      data: {
        attemptId: attempt1.id,
        questionId: q1.id,
        marksAwarded: score1 * 0.4
      }
    });
    await prisma.quizResponse.create({
      data: {
        attemptId: attempt1.id,
        questionId: q2.id,
        marksAwarded: score1 * 0.6
      }
    });

    // Random score for quiz 2
    const score2 = Math.floor(Math.random() * (100 - 40 + 1)) + 40;
    const attempt2 = await prisma.quizAttempt.create({
      data: {
        userId: student.id,
        quizId: quiz2.id,
        status: 'EVALUATED',
        totalScore: score2,
        score: score2
      }
    });

    await prisma.quizResponse.create({
      data: {
        attemptId: attempt2.id,
        questionId: q3.id,
        marksAwarded: score2 * 0.7
      }
    });
    await prisma.quizResponse.create({
      data: {
        attemptId: attempt2.id,
        questionId: q4.id,
        marksAwarded: score2 * 0.3
      }
    });
  }

  console.log('Seeding complete!');
}

seedData().catch(e => {
  console.error(e);
}).finally(async () => {
  await prisma.$disconnect();
});
