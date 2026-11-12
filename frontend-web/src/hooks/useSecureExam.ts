import { useEffect, useState, useCallback, useRef } from 'react';

export type SecurityViolationType =
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'FULLSCREEN_EXIT'
  | 'BLOCKED_KEY'
  | 'CLIPBOARD';

export interface SecurityViolationEvent {
  type: SecurityViolationType;
  reason: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface FullscreenAttemptResult {
  ok: boolean;
  unsupported?: boolean;
  error?: string;
}

interface UseSecureExamProps {
  onViolation?: (event: SecurityViolationEvent) => void | Promise<void>;
  isActive?: boolean;
  dedupeWindowMs?: number;
}

// Keys that are ALLOWED during the exam for typing answers.
const ALLOWED_KEYS = new Set([
  'a','b','c','d','e','f','g','h','i','j','k','l','m',
  'n','o','p','q','r','s','t','u','v','w','x','y','z',
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  '0','1','2','3','4','5','6','7','8','9',
  '.',',','-','\'','"','!','?',':',';','(',')','/','@','#','&','+','=',
  ' ',
  'Backspace',
  'Delete',
  'Enter',
  'Shift',
  'CapsLock',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End',
  'Tab',
]);

export function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return (
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement ||
    null
  );
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as Document & {
    webkitFullscreenEnabled?: boolean;
    mozFullScreenEnabled?: boolean;
    msFullscreenEnabled?: boolean;
  };
  const elem = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    mozRequestFullScreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };
  const hasMethod = Boolean(
    elem &&
      (elem.requestFullscreen ||
        elem.webkitRequestFullscreen ||
        elem.mozRequestFullScreen ||
        elem.msRequestFullscreen)
  );
  const enabled =
    doc.fullscreenEnabled !== false &&
    doc.webkitFullscreenEnabled !== false &&
    doc.mozFullScreenEnabled !== false &&
    doc.msFullscreenEnabled !== false;
  return hasMethod && enabled;
}

