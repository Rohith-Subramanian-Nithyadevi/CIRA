import { renderHook, act } from '@testing-library/react';
import { useBehavioralTelemetry } from './useBehavioralTelemetry';

describe('useBehavioralTelemetry Hook', () => {
  it('flags synthetic untrusted clicks when e.isTrusted is false', () => {
    const suspiciousCallback = jest.fn();
    const { result } = renderHook(() =>
      useBehavioralTelemetry({
        isActive: true,
        minTTFIMs: 1800,
        onSuspiciousActivity: suspiciousCallback,
      })
    );

    act(() => {
      result.current.notifyQuestionRendered('q-1');
    });

    const fakeSyntheticEvent = {
      isTrusted: false,
      clientX: 100,
      clientY: 100,
      currentTarget: null,
      target: null,
    } as unknown as React.MouseEvent;

    let allowed = true;
    act(() => {
      allowed = result.current.verifyClick(fakeSyntheticEvent, 'q-1');
    });

    expect(allowed).toBe(false);
    expect(suspiciousCallback).toHaveBeenCalledWith('SYNTHETIC_CLICK', expect.any(String));

    const report = result.current.getIntegrityReport();
    expect(report.violationCounts.syntheticClicks).toBe(1);
    expect(report.questionTelemetry[0].isTrusted).toBe(false);
    expect(report.questionTelemetry[0].flaggedSuspicious).toBe(true);
  });

  it('flags zero-entropy clicks when interaction occurs without prior mouse movements', () => {
    const suspiciousCallback = jest.fn();
    const { result } = renderHook(() =>
      useBehavioralTelemetry({
        isActive: true,
        minTTFIMs: 50,
        onSuspiciousActivity: suspiciousCallback,
      })
    );

    act(() => {
      result.current.notifyQuestionRendered('q-2');
    });

    const clickEvent = {
      isTrusted: true,
      clientX: 250,
      clientY: 300,
      currentTarget: null,
      target: null,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.verifyClick(clickEvent, 'q-2');
    });

    const report = result.current.getIntegrityReport();
    expect(report.violationCounts.zeroEntropyClicks).toBeGreaterThanOrEqual(1);
  });
});
