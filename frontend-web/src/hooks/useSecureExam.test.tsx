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
});

