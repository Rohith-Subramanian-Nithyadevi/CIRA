const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { calculateRiskScore } = require('../dist/controllers/student-exam.controller');

describe('Anti-AI & Anti-Automation Integrity Risk Scoring', () => {
  it('returns LOW risk score for clean student telemetry', () => {
    const cleanReport = {
      violationCounts: {
        syntheticClicks: 0,
        zeroEntropyClicks: 0,
        fastAnswers: 0,
        copyAttempts: 0,
        tabSwitches: 0,
      },
    };

    assert.equal(calculateRiskScore(cleanReport), 'LOW');
    assert.equal(calculateRiskScore(null), 'LOW');
    assert.equal(calculateRiskScore({}), 'LOW');
  });

  it('returns MEDIUM risk score for moderate signals (e.g. fast answers or zero-entropy clicks)', () => {
    const moderateReport = {
      violationCounts: {
        syntheticClicks: 0,
        zeroEntropyClicks: 1, // 15 pts
        fastAnswers: 2,       // 20 pts -> 35 pts total
        copyAttempts: 0,
        tabSwitches: 0,
      },
    };

    assert.equal(calculateRiskScore(moderateReport), 'MEDIUM');
  });

  it('returns HIGH risk score for severe automation signals (e.g. synthetic clicks or combined violations)', () => {
    const automatedReport = {
      violationCounts: {
        syntheticClicks: 2, // 70 pts -> HIGH
        zeroEntropyClicks: 0,
        fastAnswers: 0,
        copyAttempts: 0,
        tabSwitches: 0,
      },
    };

    assert.equal(calculateRiskScore(automatedReport), 'HIGH');

    const multiViolationReport = {
      violationCounts: {
        syntheticClicks: 0,
        zeroEntropyClicks: 2, // 30 pts
        fastAnswers: 1,       // 0 pts
        copyAttempts: 1,      // 10 pts
        tabSwitches: 1,       // 20 pts -> 60 pts total
      },
    };

    assert.equal(calculateRiskScore(multiViolationReport), 'HIGH');
  });
});
