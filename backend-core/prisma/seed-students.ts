import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import xlsx from 'xlsx';

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding students from Excel...");
  
  // 1. Create or get Batch "2024-2028"
  const batchName = '2024-2028';
  const batch = await prisma.batch.upsert({
    where: { name: batchName },
    update: {},
    create: {
      name: batchName,
      startYear: 2024
    }
  });

  // 2. Create or get Department "CSE"
  const deptName = 'CSE';
  const dept = await prisma.department.upsert({
    where: { 
      name_batchId: {
        name: deptName,
        batchId: batch.id
      }
    },
    update: {},
    create: {
      name: deptName,
      batchId: batch.id,
    }
  });

  // 3. Create or get Section "B"
  const sectionName = 'B';
  const section = await prisma.section.upsert({
    where: {
      name_departmentId: {
        name: sectionName,
        departmentId: dept.id
      }
    },
    update: {},
    create: {
      name: sectionName,
      departmentId: dept.id
    }
  });

  console.log(`Resolved Batch: ${batch.name}, Dept: ${dept.name}, Section: ${section.name}`);

  // 4. Read Excel
  const excelPath = 'E:\\Projects\\CIRA\\Turn-it-in Class Details.xlsx';
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data: any[] = xlsx.utils.sheet_to_json(worksheet);

  console.log(`Found ${data.length} students in Excel.`);

  let createdCount = 0;

  for (const row of data) {
    const email = row['Email'];
    const name = row['Lastname'];
    const rollSuffix = row['Firstname']; // e.g., 24102
    
    if (!email || !name) continue;

    // Use full roll number extracted from email (e.g., ch.sc.u4cse24102)
    const rollNumber = String(email).split('@')[0].toUpperCase();
    
    // Using the 'Firstname' column (e.g. 24102) as password as requested
    const rawPassword = String(rollSuffix).trim(); 
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        name: name,
        rollNumber: rollNumber,
        departmentId: dept.id,
        sectionId: section.id,
        isEmailVerified: true, // Mark as verified to skip OTP
        approvalStatus: 'APPROVED'
      },
      create: {
        email,
        password: hashedPassword,
        name: name,
        role: 'STUDENT',
        rollNumber: rollNumber,
        departmentId: dept.id,
        sectionId: section.id,
        isEmailVerified: true, // Mark as verified to skip OTP
        approvalStatus: 'APPROVED'
      }
    });
    
    createdCount++;
  }

  console.log(`Successfully seeded/updated ${createdCount} students!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
