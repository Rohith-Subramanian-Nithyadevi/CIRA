import { act, renderHook } from '@testing-library/react';
import { useSecureExam } from './useSecureExam';

describe('useSecureExam', () => {
  let fsElement: Element | null = null;
  let visibilityStateValue: DocumentVisibilityState = 'visible';
  let hasFocusValue = true;

  beforeEach(() => {
    fsElement = null;
    visibilityStateValue = 'visible';
    hasFocusValue = true;

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fsElement,
    });
    Object.defineProperty(document, 'fullscreenEnabled', {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityStateValue,
    });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => visibilityStateValue === 'hidden',
    });
    document.hasFocus = jest.fn(() => hasFocusValue);

    document.documentElement.requestFullscreen = jest.fn(async () => {
      fsElement = document.documentElement;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('activates fullscreen via user gesture and reports denial/unsupported gracefully', async () => {
    const { result } = renderHook(() => useSecureExam({ isActive: false }));

    const okRes = await act(async () => result.current.enterFullscreen());
    expect(okRes).toEqual({ ok: true });
    expect(result.current.isFullscreen).toBe(true);

    // Denial case
    fsElement = null;
    document.documentElement.requestFullscreen = jest.fn(async () => {
      throw new Error('Permission denied');
    });
    const deniedRes = await act(async () => result.current.enterFullscreen());
    expect(deniedRes.ok).toBe(false);
    expect(deniedRes.error).toMatch(/denied/i);
  });

  it('triggers black screen & deduplicates visibilitychange + blur firing together, then recovers when checks pass', async () => {
    fsElement = document.documentElement;
    const onViolation = jest.fn();

    const { result } = renderHook(() =>
      useSecureExam({ isActive: true, onViolation, dedupeWindowMs: 1500 })
    );

    expect(result.current.isBlackScreen).toBe(false);

    // Simulate blur + visibilitychange hidden firing together (tab switch / minimize / app switch)
    act(() => {
      hasFocusValue = false;
      window.dispatchEvent(new Event('blur'));
      visibilityStateValue = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.isBlackScreen).toBe(true);
    expect(onViolation).toHaveBeenCalledTimes(1);
    expect(onViolation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'WINDOW_BLUR',
      })
    );

    // Student returns: visible + focused + fullscreen still active -> recovers
    act(() => {
      visibilityStateValue = 'visible';
      hasFocusValue = true;
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current.isBlackScreen).toBe(false);
  });

  it('detects fullscreen exit, keeps black screen until explicit re-entry, and cleans up listeners', async () => {
    fsElement = document.documentElement;
    const onViolation = jest.fn();

    const { result, unmount } = renderHook(() =>
      useSecureExam({ isActive: true, onViolation, dedupeWindowMs: 1500 })
    );

    // Exit fullscreen (e.g. Escape key)
    act(() => {
      fsElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    expect(result.current.isFullscreen).toBe(false);
    expect(result.current.isBlackScreen).toBe(true);
    expect(onViolation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FULLSCREEN_EXIT',
      })
    );

    // Focus alone must NOT restore quiz if still out of fullscreen
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current.isBlackScreen).toBe(true);

    // Explicit user-gesture re-entry restores quiz
    await act(async () => {
      await result.current.enterFullscreen();
    });
    expect(result.current.isFullscreen).toBe(true);
    expect(result.current.isBlackScreen).toBe(false);

    // Unmount cleans up listeners so further events do not fire
    unmount();
    act(() => {
      visibilityStateValue = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(onViolation).toHaveBeenCalledTimes(1);
  });

  it('captures Alt + Tab + blur sequence accurately without duplicating visibilitychange', () => {
    jest.useFakeTimers();
    fsElement = document.documentElement;
    const onViolation = jest.fn();

    const { result } = renderHook(() =>
      useSecureExam({ isActive: true, onViolation, dedupeWindowMs: 1500, captureWindowMs: 1200 })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', code: 'AltLeft', altKey: true, bubbles: true }));
    });
    expect(result.current.isBlackScreen).toBe(true);
    expect(onViolation).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(65);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', altKey: true, bubbles: true }));
    });

    act(() => {
      jest.advanceTimersByTime(25);
      hasFocusValue = false;
      window.dispatchEvent(new Event('blur'));
      visibilityStateValue = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(onViolation).toHaveBeenCalledTimes(1);
    const payload = onViolation.mock.calls[0][0];
    expect(payload.type).toBe('WINDOW_BLUR');
    const evidence = payload.metadata.shortcutEvidence;
    expect(evidence.detectedSequence).toBe('Alt + Tab');
    expect(evidence.evidenceQuality).toBe('COMPLETE');
    expect(evidence.focusLost).toBe(true);
    expect(evidence.captureDurationMs).toBe(90);
    expect(evidence.events.map((e: any) => `${e.eventType}:${e.key || ''}`)).toEqual([
      'keydown:Alt',
      'keydown:Tab',
      'blur:',
    ]);

    jest.useRealTimers();
  });

  it('captures Ctrl + Tab and blocked F12 key without capturing ordinary typed answer text', () => {
    jest.useFakeTimers();
    fsElement = document.documentElement;
    const onViolation = jest.fn();

    renderHook(() =>
      useSecureExam({ isActive: true, onViolation, dedupeWindowMs: 1500, captureWindowMs: 1200 })
    );

    // Ordinary answer typing must NEVER trigger a violation or enter the shortcut buffer
    act(() => {
      for (const ch of ['h', 'e', 'l', 'l', 'o', ' ', '1', 'Backspace']) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
      }
    });
    expect(onViolation).not.toHaveBeenCalled();

    // Blur alone after normal typing -> partial evidence, zero keyboard events, no typed text
    act(() => {
      hasFocusValue = false;
      window.dispatchEvent(new Event('blur'));
    });

    expect(onViolation).toHaveBeenCalledTimes(1);
    const blurEvidence = onViolation.mock.calls[0][0].metadata.shortcutEvidence;
    expect(blurEvidence.detectedSequence).toBeNull();
    expect(blurEvidence.evidenceQuality).toBe('PARTIAL');
    expect(blurEvidence.summary).toBe('Possible application switch – shortcut events partially observed');
    expect(blurEvidence.events.every((e: any) => e.eventType === 'blur')).toBe(true);

    // Advance past dedupe window and test Ctrl + Tab
    act(() => {
      jest.advanceTimersByTime(1600);
      hasFocusValue = true;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', ctrlKey: true, bubbles: true }));
      jest.advanceTimersByTime(300);
    });

    expect(onViolation).toHaveBeenCalledTimes(2);
    const ctrlTabEvidence = onViolation.mock.calls[1][0].metadata.shortcutEvidence;
    expect(ctrlTabEvidence.detectedSequence).toBe('Ctrl + Tab');
    expect(ctrlTabEvidence.evidenceQuality).toBe('COMPLETE');

    // Advance past dedupe window and test F12 blocked key
    act(() => {
      jest.advanceTimersByTime(1600);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12', code: 'F12', bubbles: true }));
    });

    expect(onViolation).toHaveBeenCalledTimes(3);
    expect(onViolation.mock.calls[2][0].type).toBe('BLOCKED_KEY');
    expect(onViolation.mock.calls[2][0].metadata.shortcutEvidence.detectedSequence).toBe('F12');

    jest.useRealTimers();
  });

  it('flushes pending shortcut capture safely on unmount without duplicate violations', () => {
    jest.useFakeTimers();
    fsElement = document.documentElement;
    const onViolation = jest.fn();

    const { unmount } = renderHook(() =>
      useSecureExam({ isActive: true, onViolation, dedupeWindowMs: 1500, captureWindowMs: 1200 })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', code: 'AltLeft', altKey: true, bubbles: true }));
    });
    expect(onViolation).not.toHaveBeenCalled();

    unmount();
    expect(onViolation).toHaveBeenCalledTimes(1);
    expect(onViolation.mock.calls[0][0].metadata.shortcutEvidence.detectedSequence).toBe('Alt');

    jest.runAllTimers();
    expect(onViolation).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});

