import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const topics = [
  'Arrays & Hashing',
  'Two Pointers',
  'Binary Search',
  'Sliding Window',
  'Linked List',
  'Trees',
  'Tries',
  'Heap / Priority Queue',
  'Backtracking',
  'Graphs',
  '1-D Dynamic Programming',
  '2-D Dynamic Programming',
  'Greedy',
  'Advanced Graphs',
  'Math & Geometry',
  'Bit Manipulation'
];

const generateQuestions = (topicName: string, count: number, startIndex: number) => {
  return Array.from({ length: count }).map((_, i) => {
    const difficulties = ['EASY', 'MEDIUM', 'HARD'];
    const r = Math.random();
    const difficulty = r < 0.4 ? 'EASY' : r < 0.8 ? 'MEDIUM' : 'HARD';
    
    return {
      title: `Dummy Problem - ${topicName} ${startIndex + i + 1}`,
      url: 'https://leetcode.com/problemset/all/',
      difficulty,
      order: i
    };
  });
};

async function main() {
  console.log('Seeding sheets...');

  const sheetsToCreate = [
    { title: 'CIR 350 - A2Z', desc: 'Complete A2Z preparation guide with 350 questions.', count: 350 },
    { title: 'CIR 150 - Curated Qns', desc: '150 handpicked questions for comprehensive preparation.', count: 150 },
    { title: 'CIR 75 - Last minute prep', desc: 'Essential 75 questions for last minute preparation.', count: 75 }
  ];

  for (const sheetDef of sheetsToCreate) {
    await prisma.resource.deleteMany({
      where: { title: sheetDef.title }
    });

    console.log(`Creating ${sheetDef.title}...`);
    
    const resource = await prisma.resource.create({
      data: {
        title: sheetDef.title,
        description: sheetDef.desc,
        category: 'DSA',
        topic: 'Curated Prep',
        type: 'SHEET',
        totalQuestions: sheetDef.count
      }
    });

    const questionsPerTopic = Math.floor(sheetDef.count / topics.length);
    let remainingQuestions = sheetDef.count % topics.length;
    let questionIndex = 0;

    for (let i = 0; i < topics.length; i++) {
      const topicName = topics[i];
      let topicQCount = questionsPerTopic;
      
      if (remainingQuestions > 0) {
        topicQCount++;
        remainingQuestions--;
      }

      if (topicQCount === 0) continue;

      await prisma.sheetTopic.create({
        data: {
          name: topicName,
          resourceId: resource.id,
          order: i,
          questions: {
            create: generateQuestions(topicName, topicQCount, questionIndex)
          }
        }
      });
      
      questionIndex += topicQCount;
    }
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
