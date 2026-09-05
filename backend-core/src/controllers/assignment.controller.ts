import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Create an assignment and automatically assign to all applicable users
export const createAssignment = async (req: Request, res: Response) => {
  try {
    const facultyId = (req as any).user.id;
    const { title, description, targetBatches, targetDepartments, targetSections } = req.body;

    const assignment = await prisma.assignment.create({
      data: {
        title,
        description,
        createdBy: facultyId,
        targetBatches: {
          create: targetBatches?.map((b: string) => ({ batchId: b })) || []
        },
        targetDepartments: {
          create: targetDepartments?.map((d: string) => ({ departmentId: d })) || []
        },
        targetSections: {
          create: targetSections?.map((s: string) => ({ sectionId: s })) || []
        }
      }
    });

    // Optionally: assign directly to students matching the hierarchy, 
    // or evaluate on the fly when students fetch assignments.
    // Creating AssignmentStudent records for fast querying:
    let usersQuery: any = { AND: [] };
    
    if (targetBatches?.length > 0 || targetDepartments?.length > 0 || targetSections?.length > 0) {
      if (targetBatches?.length > 0) {
        usersQuery.AND.push({
          department: { batchId: { in: targetBatches } }
        });
      }
      if (targetDepartments?.length > 0) {
        usersQuery.AND.push({
          departmentId: { in: targetDepartments }
        });
      }
      if (targetSections?.length > 0) {
        usersQuery.AND.push({
          sectionId: { in: targetSections }
        });
      }

      const users = await prisma.user.findMany({
        where: { ...usersQuery, role: 'STUDENT' },
        select: { id: true }
      });

      if (users.length > 0) {
        await prisma.assignmentStudent.createMany({
          data: users.map(u => ({ assignmentId: assignment.id, userId: u.id }))
        });
      }
    }

    res.json({ success: true, data: assignment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get assignments for student
export const getStudentAssignments = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    // We check AssignmentStudent and left join with AssignmentSubmission
    const assignments = await prisma.assignmentStudent.findMany({
      where: { userId },
      include: {
        assignment: {
          include: {
            submissions: {
              where: { userId }
            }
          }
        }
      },
      orderBy: { assignment: { createdAt: 'desc' } }
    });

    const mapped = assignments.map(a => ({
      ...a.assignment,
      submitted: a.assignment.submissions.length > 0,
      submission: a.assignment.submissions[0] || null
    }));

    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get faculty's created assignments
export const getFacultyAssignments = async (req: Request, res: Response) => {
  try {
    const facultyId = (req as any).user.id;
    const assignments = await prisma.assignment.findMany({
      where: { createdBy: facultyId },
      include: {
        targetBatches: true,
        targetDepartments: true,
        targetSections: true,
        _count: {
          select: { submissions: true, targetStudents: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteAssignment = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const facultyId = (req as any).user.id;
    
    const existing = await prisma.assignment.findUnique({ where: { id } });
    if (!existing || existing.createdBy !== facultyId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await prisma.assignment.delete({ where: { id } });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
