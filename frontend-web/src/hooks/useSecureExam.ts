import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface UseSecureExamProps {
  onViolation?: (violationCount: number) => void;
  maxViolations?: number;
  isActive?: boolean;
}

export function useSecureExam({ onViolation, maxViolations = 3, isActive = true }: UseSecureExamProps = {}) {
  const [violationCount, setViolationCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleViolation = useCallback((type: string) => {
    setViolationCount(prev => {
      const newCount = prev + 1;
      console.warn(`Secure Exam Violation: ${type} (Count: ${newCount})`);
      toast.error(`Security Violation: ${type}. Warning ${newCount} of ${maxViolations}.`);
      
      if (onViolation) {
        onViolation(newCount);
      }
      return newCount;
    });
  }, [onViolation, maxViolations]);

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

    // 1. Block Context Menu (Right Click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      // handleViolation('Right-click detected'); // Optionally alert on right click, but usually just blocking is fine.
    };

    // 2. Block Keyboard Shortcuts & Clipboard
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (Developer Tools)
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'i' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
        handleViolation('Developer tools access attempt');
      }

      // Block Copy/Paste/Cut (Ctrl+C, Ctrl+V, Ctrl+X, Cmd+C, Cmd+V, Cmd+X)
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'C', 'V', 'X'].includes(e.key)) {
        e.preventDefault();
        handleViolation('Copy/Paste attempt');
      }
    };

    const handleClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    // 3. Detect Visibility Change (Tab Switch / Minimize)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('Tab switched or browser minimized');
      }
    };

    // 4. Detect Fullscreen Exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        handleViolation('Exited fullscreen mode');
      } else {
        setIsFullscreen(true);
      }
    };

    // Attach Event Listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleClipboard);
    document.addEventListener('cut', handleClipboard);
    document.addEventListener('paste', handleClipboard);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Initial check for fullscreen
    if (!document.fullscreenElement) {
        setIsFullscreen(false);
    } else {
        setIsFullscreen(true);
    }

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleClipboard);
      document.removeEventListener('cut', handleClipboard);
      document.removeEventListener('paste', handleClipboard);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isActive, handleViolation]);

  return {
    violationCount,
    isFullscreen,
    enterFullscreen
  };
}
