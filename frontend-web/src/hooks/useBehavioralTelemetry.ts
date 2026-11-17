import { useEffect, useRef, useCallback, useMemo } from 'react';

export interface QuestionTelemetryItem {
  questionId: string;
  renderToClickMs: number;
  mouseMovesCount: number;
  isTrusted: boolean;
  flaggedSuspicious: boolean;
  reasons: string[];
}

export interface IntegrityReport {
  violationCounts: {
    syntheticClicks: number;
    zeroEntropyClicks: number;
    fastAnswers: number;
    copyAttempts: number;
    tabSwitches: number;
  };
  questionTelemetry: QuestionTelemetryItem[];
  averageTTFIMs: number;
  clientTimestamp: string;
}

export interface UseBehavioralTelemetryOptions {
  isActive: boolean;
  minTTFIMs?: number; // Threshold for suspicious fast answers (default: 1800ms)
  onSuspiciousActivity?: (type: string, detail: string) => void;
}

interface MousePoint {
  x: number;
  y: number;
  timestamp: number;
}

/**
 * useBehavioralTelemetry
 * 
 * Tracks micro-behavioral telemetry during the active exam attempt to detect:
 * 1. Untrusted synthetic clicks (`event.isTrusted === false`)
 * 2. Zero-entropy clicks (no intermediate mouse movements or robotic trajectory)
 * 3. Exact geometric-center robotic clicks
 * 4. Inhumanly fast Time-To-First-Interaction (TTFI) speeds
 * 5. Clipboard & devtools access attempts
 */
