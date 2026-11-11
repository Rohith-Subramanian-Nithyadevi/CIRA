const { before, describe, it } = require('node:test');
const assert = require('node:assert/strict');
let policy;
before(() => { policy = require('../dist/utils/question-paper-policy'); });

describe('question paper policy', () => {
  it('validates marks, duplicate selections, limits and exact empty draft selections', () => {
    assert.deepEqual(policy.parsePaperQuestions([], true), []);
    assert.throws(() => policy.parsePaperQuestions([]), /at least one question/i);
    assert.throws(() => policy.parsePaperQuestions([{ questionId: 'q', marks: 1 }, { questionId: 'q', marks: 2 }]), /cannot appear twice/i);
    assert.throws(() => policy.parsePaperQuestions([{ questionId: 'q', marks: 0 }]), /marks must be greater than 0/i);
    assert.equal(policy.parsePaperQuestions([{ questionId: 'q', marks: 2.25 }])[0].marks, 2.25);
  });
  it('limits random pool by category and finalized opposite-category use unless explicitly included', () => {
    const where = policy.buildPaperQuestionPoolWhere('ASSIGNMENT', 'faculty', { includeReused: false });
    assert.deepEqual(where.AND.find((part) => part.category), { category: 'ASSIGNMENT' });
    assert.deepEqual(where.AND.find((part) => part.usages), { usages: { none: { category: { not: 'ASSIGNMENT' }, isFinalized: true } } });
    const include = policy.buildPaperQuestionPoolWhere('ASSIGNMENT', 'faculty', { includeReused: true });
    assert.equal(include.AND.some((part) => part.category), false);
    assert.equal(policy.hasOppositeCategoryReuse({ category: 'TEST_QUIZ', usages: [] }, 'ASSIGNMENT'), true);
  });
  it('randomizes without duplication and preserves all input questions', () => {
    const input = ['a', 'b', 'c'];
    const shuffled = policy.shuffleQuestions(input, () => 0);
    assert.deepEqual([...shuffled].sort(), input);
    assert.equal(new Set(shuffled).size, 3);
    assert.deepEqual(input, ['a', 'b', 'c']);
  });
});
