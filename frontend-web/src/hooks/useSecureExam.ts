import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export interface UseSecureExamProps {
  onViolation?: (reason: string, violationCount?: number) => void;
  maxViolations?: number;
  isActive?: boolean;
}

// Keys that are ALLOWED during the exam for typing answers.
// Everything else = instant violation + auto-submit.
const ALLOWED_KEYS = new Set([
  // Letters
  'a','b','c','d','e','f','g','h','i','j','k','l','m',
  'n','o','p','q','r','s','t','u','v','w','x','y','z',
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  // Digits
  '0','1','2','3','4','5','6','7','8','9',
  // Punctuation allowed for answers
  '.',',','-','\'','"','!','?',':',';','(',')','/','@','#','&','+','=',
  // Whitespace & editing
  ' ',           // Space
  'Backspace',   // Delete typed text
  'Delete',      // Forward delete
  'Enter',       // New line (for long written answers)
  // Modifiers
  'Shift',
  'CapsLock',
  // Navigation within text fields
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End',
  // Tab for accessibility within the exam UI
  'Tab',
]);

/**
 * Synchronous DOM-level blackout manipulation to ensure 0ms latency
 * and prevent any brief screen flash before React state reconciliation.
 */
export const applyImmediateBlackout = () => {
  if (typeof document !== 'undefined') {
    document.body.classList.add('quiz-blackout-active');
    const blackoutEl = document.getElementById('quiz-secure-blackout');
    if (blackoutEl) {
      blackoutEl.style.display = 'flex';
    }
    const contentEl = document.getElementById('quiz-secure-content');
    if (contentEl) {
      contentEl.style.visibility = 'hidden';
      contentEl.style.pointerEvents = 'none';
      contentEl.style.userSelect = 'none';
    }
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText('');
      }
    } catch (_) {}
  }
};

export const removeImmediateBlackout = () => {
  if (typeof document !== 'undefined') {
    document.body.classList.remove('quiz-blackout-active');
    const blackoutEl = document.getElementById('quiz-secure-blackout');
    if (blackoutEl) {
      blackoutEl.style.display = 'none';
    }
    const contentEl = document.getElementById('quiz-secure-content');
    if (contentEl) {
      contentEl.style.visibility = 'visible';
      contentEl.style.pointerEvents = 'auto';
      contentEl.style.userSelect = 'auto';
    }
  }
};

/**
 * Native platform hooks for Android / iOS wrappers if available.
 */
const triggerNativeSecurity = (enable: boolean) => {
  try {
    if (typeof window !== 'undefined') {
      const win = window as any;
      if (win.AndroidSecureBridge?.setSecureFlag) {
        win.AndroidSecureBridge.setSecureFlag(enable);
      }
      if (win.Capacitor?.Plugins?.PrivacyScreen) {
        if (enable) win.Capacitor.Plugins.PrivacyScreen.enable();
        else win.Capacitor.Plugins.PrivacyScreen.disable();
      }
      if (win.webkit?.messageHandlers?.secureExam) {
        win.webkit.messageHandlers.secureExam.postMessage({ secure: enable });
      }
    }
  } catch (err) {
    console.warn('Native security bridge call error:', err);
  }
};

