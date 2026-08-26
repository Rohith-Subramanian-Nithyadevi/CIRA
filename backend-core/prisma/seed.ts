import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with default Admin and Departments...");
  
  const adminEmail = 'admin@amrita.edu';
  const adminPassword = 'cira_admin@amrita';
  
  // Hash the password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(adminPassword, salt);

  // Upsert the Admin user
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedPassword,
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: 'System Admin',
      role: 'ADMIN',
      approvalStatus: 'APPROVED'
    },
  });

  console.log("Admin seeded successfully!");

  // Create a default batch
  const defaultBatch = await prisma.batch.upsert({
    where: { name: '2023-2027' },
    update: {},
    create: {
      name: '2023-2027',
      startYear: 2023
    }
  });

  // Seed default departments if none exist to avoid empty dropdowns
  const csDept = await prisma.department.upsert({
    where: { 
      name_batchId: {
        name: 'Computer Science',
        batchId: defaultBatch.id
      }
    },
    update: {},
    create: {
      name: 'Computer Science',
      batchId: defaultBatch.id,
      sections: {
        create: [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
      }
    }
  });

  const ecDept = await prisma.department.upsert({
    where: { 
      name_batchId: {
        name: 'Electronics',
        batchId: defaultBatch.id
      }
    },
    update: {},
    create: {
      name: 'Electronics',
      batchId: defaultBatch.id,
      sections: {
        create: [{ name: 'A' }, { name: 'B' }]
      }
    }
  });

  console.log("Departments seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