export function useSecureExam({
  onViolation,
  isActive = true,
  dedupeWindowMs = 1500,
}: UseSecureExamProps = {}) {
  const [violationCount, setViolationCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(getFullscreenElement()));
  const [isBlackScreen, setIsBlackScreen] = useState(false);

  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const lastViolationAtRef = useRef<number>(0);

  const evaluateSecurityState = useCallback(() => {
    if (typeof document === 'undefined') return;
    const fsActive = Boolean(getFullscreenElement());
    const visible = document.visibilityState !== 'hidden' && !document.hidden;
    const focused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;

    setIsFullscreen(fsActive);
    if (fsActive && visible && focused) {
      setIsBlackScreen(false);
    } else {
      setIsBlackScreen(true);
    }
  }, []);

  const recordViolation = useCallback(
    (type: SecurityViolationType, reason: string, metadata?: Record<string, unknown>) => {
      // Immediately activate black screen regardless of deduplication
      setIsBlackScreen(true);

      const now = Date.now();
      if (now - lastViolationAtRef.current < dedupeWindowMs) {
        return;
      }
      lastViolationAtRef.current = now;

      setViolationCount((prev) => prev + 1);

      const event: SecurityViolationEvent = {
        type,
        reason,
        timestamp: new Date(now).toISOString(),
        metadata,
      };

      if (onViolationRef.current) {
        void onViolationRef.current(event);
      }
    },
    [dedupeWindowMs]
  );

  const enterFullscreen = useCallback(async (): Promise<FullscreenAttemptResult> => {
    if (!isFullscreenSupported()) {
      setIsFullscreen(false);
      return {
        ok: false,
        unsupported: true,
        error: 'Fullscreen mode is unavailable or unsupported in this browser. Please use a supported browser to take this quiz.',
      };
    }

    try {
      const elem = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
        mozRequestFullScreen?: () => Promise<void> | void;
        msRequestFullscreen?: () => Promise<void> | void;
      };

      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }

      const fsActive = Boolean(getFullscreenElement());
      setIsFullscreen(fsActive);

      if (!fsActive) {
        return {
          ok: false,
          error: 'Fullscreen activation was blocked or cancelled. Please allow fullscreen mode and retry.',
        };
      }

      const visible = document.visibilityState !== 'hidden' && !document.hidden;
      const focused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
      if (visible && focused) {
        setIsBlackScreen(false);
      }

      return { ok: true };
    } catch {
      setIsFullscreen(false);
      return {
        ok: false,
        error: 'Fullscreen permission was denied. Please allow fullscreen access and try again.',
      };
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      setIsBlackScreen(false);
      return;
    }

    let lastKeyCombo = '';
    let lastKeyTime = 0;

    const buildKeyCombo = (e: KeyboardEvent) => {
      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey && e.key !== 'Shift') parts.push('Shift');
      if (e.metaKey) parts.push('Win/Cmd');
      parts.push(e.key);
      return parts.join('+');
    };

    const getRecentKeyContext = () => {
      const timeSinceLastKey = Date.now() - lastKeyTime;
      if (timeSinceLastKey < 2000 && lastKeyCombo) {
        return { recentKey: lastKeyCombo };
      }
      return undefined;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const combo = buildKeyCombo(e);
      lastKeyCombo = combo;
      lastKeyTime = Date.now();

      if (ALLOWED_KEYS.has(e.key)) {
        return;
      }

      // Let Escape be handled by fullscreenchange (FULLSCREEN_EXIT) without double-counting
      if (e.key === 'Escape') {
        return;
      }

      e.preventDefault();
      e.stopImmediatePropagation();
      recordViolation('BLOCKED_KEY', `Blocked key pressed: ${combo}`, { key: combo });
    };

    const handleKeyUpPress = (e: KeyboardEvent) => {
      if (!ALLOWED_KEYS.has(e.key) && e.key !== 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const nukeClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      recordViolation('CLIPBOARD', `Clipboard operation attempted (${e.type})`, { action: e.type });
    };

    const nukeContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    const nukeGestures = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const nukeTouchGestures = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' || document.hidden) {
        recordViolation('TAB_SWITCH', 'Page became hidden (tab switch, minimize, or app switch)', {
          visibilityState: document.visibilityState,
          ...getRecentKeyContext(),
        });
      } else {
        evaluateSecurityState();
      }
    };

    const handleBlur = () => {
      recordViolation('WINDOW_BLUR', 'Window lost focus', {
        visibilityState: document.visibilityState,
        ...getRecentKeyContext(),
      });
    };

    const handleFocus = () => {
      evaluateSecurityState();
    };

    const handleFullscreenChange = () => {
      const fsActive = Boolean(getFullscreenElement());
      setIsFullscreen(fsActive);
      if (!fsActive) {
        recordViolation('FULLSCREEN_EXIT', 'Exited fullscreen mode', {
          visibilityState: document.visibilityState,
          ...getRecentKeyContext(),
        });
      } else {
        evaluateSecurityState();
      }
    };

    const nukeDrag = (e: DragEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUpPress, true);
    window.addEventListener('keypress', handleKeyUpPress, true);

    document.addEventListener('copy', nukeClipboard, true);
    document.addEventListener('cut', nukeClipboard, true);
    document.addEventListener('paste', nukeClipboard, true);
    document.addEventListener('contextmenu', nukeContextMenu, true);

    document.addEventListener('wheel', nukeGestures, { capture: true, passive: false });
    document.addEventListener('touchstart', nukeTouchGestures, { capture: true, passive: false });
    document.addEventListener('touchmove', nukeTouchGestures, { capture: true, passive: false });

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    document.addEventListener('dragstart', nukeDrag, true);
    document.addEventListener('drop', nukeDrag, true);

    // Initial check when exam becomes active
    evaluateSecurityState();

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUpPress, true);
      window.removeEventListener('keypress', handleKeyUpPress, true);

      document.removeEventListener('copy', nukeClipboard, true);
      document.removeEventListener('cut', nukeClipboard, true);
      document.removeEventListener('paste', nukeClipboard, true);
      document.removeEventListener('contextmenu', nukeContextMenu, true);

      document.removeEventListener('wheel', nukeGestures as EventListener, true);
      document.removeEventListener('touchstart', nukeTouchGestures as EventListener, true);
      document.removeEventListener('touchmove', nukeTouchGestures as EventListener, true);

      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);

      document.removeEventListener('dragstart', nukeDrag, true);
      document.removeEventListener('drop', nukeDrag, true);
    };
  }, [isActive, evaluateSecurityState, recordViolation]);

  return {
    violationCount,
    isFullscreen,
    isBlackScreen,
    fullscreenSupported: isFullscreenSupported(),
    enterFullscreen,
  };
}
