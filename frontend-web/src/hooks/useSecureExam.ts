import { useEffect, useState, useCallback, useRef } from 'react';

export type SecurityViolationType =
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'FULLSCREEN_EXIT'
  | 'BLOCKED_KEY'
  | 'CLIPBOARD';

export type ShortcutEventType =
  | 'keydown'
  | 'keyup'
  | 'blur'
  | 'visibilitychange'
  | 'fullscreenchange';

export interface ShortcutObservedEvent {
  eventType: ShortcutEventType;
  key?: string;
  code?: string;
  modifiers: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
  };
  timestamp: string;
  relativeMs?: number;
}

export interface ShortcutEvidence {
  triggeringEvent: ShortcutEventType | 'clipboard';
  captureReason:
    | 'BLOCKED_SHORTCUT'
    | 'FOCUS_LOST'
    | 'VISIBILITY_HIDDEN'
    | 'FULLSCREEN_EXIT'
    | 'CLIPBOARD';
  detectedSequence: string | null;
  summary: string | null;
  evidenceQuality: 'COMPLETE' | 'PARTIAL';
  focusLost: boolean;
  visibilityHidden: boolean;
  captureStartedAt: string;
  captureEndedAt: string;
  captureDurationMs: number;
  events: ShortcutObservedEvent[];
}

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

export interface KeystrokeLogEntry {
  key: string;
  code?: string;
  timestamp: string;
  intervalMs: number;
  isModifier: boolean;
  isBlocked: boolean;
}

export interface UseSecureExamProps {
  onViolation?: (event: SecurityViolationEvent) => void | Promise<void>;
  isActive?: boolean;
  dedupeWindowMs?: number;
  captureWindowMs?: number;
  onKeystrokeBatch?: (batch: KeystrokeLogEntry[]) => void;
  maxViolations?: number;
  onInstantLock?: () => void;
}

const ROLLING_BUFFER_WINDOW_MS = 2000;
const MAX_ROLLING_EVENTS = 25;
const MODIFIER_KEYS = new Set(['Alt', 'Control', 'Shift', 'Meta']);
const MODIFIER_LABELS = new Set(['Alt', 'Ctrl', 'Shift', 'Win/Cmd']);
const NAVIGATION_OR_SYSTEM_KEYS = new Set([
  'Tab',
  'Escape',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
  'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  'PrintScreen',
  'ContextMenu',
  'Insert',
  'Pause',
  'ScrollLock',
  'OS',
  'AltGraph',
]);

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
  'CapsLock',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End',
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

export function isMultiDisplayDetected(): boolean {
  if (typeof window === 'undefined' || !window.screen) return false;
  const screenWithExtended = window.screen as Screen & { isExtended?: boolean };
  return Boolean(screenWithExtended.isExtended);
}

