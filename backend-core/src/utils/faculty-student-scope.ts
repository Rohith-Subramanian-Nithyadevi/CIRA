import { FacultyScope } from '../services/faculty-scope.service';

export interface StudentScopeFilters {
  year?: number;
  departmentId?: string;
  sectionId?: string;
  batchId?: string;
  search?: string;
}

export const buildFacultyStudentWhere = (
  scope: FacultyScope | undefined,
  filters: StudentScopeFilters = {},
  isAdmin = false,
) => {
  const and: any[] = [{ role: 'STUDENT' }];
  if (!isAdmin) and.push({ id: { in: scope?.studentIds || [] } });
  if (filters.year !== undefined) and.push({ department: { batch: { startYear: filters.year } } });
  if (filters.departmentId) and.push({ departmentId: filters.departmentId });
  if (filters.sectionId) and.push({ sectionId: filters.sectionId });
  if (filters.batchId) and.push({ department: { batchId: filters.batchId } });
  if (filters.search?.trim()) {
    const search = filters.search.trim();
    and.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { rollNumber: { contains: search, mode: 'insensitive' } },
      ],
    });
  }
  return { AND: and };
};
