/**
 * seed_new_quizzes.js
 * Creates two new quizzes (DSA Test 1 & Python Programming) assigned to the
 * Computer Science department, with topic-tagged questions and evaluated
 * attempts with randomised marks for all 20 mock students.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Seeded random – different distributions per section so section comparison is clear */
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Score for Section A (slightly stronger cohort) */
function scoreA() { return rand(58, 100); }

/** Score for Section B (wider spread, slightly weaker) */
function scoreB() { return rand(38, 92); }

// ─── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🔍  Finding Computer Science department...');

  const dept = await prisma.department.findFirst({
    where: { name: 'Computer Science' },
    include: {
      sections: { orderBy: { name: 'asc' } }
    }
  });

  if (!dept) {
    console.error('❌  Computer Science department not found. Run seed_reports.ts first.');
    return;
  }
  console.log(`✅  Found dept: ${dept.name} with ${dept.sections.length} section(s)`);

  // ─── Fetch the mock faculty ────────────────────────────────────────────────
  const faculty = await prisma.user.findUnique({
    where: { email: 'mockfaculty@cira.edu' }
  });
  if (!faculty) {
    console.error('❌  mockfaculty@cira.edu not found. Run fix_faculty.js first.');
    return;
  }

  // ─── Fetch all students in this department ─────────────────────────────────
  const students = await prisma.user.findMany({
    where: { departmentId: dept.id, role: 'STUDENT' },
    select: { id: true, name: true, sectionId: true }
  });
  console.log(`📚  Found ${students.length} student(s)`);

  const sectionAId = dept.sections.find(s => s.name === 'A')?.id;
  const sectionBId = dept.sections.find(s => s.name === 'B')?.id;

  // ─── Quiz 1: DSA Test 1 ───────────────────────────────────────────────────
  console.log('\n📝  Creating DSA Test 1...');
  const dsaQuiz = await prisma.quiz.create({
    data: {
      title: 'DSA Test 1',
      subject: 'Data Structures & Algorithms',
      description: 'Covers Arrays, Linked Lists, Stacks, Queues, Trees and basic Graph traversal.',
      createdBy: faculty.id,
      totalMarks: 100,
      passingMarks: 50,
      targetDepartments: {
        create: [{ departmentId: dept.id }]
      }
    }
  });
  console.log(`   Quiz ID: ${dsaQuiz.id}`);

  // 5 topic-tagged questions (20 marks each)
  const dsaQuestions = await Promise.all([
    prisma.question.create({ data: { quizId: dsaQuiz.id, type: 'MCQ',           text: 'What is the time complexity of binary search?',        topic: 'Arrays',          marks: 20, negativeMarks: 0 } }),
    prisma.question.create({ data: { quizId: dsaQuiz.id, type: 'MCQ',           text: 'In a singly linked list, insertion at head is O(___)?', topic: 'Linked Lists',    marks: 20, negativeMarks: 0 } }),
    prisma.question.create({ data: { quizId: dsaQuiz.id, type: 'MCQ',           text: 'Which data structure uses LIFO ordering?',              topic: 'Stacks & Queues', marks: 20, negativeMarks: 0 } }),
    prisma.question.create({ data: { quizId: dsaQuiz.id, type: 'SHORT_WRITTEN', text: 'Define a Binary Search Tree and state its properties.', topic: 'Trees',           marks: 20, negativeMarks: 0 } }),
    prisma.question.create({ data: { quizId: dsaQuiz.id, type: 'SHORT_WRITTEN', text: 'Explain BFS traversal with an example.',                topic: 'Graphs',          marks: 20, negativeMarks: 0 } }),
  ]);

  // ─── Quiz 2: Python Programming ───────────────────────────────────────────
  console.log('📝  Creating Python Programming...');
  const pyQuiz = await prisma.quiz.create({
    data: {
      title: 'Python Programming',
      subject: 'Python Programming',
      description: 'Tests understanding of Python fundamentals, OOP, file I/O, and error handling.',
      createdBy: faculty.id,
      totalMarks: 100,
      passingMarks: 50,
      targetDepartments: {
        create: [{ departmentId: dept.id }]
      }
    }
  });
  console.log(`   Quiz ID: ${pyQuiz.id}`);

  const pyQuestions = await Promise.all([
    prisma.question.create({ data: { quizId: pyQuiz.id, type: 'MCQ',           text: 'What is the output of type(3.14)?',                      topic: 'Python Basics',     marks: 20, negativeMarks: 0 } }),
    prisma.question.create({ data: { quizId: pyQuiz.id, type: 'MCQ',           text: 'Which keyword is used to define a class method in Python?', topic: 'OOP in Python',  marks: 20, negativeMarks: 0 } }),
    prisma.question.create({ data: { quizId: pyQuiz.id, type: 'MCQ',           text: 'How do you open a file in read mode in Python?',          topic: 'File I/O',          marks: 20, negativeMarks: 0 } }),
    prisma.question.create({ data: { quizId: pyQuiz.id, type: 'SHORT_WRITTEN', text: 'Explain try-except-finally with a code example.',         topic: 'Error Handling',    marks: 20, negativeMarks: 0 } }),
    prisma.question.create({ data: { quizId: pyQuiz.id, type: 'SHORT_WRITTEN', text: 'Write a list comprehension to square numbers 1-10.',       topic: 'Lists & Iteration', marks: 20, negativeMarks: 0 } }),
  ]);

  // ─── Create Attempts ──────────────────────────────────────────────────────
  console.log('\n🎯  Creating quiz attempts for students...');

  for (const student of students) {
    const isA = student.sectionId === sectionAId;

    // ── DSA Test 1 ──
    const dsaTotalScore = isA ? scoreA() : scoreB();
    const dsaAttempt = await prisma.quizAttempt.create({
      data: {
        userId: student.id,
        quizId: dsaQuiz.id,
        status: 'EVALUATED',
        totalScore: dsaTotalScore,
        score: dsaTotalScore
      }
    });

    // Distribute marks across 5 questions proportionally with some variance
    const dsaTopicMarks = distributeMarks(dsaTotalScore, dsaQuestions.length, 20);
    for (let i = 0; i < dsaQuestions.length; i++) {
      await prisma.quizResponse.create({
        data: {
          attemptId: dsaAttempt.id,
          questionId: dsaQuestions[i].id,
          marksAwarded: dsaTopicMarks[i],
          status: 'ANSWERED'
        }
      });
    }

    // ── Python Programming ──
    const pyTotalScore = isA ? scoreA() : scoreB();
    const pyAttempt = await prisma.quizAttempt.create({
      data: {
        userId: student.id,
        quizId: pyQuiz.id,
        status: 'EVALUATED',
        totalScore: pyTotalScore,
        score: pyTotalScore
      }
    });

    const pyTopicMarks = distributeMarks(pyTotalScore, pyQuestions.length, 20);
    for (let i = 0; i < pyQuestions.length; i++) {
      await prisma.quizResponse.create({
        data: {
          attemptId: pyAttempt.id,
          questionId: pyQuestions[i].id,
          marksAwarded: pyTopicMarks[i],
          status: 'ANSWERED'
        }
      });
    }

    const sectionLabel = isA ? 'A' : 'B';
    console.log(`   ${student.name} [Sec ${sectionLabel}] → DSA: ${dsaTotalScore}, Python: ${pyTotalScore}`);
  }

  console.log('\n✅  Seeding complete!');
  console.log('   🔑  Login: mockfaculty@cira.edu / Test@1234');
  console.log('   📊  Navigate: Student Reports → Computer Science → Section A or B → DSA Test 1 / Python Programming');

  await prisma.$disconnect();
}

/**
 * Distribute totalScore across numQuestions each capped at maxPerQ.
 * Returns array of marks per question that sums to totalScore.
 */
function distributeMarks(totalScore, numQuestions, maxPerQ) {
  let remaining = totalScore;
  const marks = [];
  for (let i = 0; i < numQuestions; i++) {
    if (i === numQuestions - 1) {
      marks.push(Math.max(0, Math.min(maxPerQ, remaining)));
    } else {
      // Random share between 0 and min(maxPerQ, remaining)
      const maxShare = Math.min(maxPerQ, remaining);
      const share = Math.floor(Math.random() * (maxShare + 1));
      marks.push(share);
      remaining -= share;
    }
  }
  return marks;
}

seed().catch(e => {
  console.error('❌  Error:', e.message);
  prisma.$disconnect();
});
