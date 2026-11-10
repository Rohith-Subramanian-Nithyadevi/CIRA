const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function fix() {
  // Check all users with FACULTY role
  const facultyUsers = await prisma.user.findMany({
    where: { role: 'FACULTY' },
    select: { id: true, email: true, name: true, approvalStatus: true, isEmailVerified: true }
  });
  console.log('All FACULTY users:', JSON.stringify(facultyUsers, null, 2));
  
  // Generate a proper hash
  const hash = await bcrypt.hash('Test@1234', 10);
  
  // Create a clean mock faculty if it doesn't exist
  const existing = await prisma.user.findUnique({ where: { email: 'mockfaculty@cira.edu' } });
  
  if (!existing) {
    // Find the batch and department already created by the seed
    const dept = await prisma.department.findFirst({ where: { name: 'Computer Science' } });
    
    const newFaculty = await prisma.user.create({
      data: {
        email: 'mockfaculty@cira.edu',
        name: 'Prof. John Doe',
        password: hash,
        role: 'FACULTY',
        isEmailVerified: true,
        approvalStatus: 'APPROVED',
        employeeId: 'EMP001',
        subject: 'Data Structures'
      }
    });
    console.log('Created mock faculty:', newFaculty.email);
    
    // Map to department
    if (dept) {
      await prisma.facultyDepartment.upsert({
        where: { userId_departmentId: { userId: newFaculty.id, departmentId: dept.id } },
        update: {},
        create: { userId: newFaculty.id, departmentId: dept.id }
      });
      
      // Map to sections too
      const sections = await prisma.section.findMany({ where: { departmentId: dept.id } });
      for (const s of sections) {
        await prisma.facultySection.upsert({
          where: { userId_sectionId: { userId: newFaculty.id, sectionId: s.id } },
          update: {},
          create: { userId: newFaculty.id, sectionId: s.id }
        });
      }
      console.log('Faculty mapped to', sections.length, 'sections in dept:', dept.name);
    }
  } else {
    // Just fix the password
    await prisma.user.update({
      where: { id: existing.id },
      data: { password: hash, isEmailVerified: true, approvalStatus: 'APPROVED' }
    });
    console.log('Updated existing mock faculty password');
  }
  
  console.log('\n✅ Login credentials:');
  console.log('   Email:    mockfaculty@cira.edu');
  console.log('   Password: Test@1234');
  
  await prisma.$disconnect();
}

fix().catch(e => { console.error(e); prisma.$disconnect(); });
