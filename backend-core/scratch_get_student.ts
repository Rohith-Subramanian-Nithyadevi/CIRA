import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({
    where: { role: 'STUDENT' },
    include: {
      department: {
        include: { batch: true }
      },
      section: true
    }
  });
  console.log(JSON.stringify(user, null, 2));
}
main().finally(() => prisma.$disconnect());
