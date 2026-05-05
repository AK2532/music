import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../stores/playerStore';

export function SeekBar({ onSeek, compact = false }) {
  const trackRef = useRef(null);
  const fillRef = useRef(null);
  const thumbRef = useRef(null);
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    if (fillRef.current) fillRef.current.style.width = `${progress}%`;
    if (thumbRef.current) thumbRef.current.style.left = `${progress}%`;
  }, [progress]);

  const getPercent = useCallback((event) => {
    if (!trackRef.current || !duration) return null;

    const rect = trackRef.current.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, [duration]);

  const handlePointerDown = useCallback((event) => {
    dragging.current = true;
    setIsDragging(true);
    const percent = getPercent(event);
    if (percent !== null) onSeek(percent * duration);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [duration, getPercent, onSeek]);

  const handlePointerMove = useCallback((event) => {
    if (!dragging.current) return;
    const percent = getPercent(event);
    if (percent !== null) {
      if (fillRef.current) fillRef.current.style.width = `${percent * 100}%`;
      if (thumbRef.current) thumbRef.current.style.left = `${percent * 100}%`;
    }
  }, [getPercent]);

  const handlePointerUp = useCallback((event) => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    const percent = getPercent(event);
    if (percent !== null) onSeek(percent * duration);
  }, [duration, getPercent, onSeek]);

  const height = compact ? 4 : 6;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={duration || 0}
      aria-valuenow={currentTime || 0}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: 'relative',
        height: height + 20, // Larger hit area
        margin: '-10px 0', // Compensation for hit area
        display: 'flex',
        alignItems: 'center',
        borderRadius: 999,
        cursor: 'pointer',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: 'rgba(var(--accent-rgb), 0.08)',
          }}
        />
        <div
          ref={fillRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${progress}%`,
            borderRadius: 999,
            background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
            boxShadow: '0 0 14px rgba(var(--accent-rgb), 0.3)',
            transition: isDragging ? 'none' : 'width 0.1s linear',
          }}
        />
      </div>
      {!compact ? (
        <div
          ref={thumbRef}
          style={{
            position: 'absolute',
            top: '50%',
            left: `${progress}%`,
            transform: 'translate(-50%, -50%)',
            width: 15,
            height: 15,
            borderRadius: '50%',
            background: '#ffffff',
            border: '2px solid var(--accent)',
            boxShadow: '0 0 12px rgba(var(--accent-rgb), 0.32)',
            transition: isDragging ? 'none' : 'left 0.1s linear',
            zIndex: 2,
          }}
        />
      ) : null}
    </div>
  );
}
