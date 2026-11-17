const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeViolationMetadata } = require('../dist/controllers/student-exam.controller.js');

test('sanitizeViolationMetadata preserves bounded shortcutEvidence and strips untrusted fields', () => {
  const sanitized = sanitizeViolationMetadata({
    visibilityState: 'hidden',
    untrustedAdminFlag: true,
    shortcutEvidence: {
      triggeringEvent: 'keydown',
      captureReason: 'FOCUS_LOST',
      detectedSequence: 'Alt + Tab',
      summary: 'Shortcut sequence followed by focus/visibility loss',
      evidenceQuality: 'COMPLETE',
      focusLost: true,
      visibilityHidden: false,
      captureStartedAt: '2026-11-12T10:24:31.120Z',
      captureEndedAt: '2026-11-12T10:24:31.210Z',
      captureDurationMs: 90,
      events: [
        {
          eventType: 'keydown',
          key: 'Alt',
          code: 'AltLeft',
          modifiers: { ctrl: false, alt: true, shift: false, meta: false },
          timestamp: '2026-11-12T10:24:31.120Z',
          relativeMs: 0,
          rawTypedText: 'secret answer',
        },
        {
          eventType: 'keydown',
          key: 'Tab',
          code: 'Tab',
          modifiers: { ctrl: false, alt: true, shift: false, meta: false },
          timestamp: '2026-11-12T10:24:31.185Z',
          relativeMs: 65,
        },
        {
          eventType: 'blur',
          modifiers: { ctrl: false, alt: false, shift: false, meta: false },
          timestamp: '2026-11-12T10:24:31.210Z',
          relativeMs: 90,
        },
      ],
    },
  });

  assert.equal('untrustedAdminFlag' in sanitized, false);
  assert.equal(sanitized.visibilityState, 'hidden');
  assert.equal(sanitized.shortcutEvidence.detectedSequence, 'Alt + Tab');
  assert.equal(sanitized.shortcutEvidence.captureDurationMs, 90);
  assert.equal(sanitized.shortcutEvidence.events.length, 3);
  assert.equal('rawTypedText' in sanitized.shortcutEvidence.events[0], false);
});

