import { prisma } from '../config/prisma';

export interface FacultyClassScope {
  id: string;
  type: 'department' | 'section';
  departmentId: string;
  batchId: string;
}

export interface FacultyScope {
  facultyId: string;
  departmentIds: string[];
  sectionIds: string[];
  classes: FacultyClassScope[];
  studentIds: string[];
}

type ScopeClient = Pick<typeof prisma, 'facultyDepartment' | 'facultySection' | 'user'>;

export const getFacultyScope = async (
  facultyId: string,
  db: ScopeClient = prisma,
): Promise<FacultyScope> => {
  const [departments, sections] = await Promise.all([
    db.facultyDepartment.findMany({
      where: { userId: facultyId },
      select: { department: { select: { id: true, batchId: true } } },
    }),
    db.facultySection.findMany({
      where: { userId: facultyId },
      select: { section: { select: { id: true, departmentId: true, department: { select: { batchId: true } } } } },
    }),
  ]);

  const departmentIds = departments.map((mapping) => mapping.department.id);
  const sectionIds = sections.map((mapping) => mapping.section.id);
  const classes: FacultyClassScope[] = [
    ...departments.map((mapping) => ({
      id: mapping.department.id,
      type: 'department' as const,
      departmentId: mapping.department.id,
      batchId: mapping.department.batchId,
    })),
    ...sections.map((mapping) => ({
      id: mapping.section.id,
      type: 'section' as const,
      departmentId: mapping.section.departmentId,
      batchId: mapping.section.department.batchId,
    })),
  ];

  const targetClauses = [
    ...(departmentIds.length ? [{ departmentId: { in: departmentIds } }] : []),
    ...(sectionIds.length ? [{ sectionId: { in: sectionIds } }] : []),
  ];
  const students = targetClauses.length
    ? await db.user.findMany({
        where: { role: 'STUDENT', OR: targetClauses },
        select: { id: true },
      })
    : [];

  return {
    facultyId,
    departmentIds,
    sectionIds,
    classes,
    studentIds: students.map((student) => student.id),
  };
};
