import { Heart, Pause, Play, SkipForward, SkipBack } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { gsap } from 'gsap';

export function MiniPlayer({ onExpand, isMobile }) {
  const containerRef = useRef(null);

  const song = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);

  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const playNext = usePlayerStore((state) => state.playNext);
  const playPrev = usePlayerStore((state) => state.playPrev);
  const queue = usePlayerStore((state) => state.queue);
  const currentIndex = usePlayerStore((state) => state.currentIndex);
  const radioMode = usePlayerStore((state) => state.radioMode);
  const repeatMode = usePlayerStore((state) => state.repeatMode);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    if (song && containerRef.current) {
      gsap.fromTo(containerRef.current, 
        { y: 150, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.8, ease: "power4.out" }
      );
    }
  }, [song?.id]);

  if (!song) return null;

  return (
    <div
      ref={containerRef}
      className="glass-panel glass-panel-hover glass-shimmer"
      style={{
        position: 'fixed',
        bottom: isMobile ? '24px' : '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: isMobile ? 'calc(100% - 32px)' : '400px',
        height: '80px',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        cursor: 'pointer',
      }}
      onClick={onExpand}
    >
      {/* Solid Progress Line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '24px',
        right: '24px',
        height: '2px',
        background: 'var(--border-subtle)',
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.1s linear' }} />
      </div>

      {/* Album Art (Physical Drop Shadow) */}
      <img 
        src={song.thumbnail} 
        alt="" 
        style={{ 
          width: '56px', 
          height: '56px', 
          borderRadius: '12px', 
          objectFit: 'cover', 
          boxShadow: '0 8px 24px rgba(28,26,23,0.2)',
          marginRight: '16px'
        }} 
      />

      {/* Editorial Info */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ 
          fontWeight: 600, 
          fontSize: '1rem', 
          color: 'var(--text-main)',
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis' 
        }}>
          {song.title}
        </div>
        <div style={{ 
          fontSize: '0.8rem', 
          color: 'var(--text-faint)', 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis' 
        }}>
          {song.artist}
        </div>
      </div>

      {/* Solid Dark Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
        {!isMobile && (
          <button className="icon-btn" onClick={playPrev} style={{ width: '40px', height: '40px', background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <SkipBack size={20} color="var(--text-muted)" />
          </button>
        )}
        <button 
          className="btn-primary" 
          onClick={togglePlay} 
          style={{ width: '48px', height: '48px', padding: 0, justifyContent: 'center', borderRadius: '50%' }}
        >
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />}
        </button>
        <button 
          className="icon-btn" 
          onClick={playNext} 
          disabled={!radioMode && repeatMode === 'none' && currentIndex >= queue.length - 1}
          style={{ 
            width: '40px', 
            height: '40px', 
            background: 'transparent', 
            border: 'none', 
            boxShadow: 'none',
            opacity: (!radioMode && repeatMode === 'none' && currentIndex >= queue.length - 1) ? 0.3 : 1
          }}
        >
          <SkipForward size={20} color="var(--text-muted)" />
        </button>
      </div>
    </div>
  );
}