export function useSecureExam({
  onViolation,
  maxViolations = 1,
  isActive = true,
}: UseSecureExamProps = {}) {
  const [violationCount, setViolationCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBlackedOut, setIsBlackedOut] = useState(false);
  const [blackoutReason, setBlackoutReason] = useState<string | null>(null);
  const [isTerminated, setIsTerminated] = useState(false);

  const hasViolatedRef = useRef(false);
  const isTerminatedRef = useRef(false);

  // Synchronous blackout trigger
  const triggerBlackout = useCallback((reason: string) => {
    applyImmediateBlackout();
    setIsBlackedOut(true);
    setBlackoutReason(reason);
  }, []);

  // Zero-Tolerance Violation Trigger: One strike = instant pure blackout + auto-submit
  const triggerViolation = useCallback((reason: string) => {
    if (hasViolatedRef.current) return;
    hasViolatedRef.current = true;
    isTerminatedRef.current = true;

    applyImmediateBlackout();
    setIsBlackedOut(true);
    setBlackoutReason(reason);
    setIsTerminated(true);
    setViolationCount(1);

    console.error(`SECURITY VIOLATION (ZERO TOLERANCE): ${reason}`);
    toast.error(`Security Violation: ${reason}. Your exam is being auto-submitted.`);

    if (onViolation) {
      onViolation(reason, 1);
    }
  }, [onViolation]);

  const enterFullscreen = useCallback(async () => {
    try {
      const elem = document.documentElement as any;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      setIsFullscreen(Boolean(document.fullscreenElement));
    } catch (error) {
      console.warn('Failed to enter fullscreen mode:', error);
      setIsFullscreen(Boolean(document.fullscreenElement));
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    document.body.classList.add('quiz-active-exam');
    triggerNativeSecurity(true);

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
        return ` [Recent key: ${lastKeyCombo}]`;
      }
      return '';
    };

    // ===================================================================
    // 1. KEYBOARD INTERCEPTION (Screenshot detection & Whitelist)
    // ===================================================================
    const handleKeyDown = (e: KeyboardEvent) => {
      const combo = buildKeyCombo(e);
      lastKeyCombo = combo;
      lastKeyTime = Date.now();

      // Detect screenshot shortcuts
      const isScreenshotKey =
        e.key === 'PrintScreen' ||
        e.key === 'PrtScn' ||
        e.key === 'Print' ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) ||
        (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) ||
        ((e.metaKey || e.altKey) && (e.key === 'r' || e.key === 'R')) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P'));

      if (isScreenshotKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        triggerViolation(`Screenshot or screen capture attempted (${combo})`);
        return;
      }

      if (ALLOWED_KEYS.has(e.key)) {
        // Allowed key — let it through
        return;
      }

      // Blocked key: instant violation + exit
      e.preventDefault();
      e.stopImmediatePropagation();
      triggerViolation(`Blocked key pressed: ${combo}`);
    };

    const handleKeyUpPress = (e: KeyboardEvent) => {
      if (!ALLOWED_KEYS.has(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener('keydown',  handleKeyDown,    true);
    window.addEventListener('keyup',    handleKeyUpPress, true);
    window.addEventListener('keypress', handleKeyUpPress, true);

    // ===================================================================
    // 2. CLIPBOARD LOCKDOWN
    // ===================================================================
    const nukeClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      triggerViolation('Clipboard operation attempted (copy/cut/paste)');
    };
    document.addEventListener('copy',  nukeClipboard, true);
    document.addEventListener('cut',   nukeClipboard, true);
    document.addEventListener('paste', nukeClipboard, true);

    // ===================================================================
    // 3. CONTEXT MENU LOCKDOWN
    // ===================================================================
    const nukeContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    document.addEventListener('contextmenu', nukeContextMenu, true);

    // ===================================================================
    // 4. TOUCH / GESTURE LOCKDOWN (Mobile multi-touch screenshots)
    // ===================================================================
    const nukeGestures = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener('wheel', nukeGestures, { capture: true, passive: false });

    const nukeTouchGestures = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
        e.stopImmediatePropagation();
        triggerViolation('Multi-touch screen capture gesture attempted');
      }
    };
    document.addEventListener('touchstart', nukeTouchGestures, { capture: true, passive: false });
    document.addEventListener('touchmove',  nukeTouchGestures, { capture: true, passive: false });

    // ===================================================================
    // 5. WINDOW BLUR (Another window opened, task switch, overlays)
    //    Directly triggers instant pure-black screen + auto-submit.
    // ===================================================================
    const handleBlur = (e: FocusEvent) => {
      // If focus was simply transferred between elements inside the same document, ignore
      if (e?.relatedTarget && document.contains(e.relatedTarget as Node)) {
        return;
      }
      triggerViolation(`Window lost focus (Another window opened, task switch, or overlay detected)${getRecentKeyContext()}`);
    };
    window.addEventListener('blur', handleBlur, true);

    // ===================================================================
    // 6. VISIBILITY CHANGE (Tab switch / App switcher preview)
    // ===================================================================
    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState !== 'visible') {
        triggerViolation(`Tab switched or browser minimized${getRecentKeyContext()}`);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange, true);

    // ===================================================================
    // 7. FULLSCREEN EXIT DETECTION
    // ===================================================================
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        triggerViolation('Exited fullscreen mode');
      } else {
        setIsFullscreen(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange, true);

    // ===================================================================
    // 8. MOBILE PAGE HIDE & FREEZE
    // ===================================================================
    const handlePageHide = () => {
      triggerViolation('Application sent to background / App switched');
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('freeze', handlePageHide);

    // ===================================================================
    // 9. ACTIVE FOCUS WATCHDOG (Catches external windows & overlays)
    // ===================================================================
    const focusWatchdog = setInterval(() => {
      if (hasViolatedRef.current) return;
      if (typeof document !== 'undefined') {
        if (!document.hasFocus() || document.hidden || document.visibilityState !== 'visible') {
          triggerViolation('Window lost focus / Another window opened');
        }
      }
    }, 200);

    // ===================================================================
    // 10. DRAG & DROP LOCKDOWN
    // ===================================================================
    const nukeDrag = (e: DragEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    document.addEventListener('dragstart', nukeDrag, true);
    document.addEventListener('drop',      nukeDrag, true);

    // ===================================================================
    // 11. BEFOREUNLOAD (Prevent accidental closure)
    // ===================================================================
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isTerminatedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Initial fullscreen check
    setIsFullscreen(!!document.fullscreenElement);

    return () => {
      clearInterval(focusWatchdog);
      document.body.classList.remove('quiz-active-exam');
      removeImmediateBlackout();
      triggerNativeSecurity(false);

      window.removeEventListener('keydown',  handleKeyDown,    true);
      window.removeEventListener('keyup',    handleKeyUpPress, true);
      window.removeEventListener('keypress', handleKeyUpPress, true);

      document.removeEventListener('copy',  nukeClipboard, true);
      document.removeEventListener('cut',   nukeClipboard, true);
      document.removeEventListener('paste', nukeClipboard, true);

      document.removeEventListener('contextmenu', nukeContextMenu, true);

      document.removeEventListener('wheel',      nukeGestures as EventListener);
      document.removeEventListener('touchstart',  nukeTouchGestures as EventListener);
      document.removeEventListener('touchmove',   nukeTouchGestures as EventListener);

      window.removeEventListener('blur', handleBlur, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange, true);
      document.removeEventListener('fullscreenchange', handleFullscreenChange, true);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('freeze', handlePageHide);

      document.removeEventListener('dragstart', nukeDrag, true);
      document.removeEventListener('drop',      nukeDrag, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isActive, triggerViolation]);

  return {
    violationCount,
    maxViolations,
    isFullscreen,
    isBlackedOut,
    blackoutReason,
    isTerminated,
    enterFullscreen,
    triggerBlackout,
    triggerViolation,
  };
}
