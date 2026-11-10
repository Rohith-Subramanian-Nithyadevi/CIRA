const { before, describe, it } = require('node:test');
const assert = require('node:assert/strict');
let validatePollInput;
before(() => { ({ validatePollInput } = require('../dist/controllers/announcement-poll.controller')); });

describe('poll input validation', () => {
  const valid = { question: 'Which session works?', options: ['Morning', 'Evening'], targetType: 'DEPARTMENT', targetId: 'dept-1', startsAt: '2026-11-10T09:00:00Z', expiresAt: '2026-11-11T09:00:00Z' };
  it('accepts a valid question, distinct options, audience and schedule', () => {
    const result = validatePollInput(valid);
    assert.deepEqual(result.options, ['Morning', 'Evening']);
    assert.equal(result.targetType, 'DEPARTMENT');
  });
  it('rejects missing or duplicate options, unsupported audience and invalid expiry', () => {
    assert.throws(() => validatePollInput({ ...valid, options: ['Only one'] }), /between 2 and 10 options/i);
    assert.throws(() => validatePollInput({ ...valid, options: ['Same', ' same '] }), /must be unique/i);
    assert.throws(() => validatePollInput({ ...valid, targetType: 'ALL' }), /Select a batch/i);
    assert.throws(() => validatePollInput({ ...valid, expiresAt: '2026-11-09T09:00:00Z' }), /expiry must be after/i);
  });
});
