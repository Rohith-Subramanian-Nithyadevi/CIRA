import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface UseSecureExamProps {
  onViolation?: (reason: string) => void;
  isActive?: boolean;
}

// Keys that are ALLOWED during the exam for typing answers.
// Everything else = instant violation + auto-submit.
const ALLOWED_KEYS = new Set([
  // Letters (e.key returns lowercase or uppercase depending on CapsLock/Shift)
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
  // Modifiers (they don't produce characters alone, allowed so Shift+letter works)
  'Shift',
  'CapsLock',
  // Navigation within text fields
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End',
  // Tab for accessibility within the exam UI (navigating between buttons)
  'Tab',
]);

export function useSecureExam({ onViolation, isActive = true }: UseSecureExamProps = {}) {
  const [violationCount, setViolationCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasViolatedRef = useRef(false); // Once violated, don't fire again

  const triggerViolation = useCallback((reason: string) => {
    if (hasViolatedRef.current) return; // Already triggered
    hasViolatedRef.current = true;

    setViolationCount(1);
    console.error(`SECURITY VIOLATION: ${reason}`);
    toast.error(`Security Violation: ${reason}. Your exam is being auto-submitted.`);
    
    if (onViolation) {
      onViolation(reason);
    }
  }, [onViolation]);

  const enterFullscreen = async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      }
      setIsFullscreen(true);
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      toast.error('Failed to enter fullscreen mode. This is required for the exam.');
    }
  };

  useEffect(() => {
    if (!isActive) return;

    // Keep track of the last key pressed to provide context on blur
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

    // ===================================================================
    // 1. KEYBOARD: Allow whitelisted keys, BLOCK everything else
    //    Uses capture phase on window for earliest interception.
    // ===================================================================
    const handleKeyDown = (e: KeyboardEvent) => {
      const combo = buildKeyCombo(e);
      lastKeyCombo = combo;
      lastKeyTime = Date.now();

      if (ALLOWED_KEYS.has(e.key)) {
        // Allowed key — let it through, do NOT preventDefault
        return;
      }

      // BLOCKED KEY — prevent default and trigger violation
      e.preventDefault();
      e.stopImmediatePropagation();

      triggerViolation(`Blocked key pressed: ${combo}`);
    };

    // Block keyup and keypress for non-allowed keys too (capture phase)
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
    // 3. CONTEXT MENU (right-click) BLOCK
    // ===================================================================
    const nukeContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    document.addEventListener('contextmenu', nukeContextMenu, true);

    // ===================================================================
    // 4. TOUCHPAD / TRACKPAD GESTURE LOCKDOWN
    // ===================================================================
    const nukeGestures = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener('wheel', nukeGestures, { capture: true, passive: false });

    const nukeTouchGestures = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener('touchstart', nukeTouchGestures, { capture: true, passive: false });
    document.addEventListener('touchmove',  nukeTouchGestures, { capture: true, passive: false });

    // Helper to get recent key context for blur events
    const getRecentKeyContext = () => {
      const timeSinceLastKey = Date.now() - lastKeyTime;
      // If a key was pressed within the last 2 seconds before blur, log it
      if (timeSinceLastKey < 2000 && lastKeyCombo) {
        return ` [Recent key: ${lastKeyCombo}]`;
      }
      return '';
    };

    // ===================================================================
    // 5. WINDOW BLUR — catches Alt+Tab, Win key, taskbar clicks
    // ===================================================================
    const handleBlur = () => {
      triggerViolation(`Window lost focus (Task switch or click outside detected)${getRecentKeyContext()}`);
    };
    window.addEventListener('blur', handleBlur);

    // ===================================================================
    // 6. VISIBILITY CHANGE — tab switch / minimise
    // ===================================================================
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation(`Tab switched or browser minimized${getRecentKeyContext()}`);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

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
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // ===================================================================
    // 8. DRAG & DROP LOCKDOWN
    // ===================================================================
    const nukeDrag = (e: DragEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    document.addEventListener('dragstart', nukeDrag, true);
    document.addEventListener('drop',      nukeDrag, true);

    // Initial fullscreen check
    setIsFullscreen(!!document.fullscreenElement);

    // ===================================================================
    // CLEANUP
    // ===================================================================
    return () => {
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

      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);

      document.removeEventListener('dragstart', nukeDrag, true);
      document.removeEventListener('drop',      nukeDrag, true);
    };
  }, [isActive, triggerViolation]);

  return {
    violationCount,
    isFullscreen,
    enterFullscreen
  };
}
