import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  try {
    const quiz = await prisma.quiz.findFirst();
    if (!quiz) { console.log('No quiz'); return; }
    
    // Simulate payload from Altered_Quiz_Template.docx
    const questions = [
      { type: 'MCQ', text: 'What is the output of print(2 + 3)?', marks: 1, options: ['4','5','6','23'], answerKey: '5' },
      { type: 'MCQ', text: 'Which keyword defines a function in Python?', marks: 1, options: ['func','define','def','function'], answerKey: 'def' },
    ];

    for (const q of questions) {
      await prisma.question.create({
        data: {
          quizId: quiz.id,
          type: q.type as any,
          text: q.text,
          marks: q.marks,
          options: q.options ?? undefined,
          answerKey: q.answerKey ?? undefined,
        }
      });
    }
    console.log('Success');
  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
