import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updatePasswords() {
  const hash = '$2b$10$8HSrmYhRe1JHlm7E95Oe0eszqvU09TgVBPDMlUv03xnoaBOwzujR2';

  // Update mock faculty
  await prisma.user.updateMany({
    where: { email: 'mockfaculty@example.com' },
    data: { password: hash }
  });
  
  // Update all mock students too
  await prisma.user.updateMany({
    where: { email: { contains: 'student' } },
    data: { password: hash }
  });

  console.log('Passwords updated to valid bcrypt hashes!');
}

updatePasswords().catch(console.error).finally(() => prisma.$disconnect());
