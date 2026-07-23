import { PrismaClient, Role, QuestionType, QuizAttemptStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const rollNumber = 'ch.sc.u4cse24141';
  const email = `${rollNumber}@cb.students.amrita.edu`;
  const name = 'Rohith Subramanian Nithyadevi'; // matching the screenshot name

  // 1. Ensure User exists
  let user = await prisma.user.findUnique({
    where: { rollNumber },
  });

  if (!user) {
    user = await prisma.user.findUnique({
      where: { email },
    });
  }

  if (!user) {
    const hashedPassword = await bcrypt.hash('password123', 10);
    user = await prisma.user.create({
      data: {
        email,
        name,
        rollNumber,
        password: hashedPassword,
        role: Role.STUDENT,
        isEmailVerified: true,
      },
    });
    console.log(`Created new user: ${name}`);
  } else {
    console.log(`Found existing user: ${user.name}`);
  }

  // 2. Create some sample Quizzes and Attempts for Trajectory
  const attemptScores = [45, 55, 60, 75, 82]; // Trend upwards
  
  for (let i = 0; i < attemptScores.length; i++) {
    const score = attemptScores[i];
    const quizTitle = `Weekly Assessment ${i + 1}`;
    
    // Check if this quiz already exists
    let quiz = await prisma.quiz.findFirst({
      where: { title: quizTitle, createdBy: 'system_seed' }
    });

    if (!quiz) {
      quiz = await prisma.quiz.create({
        data: {
          title: quizTitle,
          totalMarks: 100,
          passingMarks: 40,
          createdBy: 'system_seed',
          questions: {
            create: [
              {
                type: QuestionType.MCQ,
                text: 'Sample Question',
                marks: 100,
              }
            ]
          }
        }
      });
    }

    // Create attempt
    const attemptTime = new Date();
    attemptTime.setDate(attemptTime.getDate() - (attemptScores.length - i) * 7); // 1 week apart

    // We'll set the metrics only for the last attempt for the Radar Chart
    const metrics = i === attemptScores.length - 1 ? {
      "Algorithms": 85,
      "Data Structures": 60,
      "Database Systems": 90,
      "Operating Systems": 45,
      "Computer Networks": 75,
      "Web Technologies": 80
    } : {};

    await prisma.quizAttempt.create({
      data: {
        userId: user.id,
        quizId: quiz.id,
        status: QuizAttemptStatus.EVALUATED,
        startTime: attemptTime,
        endTime: new Date(attemptTime.getTime() + 60 * 60 * 1000), // 1 hour later
        score: score,
        totalScore: score,
        metrics: metrics
      }
    });
  }

  console.log(`Created ${attemptScores.length} quiz attempts for trajectory.`);

  // 3. Create Remediation Assignments
  const assignmentsData = [
    { title: "Operating Systems Memory Management Review", rating: "POOR" },
    { title: "Data Structures: Advanced Trees Implementation", rating: "AVERAGE" }
  ];

  for (const a of assignmentsData) {
    const assignment = await prisma.assignment.create({
      data: {
        title: a.title,
        description: "NLP-Generated Remediation based on recent quiz performance.",
        createdBy: "system_seed"
      }
    });

    const submitDate = new Date();
    submitDate.setDate(submitDate.getDate() - Math.floor(Math.random() * 5));

    await prisma.assignmentSubmission.create({
      data: {
        userId: user.id,
        assignmentId: assignment.id,
        submittedAt: submitDate,
        rating: a.rating as any,
      }
    });
  }
  
  console.log(`Created ${assignmentsData.length} remediation assignments.`);
  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