export function useBehavioralTelemetry({
  isActive,
  minTTFIMs = 1800,
  onSuspiciousActivity,
}: UseBehavioralTelemetryOptions) {
  // Counters for violations
  const syntheticClicksRef = useRef(0);
  const zeroEntropyClicksRef = useRef(0);
  const fastAnswersRef = useRef(0);
  const copyAttemptsRef = useRef(0);
  const tabSwitchesRef = useRef(0);

  // Per-question tracking
  const currentQuestionIdRef = useRef<string>('');
  const questionRenderTimeRef = useRef<number>(performance.now());
  const mousePointsRef = useRef<MousePoint[]>([]);
  const questionTelemetryRef = useRef<QuestionTelemetryItem[]>([]);
  const exactCenterHitCountRef = useRef<number>(0);

  // Mouse move entropy collector
  useEffect(() => {
    if (!isActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      const points = mousePointsRef.current;
      points.push({ x: e.clientX, y: e.clientY, timestamp: now });

      // Keep only recent 60 movement coordinates for sliding window
      if (points.length > 60) {
        points.shift();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchesRef.current += 1;
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive]);

  // Clipboard & inspection shortcut prevention
  useEffect(() => {
    if (!isActive) return;

    const handleCopyCut = (e: ClipboardEvent) => {
      e.preventDefault();
      copyAttemptsRef.current += 1;
      onSuspiciousActivity?.('CLIPBOARD_ACCESS', 'Blocked copy/cut action');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      copyAttemptsRef.current += 1;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCopy = (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C');
      const isInspect = e.key === 'F12' || ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U'));

      if (isCopy || isInspect) {
        e.preventDefault();
        copyAttemptsRef.current += 1;
        onSuspiciousActivity?.('BLOCKED_SHORTCUT', `Blocked ${e.key} keypress`);
      }
    };

    document.addEventListener('copy', handleCopyCut, true);
    document.addEventListener('cut', handleCopyCut, true);
    document.addEventListener('paste', handleCopyCut, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('copy', handleCopyCut, true);
      document.removeEventListener('cut', handleCopyCut, true);
      document.removeEventListener('paste', handleCopyCut, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isActive, onSuspiciousActivity]);

  // Notify when a new question mounts or renders
  const notifyQuestionRendered = useCallback((questionId: string) => {
    currentQuestionIdRef.current = questionId;
    questionRenderTimeRef.current = performance.now();
    mousePointsRef.current = [];
  }, []);

  // Compute movement entropy: path curvature and direction changes
  const computePathEntropy = useCallback((points: MousePoint[]): number => {
    if (points.length < 3) return 0;

    let directionChanges = 0;
    for (let i = 2; i < points.length; i++) {
      const dx1 = points[i - 1].x - points[i - 2].x;
      const dy1 = points[i - 1].y - points[i - 2].y;
      const dx2 = points[i].x - points[i - 1].x;
      const dy2 = points[i].y - points[i - 1].y;

      const dot = dx1 * dx2 + dy1 * dy2;
      const mag1 = Math.hypot(dx1, dy1);
      const mag2 = Math.hypot(dx2, dy2);

      if (mag1 > 1 && mag2 > 1) {
        const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        if (cosTheta < 0.95) {
          directionChanges += 1;
        }
      }
    }

    return directionChanges;
  }, []);

  // Verify and profile an answer selection or action click
  const verifyClick = useCallback(
    (e: React.MouseEvent | MouseEvent, questionId?: string): boolean => {
      if (!isActive) return true;

      const qId = questionId || currentQuestionIdRef.current || 'unknown';
      const now = performance.now();
      const ttfiMs = Math.round(now - questionRenderTimeRef.current);
      const isTrusted = e.isTrusted !== false;
      const reasons: string[] = [];

      // 1. Untrusted Synthetic Click Check
      if (!isTrusted) {
        syntheticClicksRef.current += 1;
        reasons.push('Untrusted synthetic click event');
        onSuspiciousActivity?.('SYNTHETIC_CLICK', `Script-generated click on question ${qId}`);
      }

      // 2. Mouse Movement Entropy Check
      const points = mousePointsRef.current;
      const entropy = computePathEntropy(points);
      if (points.length === 0) {
        zeroEntropyClicksRef.current += 1;
        reasons.push('Zero mouse movements prior to click');
        onSuspiciousActivity?.('ZERO_ENTROPY_CLICK', `Instantaneous click without mouse movement on ${qId}`);
      } else if (points.length < 2 && entropy === 0) {
        zeroEntropyClicksRef.current += 1;
        reasons.push('Unnatural straight-line instant click');
      }

      // 3. Exact Geometric Center Coordinates Check
      const target = (e.currentTarget || e.target) as HTMLElement | null;
      if (target && typeof target.getBoundingClientRect === 'function') {
        const rect = target.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);

        // Robotic automation tools typically dispatch click events to the exact center of the bounding box
        if (dist <= 0.8) {
          exactCenterHitCountRef.current += 1;
          if (exactCenterHitCountRef.current >= 2) {
            zeroEntropyClicksRef.current += 1;
            reasons.push('Repeated exact geometric center click coordinates');
            onSuspiciousActivity?.('ROBOTIC_COORDINATES', `Exact center coordinate hit on ${qId}`);
          }
        }
      }

      // 4. Speed Profiling (Inhuman TTFI)
      if (ttfiMs < minTTFIMs && points.length < 4) {
        fastAnswersRef.current += 1;
        reasons.push(`Suspiciously fast answer interaction (${ttfiMs}ms < ${minTTFIMs}ms)`);
        onSuspiciousActivity?.('FAST_ANSWER', `Inhuman TTFI of ${ttfiMs}ms on question ${qId}`);
      }

      const isSuspicious = reasons.length > 0;

      // Record item telemetry
      questionTelemetryRef.current.push({
        questionId: qId,
        renderToClickMs: ttfiMs,
        mouseMovesCount: points.length,
        isTrusted,
        flaggedSuspicious: isSuspicious,
        reasons,
      });

      // Clear points for next question interaction
      mousePointsRef.current = [];

      return !isSuspicious;
    },
    [isActive, minTTFIMs, computePathEntropy, onSuspiciousActivity]
  );

  // Generate complete telemetry report for final submission
  const getIntegrityReport = useCallback((): IntegrityReport => {
    const list = questionTelemetryRef.current;
    const totalTTFI = list.reduce((acc, cur) => acc + cur.renderToClickMs, 0);
    const avgTTFI = list.length > 0 ? Math.round(totalTTFI / list.length) : 0;

    return {
      violationCounts: {
        syntheticClicks: syntheticClicksRef.current,
        zeroEntropyClicks: zeroEntropyClicksRef.current,
        fastAnswers: fastAnswersRef.current,
        copyAttempts: copyAttemptsRef.current,
        tabSwitches: tabSwitchesRef.current,
      },
      questionTelemetry: list,
      averageTTFIMs: avgTTFI,
      clientTimestamp: new Date().toISOString(),
    };
  }, []);

  return useMemo(
    () => ({
      notifyQuestionRendered,
      verifyClick,
      getIntegrityReport,
      recordBlockedCopy: () => {
        copyAttemptsRef.current += 1;
      },
    }),
    [notifyQuestionRendered, verifyClick, getIntegrityReport]
  );
}

export default useBehavioralTelemetry;
