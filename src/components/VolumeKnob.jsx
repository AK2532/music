import React, { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../stores/playerStore';

export const VolumeKnob = () => {
  const [volume, setVolume] = useState(50);
  const knobRef = useRef(null);
  const isDragging = useRef(false);

  // In a real app, this would come from the audio engine or store
  // For now, we'll just local state but it should ideally sync with playerStore if volume is there
  // Looking at playerStore usage in other files, volume isn't explicitly shown but let's assume 0-100

  const handleMouseMove = (e) => {
    if (!isDragging.current || !knobRef.current) return;

    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = e.clientX - centerX;
    const y = e.clientY - centerY;

    let angle = Math.atan2(y, x) * (180 / Math.PI);
    angle = (angle + 450) % 360; // Normalize to 0-360 starting from top

    // Constrain angle to a specific range if needed, or just map 0-360 to 0-100
    const newVolume = Math.round((angle / 360) * 100);
    setVolume(newVolume);
    
    // Update global volume if possible
    const audio = document.querySelector('audio');
    if (audio) {
      audio.volume = newVolume / 100;
    }
  };

  const handleMouseDown = () => {
    isDragging.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const circumference = 2 * Math.PI * 70; // r=70 for 140px diameter
  const offset = circumference - (volume / 100) * circumference;

  return (
    <div className="volume-card glass-card">
      <span className="volume-label">Volume</span>
      <div className="knob-container">
        <svg className="knob-progress-svg" viewBox="0 0 160 160">
          <defs>
            <linearGradient id="knob-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4facfe" />
              <stop offset="100%" stopColor="#00f2fe" />
            </linearGradient>
          </defs>
          <circle className="knob-progress-bg" cx="80" cy="80" r="70" />
          <circle 
            className="knob-progress-value" 
            cx="80" cy="80" r="70" 
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div 
          ref={knobRef}
          className="knob-outer"
          onMouseDown={handleMouseDown}
          style={{ transform: `rotate(${(volume / 100) * 360}deg)` }}
        >
          <div className="knob-inner"></div>
        </div>
      </div>
    </div>
  );
};
