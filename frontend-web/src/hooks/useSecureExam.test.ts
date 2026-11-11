import { renderHook, act } from '@testing-library/react';
import { useSecureExam } from './useSecureExam';

describe('useSecureExam Hook - Zero Tolerance Screen Blackout & Privacy Protection', () => {
  let mockBlackoutEl: HTMLDivElement;
  let mockContentEl: HTMLDivElement;

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.className = '';

    mockBlackoutEl = document.createElement('div');
    mockBlackoutEl.id = 'quiz-secure-blackout';
    mockBlackoutEl.style.display = 'none';
    document.body.appendChild(mockBlackoutEl);

    mockContentEl = document.createElement('div');
    mockContentEl.id = 'quiz-secure-content';
    mockContentEl.style.visibility = 'visible';
    document.body.appendChild(mockContentEl);

    jest.spyOn(document, 'hasFocus').mockReturnValue(true);

    Object.defineProperty(document, 'fullscreenElement', {
      writable: true,
      configurable: true,
      value: document.documentElement,
    });
    Object.defineProperty(document, 'hidden', {
      writable: true,
      configurable: true,
      value: false,
    });
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    mockBlackoutEl.remove();
    mockContentEl.remove();
    jest.restoreAllMocks();
  });

  it('initializes in secure exam mode with zero tolerance default (maxViolations = 1)', () => {
    const { result } = renderHook(() => useSecureExam({ isActive: true }));

    expect(result.current.isBlackedOut).toBe(false);
    expect(result.current.violationCount).toBe(0);
    expect(result.current.maxViolations).toBe(1);
    expect(result.current.isTerminated).toBe(false);
    expect(document.body.classList.contains('quiz-active-exam')).toBe(true);
    expect(document.body.classList.contains('quiz-blackout-active')).toBe(false);
  });

  it('immediately triggers pure black screen and instant termination on window blur (opening another window)', () => {
    const onViolation = jest.fn();
    const { result } = renderHook(() => useSecureExam({ isActive: true, onViolation }));

    act(() => {
      window.dispatchEvent(new FocusEvent('blur'));
    });

    expect(result.current.isBlackedOut).toBe(true);
    expect(result.current.isTerminated).toBe(true);
    expect(result.current.violationCount).toBe(1);
    expect(document.body.classList.contains('quiz-blackout-active')).toBe(true);
    expect(mockBlackoutEl.style.display).toBe('flex');
    expect(mockContentEl.style.visibility).toBe('hidden');
    expect(onViolation).toHaveBeenCalledWith(
      expect.stringContaining('Window lost focus'),
      1
    );
  });

  it('immediately blacks out screen and terminates on browser tab hide (visibilitychange)', () => {
    const onViolation = jest.fn();
    const { result } = renderHook(() => useSecureExam({ isActive: true, onViolation }));

    act(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.isBlackedOut).toBe(true);
    expect(result.current.isTerminated).toBe(true);
    expect(onViolation).toHaveBeenCalledWith(
      expect.stringContaining('Tab switched or browser minimized'),
      1
    );
  });

  it('immediately blacks out screen and terminates on fullscreen exit', () => {
    const onViolation = jest.fn();
    const { result } = renderHook(() => useSecureExam({ isActive: true, onViolation }));

    act(() => {
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    expect(result.current.isBlackedOut).toBe(true);
    expect(result.current.isTerminated).toBe(true);
    expect(onViolation).toHaveBeenCalledWith(
      expect.stringContaining('Exited fullscreen mode'),
      1
    );
  });

  it('detects PrintScreen and screen capture shortcuts, blacking out and terminating instantly', () => {
    const onViolation = jest.fn();
    const { result } = renderHook(() => useSecureExam({ isActive: true, onViolation }));

    const prtScnEvent = new KeyboardEvent('keydown', { key: 'PrintScreen', bubbles: true, cancelable: true });
    act(() => {
      window.dispatchEvent(prtScnEvent);
    });

    expect(prtScnEvent.defaultPrevented).toBe(true);
    expect(result.current.isBlackedOut).toBe(true);
    expect(result.current.isTerminated).toBe(true);
    expect(onViolation).toHaveBeenCalledWith(
      expect.stringContaining('Screenshot or screen capture attempted'),
      1
    );
  });

  it('detects unauthorized keys (e.g. Alt, Ctrl, Win) and immediately terminates', () => {
    const onViolation = jest.fn();
    const { result } = renderHook(() => useSecureExam({ isActive: true, onViolation }));

    const altEvent = new KeyboardEvent('keydown', { key: 'Alt', altKey: true, bubbles: true, cancelable: true });
    act(() => {
      window.dispatchEvent(altEvent);
    });

    expect(altEvent.defaultPrevented).toBe(true);
    expect(result.current.isBlackedOut).toBe(true);
    expect(result.current.isTerminated).toBe(true);
    expect(onViolation).toHaveBeenCalledWith(
      expect.stringContaining('Blocked key pressed'),
      1
    );
  });

  it('allows whitelisted typing keys without triggering blackout or termination', () => {
    const onViolation = jest.fn();
    const { result } = renderHook(() => useSecureExam({ isActive: true, onViolation }));

    const allowedKeys = ['a', 'Z', '5', ' ', '.', 'Backspace', 'Enter'];
    for (const key of allowedKeys) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      act(() => {
        window.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(false);
    }

    expect(result.current.isBlackedOut).toBe(false);
    expect(result.current.isTerminated).toBe(false);
    expect(onViolation).not.toHaveBeenCalled();
  });

  it('cleans up event listeners and body classes when unmounted', () => {
    const { unmount } = renderHook(() => useSecureExam({ isActive: true }));
    expect(document.body.classList.contains('quiz-active-exam')).toBe(true);

    act(() => {
      unmount();
    });

    expect(document.body.classList.contains('quiz-active-exam')).toBe(false);
    expect(document.body.classList.contains('quiz-blackout-active')).toBe(false);
  });
});
