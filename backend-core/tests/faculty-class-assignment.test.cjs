const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { enrollDepartment, unenrollDepartment, unenrollSection } = require('../dist/controllers/faculty.controller');
const { assignFacultyClasses } = require('../dist/controllers/admin.controller');
const { prisma } = require('../dist/config/prisma');

describe('faculty class assignment control and self-enrollment guards', () => {
  it('blocks faculty from self-enrolling with 403 Forbidden', async () => {
    let statusCode = 0;
    let responseBody = null;

    const req = {
      user: { userId: 'fac-1', role: 'FACULTY' },
      body: { departmentId: 'dept-1' }
    };
    const res = {
      status(code) {
        statusCode = code;
        return {
          json(body) {
            responseBody = body;
          }
        };
      }
    };
    const next = () => {};

    await enrollDepartment(req, res, next);
    assert.equal(statusCode, 403);
    assert.equal(responseBody.status, 'error');
    assert.match(responseBody.message, /disabled/i);
  });

  it('blocks faculty from unenrolling department or section with 403 Forbidden', async () => {
    let deptStatus = 0;
    let deptBody = null;
    let secStatus = 0;
    let secBody = null;

    const resDept = {
      status(code) {
        deptStatus = code;
        return { json(b) { deptBody = b; } };
      }
    };
    const resSec = {
      status(code) {
        secStatus = code;
        return { json(b) { secBody = b; } };
      }
    };

    await unenrollDepartment({ user: { userId: 'fac-1', role: 'FACULTY' }, params: { departmentId: 'd-1' } }, resDept, () => {});
    assert.equal(deptStatus, 403);
    assert.match(deptBody.message, /disabled/i);

    await unenrollSection({ user: { userId: 'fac-1', role: 'FACULTY' }, params: { sectionId: 's-1' } }, resSec, () => {});
    assert.equal(secStatus, 403);
    assert.match(secBody.message, /disabled/i);
  });

  it('assignFacultyClasses updates faculty class assignments atomically in Prisma', async () => {
    const originalFindUnique = prisma.user.findUnique;
    const originalTransaction = prisma.$transaction;

    try {
      let deletedDepts = false;
      let deletedSections = false;
      let createdDepts = [];
      let createdSections = [];

      prisma.user.findUnique = async ({ where }) => {
        if (where.id === 'fac-100') {
          return {
            id: 'fac-100',
            name: 'Prof. Test',
            email: 'test@amrita.edu',
            role: 'FACULTY',
            mappedDepartments: createdDepts.map(d => ({ department: { id: d.departmentId, name: 'CSE' } })),
            mappedSections: createdSections.map(s => ({ section: { id: s.sectionId, name: 'A' } }))
          };
        }
        return null;
      };

      prisma.$transaction = async (callback) => {
        const tx = {
          facultyDepartment: {
            deleteMany: async () => { deletedDepts = true; },
            createMany: async ({ data }) => { createdDepts = data; }
          },
          facultySection: {
            deleteMany: async () => { deletedSections = true; },
            createMany: async ({ data }) => { createdSections = data; }
          }
        };
        return callback(tx);
      };

      let statusCode = 0;
      let responseBody = null;
      const req = {
        params: { facultyId: 'fac-100' },
        body: { departmentIds: ['dept-10'], sectionIds: ['sec-20', 'sec-21'] }
      };
      const res = {
        status(code) {
          statusCode = code;
          return { json(b) { responseBody = b; } };
        }
      };

      await assignFacultyClasses(req, res, () => {});

      assert.equal(statusCode, 200);
      assert.equal(responseBody.status, 'success');
      assert.equal(deletedDepts, true);
      assert.equal(deletedSections, true);
      assert.equal(createdDepts.length, 1);
      assert.equal(createdSections.length, 2);
      assert.equal(responseBody.data.faculty.id, 'fac-100');
    } finally {
      prisma.user.findUnique = originalFindUnique;
      prisma.$transaction = originalTransaction;
    }
  });
});
