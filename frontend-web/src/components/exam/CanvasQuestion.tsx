import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface CanvasQuestionProps {
  text: string;
  subtext?: string;
  studentId?: string;
  studentEmail?: string;
  fontSize?: number;
  lineHeight?: number;
  color?: string;
  watermarkOpacity?: number;
  noiseDensity?: number;
  className?: string;
}

/**
 * CanvasQuestion
 * 
 * Renders question text onto an HTML5 <canvas> to break automated DOM scrapers,
 * browser extension extractors, and accessibility tree harvesters.
 * Features:
 * - High-DPI (Retina) crispness via window.devicePixelRatio scaling
 * - Dynamic height calculation and responsive multi-line word-wrapping
 * - Zero question text leaked in DOM attributes (no aria-label, alt, title, data-*)
 * - Subtle drifting diagonal watermark with student identifier
 * - Micro-noise background pattern disrupting automated OCR vision pipelines
 */
export const CanvasQuestion: React.FC<CanvasQuestionProps> = ({
  text,
  subtext,
  studentId,
  studentEmail,
  fontSize = 18,
  lineHeight = 28,
  color,
  watermarkOpacity = 0.07,
  noiseDensity = 0.04,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [driftOffset, setDriftOffset] = useState<number>(0);

  // Monitor container width dynamically across screen resizes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const rect = el.getBoundingClientRect();
      const measured = rect.width || el.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800);
      if (measured > 0 && Math.abs(measured - containerWidth) > 1) {
        setContainerWidth(measured);
      }
    };

    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(el);
      return () => observer.disconnect();
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, [containerWidth]);

  // Subtle continuous drift for the watermark (0.2px per frame)
  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') return;

    let active = true;
    let offset = 0;

    const step = () => {
      if (!active) return;
      offset = (offset + 0.15) % 300;
      setDriftOffset(offset);
      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      active = false;
      if (animFrameRef.current && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Text wrapping utility
  const computeWrappedLines = useCallback(
    (ctx: CanvasRenderingContext2D, content: string, maxWidth: number): string[] => {
      const lines: string[] = [];
      const paragraphs = content.split(/\r?\n/);

      for (const para of paragraphs) {
        if (!para.trim()) {
          lines.push('');
          continue;
        }

        const words = para.split(' ');
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);

          if (metrics.width <= maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              // Word itself is wider than available width: break character by character
              let partial = '';
              for (const ch of word) {
                if (ctx.measureText(partial + ch).width <= maxWidth) {
                  partial += ch;
                } else {
                  lines.push(partial);
                  partial = ch;
                }
              }
              currentLine = partial;
            }
          }
        }

        if (currentLine) {
          lines.push(currentLine);
        }
      }

      return lines;
    },
    []
  );

  // Canvas drawing effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerWidth <= 0) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const paddingX = 4;
    const paddingY = 8;
    const effectiveWidth = Math.max(200, containerWidth);
    const textAvailableWidth = effectiveWidth - paddingX * 2;

    // Detect dark mode if color not explicitly passed
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const textColor = color || (isDark ? '#F4F4F5' : '#18181B');
    const subtextColor = isDark ? '#A1A1AA' : '#52525B';

    // Set font for line measurement
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

    const mainLines = computeWrappedLines(ctx, text, textAvailableWidth);

    ctx.font = `400 ${fontSize - 3}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
    const subLines = subtext ? computeWrappedLines(ctx, subtext, textAvailableWidth) : [];

    const totalHeight =
      paddingY * 2 +
      mainLines.length * lineHeight +
      (subLines.length > 0 ? subLines.length * (lineHeight - 4) + 12 : 0);

    // High-DPI canvas sizing
    canvas.width = Math.floor(effectiveWidth * dpr);
    canvas.height = Math.floor(totalHeight * dpr);
    canvas.style.width = `${effectiveWidth}px`;
    canvas.style.height = `${totalHeight}px`;

    // Scale context to DPR coordinate space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, effectiveWidth, totalHeight);

    // 1. Subtle OCR-disruptive background noise (micro-speckles and anti-OCR grid)
    if (noiseDensity > 0) {
      ctx.save();
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.035)';
      const dotCount = Math.floor(effectiveWidth * totalHeight * 0.0003 * (noiseDensity / 0.04));
      for (let i = 0; i < dotCount; i++) {
        const nx = ((i * 37 + 13) % effectiveWidth);
        const ny = ((i * 73 + 29) % totalHeight);
        ctx.fillRect(nx, ny, 1.2, 1.2);
      }

      // 2-3 thin diagonal hash lines disrupting edge detection
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.025)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      for (let x = -totalHeight; x < effectiveWidth; x += 120) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + totalHeight, totalHeight);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 2. Dynamic Moving Watermark (Logged-in Student Identity)
    const watermarkIdentifier = studentEmail || studentId || 'CIRA SECURE EXAM';
    const watermarkText = `${watermarkIdentifier} • ${new Date().toLocaleTimeString()}`;

    ctx.save();
    ctx.rotate((-20 * Math.PI) / 180);
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = isDark ? `rgba(255, 255, 255, ${watermarkOpacity})` : `rgba(139, 0, 0, ${watermarkOpacity})`;

    const stepX = 280;
    const stepY = 110;
    const startX = -effectiveWidth - 100 + (driftOffset % stepX);
    const startY = -totalHeight - 100;

    for (let x = startX; x < effectiveWidth * 2; x += stepX) {
      for (let y = startY; y < totalHeight * 2.5; y += stepY) {
        ctx.fillText(watermarkText, x, y);
      }
    }
    ctx.restore();

    // 3. Crisp Foreground Text Rendering
    let currentY = paddingY + fontSize;

    ctx.fillStyle = textColor;
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
    ctx.textBaseline = 'alphabetic';

    for (const line of mainLines) {
      if (line) {
        ctx.fillText(line, paddingX, currentY);
      }
      currentY += lineHeight;
    }

    // 4. Subtext / Code Snippet Rendering (if present)
    if (subLines.length > 0) {
      currentY += 4;
      ctx.fillStyle = subtextColor;
      ctx.font = `400 ${fontSize - 3}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

      for (const line of subLines) {
        if (line) {
          ctx.fillText(line, paddingX, currentY);
        }
        currentY += lineHeight - 4;
      }
    }
  }, [
    text,
    subtext,
    containerWidth,
    fontSize,
    lineHeight,
    color,
    watermarkOpacity,
    noiseDensity,
    driftOffset,
    studentId,
    studentEmail,
    computeWrappedLines,
  ]);

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden select-none relative ${className}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        role="presentation"
        className="block select-none pointer-events-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        <span
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {text}
        </span>
      </canvas>
    </div>
  );
};

export default CanvasQuestion;
