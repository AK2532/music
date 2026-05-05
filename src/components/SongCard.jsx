import { Pause, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRef } from 'react';

export function SongCard({ song, onPlay, active, playing }) {
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 10;
    const rotateY = (centerX - x) / 10;

    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  };

  return (
    <div
      ref={cardRef}
      className="card-glass"
      data-active={active}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onPlay}
      style={{
        borderRadius: '24px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'transform 0.1s ease-out, background 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
        display: 'grid',
        gap: '16px'
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '16px', overflow: 'hidden' }}>
        <img 
          src={song.thumbnail} 
          alt={song.title} 
          onError={(e) => {
            e.target.onerror = null; 
            e.target.src = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=540&auto=format&fit=crop';
          }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: active ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.5s ease' }} 
        />
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)',
          opacity: active ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }} />
        
        <div style={{
          position: 'absolute',
          right: '12px',
          bottom: '12px',
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--glow-strong)',
          opacity: active ? 1 : 0,
          transform: active ? 'scale(1)' : 'scale(0.8)',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          {playing && active ? <Pause size={20} fill="#000" /> : <Play size={20} fill="#000" style={{ marginLeft: 2 }} />}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '4px' }}>
        <div style={{ 
          fontWeight: 800, 
          fontSize: '15px', 
          color: active ? 'var(--accent)' : '#fff',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {song.title}
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {song.artist}
        </div>
      </div>

      {active && (
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          height: '2px', 
          background: 'var(--accent)',
          boxShadow: '0 0 10px var(--accent)'
        }} />
      )}
    </div>
  );
}