export function useSecureExam({
  onViolation,
  isActive = true,
  dedupeWindowMs = 1500,
  captureWindowMs = 1200,
  onKeystrokeBatch,
  maxViolations,
  onInstantLock,
}: UseSecureExamProps = {}) {
  const [violationCount, setViolationCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(getFullscreenElement()));
  const [isBlackScreen, setIsBlackScreen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;
  const onKeystrokeBatchRef = useRef(onKeystrokeBatch);
  onKeystrokeBatchRef.current = onKeystrokeBatch;
  const onInstantLockRef = useRef(onInstantLock);
  onInstantLockRef.current = onInstantLock;

  const keystrokeBufferRef = useRef<KeystrokeLogEntry[]>([]);
  const lastKeyTimestampRef = useRef<number>(Date.now());
  const lastViolationAtRef = useRef<number>(0);

  // Periodic keystroke telemetry flush every 1.5 seconds (1–2s window)
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      if (keystrokeBufferRef.current.length > 0) {
        const batch = [...keystrokeBufferRef.current];
        keystrokeBufferRef.current = [];
        onKeystrokeBatchRef.current?.(batch);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [isActive]);

  const evaluateSecurityState = useCallback(() => {
    if (typeof document === 'undefined') return;
    const fsActive = Boolean(getFullscreenElement());
    const visible = document.visibilityState !== 'hidden' && !document.hidden;
    const focused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
    const isMultiDisplay = isMultiDisplayDetected();

    setIsFullscreen(fsActive);
    if (fsActive && visible && focused && !isMultiDisplay && !isLocked) {
      setIsBlackScreen(false);
    } else {
      setIsBlackScreen(true);
    }
  }, [isLocked]);

  const recordViolation = useCallback(
    (type: SecurityViolationType, reason: string, metadata?: Record<string, unknown>) => {
      // Immediately activate black screen regardless of deduplication
      setIsBlackScreen(true);

      const now = Date.now();
      if (now - lastViolationAtRef.current < dedupeWindowMs) {
        return;
      }
      lastViolationAtRef.current = now;

      setViolationCount((prev) => {
        const nextCount = prev + 1;
        if (maxViolations && nextCount >= maxViolations) {
          setIsLocked(true);
          onInstantLockRef.current?.();
        }
        return nextCount;
      });

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
    [dedupeWindowMs, maxViolations]
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

    type InternalObservedEvent = ShortcutObservedEvent & { epochMs: number };

    interface PendingCapture {
      type: SecurityViolationType;
      reason: string;
      triggeringEvent: ShortcutEvidence['triggeringEvent'];
      captureReason: ShortcutEvidence['captureReason'];
      triggerEpochMs: number;
      metadata: Record<string, unknown>;
      events: InternalObservedEvent[];
      timerId: ReturnType<typeof setTimeout> | null;
    }

    const boundedCaptureMs = Math.max(200, Math.min(2000, captureWindowMs));
    let rollingBuffer: InternalObservedEvent[] = [];
    let pendingCapture: PendingCapture | null = null;
    let lastKeyCombo = '';
    let lastKeyTime = 0;

    const normalizeKeyLabel = (e: KeyboardEvent): string => {
      if (e.key === 'Control') return 'Ctrl';
      if (e.key === 'Meta') return 'Win/Cmd';
      if (e.key === ' ') return 'Space';
      if (e.key === 'Unidentified' && e.code) return e.code;
      if (e.key && e.key.length === 1 && (e.ctrlKey || e.altKey || e.metaKey)) {
        return e.key.toUpperCase();
      }
      return e.key || e.code || 'Unknown';
    };

    const isEligibleShortcutKey = (e: KeyboardEvent): boolean => {
      if (MODIFIER_KEYS.has(e.key) || NAVIGATION_OR_SYSTEM_KEYS.has(e.key)) {
        return true;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return true;
      }
      // Never capture ordinary text typed into answers/inputs when no shortcut modifier is active
      if (ALLOWED_KEYS.has(e.key)) {
        return false;
      }
      return true;
    };

    const pruneRollingBuffer = (now: number) => {
      const cutoff = now - ROLLING_BUFFER_WINDOW_MS;
      rollingBuffer = rollingBuffer
        .filter((ev) => ev.epochMs >= cutoff)
        .slice(-MAX_ROLLING_EVENTS);
    };

    const pushObservedEvent = (ev: InternalObservedEvent) => {
      pruneRollingBuffer(ev.epochMs);
      const last = rollingBuffer[rollingBuffer.length - 1];
      const isDuplicate =
        last &&
        last.eventType === ev.eventType &&
        last.key === ev.key &&
        last.code === ev.code &&
        ev.epochMs - last.epochMs < 15;
      if (!isDuplicate) {
        rollingBuffer.push(ev);
        if (rollingBuffer.length > MAX_ROLLING_EVENTS) {
          rollingBuffer = rollingBuffer.slice(-MAX_ROLLING_EVENTS);
        }
      }
      if (pendingCapture) {
        const lastPending = pendingCapture.events[pendingCapture.events.length - 1];
        const isPendingDup =
          lastPending &&
          lastPending.eventType === ev.eventType &&
          lastPending.key === ev.key &&
          lastPending.code === ev.code &&
          ev.epochMs - lastPending.epochMs < 15;
        if (!isPendingDup && pendingCapture.events.length < MAX_ROLLING_EVENTS) {
          pendingCapture.events.push(ev);
        }
      }
    };

    const buildShortcutEvidence = (
      rawEvents: InternalObservedEvent[],
      triggerEpochMs: number,
      triggeringEvent: ShortcutEvidence['triggeringEvent'],
      captureReason: ShortcutEvidence['captureReason']
    ): ShortcutEvidence => {
      const sorted = [...rawEvents].sort((a, b) => a.epochMs - b.epochMs);
      const startMs = sorted.length > 0 ? sorted[0].epochMs : triggerEpochMs;
      const endMs = sorted.length > 0 ? sorted[sorted.length - 1].epochMs : triggerEpochMs;

      const keyDownEvents = sorted.filter((ev) => ev.eventType === 'keydown' && ev.key);
      const keyboardEvents = sorted.filter(
        (ev) => ev.eventType === 'keydown' || ev.eventType === 'keyup'
      );

      const sequenceParts: string[] = [];
      for (const ev of keyDownEvents) {
        if (ev.modifiers.ctrl && !sequenceParts.includes('Ctrl')) sequenceParts.push('Ctrl');
        if (ev.modifiers.alt && !sequenceParts.includes('Alt')) sequenceParts.push('Alt');
        if (ev.modifiers.shift && ev.key !== 'Shift' && !sequenceParts.includes('Shift')) {
          sequenceParts.push('Shift');
        }
        if (ev.modifiers.meta && !sequenceParts.includes('Win/Cmd')) sequenceParts.push('Win/Cmd');
        if (ev.key && !sequenceParts.includes(ev.key)) {
          sequenceParts.push(ev.key);
        }
      }

      const detectedSequence = sequenceParts.length > 0 ? sequenceParts.join(' + ') : null;
      const focusLost = sorted.some((ev) => ev.eventType === 'blur');
      const visibilityHidden = sorted.some((ev) => ev.eventType === 'visibilitychange');

      const onlySingleModifierKey =
        keyDownEvents.length === 1 &&
        Boolean(keyDownEvents[0].key && MODIFIER_LABELS.has(keyDownEvents[0].key));

      let evidenceQuality: 'COMPLETE' | 'PARTIAL' = 'PARTIAL';
      let summary: string | null = null;

      if (keyboardEvents.length === 0 && (focusLost || visibilityHidden)) {
        evidenceQuality = 'PARTIAL';
        summary = 'Possible application switch – shortcut events partially observed';
      } else if ((focusLost || visibilityHidden) && onlySingleModifierKey) {
        evidenceQuality = 'PARTIAL';
        summary = 'Possible application switch – shortcut events partially observed';
      } else if (keyboardEvents.length >= 1) {
        evidenceQuality = 'COMPLETE';
        summary =
          focusLost || visibilityHidden
            ? 'Shortcut sequence followed by focus/visibility loss'
            : 'Blocked shortcut sequence observed';
      }

      return {
        triggeringEvent,
        captureReason,
        detectedSequence,
        summary,
        evidenceQuality,
        focusLost,
        visibilityHidden,
        captureStartedAt: new Date(startMs).toISOString(),
        captureEndedAt: new Date(endMs).toISOString(),
        captureDurationMs: Math.max(0, endMs - startMs),
        events: sorted.map(({ epochMs, ...rest }) => ({
          ...rest,
          relativeMs: epochMs - triggerEpochMs,
        })),
      };
    };

    const finalizePendingCapture = (
      overrideType?: SecurityViolationType,
      overrideReason?: string,
      overrideCaptureReason?: ShortcutEvidence['captureReason']
    ) => {
      if (!pendingCapture) return;
      const current = pendingCapture;
      pendingCapture = null;
      if (current.timerId !== null) {
        clearTimeout(current.timerId);
      }

      const finalType = overrideType ?? current.type;
      const finalReason = overrideReason ?? current.reason;
      const finalCaptureReason = overrideCaptureReason ?? current.captureReason;
      const evidence = buildShortcutEvidence(
        current.events,
        current.triggerEpochMs,
        current.triggeringEvent,
        finalCaptureReason
      );

      recordViolation(finalType, finalReason, {
        ...current.metadata,
        ...(evidence.detectedSequence ? { key: evidence.detectedSequence } : {}),
        shortcutEvidence: evidence,
      });
      rollingBuffer = [];
    };

    const buildKeyCombo = (e: KeyboardEvent) => {
      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey && e.key !== 'Shift') parts.push('Shift');
      if (e.metaKey) parts.push('Win/Cmd');
      const label = normalizeKeyLabel(e);
      if (!parts.includes(label)) {
        parts.push(label);
      }
      return parts.join('+');
    };

    const getRecentKeyContext = () => {
      const timeSinceLastKey = Date.now() - lastKeyTime;
      if (timeSinceLastKey < ROLLING_BUFFER_WINDOW_MS && lastKeyCombo) {
        return { recentKey: lastKeyCombo };
      }
      return undefined;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEligibleShortcutKey(e)) {
        return;
      }

      const now = Date.now();
      const combo = buildKeyCombo(e);
      lastKeyCombo = combo;
      lastKeyTime = now;

      if (!e.repeat) {
        pushObservedEvent({
          eventType: 'keydown',
          key: normalizeKeyLabel(e),
          code: e.code || undefined,
          modifiers: {
            ctrl: e.ctrlKey,
            alt: e.altKey,
            shift: e.shiftKey,
            meta: e.metaKey,
          },
          timestamp: new Date(now).toISOString(),
          epochMs: now,
        });
      }

      // Let Escape be handled by fullscreenchange (FULLSCREEN_EXIT) without double-counting
      if (e.key === 'Escape') {
        return;
      }

      e.preventDefault();
      e.stopImmediatePropagation();
      setIsBlackScreen(true);

      const isModifierOnly = MODIFIER_KEYS.has(e.key);
      const isFocusSwitchCombo =
        e.key === 'Tab' && (e.altKey || e.ctrlKey || e.metaKey);

      if (pendingCapture) {
        // Extend/update pending capture with the newly observed shortcut key
        pendingCapture.reason = `Blocked key pressed: ${combo}`;
        pendingCapture.metadata = { ...pendingCapture.metadata, key: combo };
        if (pendingCapture.timerId !== null) {
          clearTimeout(pendingCapture.timerId);
        }
        const remainingWait = isFocusSwitchCombo ? 250 : isModifierOnly ? boundedCaptureMs : 150;
        pendingCapture.timerId = setTimeout(() => {
          finalizePendingCapture();
        }, remainingWait);
        return;
      }

      if (isModifierOnly || isFocusSwitchCombo) {
        pruneRollingBuffer(now);
        const waitMs = isFocusSwitchCombo ? 250 : boundedCaptureMs;
        pendingCapture = {
          type: 'BLOCKED_KEY',
          reason: `Blocked key pressed: ${combo}`,
          triggeringEvent: 'keydown',
          captureReason: 'BLOCKED_SHORTCUT',
          triggerEpochMs: now,
          metadata: { key: combo },
          events: [...rollingBuffer],
          timerId: setTimeout(() => {
            finalizePendingCapture();
          }, waitMs),
        };
        return;
      }

      pruneRollingBuffer(now);
      const evidence = buildShortcutEvidence(
        rollingBuffer,
        now,
        'keydown',
        'BLOCKED_SHORTCUT'
      );
      recordViolation('BLOCKED_KEY', `Blocked key pressed: ${combo}`, {
        key: combo,
        shortcutEvidence: evidence,
      });
      rollingBuffer = [];
    };

    const handleKeyUpPress = (e: KeyboardEvent) => {
      if (e.type === 'keyup' && isEligibleShortcutKey(e)) {
        const now = Date.now();
        pushObservedEvent({
          eventType: 'keyup',
          key: normalizeKeyLabel(e),
          code: e.code || undefined,
          modifiers: {
            ctrl: e.ctrlKey,
            alt: e.altKey,
            shift: e.shiftKey,
            meta: e.metaKey,
          },
          timestamp: new Date(now).toISOString(),
          epochMs: now,
        });
      }
      if (!ALLOWED_KEYS.has(e.key) && e.key !== 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const nukeClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const now = Date.now();
      pruneRollingBuffer(now);
      const evidence = buildShortcutEvidence(
        rollingBuffer,
        now,
        'clipboard',
        'CLIPBOARD'
      );
      recordViolation('CLIPBOARD', `Clipboard operation attempted (${e.type})`, {
        action: e.type,
        shortcutEvidence: evidence,
      });
      rollingBuffer = [];
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
        const now = Date.now();
        pushObservedEvent({
          eventType: 'visibilitychange',
          modifiers: { ctrl: false, alt: false, shift: false, meta: false },
          timestamp: new Date(now).toISOString(),
          epochMs: now,
        });
        if (pendingCapture) {
          finalizePendingCapture(
            'TAB_SWITCH',
            'Page became hidden (tab switch, minimize, or app switch)',
            'VISIBILITY_HIDDEN'
          );
          return;
        }
        pruneRollingBuffer(now);
        const evidence = buildShortcutEvidence(
          rollingBuffer,
          now,
          'visibilitychange',
          'VISIBILITY_HIDDEN'
        );
        recordViolation('TAB_SWITCH', 'Page became hidden (tab switch, minimize, or app switch)', {
          visibilityState: document.visibilityState,
          ...getRecentKeyContext(),
          shortcutEvidence: evidence,
        });
        rollingBuffer = [];
      } else {
        evaluateSecurityState();
      }
    };

    const handleBlur = () => {
      const now = Date.now();
      pushObservedEvent({
        eventType: 'blur',
        modifiers: { ctrl: false, alt: false, shift: false, meta: false },
        timestamp: new Date(now).toISOString(),
        epochMs: now,
      });
      if (pendingCapture) {
        finalizePendingCapture(
          'WINDOW_BLUR',
          'Window lost focus',
          'FOCUS_LOST'
        );
        return;
      }
      pruneRollingBuffer(now);
      const evidence = buildShortcutEvidence(
        rollingBuffer,
        now,
        'blur',
        'FOCUS_LOST'
      );
      recordViolation('WINDOW_BLUR', 'Window lost focus', {
        visibilityState: document.visibilityState,
        ...getRecentKeyContext(),
        shortcutEvidence: evidence,
      });
      rollingBuffer = [];
    };

    const handleFocus = () => {
      evaluateSecurityState();
    };

    const handleFullscreenChange = () => {
      const fsActive = Boolean(getFullscreenElement());
      setIsFullscreen(fsActive);
      if (!fsActive) {
        const now = Date.now();
        pushObservedEvent({
          eventType: 'fullscreenchange',
          modifiers: { ctrl: false, alt: false, shift: false, meta: false },
          timestamp: new Date(now).toISOString(),
          epochMs: now,
        });
        if (pendingCapture) {
          finalizePendingCapture(
            'FULLSCREEN_EXIT',
            'Exited fullscreen mode',
            'FULLSCREEN_EXIT'
          );
          return;
        }
        pruneRollingBuffer(now);
        const evidence = buildShortcutEvidence(
          rollingBuffer,
          now,
          'fullscreenchange',
          'FULLSCREEN_EXIT'
        );
        recordViolation('FULLSCREEN_EXIT', 'Exited fullscreen mode', {
          visibilityState: document.visibilityState,
          ...getRecentKeyContext(),
          shortcutEvidence: evidence,
        });
        rollingBuffer = [];
      } else {
        evaluateSecurityState();
      }
    };

    const handleVisualViewportChange = () => {
      if (typeof window === 'undefined' || !window.visualViewport) return;
      const heightRatio = window.visualViewport.height / (window.innerHeight || 1);
      // Detected split-screen or floating overlay
      if (heightRatio < 0.65 && !document.hidden) {
        setIsBlackScreen(true);
        recordViolation('WINDOW_BLUR', 'External overlay or split-screen detected', {
          visualHeight: window.visualViewport.height,
          innerHeight: window.innerHeight,
          ratio: heightRatio,
        });
      }
    };

    const handleKeyLogger = (e: KeyboardEvent) => {
      const now = Date.now();
      const intervalMs = Math.max(0, now - lastKeyTimestampRef.current);
      lastKeyTimestampRef.current = now;
      keystrokeBufferRef.current.push({
        key: e.key,
        code: e.code,
        timestamp: new Date(now).toISOString(),
        intervalMs,
        isModifier: MODIFIER_KEYS.has(e.key),
        isBlocked: !ALLOWED_KEYS.has(e.key) && !MODIFIER_KEYS.has(e.key),
      });
    };

    const handlePageExit = () => {
      if (pendingCapture) {
        finalizePendingCapture();
      }
    };

    const nukeDrag = (e: DragEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener('keydown', handleKeyLogger, true);
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
    window.addEventListener('resize', evaluateSecurityState);
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    document.addEventListener('dragstart', nukeDrag, true);
    document.addEventListener('drop', nukeDrag, true);
    window.addEventListener('pagehide', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);

    // Initial check when exam becomes active
    evaluateSecurityState();

    return () => {
      if (pendingCapture) {
        finalizePendingCapture();
      }
      rollingBuffer = [];
      window.removeEventListener('keydown', handleKeyLogger, true);
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
      window.removeEventListener('resize', evaluateSecurityState);
      if (typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);

      document.removeEventListener('dragstart', nukeDrag, true);
      document.removeEventListener('drop', nukeDrag, true);
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
    };
  }, [isActive, captureWindowMs, evaluateSecurityState, recordViolation]);

  return {
    violationCount,
    isFullscreen,
    isBlackScreen,
    isLocked,
    fullscreenSupported: isFullscreenSupported(),
    enterFullscreen,
    triggerBlackout: () => setIsBlackScreen(true),
    dismissBlackout: () => evaluateSecurityState(),
    lockScreen: () => setIsLocked(true),
  };
}
